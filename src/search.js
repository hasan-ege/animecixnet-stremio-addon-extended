const header = require("../header");
require("dotenv").config()
const Axios = require('axios')
const { setupCache } = require("axios-cache-interceptor");


const instance = Axios.create();
const axios = setupCache(instance);


const NodeCache = require("node-cache");
const knownTitles = new NodeCache({ stdTTL: 6 * 60 * 60, checkperiod: 300 }); // 6 saat TTL, otomatik süresi dolanları temizle

function saveKnownTitle(titleObj) {
    if (titleObj && titleObj.id) {
        try {
            knownTitles.set(Number(titleObj.id), titleObj);
        } catch (e) {
            // Önbellek hatası akışı asla bozmamalı
        }
    }
}

async function SearchAnime(name) {
    var values = [];
    name = String(name).replace(" ", "-");
    try {
        await axios.get(`${process.env.API_HOST}/search/${name}?limit=200`, { headers: header }).then((value) => {
            if (value && value.status == 200 && value.statusText == "OK") {
                if (value && typeof (value.data.results) !== "undefined") {
                    values = value.data.results;
                    values.forEach(item => saveKnownTitle(item));
                }
            }
        })
    } catch (error) {
        if (error) console.log(error);
    }
    return values;
}

const { signer } = require('./signer');

async function fetchAniListDescription(malId, animeName) {
    try {
        const query = `
        query ($idMal: Int, $search: String) {
            Media (idMal: $idMal, search: $search, type: ANIME) {
                description(asHtml: false)
            }
        }
        `;
        const variables = malId ? { idMal: parseInt(malId) } : { search: animeName };
        const res = await Axios.post('https://graphql.anilist.co', { query, variables }, { timeout: 4000 });
        if (res.data && res.data.data && res.data.data.Media && res.data.data.Media.description) {
            return res.data.data.Media.description.replace(/<[^>]*>/g, '').trim();
        }
    } catch (e) {}
    return null;
}

async function FindAnimeDetail(id) {
    var values;
    try {
        const numId = parseInt(id, 10);
        if (!isNaN(numId) && numId > 0) {
            // 1. Doğrudan AnimeciX imzalı API (secure/titles/:id) üzerinden çek
            const signHeader = await signer.getHeader("");
            const res = await Axios.get(`https://animecix.tv/secure/titles/${numId}`, {
                headers: { ...header, ...signHeader },
                timeout: 8000
            }).catch(() => null);

            if (res && res.data && res.data.title && res.data.title.id == numId) {
                values = res.data.title;
                saveKnownTitle(values);
            }

            // 2. Eğer secure/titles başarısız olursa bilinen başlıklardan (arama veya katalog) al
            if (!values) {
                values = knownTitles.get(numId);
            }

            // 3. Bilinenlerde de yoksa (örn. kütüphaneden doğrudan açıldıysa), videos API üzerinden anime oluştur
            if (!values) {
                const vRes = await Axios.get(`https://animecix.tv/secure/videos?titleId=${numId}&perPage=50`, { headers: header, timeout: 6000 }).catch(() => null);
                if (vRes && vRes.data && vRes.data.pagination && Array.isArray(vRes.data.pagination.data) && vRes.data.pagination.data.length > 0) {
                    const firstVid = vRes.data.pagination.data[0];
                    let epName = 'Anime ' + numId;
                    let epDesc = '';
                    let epPoster = firstVid.thumbnail || '';

                    if (firstVid.episode_id) {
                        const epRes = await Axios.get(`https://animecix.tv/secure/episodes/${firstVid.episode_id}`, { headers: header, timeout: 5000 }).catch(() => null);
                        if (epRes && epRes.data && epRes.data.data) {
                            const epD = epRes.data.data;
                            epName = epD.old_name || epD.name || epName;
                            epDesc = epD.description || '';
                            if (epD.poster) epPoster = epD.poster;
                        }
                    }

                    values = {
                        id: numId,
                        name: epName,
                        name_english: epName,
                        description: epDesc,
                        poster: epPoster,
                        backdrop: epPoster,
                        genres: [],
                        seasons: []
                    };
                    saveKnownTitle(values);
                }
            }

            // 4. Açıklama boşsa AniList'ten çek
            if (values && (!values.description || String(values.description).trim() === '')) {
                const desc = await fetchAniListDescription(values.mal_id, values.name_english || values.name);
                if (desc) {
                    values.description = desc;
                }
            }

            // 5. Eğer seasons yoksa, videos API'sinden sezon ve bölüm yapısını dinamik kur
            if (values) {
                if (!Array.isArray(values.seasons) || values.seasons.length === 0) {
                    const vRes = await Axios.get(`https://animecix.tv/secure/videos?titleId=${numId}&perPage=200`, { headers: header, timeout: 6000 }).catch(() => null);
                    if (vRes && vRes.data && vRes.data.pagination && Array.isArray(vRes.data.pagination.data)) {
                        const seasonMap = new Map();
                        vRes.data.pagination.data.forEach(v => {
                            const s = v.season_num || 1;
                            const ep = v.episode_num || 1;
                            const cur = seasonMap.get(s) || 0;
                            if (ep > cur) seasonMap.set(s, ep);
                        });
                        values.seasons = [];
                        seasonMap.forEach((maxEp, sNum) => {
                            values.seasons.push({
                                number: sNum,
                                episode_count: maxEp,
                                name: `Sezon ${sNum}`,
                                poster: values.poster
                            });
                        });
                        if (values.seasons.length === 0) {
                            values.seasons = [{ number: 1, episode_count: 1, name: 'Sezon 1', poster: values.poster }];
                        }
                    }
                }
            }
        }
    } catch (error) {
        if (error) console.log(error);
    }
    return values;
}

async function FindAnimeId(name, _id) {
    var values;
    name = String(name).replace(" ", "-");
    try {
        await axios.get(`${process.env.API_HOST}/search/${name}?limit=200`, { headers: header }).then((value) => {
            if (value && value.status == 200 && value.statusText == "OK") {
                for (const element of value.data.results) {
                    if (element._id === _id) {
                        values = element.id;
                    }
                }
            }
        })
    } catch (error) {
        console.log(error);
    }

    return values;
}

async function SearchVideoDetail(type, id, name, seasonNumber) {
    var values;
    try {
        if (id > 0) {
            const query = `?seasonNumber=${seasonNumber || 1}&perPage=200`;
            const signHeader = await signer.getHeader(query);
            const res = await Axios.get(`https://animecix.tv/secure/titles/${id}${query}`, {
                headers: { ...header, ...signHeader },
                timeout: 8000
            }).catch(() => null);

            if (res && res.data && res.data.title) {
                if (type === "series") {
                    if (res.data.title.season && res.data.title.season.episodePagination) {
                        values = res.data.title.season.episodePagination.data;
                    } else if (Array.isArray(res.data.title.episodes) && res.data.title.episodes.length > 0) {
                        values = res.data.title.episodes;
                    }
                } else {
                    values = res.data.title;
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
    return values;
}

module.exports = { SearchAnime, FindAnimeDetail, FindAnimeId, SearchVideoDetail, saveKnownTitle }