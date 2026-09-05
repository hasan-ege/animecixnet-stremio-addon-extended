const Axios = require('axios')
const { setupCache } = require("axios-cache-interceptor");

const instance = Axios.create();
const axios = setupCache(instance);


const NodeCache = require("node-cache");
const tauCache = new NodeCache({ stdTTL: 2 * 60 * 60, checkperiod: 300 }); // 2 saatlik önbellek

async function VideoApi(code) {
    try {
        if (!code || code.length === 0) return [];

        const cached = tauCache.get(code);
        if (cached) return cached;

        var Headers = {
            "Content-Type": "application/json",
            "User-Agent": process.env.USERAGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://tau-video.xyz/",
            "Origin": "https://tau-video.xyz"
        };
        const apiUrl = `https://tau-video.xyz/api/video/${code}`;
        const res = await Axios.get(apiUrl, { headers: Headers, timeout: 8000 }).catch((error) => {
            if (error.response && error.response.status === 429) {
                console.log(`⚠️ Tau Video Rate Limit (429) embed: ${code}`);
            } else {
                console.log(`⚠️ Tau Video Hata (${error.response ? error.response.status : error.message}) embed: ${code}`);
            }
            return null;
        });

        if (res && res.status === 200 && res.data) {
            tauCache.set(code, res.data);
            return res.data;
        }
    } catch (error) {
        console.log("Tau VideoApi error:", error.message);
    }
    return [];
}

module.exports = { VideoApi };