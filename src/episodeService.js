const Axios = require('axios');
const header = require('../header');
const NodeCache = require('node-cache');
const { signer } = require('./signer');

const episodeCache = new NodeCache({ stdTTL: 12 * 60 * 60, checkperiod: 300 }); // 12 saat önbellek

/**
 * AnimeciX resmi sezon API'si üzerinden o sezondaki tüm bölümlerin
 * orijinal isimlerini, açıklamalarını ve afişlerini çeker.
 */
async function getOfficialSeasonEpisodes(titleId, seasonNum) {
    const map = new Map();
    try {
        const q1 = `?seasonNumber=${seasonNum}&page=1&perPage=200`;
        const h1 = await signer.getHeader(q1);
        const r1 = await Axios.get(`https://animecix.tv/secure/titles/${titleId}${q1}`, {
            headers: { ...header, ...h1 },
            timeout: 8000
        }).catch(() => null);

        const pag = r1?.data?.title?.season?.episodePagination;
        if (!pag || !Array.isArray(pag.data)) return map;

        pag.data.forEach(ep => {
            if (ep.episode_number) {
                map.set(`${seasonNum}-${ep.episode_number}`, {
                    title: ep.name || null,
                    description: ep.description || null,
                    thumbnail: ep.poster || null,
                    poster: ep.poster || null
                });
            }
        });

        if (pag.last_page > 1) {
            const pagePromises = [];
            const maxPage = Math.min(pag.last_page, 10);
            for (let p = 2; p <= maxPage; p++) {
                pagePromises.push((async () => {
                    const qp = `?seasonNumber=${seasonNum}&page=${p}&perPage=200`;
                    const hp = await signer.getHeader(qp);
                    const rp = await Axios.get(`https://animecix.tv/secure/titles/${titleId}${qp}`, {
                        headers: { ...header, ...hp },
                        timeout: 8000
                    }).catch(() => null);
                    return rp?.data?.title?.season?.episodePagination?.data || [];
                })());
            }
            const rest = await Promise.all(pagePromises);
            rest.forEach(pageData => {
                pageData.forEach(ep => {
                    if (ep.episode_number) {
                        map.set(`${seasonNum}-${ep.episode_number}`, {
                            title: ep.name || null,
                            description: ep.description || null,
                            thumbnail: ep.poster || null,
                            poster: ep.poster || null
                        });
                    }
                });
            });
        }
    } catch(e) {}
    return map;
}

/**
 * AnimeciX'in kendi veritabanından (videos ve secure/episodes/:id) 
 * tüm bölümlerin orijinal Türkçe isimlerini, açıklamalarını ve kapak görsellerini çeker (Fallback).
 * @param {number|string} titleId AnimeciX title ID
 * @returns {Promise<Map<string, { title: string, description: string, thumbnail: string, poster: string }>>}
 */
async function getAnimecixEpisodes(titleId) {
    const map = new Map();
    try {
        // 1. İlk sayfayı çek ve toplam sayfa sayısını öğren
        const firstRes = await Axios.get(`https://animecix.tv/secure/videos?titleId=${titleId}&page=1&perPage=200`, {
            headers: header,
            timeout: 8000
        }).catch(() => null);

        if (!firstRes || !firstRes.data || !firstRes.data.pagination || !Array.isArray(firstRes.data.pagination.data)) {
            return map;
        }

        let allVideos = firstRes.data.pagination.data;
        const lastPage = Math.min(firstRes.data.pagination.last_page || 1, 25);

        // 2. Kalan tüm sayfaları (JoJo, One Piece gibi serilerin tüm sezonlarını kapsayacak şekilde) paralel çek
        if (lastPage > 1) {
            const pagePromises = [];
            for (let p = 2; p <= lastPage; p++) {
                pagePromises.push(
                    Axios.get(`https://animecix.tv/secure/videos?titleId=${titleId}&page=${p}&perPage=200`, {
                        headers: header,
                        timeout: 7000
                    }).then(r => (r && r.data && r.data.pagination && Array.isArray(r.data.pagination.data)) ? r.data.pagination.data : [])
                      .catch(() => [])
                );
            }
            const restPages = await Promise.all(pagePromises);
            restPages.forEach(pData => {
                allVideos = allVideos.concat(pData);
            });
        }

        // Her (season, episode) için video thumbnail'larını ve aday episode_id'leri topla
        const epCandidates = new Map(); // key -> Set of episode_ids
        const thumbMap = new Map(); // key -> thumbnail

        for (const v of allVideos) {
            if (!v.episode_num) continue;
            const season = v.season_num || 1;
            const key = `${season}-${v.episode_num}`;

            if (v.thumbnail && !v.thumbnail.includes('random') && !v.thumbnail.includes('null')) {
                if (!thumbMap.has(key)) thumbMap.set(key, v.thumbnail);
            }

            if (v.episode_id) {
                if (!epCandidates.has(key)) epCandidates.set(key, new Set());
                epCandidates.get(key).add(v.episode_id);
            }
        }

        // Her bölüm için en fazla 2 aday episode_id seçerek sorgu yükünü azalt
        const prioritizedIds = new Set();
        for (const ids of epCandidates.values()) {
            const arr = Array.from(ids);
            if (arr.length > 0) prioritizedIds.add(arr[0]);
            if (arr.length > 1) prioritizedIds.add(arr[1]);
        }

        // 10'arlı gruplar halinde, 429 korumalı ve retry destekli olarak AnimeciX veritabanından çek
        const epDataCache = new Map(); // episode_id -> { name, description, poster }
        const idList = Array.from(prioritizedIds);
        const chunkSize = 10;

        for (let i = 0; i < idList.length; i += chunkSize) {
            const chunk = idList.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async id => {
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const epRes = await Axios.get(`https://animecix.tv/secure/episodes/${id}`, {
                            headers: header,
                            timeout: 4000
                        });
                        if (epRes.data && epRes.data.data && epRes.data.data.name) {
                            epDataCache.set(id, {
                                name: epRes.data.data.name.trim(),
                                description: epRes.data.data.description ? epRes.data.data.description.trim() : null,
                                poster: epRes.data.data.poster || null
                            });
                        }
                        break;
                    } catch (e) {
                        if (e.response && e.response.status === 429) {
                            // Rate limit durumunda bekle ve tekrar dene
                            await new Promise(r => setTimeout(r, 400));
                        } else {
                            break;
                        }
                    }
                }
            }));
            if (i + chunkSize < idList.length) {
                await new Promise(r => setTimeout(r, 50));
            }
        }

        // Her sezon ve bölüm için ilk çalışan Türkçe veriyi eşle
        for (const [key, idSet] of epCandidates.entries()) {
            let foundData = null;
            for (const id of idSet) {
                if (epDataCache.has(id)) {
                    foundData = epDataCache.get(id);
                    break;
                }
            }

            const thumbnail = thumbMap.get(key) || null;
            if (foundData) {
                map.set(key, {
                    title: foundData.name,
                    description: foundData.description,
                    poster: foundData.poster,
                    thumbnail: foundData.poster || thumbnail
                });
            } else if (thumbnail) {
                map.set(key, {
                    title: null,
                    description: null,
                    poster: null,
                    thumbnail: thumbnail
                });
            }
        }
    } catch (e) {
        // Hata durumunda sessizce devam et
    }
    return map;
}

