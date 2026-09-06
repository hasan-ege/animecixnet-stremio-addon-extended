const Axios = require('axios');
const NodeCache = require('node-cache');
const { SearchAnime } = require('./search');

// 24 saat önbellek
const idCache = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 600 });

/**
 * Başlık isimlerini temizler ve aramaya en uygun hale getirir.
 */
function cleanTitle(title) {
    if (!title || typeof title !== 'string') return '';
    return title
        .replace(/\(TV\)/gi, '')
        .replace(/\(Movie\)/gi, '')
        .replace(/Season \d+/gi, '')
        .replace(/\d+(st|nd|rd|th) Season/gi, '')
        .replace(/[:\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Kitsu ID'sini (örn: 46171) AnimeciX başlık ID'sine çevirir.
 */
async function resolveKitsuToAnimecix(kitsuId) {
    if (!kitsuId) return null;
    const cleanKitsuId = String(kitsuId).replace(/^kitsu:/i, '').split(/[-:]/)[0];
    const cacheKey = `kitsu_map_${cleanKitsuId}`;
    const cached = idCache.get(cacheKey);
    if (cached) return cached;

    try {
        const res = await Axios.get(`https://kitsu.io/api/edge/anime/${cleanKitsuId}`, {
            headers: {
                'Accept': 'application/vnd.api+json',
                'User-Agent': 'AnimecixStremioAddon/1.4.2'
            },
            timeout: 6000
        });

        const attr = res.data?.data?.attributes;
        if (!attr) return null;

        // Olası başlık adayları
        const titles = [
            attr.canonicalTitle,
            attr.titles?.en,
            attr.titles?.en_jp,
            attr.titles?.ja_jp
        ].filter(Boolean);

        for (const rawTitle of titles) {
            const cleaned = cleanTitle(rawTitle);
            const candidates = [rawTitle, cleaned].filter((v, i, a) => a.indexOf(v) === i);

            for (const q of candidates) {
                const results = await SearchAnime(q);
                if (Array.isArray(results) && results.length > 0) {
                    const matched = results[0];
                    const animecixId = String(matched.id).replace(/^0-/, '');
                    idCache.set(cacheKey, animecixId);
                    return animecixId;
                }
            }
        }
    } catch (e) {
        console.error(`⚠️ [IDResolver] Kitsu ${cleanKitsuId} çözme hatası:`, e.response ? e.response.status : e.message);
    }
    return null;
}

/**
 * IMDb ID'sini (örn: tt2560140) Cinemeta üzerinden AnimeciX başlık ID'sine çevirir.
 */
async function resolveImdbToAnimecix(imdbId) {
    if (!imdbId) return null;
    const cleanImdbId = String(imdbId).split(/[-:]/)[0];
    const cacheKey = `imdb_map_${cleanImdbId}`;
    const cached = idCache.get(cacheKey);
    if (cached) return cached;

    try {
        // Önce Cinemeta series, olmazsa movie dene
        let res = await Axios.get(`https://v3-cinemeta.strem.io/meta/series/${cleanImdbId}.json`, { timeout: 6000 }).catch(() => null);
        if (!res || !res.data || !res.data.meta) {
            res = await Axios.get(`https://v3-cinemeta.strem.io/meta/movie/${cleanImdbId}.json`, { timeout: 6000 }).catch(() => null);
        }

        const meta = res?.data?.meta;
        if (!meta || !meta.name) return null;

        const candidates = [meta.name, cleanTitle(meta.name)].filter((v, i, a) => a.indexOf(v) === i);

        for (const q of candidates) {
            const results = await SearchAnime(q);
            if (Array.isArray(results) && results.length > 0) {
                const matched = results[0];
                const animecixId = String(matched.id).replace(/^0-/, '');
                idCache.set(cacheKey, animecixId);
                return animecixId;
            }
        }
    } catch (e) {
        console.error(`⚠️ [IDResolver] IMDb ${cleanImdbId} çözme hatası:`, e.response ? e.response.status : e.message);
    }
    return null;
}

module.exports = {
    resolveKitsuToAnimecix,
    resolveImdbToAnimecix,
    cleanTitle
};
