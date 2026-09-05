const { publishToCentral } = require('stremio-addon-sdk')
require("dotenv").config();
if (!process.env.HOSTING_URL && process.env.RENDER_EXTERNAL_URL) {
    process.env.HOSTING_URL = process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
}
const searchVideo = require("./src/search");
const MANIFEST = require('./manifest');
const videos = require("./src/videos");
const Path = require("path");
const express = require("express");
const app = express();
const header = require('./header');
const fs = require('fs')
const subsrt = require('subtitle-converter');
const path = require('path');
const ass2srt = require('ass-to-srt');
const Axios = require('axios')
const { setupCache } = require("axios-cache-interceptor");
const NodeCache = require("node-cache");
const scrapeProxy = require("./src/scrapeProxyCookie");
const catalogs = require("./src/catalogs.json");
const homepage = require("./src/homepage");
const episodeService = require("./src/episodeService");
const calendarService = require("./src/calendarService");
const titleBrowseService = require("./src/titleBrowseService");
const { signer } = require("./src/signer");
const instance = Axios.create();
const axios = setupCache(instance);

calendarService.initCalendarService();

const myCache = new NodeCache({ stdTTL: 30 * 60, maxKeys: 300, checkperiod: 120 });

/**
 * Türkçe başlık düzeni (Bağlaçlar hariç her kelimenin ilk harfi büyük).
 */
function toTurkishTitleCase(str) {
    if (!str) return '';
    const conjunctions = new Set([
        've', 'ile', 'veya', 'ama', 'fakat', 'lakin', 'ancak', 'de', 'da', 'ki', 'mi', 'mu', 'mü', 'mı', 'ise', 'ya', 'yahut'
    ]);

    const words = str.split(/\s+/);
    const formattedWords = words.map((word, index) => {
        if (!word) return '';
        const lower = word.toLocaleLowerCase('tr-TR');
        const cleanWord = lower.replace(/[^a-zçğıöşü]/gi, '');

        if (['ova', 'tv', 'ona', 'bd', 'dvd'].includes(cleanWord)) {
            return lower.toUpperCase();
        }

        // DIO veya DIO'nun gibi büyük harfli kelimeleri koru
        const basePart = word.split(/['’]/)[0].replace(/[^A-Za-zÇĞİÖŞÜ]/g, '');
        if (basePart.length >= 2 && basePart === basePart.toUpperCase() && !conjunctions.has(cleanWord)) {
            const parts = word.split(/['’]/);
            if (parts.length > 1) {
                return parts[0].toUpperCase() + "'" + parts.slice(1).join("'").toLocaleLowerCase('tr-TR');
            }
            return word.toUpperCase();
        }

        if (index > 0 && conjunctions.has(cleanWord)) {
            return lower;
        }

        return lower.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (match, prefix, firstChar, rest) => {
            return prefix + firstChar.toLocaleUpperCase('tr-TR') + rest;
        });
    });

    return formattedWords.join(' ');
}

/**
 * Bölüm başlıklarını temizler ve Türkçeleştirir.
 * "1. Bölüm", "Bölüm 1", "Episode 1" gibi jenerik başlıkları "Bölüm 1" yapar.
 * "1. Bölüm: Başlangıç" veya "Bölüm 1 - Başlangıç" gibi başlıklardan "Başlangıç" adını çıkarır.
 */
function formatEpisodeTitle(rawTitle, ep) {
    if (!rawTitle || typeof rawTitle !== 'string') return `Bölüm ${ep}`;
    let title = rawTitle.trim();

    const isGenericEpisode = new RegExp(`^(?:bölüm\\s*${ep}|${ep}\\.?\\s*bölüm|episode\\s*${ep}|ep\\.?\\s*${ep}|#?${ep})$`, 'i');
    if (isGenericEpisode.test(title)) {
        return `Bölüm ${ep}`;
    }

    const prefixRegex = new RegExp(`^(?:bölüm\\s*${ep}|${ep}\\.?\\s*bölüm|episode\\s*${ep}|ep\\.?\\s*${ep}|${ep})\\s*[-–:.]\\s*`, 'i');
    title = title.replace(prefixRegex, '').trim();
    title = title.replace(/^[-–:.]\\s*/, '').trim();

    if (!title) {
        return `Bölüm ${ep}`;
    }

    return toTurkishTitleCase(title);
}

const CACHE_MAX_AGE = 4 * 60 * 60; // 4 hours in seconds
const STALE_REVALIDATE_AGE = 4 * 60 * 60; // 4 hours
const STALE_ERROR_AGE = 7 * 24 * 60 * 60; // 7 days

app.use('/images', express.static(path.join(__dirname, "static", "images"), { maxAge: '7d' }));
app.use('/subs', express.static(path.join(__dirname, "static", "subs"), { maxAge: '1d' }));

app.use((req, res, next) => {
    if (!req.url.startsWith('/images') && !req.url.startsWith('/subs')) {
        console.log(`📡 [${req.method}] ${req.url}`);
    }
    next();
});

// Altyazı URL eşleşmeleri için sınırlı bellek önbelleği
const subsCache = new NodeCache({ stdTTL: 2 * 60 * 60, maxKeys: 300, checkperiod: 300 });

var respond = function (res, data) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(data);
};

function getBaseUrl(req) {
    if (process.env.HOSTING_URL && !process.env.HOSTING_URL.includes('localhost') && !process.env.HOSTING_URL.includes('127.0.0.1')) {
        return process.env.HOSTING_URL.replace(/\/+$/, '');
    }
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${process.env.PORT || 7000}`;
    return `${proto}://${host}`;
}

// Web arayüzü yerine hafif JSON durumu döner
app.get('/', function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const baseUrl = getBaseUrl(req);
    return res.json({
        name: MANIFEST.name,
        version: MANIFEST.version,
        description: MANIFEST.description,
        status: "online",
        manifest: `${baseUrl}/addon/manifest.json`
    });
});

app.get(['/manifest.json', '/addon/manifest.json', '/:userConf/manifest.json'], function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const baseUrl = getBaseUrl(req);
    const dynamicManifest = {
        ...MANIFEST,
        logo: `${baseUrl}/images/animecix.png`,
        background: `${baseUrl}/images/background.png`
    };
    return respond(res, dynamicManifest);
});


