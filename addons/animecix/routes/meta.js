const express = require("express");
const searchVideo = require('../../../src/search');
const episodeService = require('../../../src/episodeService');
const { respond } = require('../lib/http');
const { metaCache } = require('../lib/caches');
const { formatEpisodeTitle, resolveReleaseDate } = require('../lib/format');

const router = express.Router();

const metaRoutes = [
    "/addon/meta/:type/:id.json",
    "/addon/meta/:type/:id",
    "/meta/:type/:id.json",
    "/meta/:type/:id",
    "/addon/meta/:type/:id/",
    "/meta/:type/:id/"
];

router.get(metaRoutes, async (req, res, next) => {
    try {
        var { type, id } = req.params;
        id = id.replace(".json", "");
        if (id) {

            var findId = String(id).substring(2).replace(".json", "");
            var cached = metaCache.get(findId);
            if (cached && cached.name && !cached.name.startsWith("Anime ") && cached.poster) {
                return respond(res, { meta: cached, cacheMaxAge: 120, staleRevalidate: 60, staleError: 300 });
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
                                released: resolveReleaseDate(epInfo && epInfo.released, find),
                                season: sNum,
                                episode: ep,
                                overview: epOverview,
                                thumbnail: epThumb
                            });
                        }
                    }
                }
                if (metaObj.name && !metaObj.name.startsWith("Anime ")) {
                    metaCache.set(findId, metaObj);
                }
                return respond(res, { meta: metaObj, cacheMaxAge: 120, staleRevalidate: 60, staleError: 300 }, req);
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
                    released: resolveReleaseDate(find.release_date, find),
                    thumbnail: movieThumb,
                    overview: find.description || "",
                    season: 1,
                    episode: 1,
                    anime: animes
                });
                metaObj.videos = videos;
                if (metaObj.name && !metaObj.name.startsWith("Anime ")) {
                    metaCache.set(findId, metaObj);
                }
                return respond(res, { meta: metaObj, cacheMaxAge: 120, staleRevalidate: 60, staleError: 300 }, req);
            }
        } else {
            return respond(res, { meta: {} }, req);
        }
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { meta: {} }, req);
    }

})



module.exports = router;
