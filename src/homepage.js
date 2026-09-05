const Axios = require('axios');
const header = require('../header');
const NodeCache = require('node-cache');

const homeCache = new NodeCache({ stdTTL: 15 * 60, checkperiod: 120 }); // 15 dakika önbellek
const { saveKnownTitle } = require('./search');
const { signer } = require('./signer');

async function getHomepageLists() {
    try {
        const cached = homeCache.get('homepage_lists');
        if (cached) return cached;

        const signHeader = await signer.getHeader('');
        const res = await Axios.get('https://animecix.tv/secure/homepage/lists', {
            headers: {
                ...header,
                ...signHeader
            },
            timeout: 10000
        });

        if (res && res.data && Array.isArray(res.data.lists)) {
            homeCache.set('homepage_lists', res.data.lists);
            return res.data.lists;
        }
    } catch (e) {
        console.error('getHomepageLists error:', e.message);
    }
    return [];
}

function formatAnimeItem(element, targetType) {
    if (!element) return null;
    saveKnownTitle(element);

    let id = String(element.id);
    if (!id.includes('0-')) {
        id = '0-' + id;
    }
    const name = element.name_english || element.name || 'İsimsiz Anime';
    let type = element.type;
    if (!type) {
        type = (element.title_type === 'anime' || element.is_series) ? 'series' : (element.title_type || 'series');
    }

    if (targetType && type !== targetType) {
        // Eğer targetType movies ise ve bu series ise geç, ya da tam tersi
        return null;
    }

    const genres = [];
    if (Array.isArray(element.genres)) {
        element.genres.forEach(g => {
            if (g && (g.display_name || g.name)) {
                genres.push(g.display_name || g.name);
            }
        });
    }

    return {
        id: id,
        type: type,
        name: name,
        poster: element.poster,
        background: element.backdrop,
        description: element.description || '',
        releaseInfo: element.year ? String(element.year) : undefined,
        imdbRating: element.mal_vote_average || element.tmdb_vote_average || undefined,
        genres: genres
    };
}

async function getCatalogMetas(catalogId, type, genreFilter) {
    const lists = await getHomepageLists();
    let items = [];

    if (catalogId === 'animecix_son_cikanlar') {
        const list = lists.find(l => l.name.includes('Son Çıkan') || l.name.includes('Son'));
        items = list ? list.items : [];
    } else if (catalogId === 'animecix_sezonun_incileri') {
        const list = lists.find(l => l.name.includes('Sezonun') || l.name.includes('İncileri'));
        items = list ? list.items : [];
    } else if (catalogId === 'animecix_en_iyiler') {
        const list = lists.find(l => l.name.includes('Yüksek Puan') || l.name.includes('En'));
        items = list ? list.items : [];
    } else if (catalogId === 'animecix_gelecek') {
        const list = lists.find(l => l.name.includes('Gelecek'));
        items = list ? list.items : [];
    } else {
        // animecix ana kataloğu: Tüm listelerdeki öğeleri topla, duplicate'leri ayıkla
        const seenIds = new Set();
        // Öncelik: Son çıkanlar -> Sezonun incileri -> En yüksek puanlılar
        lists.forEach(l => {
            if (Array.isArray(l.items)) {
                l.items.forEach(item => {
                    if (!seenIds.has(item.id)) {
                        seenIds.add(item.id);
                        items.push(item);
                    }
                });
            }
        });
    }

    let metas = [];
    items.forEach(item => {
        const formatted = formatAnimeItem(item, type);
        if (formatted) {
            if (genreFilter) {
                // Tür filtresi varsa kontrol et
                const hasGenre = formatted.genres.some(g => g.toLowerCase().includes(genreFilter.toLowerCase()));
                if (hasGenre) {
                    metas.push(formatted);
                }
            } else {
                metas.push(formatted);
            }
        }
    });

    return metas;
}

module.exports = { getHomepageLists, getCatalogMetas, formatAnimeItem };
