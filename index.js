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
const { connectionTracker } = require("./src/connectionTracker");
const { getStatsHTML } = require("./src/statsTemplate");
const { resolveKitsuToAnimecix, resolveImdbToAnimecix } = require("./src/idResolver");
const instance = Axios.create();
const axios = setupCache(instance);

calendarService.initCalendarService();

const myCache = new NodeCache({ stdTTL: 30 * 60, checkperiod: 120 });

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
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Origin, X-Requested-With, *');
    res.setHeader('Access-Control-Expose-Headers', '*');
    res.setHeader('ngrok-skip-browser-warning', 'true');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).end();
    }

    const { isNew, client, isIgnored } = connectionTracker.onStart(req);

    let ended = false;
    const endReq = () => {
        if (!ended) {
            ended = true;
            connectionTracker.onEnd(isIgnored);
        }
    };
    res.on('finish', endReq);
    res.on('close', endReq);

    if (!isIgnored && !req.url.startsWith('/images') && !req.url.startsWith('/subs')) {
        const activeCount = connectionTracker.getActiveCount(5 * 60 * 1000);
        const inFlight = connectionTracker.activeRequests;

        if (isNew && client) {
            console.log(`✨ [Yeni Bağlantı] 🟢 Yeni kullanıcı bağlandı: ${client.maskedIp} (${client.device}) | 👥 Toplam Aktif: ${activeCount}`);
        }

        console.log(`📡 [${req.method}] ${req.url} — 👥 ${activeCount} aktif kullanıcı | ⚡ ${inFlight} anlık istek`);
    }
    next();
});

// Altyazı URL eşleşmeleri için sınırlı bellek önbelleği
const subsCache = new NodeCache({ stdTTL: 2 * 60 * 60, checkperiod: 300 });

