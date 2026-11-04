const express = require("express");
const homepage = require('../../../src/homepage');
const calendarService = require('../../../src/calendarService');
const titleBrowseService = require('../../../src/titleBrowseService');
const { respond } = require('../lib/http');
const { parseCatalogExtra } = require('../lib/format');

const router = express.Router();

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
                cacheMaxAge: 120, staleRevalidate: 60, staleError: 300
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
                cacheMaxAge: 120, staleRevalidate: 60, staleError: 300
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

router.get(catalogRoutes, handleCatalogRequest);

module.exports = router;