function parseCatalogExtra(extraString, queryParams = {}) {
    const extra = { ...queryParams };
    if (!extraString) return extra;
    const clean = extraString.replace(/\.json$/, "");
    const pairs = clean.split("&");
    for (const pair of pairs) {
        const [k, v] = pair.split("=");
        if (k && v !== undefined) {
            extra[decodeURIComponent(k)] = decodeURIComponent(v);
        }
    }
    return extra;
}

// Ana sayfa, Takvim, Arama ve Tüm Veritabanı Katalogları
async function handleCatalogRequest(req, res) {
    try {
        let { type, id, extraArgs, genre, search } = req.params;
        id = (id || '').replace(".json", "");
        const extra = parseCatalogExtra(extraArgs, req.query);
        if (genre) {
            const cleanGenre = decodeURIComponent(genre.replace(".json", ""));
            if (cleanGenre.includes("&")) {
                Object.assign(extra, parseCatalogExtra("genre=" + cleanGenre));
            } else {
                extra.genre = cleanGenre;
            }
        }
        if (search) {
            const cleanSearch = decodeURIComponent(search.replace(".json", ""));
            if (cleanSearch.includes("&")) {
                Object.assign(extra, parseCatalogExtra("search=" + cleanSearch));
            } else {
                extra.search = cleanSearch;
            }
        }

        // 1. Takvim Kataloğu (Kategori Takvimi: Bugün, Pazartesi, Salı, ... Tüm Hafta)
        if (id.startsWith("animecix_takvim")) {
            let metas = await calendarService.getCatalogMetas(id, extra.genre);
            if (extra.search) {
                const sLow = extra.search.toLowerCase();
                metas = metas.filter(m => (m.name || '').toLowerCase().includes(sLow));
            }
            res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
            return respond(res, {
                metas: metas,
                cacheMaxAge: 300,
                staleRevalidate: 600,
                staleError: 1800
            });
        }

        // 2. Ana AnimeciX Dizileri & Filmleri Kataloğu (Tüm Veritabanı: 2500+ Dizi, 500+ Film)
        if (id === "animecix") {
            const metas = await titleBrowseService.getBrowseMetas({
                type: type === "movie" ? "movie" : "series",
                genre: extra.genre || null,
                search: extra.search || null,
                skip: extra.skip ? parseInt(extra.skip, 10) : 0,
                perPage: 50
            });
            return respond(res, {
                metas: metas,
                cacheMaxAge: CACHE_MAX_AGE,
                staleRevalidate: STALE_REVALIDATE_AGE,
                staleError: STALE_ERROR_AGE
            });
        }

        // 3. Özel Ana Sayfa Listeleri (Son Çıkanlar, Sezonun İncileri, En İyiler)
        if (id.startsWith("animecix")) {
            let metas = await homepage.getCatalogMetas(id, type, extra.genre);
            if (extra.search) {
                const sLow = extra.search.toLowerCase();
                metas = metas.filter(m => (m.name || '').toLowerCase().includes(sLow));
            }
            return respond(res, {
                metas: metas,
                cacheMaxAge: CACHE_MAX_AGE,
                staleRevalidate: STALE_REVALIDATE_AGE,
                staleError: STALE_ERROR_AGE
            });
        }

        return respond(res, { metas: [] });
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { metas: [] });
    }
}

