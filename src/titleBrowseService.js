const crypto = require('crypto');
const Axios = require('axios');
const header = require('../header');
const catalogs = require('./catalogs.json');
const { saveKnownTitle } = require('./search');
const NodeCache = require('node-cache');

const browseCache = new NodeCache({ stdTTL: 60 * 60 }); // 1 saat önbellek

const { signer } = require('./signer');

function formatBrowseItem(item, targetType) {
    if (!item) return null;
    saveKnownTitle(item);

    let id = String(item.id);
    if (!id.includes('0-')) {
        id = '0-' + id;
    }

    const name = item.name_english || item.name || 'İsimsiz Anime';
    let type = targetType || item.type;
    if (!type) {
        type = (item.title_type === 'anime' || item.is_series) ? 'series' : (item.title_type || 'series');
    }

    const genres = [];
    if (Array.isArray(item.genres)) {
        item.genres.forEach(g => {
            const gName = g.display_name || g.name;
            if (gName && !genres.includes(gName)) genres.push(gName);
        });
    }

    return {
        id: id,
        type: type,
        name: name,
        poster: item.poster,
        background: item.backdrop || item.poster,
        description: item.description || '',
        releaseInfo: item.year ? String(item.year) : undefined,
        imdbRating: item.mal_vote_average || item.tmdb_vote_average || undefined,
        genres: genres
    };
}

/**
 * AnimeciX veritabanındaki tüm anime ve filmleri sayfalı ve filtreli olarak çeker.
 * @param {Object} options { type, genre, search, skip, perPage }
 */
async function getBrowseMetas({ type = 'series', genre = null, search = null, skip = 0, perPage = 50 }) {
    const page = skip ? Math.floor(parseInt(skip, 10) / perPage) + 1 : 1;
    const cacheKey = `browse_${type}_${genre || 'all'}_${search || 'all'}_p${page}_pp${perPage}`;

    const cached = browseCache.get(cacheKey);
    if (cached) return cached;

    try {
        const params = {
            type: type === 'movie' ? 'movie' : 'series',
            page: page,
            perPage: perPage
        };

        if (genre) {
            // catalogs.json eşlemesi (Türkçe -> İngilizce)
            const mappedGenre = catalogs[genre] || genre.toLowerCase();
            params.genre = mappedGenre;
        }

        if (search) {
            params.query = search.trim();
        }

        const queryStr = Object.keys(params)
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
        const signPath = '/?' + queryStr;
        const signHeader = await signer.getHeader(signPath);

        const res = await Axios.get('https://animecix.tv/secure/titles', {
            headers: {
                ...header,
                ...signHeader
            },
            params: params,
            timeout: 10000
        });

        if (res && res.data && res.data.pagination && Array.isArray(res.data.pagination.data)) {
            const metas = [];
            for (const item of res.data.pagination.data) {
                const formatted = formatBrowseItem(item, type);
                if (formatted) metas.push(formatted);
            }
            browseCache.set(cacheKey, metas);
            return metas;
        }
    } catch (err) {
        console.error(`❌ [Browse] AnimeciX veritabanından çekme hatası (${type}, sayfa ${page}):`, err.response ? err.response.status : err.message);
    }

    return [];
}

module.exports = {
    getBrowseMetas,
    formatBrowseItem
};
