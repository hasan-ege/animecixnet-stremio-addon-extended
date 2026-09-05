const header = require("../header");
const tauvideoapi = require("./api/tauvideoapi");
const { signer } = require("./signer");
require("dotenv").config();
const Axios = require('axios')
const { setupCache } = require("axios-cache-interceptor");


const instance = Axios.create();
const axios = setupCache(instance);

async function GetVideos(id, episode, season) {
    var values = [];
    try {
        if (id > 0 && episode > 0 && season > 0) {
            const query = `?titleId=${id}&episode=${episode}&season=${season}`;
            const signHeader = await signer.getHeader(query);
            const value = await axios.get(`${process.env.API_HOST}/episode-videos${query}`, {
                headers: { ...header, ...signHeader }
            }).catch((error) => {
                console.log("GetVideos error:", error.response ? error.response.status : error.message);
                return null;
            });
            if (value && value.status == 200 && Array.isArray(value.data)) {
                values = value.data;
            }
        }

        return values;
    } catch (error) {
        console.log(error);
    }

}


async function ListVideos(list) {
    var values = [];
    try {
        // defensive: if list is not an array return empty array
        if (!Array.isArray(list) || list.length === 0) {
            return values;
        }

        for (let video of list) {
            video.name = String(video.name || '').trim().toLowerCase();
            switch (video.name) {
                case "tau video":
                    var embedId = String(video.url || '').replace("https://tau-video.xyz/embed/", "")
                    var links = await tauvideoapi.VideoApi(embedId);
                    if (links && Array.isArray(links.urls)) {
                        links.urls.forEach(video2 => {
                            var size = Number(video2.size) / 1024000 || 0;
                            size = Math.round(size).toString();
                            values.push({
                                url: video.url,
                                parseUrl: video2.url,
                                label: video2.label,
                                support: "stremio",
                                size: size + " MB",
                                subName: video.extra,
                                videoProvider: "tau video || Stremiodan izlenebilir"
                            })
                        });
                    }
                    break;
                default:
                    values.push({
                        url: video.url,
                        support: "browser",
                        size: "Boyut Bilinmiyor",
                        subName: video.extra,
                        videoProvider: `${video.name} || Tarayıcıdan izlenebilir`
                    })
                    break;
            }
        }
        return values;
    } catch (error) {
        console.log(error);
    }
}




module.exports = { GetVideos, ListVideos }