const catalogRoutes = [
    "/addon/catalog/:type/:id.json",
    "/addon/catalog/:type/:id",
    "/catalog/:type/:id.json",
    "/catalog/:type/:id",
    "/addon/catalog/:type/:id/genre=:genre.json",
    "/addon/catalog/:type/:id/genre=:genre",
    "/catalog/:type/:id/genre=:genre.json",
    "/catalog/:type/:id/genre=:genre",
    "/addon/catalog/:type/:id/search=:search.json",
    "/addon/catalog/:type/:id/search=:search",
    "/catalog/:type/:id/search=:search.json",
    "/catalog/:type/:id/search=:search",
    "/addon/catalog/:type/:id/:extraArgs.json",
    "/addon/catalog/:type/:id/:extraArgs",
    "/catalog/:type/:id/:extraArgs.json",
    "/catalog/:type/:id/:extraArgs"
];

app.get(catalogRoutes, handleCatalogRequest);

const metaRoutes = [
    "/addon/meta/:type/:id.json",
    "/addon/meta/:type/:id",
    "/meta/:type/:id.json",
    "/meta/:type/:id",
    "/addon/meta/:type/:id/",
    "/meta/:type/:id/"
];

app.get(metaRoutes, async (req, res, next) => {
    try {
        var { type, id } = req.params;
        id = id.replace(".json", "");
        if (id) {

            var findId = String(id).substring(2).replace(".json", "");
            var cached = myCache.get(findId);
            if (cached && cached.name && !cached.name.startsWith("Anime ") && cached.poster) {
                return respond(res, { meta: cached, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE });
            }
            var metaObj = {};

            var find = await searchVideo.FindAnimeDetail(findId);
            if (!find) {
                return respond(res, { meta: {} });
            }

            const animeName = (find.name_english && String(find.name_english).trim() !== '') 
                ? String(find.name_english).trim() 
                : (find.name || `Anime ${findId}`);

            if (find.type === null || find.type === '') {
                find.type = (find.title_type === "anime" || find.is_series) ? "series" : (find.title_type || type || "series");
            }

            const metaGenres = [];
            if (Array.isArray(find.genres)) {
                find.genres.forEach(element => {
                    const gName = element.display_name || element.name;
                    if (gName && !metaGenres.includes(gName)) {
                        metaGenres.push(gName);
                    }
                });
            }

            const seasonsCount = Array.isArray(find.seasons) && find.seasons.length > 0 ? find.seasons.length : 1;
            const imdbRating = Number(find.rating || find.mal_vote_average || find.tmdb_vote_average || 0);

            metaObj = {
                id: id,
                type: type,
                name: animeName,
                background: find.backdrop || find.poster,
                country: find.country || "JP",
                genres: metaGenres,
                season: seasonsCount,
                videos: [],
                imdbRating: isNaN(imdbRating) || imdbRating <= 0 ? undefined : imdbRating,
                description: find.description || "",
                releaseInfo: find.year ? String(find.year) : (find.release_date ? String(find.release_date).substring(0, 4) : undefined),
                poster: find.poster,
                posterShape: 'poster',
            };

            //series or movie check
            if (type === "series") {
                const titleImages = Array.isArray(find.images) ? find.images.filter(img => img && img.url) : [];
                const epResolver = await episodeService.resolveEpisodesMetadata(find);

                if (Array.isArray(find.seasons) && find.seasons.length > 0) {
                    for (let i = 0; i < find.seasons.length; i++) {
                        const seasonObj = find.seasons[i];
                        const sNum = seasonObj.number || (i + 1);
                        const epCount = seasonObj.episode_count || 1;

                        for (let ep = 1; ep <= epCount; ep++) {
                            const epInfo = epResolver ? epResolver.getEpisodeInfo(sNum, ep) : null;
                            const rawTitle = (epInfo && epInfo.title) ? epInfo.title : `Bölüm ${ep}`;
                            const epTitle = formatEpisodeTitle(rawTitle, ep);

                            const epThumb = (epInfo && epInfo.thumbnail) 
                                ? epInfo.thumbnail 
                                : (titleImages.length > 0 
                                    ? titleImages[(ep - 1) % titleImages.length].url 
                                    : (seasonObj.poster || find.backdrop || find.poster));
                            const epOverview = (epInfo && epInfo.description) ? epInfo.description : (seasonObj.overview || find.description || "");

                            metaObj.videos.push({
                                id: `0-${findId}-${sNum}-${ep}`,
                                _id: findId,
                                title: epTitle,
                                released: new Date("2024-01-01"),
                                season: sNum,
                                episode: ep,
                                overview: epOverview,
                                thumbnail: epThumb
                            });
                        }
                    }
                }
                if (metaObj.name && !metaObj.name.startsWith("Anime ")) {
                    myCache.set(findId, metaObj);
                }
                return respond(res, { meta: metaObj, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE });
            } else {
                //movie
                var animes = await searchVideo.SearchVideoDetail(type, findId, find.name_english, 1);
                var videos = [];
                if (animes && !String(animes.id).includes("0-")) {
                    animes.id = "0-" + animes.id;
                }
                const movieThumb = find.backdrop || find.poster;
                videos.push({
                    id: (animes && animes.id) ? animes.id : `0-${findId}-1-1`,
                    _id: findId,
                    title: find.name_english || find.name || "Film",
                    released: new Date(find.release_date || "2024-01-01"),
                    thumbnail: movieThumb,
                    overview: find.description || "",
                    season: 1,
                    episode: 1,
                    anime: animes
                });
                metaObj.videos = videos;
                if (metaObj.name && !metaObj.name.startsWith("Anime ")) {
                    myCache.set(findId, metaObj);
                }
                return respond(res, { meta: metaObj, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE });
            }
        } else {
            return respond(res, { meta: {} });
        }
    } catch (error) {
        if (error) console.log(error);
    }

})



