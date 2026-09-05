const Axios = require('axios');
const header = require('../header');
const { saveKnownTitle } = require('./search');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'calendar_cache.json');
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 dakikada bir otomatik yenile

const WEEKDAY_MAP = {
    Mon: 'pazartesi',
    Tue: 'sali',
    Wed: 'carsamba',
    Thu: 'persembe',
    Fri: 'cuma',
    Sat: 'cumartesi',
    Sun: 'pazar'
};

const DAY_TITLES = {
    pazartesi: 'Pazartesi',
    sali: 'Salı',
    carsamba: 'Çarşamba',
    persembe: 'Perşembe',
    cuma: 'Cuma',
    cumartesi: 'Cumartesi',
    pazar: 'Pazar'
};

const DAY_GENRE_MAP = {
    'bugün': 'today',
    'bugun': 'today',
    'today': 'today',
    'pazartesi': 'pazartesi',
    'sali': 'sali',
    'salı': 'sali',
    'carsamba': 'carsamba',
    'çarşamba': 'carsamba',
    'persembe': 'persembe',
    'perşembe': 'persembe',
    'cuma': 'cuma',
    'cumartesi': 'cumartesi',
    'pazar': 'pazar',
    'tüm hafta': 'all',
    'tum hafta': 'all',
    'all': 'all'
};

const dFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Istanbul' });

// Bellek içi takvim verisi
let calendarDays = [];
let lastFetchedAt = null;
let fetchPromise = null;

// Yedek dosyadan varsa oku
try {
    if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        calendarDays = JSON.parse(raw);
        if (Array.isArray(calendarDays) && calendarDays.length > 0) {
            console.log(`📅 [Calendar] Yedek önbellekten ${calendarDays.length} günlük takvim yüklendi.`);
        }
    }
} catch (err) {
    console.error('Takvim yedek dosyası okuma hatası:', err.message);
}

/**
 * Türkiye saatine göre (Europe/Istanbul) gün anahtarını döner ('pazartesi', 'sali', vs.)
 */
function getDayKeyFromDate(dateInput) {
    if (!dateInput) return null;
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        const weekday = dFormatter.format(d);
        return WEEKDAY_MAP[weekday] || null;
    } catch {
        return null;
    }
}

/**
 * Bugünün Türkiye saatine göre gün anahtarını döner
 */
function getTodayDayKey() {
    try {
        const weekday = dFormatter.format(new Date());
        return WEEKDAY_MAP[weekday] || 'pazartesi';
    } catch {
        return 'pazartesi';
    }
}

/**
 * AnimeciX'ten takvim verisini çeker ve önbelleği günceller.
 */
async function fetchCalendarData() {
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
        try {
            const res = await Axios.get(`https://animecix.tv/secure/calendar?_t=${Date.now()}`, {
                headers: {
                    ...header,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 15000
            });

            if (res && res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
                calendarDays = res.data.data;
                lastFetchedAt = Date.now();

                // Dosyaya asenkron yedekle
                fs.writeFile(CACHE_FILE, JSON.stringify(calendarDays, null, 2), (err) => {
                    if (err) console.error('Takvim önbellek dosyası yazılamadı:', err.message);
                });

                // Bilinen başlıkları pre-cache yap (Stremio'da tıklandığında anında açılsın)
                for (const day of calendarDays) {
                    if (Array.isArray(day.episodes)) {
                        for (const ep of day.episodes) {
                            if (ep && ep.title) {
                                saveKnownTitle(ep.title);
                            }
                        }
                    }
                }

                console.log(`✅ [Calendar] AnimeciX takvimi başarıyla güncellendi (${calendarDays.length} gün).`);
            }
        } catch (err) {
            console.warn(`⚠️ [Calendar] AnimeciX takvim güncelleme hatası (${err.response ? err.response.status : err.message}). Mevcut önbellek korunuyor.`);
        } finally {
            fetchPromise = null;
        }
        return calendarDays;
    })();

    return fetchPromise;
}

/**
 * Belirli bir güne ait bölümleri bulur
 */
function getDayEpisodes(targetDayKey) {
    if (!Array.isArray(calendarDays) || calendarDays.length === 0) {
        return [];
    }

    const dayObj = calendarDays.find(d => {
        const key = getDayKeyFromDate(d.date);
        return key === targetDayKey;
    });

    return dayObj && Array.isArray(dayObj.episodes) ? dayObj.episodes : [];
}

/**
 * Takvim bölümünü Stremio meta formatına çevirir.
 * Doğrudan Stremio içerisinde dizi sayfası olarak açılır.
 */