var respond = function (res, data, req = null) {
    const origin = req?.headers?.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!res.getHeader('Access-Control-Allow-Origin')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning, Accept, Origin, X-Requested-With, *');
    res.setHeader('Access-Control-Expose-Headers', '*');
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

function getLandingHTML(manifest, baseUrl) {
    const manifestUrl = `${baseUrl}/manifest.json`;
    const stremioUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');
    const stremioWebUrl = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${manifest.name} - Stremio Eklentisi</title>
    <link rel="icon" href="/images/animecix.png" type="image/png">
    <meta http-equiv="refresh" content="0; url=${stremioUrl}">
    <style>
        :root {
            --bg-color: #0c0d14;
            --card-bg: rgba(22, 24, 35, 0.96);
            --primary: #7c4dff;
            --primary-hover: #651fff;
            --secondary-bg: #26293d;
            --secondary-hover: #323652;
            --text-color: #ffffff;
            --text-dim: #9e9eb4;
            --border: rgba(255, 255, 255, 0.08);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            background-image: radial-gradient(circle at 50% 20%, rgba(124, 77, 255, 0.18) 0%, transparent 70%);
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 40px 32px;
            max-width: 460px;
            width: 100%;
            text-align: center;
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(12px);
            animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .logo-wrap {
            margin: 0 auto 20px;
            width: 90px;
            height: 90px;
            position: relative;
        }
        .logo {
            width: 100%;
            height: 100%;
            border-radius: 20px;
            object-fit: cover;
            box-shadow: 0 10px 25px rgba(124, 77, 255, 0.35);
        }
        .title-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        h1 {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .version {
            font-size: 13px;
            background: rgba(124, 77, 255, 0.22);
            color: #c5b3ff;
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid rgba(124, 77, 255, 0.35);
            font-weight: 600;
        }
        .desc {
            color: var(--text-dim);
            font-size: 14.5px;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .redirect-notice {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13.5px;
            color: #4ade80;
            background: rgba(74, 222, 128, 0.1);
            padding: 8px 16px;
            border-radius: 20px;
            margin-bottom: 26px;
            font-weight: 500;
        }
        .pulse {
            width: 8px;
            height: 8px;
            background: #4ade80;
            border-radius: 50%;
            box-shadow: 0 0 10px #4ade80;
            animation: pulseAnim 1.6s infinite ease-in-out;
        }
        @keyframes pulseAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.6; }
        }
        .btn-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 14px 20px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }
        .btn-primary {
            background: var(--primary);
            color: #ffffff;
            box-shadow: 0 8px 20px rgba(124, 77, 255, 0.35);
        }
        .btn-primary:hover {
            background: var(--primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(124, 77, 255, 0.45);
        }
        .btn-secondary {
            background: var(--secondary-bg);
            color: #ffffff;
            border: 1px solid var(--border);
        }
        .btn-secondary:hover {
            background: var(--secondary-hover);
            transform: translateY(-2px);
        }
        .hint {
            margin-top: 22px;
            font-size: 12.5px;
            color: var(--text-dim);
            line-height: 1.5;
        }
        #toast {
            display: none;
            position: fixed;
            bottom: 28px;
            left: 50%;
            transform: translateX(-50%);
            background: #22c55e;
            color: white;
            padding: 10px 22px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 6px 18px rgba(0,0,0,0.4);
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo-wrap">
            <img class="logo" src="/images/animecix.png" alt="AnimeciX">
        </div>
        <div class="title-row">
            <h1>${manifest.name}</h1>
            <span class="version">v${manifest.version}</span>
        </div>
        <p class="desc">${manifest.description}</p>
        <div class="redirect-notice">
            <span class="pulse"></span> Stremio'ya yönlendiriliyor...
        </div>

        <div class="btn-group">
            <a href="${stremioUrl}" class="btn btn-primary" id="installBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Stremio ile Kur
            </a>
            <a href="${stremioWebUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" id="webInstallBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Stremio Web ile Kur
            </a>
            <button class="btn btn-secondary" onclick="copyManifest()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Manifest URL'sini Kopyala
            </button>
        </div>

        <p class="hint">
            Stremio otomatik açılmadıysa yukarıdaki <strong>Stremio ile Kur</strong> butonuna tıklayabilirsiniz.<br>
            <span style="color: #c4b5fd; display: inline-block; margin-top: 6px;">💡 Stremio Web kullanıcıları: Tarayıcınızda ilk girişte ngrok güvenlik ekranı çıkarsa bir defaya mahsus <strong>"Visit Site"</strong> butonuna basınız.</span>
        </p>
    </div>

    <div id="toast">Manifest linki kopyalandı!</div>

    <script>
        (function() {
            const dynamicManifestUrl = window.location.origin + '/manifest.json';
            const dynamicStremioUrl = 'stremio://' + window.location.host + '/manifest.json';
            const dynamicWebUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(dynamicManifestUrl);

            const installBtn = document.getElementById('installBtn');
            const webBtn = document.getElementById('webInstallBtn');
            if (installBtn) installBtn.href = dynamicStremioUrl;
            if (webBtn) webBtn.href = dynamicWebUrl;

            try {
                window.location.href = dynamicStremioUrl;
            } catch (err) {
                console.warn(err);
            }

            window.copyManifest = function() {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(dynamicManifestUrl).then(showToast);
                } else {
                    prompt('Manifest URL:', dynamicManifestUrl);
                }
            };

            function showToast() {
                const toast = document.getElementById('toast');
                if (!toast) return;
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 2500);
            }
        })();
    </script>
</body>
</html>`;
}

// Tarayıcıdan girildiğinde otomatik Stremio'ya yönlendirir / Kurulum arayüzü sunar;
// Stremio Web, mobil veya API girerse 302 yerine doğrudan manifest.json döndürür (CORS hatasını önler).
app.get('/', function (req, res) {
    const acceptHeader = req.headers['accept'] || '';
    const origin = req.headers['origin'] || '';
    const isBrowser = acceptHeader.includes('text/html') && !origin.includes('stremio') && req.headers['sec-fetch-dest'] !== 'empty';

    if (!isBrowser) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const baseUrl = getBaseUrl(req);
        const dynamicManifest = {
            ...MANIFEST,
            logo: `${baseUrl}/images/animecix.png`,
            background: `${baseUrl}/images/background.png`
        };
        return respond(res, dynamicManifest, req);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const baseUrl = getBaseUrl(req);
    return res.send(getLandingHTML(MANIFEST, baseUrl));
});

// Canlı bağlantı ve kullanıcı istatistikleri arayüzü ve API uç noktaları
app.get('/stats', function (req, res) {
    const wantsJson = req.query.json === 'true' || 
                      req.query.format === 'json' || 
                      (req.headers['accept'] && req.headers['accept'].includes('application/json') && !req.headers['accept'].includes('text/html'));

    if (wantsJson) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        return res.json(connectionTracker.getStats());
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const baseUrl = getBaseUrl(req);
    return res.send(getStatsHTML(baseUrl));
});

// JSON İstatistik API'si
app.get('/api/stats', function (req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.json(connectionTracker.getStats());
});

// SSE (Server-Sent Events) Gerçek Zamanlı Veri Akışı
app.get('/api/stats/stream', function (req, res) {
    connectionTracker.addSseClient(res);
});

// İstatistikleri ve aktif kullanıcıları sıfırlama (Clear) uç noktası
app.all('/api/stats/clear', function (req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const cleared = connectionTracker.clear();
    return res.json(cleared);
});

app.get(['/manifest.json', '/addon/manifest.json', '/:userConf/manifest.json'], function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const baseUrl = getBaseUrl(req);
    const dynamicManifest = {
        ...MANIFEST,
        logo: `${baseUrl}/images/animecix.png`,
        background: `${baseUrl}/images/background.png`
    };
    return respond(res, dynamicManifest, req);
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
        const effectiveType = (type === "movie" ? "movie" : "series");
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

        // 1. Takvim Kataloğu (Kategori Takvimi: Bugün, Pazartesi, Salı, ... Tüm Hafta & animecix-calendar uyumluluğu)
        if (id.startsWith("animecix_takvim") || id.includes("calendar") || id === "animecix-calendar") {
            let genreFilter = extra.genre;
            if (!genreFilter && (extraArgs === "today" || extraArgs === "today.json")) {
                genreFilter = "Bugün";
            }
            let metas = await calendarService.getCatalogMetas(id, genreFilter);
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
            }, req);
        }

        // 2. Ana AnimeciX Dizileri & Filmleri Kataloğu (Tüm Veritabanı: 2500+ Dizi, 500+ Film)
        if (id === "animecix") {
            const metas = await titleBrowseService.getBrowseMetas({
                type: effectiveType,
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
            }, req);
        }

        // 3. Özel Ana Sayfa Listeleri (Son Çıkanlar, Sezonun İncileri, En İyiler)
        if (id.startsWith("animecix")) {
            let metas = await homepage.getCatalogMetas(id, effectiveType, extra.genre);
            if (extra.search) {
                const sLow = extra.search.toLowerCase();
                metas = metas.filter(m => (m.name || '').toLowerCase().includes(sLow));
            }
            return respond(res, {
                metas: metas,
                cacheMaxAge: CACHE_MAX_AGE,
                staleRevalidate: STALE_REVALIDATE_AGE,
                staleError: STALE_ERROR_AGE
            }, req);
        }

        return respond(res, { metas: [] }, req);
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { metas: [] }, req);
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
                return respond(res, { meta: metaObj, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE }, req);
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
                return respond(res, { meta: metaObj, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE }, req);
            }
        } else {
            return respond(res, { meta: {} }, req);
        }
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { meta: {} }, req);
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

            const rawId = decodeURIComponent(id);

            // 1. Kitsu ID Desteği (kitsu:46171:1, kitsu:46171:1:1 veya kitsu:46171)
            if (rawId.startsWith('kitsu:')) {
                const kParts = rawId.split(':');
                const kitsuId = kParts[1];
                let season = 1;
                let episode = 1;

                if (kParts.length >= 4) {
                    season = parseInt(kParts[2], 10) || 1;
                    episode = parseInt(kParts[3], 10) || 1;
                } else if (kParts.length >= 3) {
                    episode = parseInt(kParts[2], 10) || 1;
                }

                const animecixTitleId = await resolveKitsuToAnimecix(kitsuId);
                if (animecixTitleId) {
                    detail = {
                        _id: animecixTitleId,
                        season: season,
                        episode: episode
                    };
                }
            }
            // 2. IMDb ID Desteği (tt2560140:1:1 veya tt2560140)
            else if (rawId.startsWith('tt')) {
                const ttParts = rawId.split(':');
                const imdbId = ttParts[0];
                let season = 1;
                let episode = 1;

                if (ttParts.length >= 3) {
                    season = parseInt(ttParts[1], 10) || 1;
                    episode = parseInt(ttParts[2], 10) || 1;
                } else if (ttParts.length >= 2) {
                    episode = parseInt(ttParts[1], 10) || 1;
                }

                const animecixTitleId = await resolveImdbToAnimecix(imdbId);
                if (animecixTitleId) {
                    detail = {
                        _id: animecixTitleId,
                        season: season,
                        episode: episode
                    };
                }
            }
            // 3. Standart AnimeciX ID Desteği (0-titleId-season-episode veya 0-titleId:season:episode)
            else {
                const cleanId = rawId.replace(/^0-/, "");
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
            }

            if (typeof (detail) != "undefined" && detail._id) {
                // initialize defaults
                let streamLinks = [];
                let typeValue = [];

                if (type === "series" || type === "anime") {
                    const getVideo = await videos.GetVideos(detail._id, detail.episode, detail.season);
                    if (Array.isArray(getVideo) && getVideo.length > 0) {
                        streamLinks = await videos.ListVideos(getVideo);
                        typeValue = getVideo; // use raw provider objects for subtitle/caption checks
                    }
                } else {
                    if (detail.anime && Array.isArray(detail.anime.videos) && detail.anime.videos.length > 0) {
                        streamLinks = await videos.ListVideos(detail.anime.videos);
                        typeValue = detail.anime.videos; // use raw provider objects for subtitle/caption checks
                    } else {
                        // Film için 1. bölüm veya videoları dene
                        const getVideo = await videos.GetVideos(detail._id, 1, 1);
                        if (Array.isArray(getVideo) && getVideo.length > 0) {
                            streamLinks = await videos.ListVideos(getVideo);
                            typeValue = getVideo;
                        }
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
                return respond(res, { streams: stream, cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE }, req);
            }

            return respond(res, { streams: [] }, req);
        }

        return respond(res, { streams: [] }, req);
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { streams: [] }, req);
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
                    return respond(res, { subtitles: [subtitles], cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE }, req);
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
                        return respond(res, { subtitles: [subtitles], cacheMaxAge: CACHE_MAX_AGE, staleRevalidate: STALE_REVALIDATE_AGE, staleError: STALE_ERROR_AGE }, req);
                    }
                }
            }
            return respond(res, { subtitles: [] }, req);
        }
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { subtitles: [] }, req);
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