const streamRoutes = [
    "/addon/stream/:type/:id.json",
    "/addon/stream/:type/:id",
    "/stream/:type/:id.json",
    "/stream/:type/:id",
    "/addon/stream/:type/:id/"
];

app.get(streamRoutes, async (req, res, next) => {
    try {
        var { type, id } = req.params;
        id = String(id).replace(".json", "");
        if (id) {
            var stream = [];
            var detail = {};
            var typeValue;

            // ID'den akıllı ayrıştırma fallback (0-titleId-season-episode veya 0-titleId:season:episode)
            const cleanId = decodeURIComponent(id).replace(/^0-/, "");
            const parts = cleanId.split(/[-:]/);
            const titleId = parts[0];

            // Önce myCache içerisindeki meta nesnesinden bulmaya çalış
            const cachedMeta = myCache.get(titleId);
            if (cachedMeta && Array.isArray(cachedMeta.videos)) {
                const found = cachedMeta.videos.find(e => e.id === id || e.id === `0-${id}` || (parts.length >= 3 && e.season == parts[1] && e.episode == parts[2]));
                if (found) {
                    detail = found;
                }
            }

            if ((!detail || !detail._id) && parts.length >= 3) {
                detail = {
                    _id: parts[0],
                    season: parseInt(parts[1], 10) || 1,
                    episode: parseInt(parts[2], 10) || 1
                };
            } else if ((!detail || !detail._id) && parts.length === 1 && !isNaN(parseInt(parts[0], 10))) {
                // Eski eklenti versiyonlarının kaydettiği doğrudan bölüm ID'si (örn: 0-127036)
                const epRes = await axios.get(`https://animecix.tv/secure/episodes/${parts[0]}`, { headers: header }).catch(() => null);
                if (epRes && epRes.data && epRes.data.data) {
                    detail = {
                        _id: epRes.data.data.title_id,
                        season: epRes.data.data.season_number || 1,
                        episode: epRes.data.data.episode_number || 1
                    };
                } else {
                    detail = {
                        _id: parts[0],
                        season: 1,
                        episode: 1
                    };
                }
            }

            if (typeof (detail) != "undefined") {
                // initialize defaults
                let streamLinks = [];
                let typeValue = [];

                if (type === "series") {
                    const getVideo = await videos.GetVideos(detail._id, detail.episode, detail.season);
                    if (Array.isArray(getVideo) && getVideo.length > 0) {
                        streamLinks = await videos.ListVideos(getVideo);
                        typeValue = getVideo; // use raw provider objects for subtitle/caption checks
                    }
                } else {
                    if (detail.anime && Array.isArray(detail.anime.videos) && detail.anime.videos.length > 0) {
                        streamLinks = await videos.ListVideos(detail.anime.videos);
                        typeValue = detail.anime.videos; // use raw provider objects for subtitle/caption checks
                    }
                }

                for (const element of typeValue) {
                    element.extra = String(element.extra || '').trim().toLocaleLowerCase();
                    element.name = String(element.name || '').trim().toLocaleLowerCase();
                    if (element.extra.includes("yapay") || element.extra === '' || element.extra === "null") {
                        if (element.name === "tau video") {
                            if (element && Array.isArray(element.captions) && typeof (element.captions[0]) !== "undefined") {
                                subsCache.set(id, element.captions[0].url);
                                break;
                            }
                        }
                    }
                }

                streamLinks.forEach(element => {
                    if (element.support == "stremio") {
                        stream.push({
                            url: element.parseUrl,
                            name: element.label + "\n" + element.subName,
                            description: element.videoProvider + "\n" + element.size,
                        });
                    } else {
                        stream.push({
                            externalUrl: element.url,
                            name: "Animecix \n" + element.subName,
                            description: element.videoProvider + "\n" + element.size,
                        });
                    }
                });
                return respond(res, { streams: stream, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE })
            }

        }
    } catch (error) {
        if (error) console.log(error);
    }
})

