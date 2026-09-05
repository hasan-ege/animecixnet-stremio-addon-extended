const Axios = require('axios');
const NodeCache = require('node-cache');

const kitsuCache = new NodeCache({ stdTTL: 12 * 60 * 60, checkperiod: 300 }); // 12 saat önbellek

const KITSU_HEADERS = {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'User-Agent': 'AnimecixStremioAddon/1.0'
};

/**
 * Animenin İngilizce veya orijinal adına göre Kitsu'dan bölüm başlıklarını ve kapak resimlerini çeker.
 * @param {string} animeName Animenin adı
 * @returns {Promise<Object>} { [episodeNumber]: { title: string, thumbnail: string } }
 */
async function getAnimeEpisodesInfo(animeName) {
    const episodeMap = {};
    if (!animeName || typeof animeName !== 'string') return episodeMap;

    const cleanName = animeName
        .replace(/\(TV\)/gi, '')
        .replace(/:/g, ' ')
        .trim();

    const cacheKey = `kitsu_${cleanName.toLowerCase()}`;
    const cached = kitsuCache.get(cacheKey);
    if (cached) return cached;

    try {
        // 1. Animeyi ara
        const searchUrl = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(cleanName)}&page[limit]=1`;
        const searchRes = await Axios.get(searchUrl, { headers: KITSU_HEADERS, timeout: 6000 });

        if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
            const animeId = searchRes.data.data[0].id;

            // 2. Bölümleri çek (sayfa başı 20, en fazla 5 sayfa = 100 bölüm)
            for (let offset = 0; offset < 100; offset += 20) {
                const epUrl = `https://kitsu.io/api/edge/anime/${animeId}/episodes?page[limit]=20&page[offset]=${offset}&sort=number`;
                const epRes = await Axios.get(epUrl, { headers: KITSU_HEADERS, timeout: 6000 }).catch(() => null);

                if (!epRes || !epRes.data || !Array.isArray(epRes.data.data) || epRes.data.data.length === 0) {
                    break;
                }

                epRes.data.data.forEach(ep => {
                    const epNum = ep.attributes.number;
                    const titles = ep.attributes.titles || {};
                    const epTitle = titles.en_us || titles.en || titles.en_jp || ep.attributes.canonicalTitle;
                    const thumb = ep.attributes.thumbnail ? (ep.attributes.thumbnail.original || ep.attributes.thumbnail.medium) : null;

                    if (epNum) {
                        episodeMap[epNum] = {
                            title: epTitle || null,
                            thumbnail: thumb || null
                        };
                    }
                });

                if (epRes.data.data.length < 20) break;
            }
        }
    } catch (e) {
        // Hata durumunda sessizce boş nesne dön
    }

    kitsuCache.set(cacheKey, episodeMap);
    return episodeMap;
}

module.exports = { getAnimeEpisodesInfo };