function formatCalendarMeta(ep, dayTitle) {
    if (!ep) return null;
    const title = ep.title || {};
    const titleId = title.id || ep.title_id;
    if (!titleId) return null;

    saveKnownTitle(title);

    let id = String(titleId);
    if (!id.includes('0-')) {
        id = '0-' + id;
    }

    const name = title.name_english || title.name || ep.name || 'İsimsiz Anime';
    const seasonNum = ep.season_number || 1;
    const epNum = ep.episode_number || 1;
    const releaseText = `${seasonNum}. Sezon, ${epNum}. Bölüm`;

    const poster = ep.poster || title.poster;
    const backdrop = title.backdrop || poster;

    let desc = `📅 ${dayTitle} | 📺 ${releaseText}`;
    if (ep.name) {
        desc += ` - "${ep.name}"`;
    }
    if (ep.description) {
        desc += `\n\n${ep.description}`;
    } else if (title.description) {
        desc += `\n\n${title.description}`;
    }

    const genres = [dayTitle];
    const todayKey = getTodayDayKey();
    if (DAY_TITLES[todayKey] === dayTitle && !genres.includes('Bugün')) {
        genres.unshift('Bugün');
    }
    if (Array.isArray(title.genres)) {
        title.genres.forEach(g => {
            const gName = g.display_name || g.name;
            if (gName && !genres.includes(gName)) genres.push(gName);
        });
    }

    return {
        id: id,
        type: 'series',
        name: name,
        poster: poster,
        background: backdrop,
        releaseInfo: releaseText,
        description: desc,
        genres: genres
    };
}

/**
 * Belirtilen katalog ID ve kategoriye (genre) göre Stremio meta listesini döner.
 * 'genre' boş ise veya 'Bugün' ise bugünün animelerini döner.
 * 'Tüm Hafta' ise tüm haftanın animelerini döner.
 */
async function getCatalogMetas(catalogId, genre = null) {
    // Önbellek boşsa veya çok eskiyse tazele
    if (!calendarDays || calendarDays.length === 0 || !lastFetchedAt || (Date.now() - lastFetchedAt > REFRESH_INTERVAL_MS)) {
        await fetchCalendarData();
    }

    let target = 'today';

    if (genre) {
        const cleanGenre = String(genre).trim().toLowerCase();
        target = DAY_GENRE_MAP[cleanGenre] || cleanGenre;
    } else if (catalogId === 'animecix_takvim_bugun') {
        target = 'today';
    } else if (catalogId && catalogId.startsWith('animecix_takvim_')) {
        const dayPart = catalogId.replace('animecix_takvim_', '').toLowerCase();
        target = DAY_GENRE_MAP[dayPart] || dayPart;
    } else {
        target = 'today';
    }

    const metas = [];
    const seenIds = new Set();

    if (target === 'all') {
        if (Array.isArray(calendarDays)) {
            for (const day of calendarDays) {
                const dayKey = getDayKeyFromDate(day.date);
                const dayTitle = DAY_TITLES[dayKey] || 'Yayın';
                if (Array.isArray(day.episodes)) {
                    for (const ep of day.episodes) {
                        const titleId = (ep.title && ep.title.id) || ep.title_id;
                        if (titleId && !seenIds.has(titleId)) {
                            seenIds.add(titleId);
                            const meta = formatCalendarMeta(ep, dayTitle);
                            if (meta) metas.push(meta);
                        }
                    }
                }
            }
        }
        return metas;
    }

    const targetDayKey = target === 'today' ? getTodayDayKey() : target;
    const dayTitle = DAY_TITLES[targetDayKey];
    if (!dayTitle) {
        return [];
    }

    const episodes = getDayEpisodes(targetDayKey);
    for (const ep of episodes) {
        const titleId = (ep.title && ep.title.id) || ep.title_id;
        if (titleId && !seenIds.has(titleId)) {
            seenIds.add(titleId);
            const meta = formatCalendarMeta(ep, dayTitle);
            if (meta) {
                metas.push(meta);
            }
        }
    }

    return metas;
}

/**
 * Sunucu açıldığında arka plan yenileme döngüsünü başlatır.
 */
function initCalendarService() {
    fetchCalendarData().catch(() => {});

    setInterval(() => {
        fetchCalendarData().catch(() => {});
    }, REFRESH_INTERVAL_MS);
}

module.exports = {
    initCalendarService,
    fetchCalendarData,
    getCatalogMetas,
    getTodayDayKey,
    DAY_TITLES,
    DAY_GENRE_MAP
};