let lastSubClean = 0;
function CheckSubtitleFoldersAndFiles() {
    const now = Date.now();
    // En fazla 30 dakikada bir kontrol et (CPU ve I/O yükünü önlemek için)
    if (now - lastSubClean < 30 * 60 * 1000) return;
    lastSubClean = now;

    try {
        const folderPath = path.join(__dirname, "static", "subs");
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            return;
        }

        const files = fs.readdirSync(folderPath);
        if (files.length > 200) {
            for (const file of files) {
                const filePath = path.join(folderPath, file);
                try {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } catch (e) {}
            }
        }
    } catch (error) {
        console.log("CheckSubtitleFoldersAndFiles error:", error.message);
    }
}

const subtitleRoutes = [
    "/addon/subtitles/:type/:id/:query?.json",
    "/addon/subtitles/:type/:id/:query?",
    "/subtitles/:type/:id/:query?.json",
    "/subtitles/:type/:id/:query?",
    "/addon/subtitles/:type/:id.json",
    "/subtitles/:type/:id.json"
];

app.get(subtitleRoutes, async (req, res, next) => {
    try {
        var { type, id } = req.params;
        id = id.replace(".json", "");
        if (id) {
            const captionUrl = subsCache.get(id);
            if (captionUrl) {
                var localUrl = `${getBaseUrl(req)}/subs/${id}/${id}.srt`;
                const subtitles = {
                    id: "animecix-" + id,
                    lang: "tur",
                    url: localUrl
                };

                CheckSubtitleFoldersAndFiles();

                const existingSub = path.join(__dirname, "static", "subs", id, `${id}.srt`);
                if (fs.existsSync(existingSub)) {
                    return respond(res, { subtitles: [subtitles], cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE });
                }

                var downloadUrl = `${process.env.SUBTITLEAI_URL + new URL(captionUrl).pathname}`;
                var subtitleHeader = {
                    "User-Agent": `${process.env.USERAGENT}`,
                    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "Windows",
                };

                var response = await axios.get(downloadUrl, { method: "GET", headers: subtitleHeader });
                if (response && response.status == 200 && response.statusText == "OK") {
                    var subtitle = "";
                    if (Path.extname(downloadUrl) !== ".srt" && Path.extname(downloadUrl) !== ".ass") {
                        const outputExtension = '.srt';
                        const options = {
                            removeTextFormatting: true,
                        };
                        subtitle = subsrt.convert(response.data, outputExtension, options).subtitle;
                    } else if (Path.extname(downloadUrl) === ".ass") {
                        subtitle = ass2srt(response.data);
                    } else if (Path.extname(downloadUrl) === ".srt") {
                        subtitle = response.data;
                    }

                    if (subtitle !== '') {
                        const subDir = path.join(__dirname, "static", "subs", id);
                        if (!fs.existsSync(subDir)) {
                            fs.mkdirSync(subDir, { recursive: true });
                        }
                        fs.writeFileSync(path.join(subDir, `${id}.srt`), subtitle, { encoding: "utf8" });
                        return respond(res, { subtitles: [subtitles], cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE });
                    }
                }
            }
            return respond(res, { subtitles: [] });
        }
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { subtitles: [] });
    }
})


if (module.parent) {
    module.exports = app;
} else {
    const os = require('os');
    function getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    const PORT = process.env.PORT || 7000;
    app.listen(PORT, '0.0.0.0', function (err) {
        if (err) {
            return console.error("Error :" + err);
        }
        const localIP = getLocalIP();
        const displayUrl = process.env.HOSTING_URL || `http://${localIP}:${PORT}`;
        console.log(`\n✅ Eklenti çalışıyor! Port: ${PORT}\n`);
        console.log(`   Yerel:   http://localhost:${PORT}`);
        console.log(`   Ağ:      http://${localIP}:${PORT}\n`);
        console.log(`   📦 Eklenti URL:     http://${localIP}:${PORT}/addon/manifest.json`);
        console.log(`   🔗 Stremio Install: stremio://addon/${localIP}:${PORT}/addon/manifest.json\n`);
    });

    process.on('SIGINT', () => {
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        process.exit(0);
    });
}