/**
 * AniList GraphQL API üzerinden animenin bölüm isimlerini ve thumbnail'larını çeker (Fallback).
 * @param {number} malId MyAnimeList ID
 * @param {string} animeName Anime adı
 * @returns {Promise<Map<number, { title: string, thumbnail: string }>>}
 */
async function getAniListEpisodes(malId, animeName) {
    const map = new Map();
    try {
        const query = `
        query ($idMal: Int, $search: String) {
            Media (idMal: $idMal, search: $search, type: ANIME) {
                id
                streamingEpisodes {
                    title
                    thumbnail
                }
            }
        }
        `;
        const variables = malId ? { idMal: parseInt(malId) } : { search: animeName };
        const res = await Axios.post('https://graphql.anilist.co', { query, variables }, { timeout: 6000 });

        if (res.data && res.data.data && res.data.data.Media && Array.isArray(res.data.data.Media.streamingEpisodes)) {
            res.data.data.Media.streamingEpisodes.forEach(ep => {
                if (ep && ep.title) {
                    const match = ep.title.match(/Episode\s+(\d+)(?:\s*-\s*(.+))?/i);
                    if (match) {
                        const epNum = parseInt(match[1]);
                        const epTitle = match[2] ? match[2].trim() : null;
                        map.set(epNum, {
                            title: epTitle,
                            thumbnail: ep.thumbnail || null
                        });
                    }
                }
            });
        }
    } catch (e) {
        // AniList başarısız olursa sessizce geç
    }
    return map;
}

/**
 * Kitsu API üzerinden animenin bölüm isimlerini ve thumbnail'larını çeker (Fallback).
 * @param {string} animeName Anime adı
 * @returns {Promise<Map<number, { title: string, thumbnail: string }>>}
 */
async function getKitsuEpisodes(animeName) {
    const map = new Map();
    if (!animeName) return map;
    try {
        const clean = animeName.replace(/\(TV\)/gi, '').replace(/:/g, ' ').trim();
        const headers = { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' };
        const searchRes = await Axios.get(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(clean)}&page[limit]=1`, { headers, timeout: 5000 });

        if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
            const animeId = searchRes.data.data[0].id;
            const epRes = await Axios.get(`https://kitsu.io/api/edge/anime/${animeId}/episodes?page[limit]=50&sort=number`, { headers, timeout: 5000 });
            if (epRes.data && Array.isArray(epRes.data.data)) {
                epRes.data.data.forEach(ep => {
                    const epNum = ep.attributes.number;
                    const titles = ep.attributes.titles || {};
                    const epTitle = titles.en_us || titles.en || titles.en_jp || ep.attributes.canonicalTitle;
                    const thumb = ep.attributes.thumbnail ? ep.attributes.thumbnail.original : null;
                    if (epNum) {
                        map.set(epNum, {
                            title: epTitle || null,
                            thumbnail: thumb || null
                        });
                    }
                });
            }
        }
    } catch (e) {
        // Kitsu başarısız olursa sessizce geç
    }
    return map;
}

