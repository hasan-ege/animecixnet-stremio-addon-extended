const express = require("express");
const Axios = require('axios');
const { setupCache } = require("axios-cache-interceptor");
const header = require('../../../header');
const videos = require('../../../src/videos');
const { resolveKitsuToAnimecix, resolveImdbToAnimecix } = require('../../../src/idResolver');
const { respond } = require('../lib/http');
const { metaCache, subsCache } = require('../lib/caches');
const { parseStreamId } = require('../lib/format');

const axios = setupCache(Axios.create());

const router = express.Router();

/**
 * Akış ID'sini AnimeciX başlık/sezon/bölüm bilgisine çevirir.
 * Film ise meta önbelleğindeki `anime` alanı (hazır video listesi) da gelir.
 */
async function resolveStreamDetail(id, rawId) {
    const parsed = parseStreamId(rawId);

    if (parsed.source === 'kitsu' || parsed.source === 'imdb') {
        const resolve = parsed.source === 'kitsu' ? resolveKitsuToAnimecix : resolveImdbToAnimecix;
        const titleId = await resolve(parsed.id);
        return titleId ? { _id: titleId, season: parsed.season, episode: parsed.episode } : null;
    }

    // Önce meta önbelleğindeki bölüm listesinden bulmaya çalış
    const cachedMeta = metaCache.get(parsed.id);
    if (cachedMeta && Array.isArray(cachedMeta.videos)) {
        const found = cachedMeta.videos.find(e => e.id === id || e.id === `0-${id}`
            || (parsed.season !== null && Number(e.season) === parsed.season && Number(e.episode) === parsed.episode));
        if (found) return found;
    }

    if (parsed.season !== null) {
        return { _id: parsed.id, season: parsed.season, episode: parsed.episode };
    }

    if (!isNaN(parseInt(parsed.id, 10))) {
        // Eski eklenti versiyonlarının kaydettiği doğrudan bölüm ID'si (örn: 0-127036)
        const epRes = await axios.get(`https://animecix.tv/secure/episodes/${parsed.id}`, { headers: header }).catch(() => null);
        if (epRes && epRes.data && epRes.data.data) {
            return {
                _id: epRes.data.data.title_id,
                season: epRes.data.data.season_number || 1,
                episode: epRes.data.data.episode_number || 1
            };
        }
        return { _id: parsed.id, season: 1, episode: 1 };
    }

    return null;
}

const streamRoutes = [
    "/addon/stream/:type/:id.json",
    "/addon/stream/:type/:id",
    "/stream/:type/:id.json",
    "/stream/:type/:id",
    "/addon/stream/:type/:id/"
];

router.get(streamRoutes, async (req, res, next) => {
    try {
        var { type, id } = req.params;
        id = String(id).replace(".json", "");
        if (!id) {
            return respond(res, { streams: [] }, req);
        }

        var stream = [];
        const detail = await resolveStreamDetail(id, decodeURIComponent(id));

        if (detail && detail._id) {
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
        }

        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return respond(res, { streams: stream, cacheMaxAge: 0, staleRevalidate: 0 }, req);
    } catch (error) {
        if (error) console.log(error);
        return respond(res, { streams: [] }, req);
    }
})

module.exports = router;