const KNOWN_SPECIALS = {
    // Mushoku Tensei 1. Sezon 24. Bölüm (OVA - Goblin Keser Eris)
    '7350-1-24': {
        title: 'OVA - Goblin Keser Eris',
        poster: 'https://image.tmdb.org/t/p/original/gLKOYIMyKlUHW0SVdskhgf9C0yy.jpg',
        description: 'Bu bölüm için henüz bir genel bakışımız yok.'
    },
    '7350-2-0': {
        title: 'Koruma Fitz',
        poster: 'https://image.tmdb.org/t/p/original/sS93JaHkWvhecsmgSdg5MFel3y5.jpg',
        description: null
    },
    // Mushoku Tensei 3. Sezon 11. Bölüm (Dönüm Noktası 4)
    '7350-3-11': {
        title: 'Dönüm Noktası 4',
        poster: 'https://image.tmdb.org/t/p/original/gLKOYIMyKlUHW0SVdskhgf9C0yy.jpg',
        description: null
    }
};

/**
 * Tüm kaynakları birleştirerek bölüm başlıkları ve thumbnail haritası üretir.
 * Bölüm isimleri SADECE AnimeciX'in Türkçe veritabanından çekilir.
 * Harici servisler (AniList/Kitsu) sadece eksik kapak görselleri için fallback olarak kullanılır.
 */
async function resolveEpisodesMetadata(find) {
    const cacheKey = `ep_meta_${find.id}`;
    const cached = episodeCache.get(cacheKey);
    if (cached) return cached;

    const animeName = find.name_english || find.name;
    const seasons = Array.isArray(find.seasons) && find.seasons.length > 0 ? find.seasons : [{ number: 1 }];

    // 1. ÖNCELİK: AnimeciX Resmi Sezon API'sinden tüm sezonların bölümlerini paralel çek
    const seasonPromises = seasons.map(s => getOfficialSeasonEpisodes(find.id, s.number || 1));
    const officialSeasonMaps = await Promise.all(seasonPromises);
    const officialMap = new Map();
    officialSeasonMaps.forEach(sMap => {
        for (const [k, v] of sMap.entries()) {
            officialMap.set(k, v);
        }
    });

    // 2. Harici kaynakları (AniList, Kitsu) paralel başlat (görsel/başlık fallback için)
    const [anilistMap, kitsuMap, cixVideosMap] = await Promise.all([
        getAniListEpisodes(find.mal_id, animeName),
        getKitsuEpisodes(animeName),
        // Sadece officialMap tamamen boşsa videos API'sini dene
        officialMap.size === 0 ? getAnimecixEpisodes(find.id) : Promise.resolve(new Map())
    ]);

    const result = {
        getEpisodeInfo(seasonNum, episodeNum) {
            const key = `${seasonNum}-${episodeNum}`;

            let title = null;
            let thumbnail = null;
            let description = null;

            // 1. ÖNCELİK: AnimeciX Resmi Sezon Veritabanı
            if (officialMap.has(key)) {
                const off = officialMap.get(key);
                if (off.title) title = off.title;
                if (off.thumbnail) thumbnail = off.thumbnail;
                else if (off.poster) thumbnail = off.poster;
                if (off.description) description = off.description;
            }

            // 2. Yedek: AnimeciX Video Yüklemeleri Veritabanı
            if (!title && cixVideosMap.has(key)) {
                const cix = cixVideosMap.get(key);
                if (cix.title) title = cix.title;
                if (!thumbnail) thumbnail = cix.poster || cix.thumbnail;
                if (!description && cix.description) description = cix.description;
            }

            // 3. Özel / OVA Bölümleri
            const specialKey = `${find.id}-${seasonNum}-${episodeNum}`;
            if (KNOWN_SPECIALS[specialKey]) {
                const sp = KNOWN_SPECIALS[specialKey];
                if (!title && sp.title) title = sp.title;
                if (!thumbnail && sp.poster) thumbnail = sp.poster;
                if (!description && sp.description) description = sp.description;
            }

            // 4. Başlık Fallback (AniList -> Kitsu)
            if (!title) {
                if (anilistMap.has(episodeNum) && anilistMap.get(episodeNum).title) {
                    title = anilistMap.get(episodeNum).title;
                } else if (kitsuMap.has(episodeNum) && kitsuMap.get(episodeNum).title) {
                    title = kitsuMap.get(episodeNum).title;
                }
            }

            // 5. Thumbnail Fallback (AniList -> Kitsu)
            if (!thumbnail) {
                if (anilistMap.has(episodeNum) && anilistMap.get(episodeNum).thumbnail) {
                    thumbnail = anilistMap.get(episodeNum).thumbnail;
                } else if (kitsuMap.has(episodeNum) && kitsuMap.get(episodeNum).thumbnail) {
                    thumbnail = kitsuMap.get(episodeNum).thumbnail;
                }
            }

            return { title, thumbnail, description };
        }
    };

    episodeCache.set(cacheKey, result);
    return result;
}

module.exports = { resolveEpisodesMetadata };
