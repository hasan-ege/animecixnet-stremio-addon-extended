const express = require("express");
const fs = require('fs');
const path = require('path');
const subsrt = require('subtitle-converter');
const ass2srt = require('ass-to-srt');
const Axios = require('axios');
const { setupCache } = require("axios-cache-interceptor");
const { respond, getBaseUrl } = require('../lib/http');
const { subsCache } = require('../lib/caches');

const axios = setupCache(Axios.create());
const SUBS_DIR = path.join(__dirname, '../../../static/subs');

const router = express.Router();

let lastSubClean = 0;
function CheckSubtitleFoldersAndFiles() {
    const now = Date.now();
    // En fazla 30 dakikada bir kontrol et (CPU ve I/O yükünü önlemek için)
    if (now - lastSubClean < 30 * 60 * 1000) return;
    lastSubClean = now;

    try {
        const folderPath = SUBS_DIR;
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

router.get(subtitleRoutes, async (req, res, next) => {
    try {
        var { type, id } = req.params;
        id = id.replace(".json", "");
        if (id) {
            const captionUrl = subsCache.get(id);
            if (captionUrl) {
                // id kullanıcıdan gelir; dosya yolunda yalnızca güvenli karakterler kullan (path traversal önlemi)
                const fileId = id.replace(/[^A-Za-z0-9_-]/g, '_');
                var localUrl = `${getBaseUrl(req)}/subs/${fileId}/${fileId}.srt`;
                const subtitles = {
                    id: "animecix-" + id,
                    lang: "tur",
                    url: localUrl
                };

                CheckSubtitleFoldersAndFiles();

                const existingSub = path.join(SUBS_DIR, fileId, `${fileId}.srt`);
                if (fs.existsSync(existingSub)) {
                    return respond(res, { subtitles: [subtitles], cacheMaxAge: 120, staleRevalidate: 60, staleError: 300 }, req);
                }

                var downloadUrl = `${process.env.SUBTITLEAI_URL + new URL(captionUrl).pathname}`;
                var subtitleHeader = {
                    "User-Agent": `${process.env.USERAGENT}`,
                    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "Windows",
                };

                var response = await axios.get(downloadUrl, { headers: subtitleHeader, timeout: 10000 });
                if (response && response.status == 200) {
                    var subtitle = "";
                    if (path.extname(downloadUrl) !== ".srt" && path.extname(downloadUrl) !== ".ass") {
                        const outputExtension = '.srt';
                        const options = {
                            removeTextFormatting: true,
                        };
                        subtitle = subsrt.convert(response.data, outputExtension, options).subtitle;
                    } else if (path.extname(downloadUrl) === ".ass") {
                        subtitle = ass2srt(response.data);
                    } else if (path.extname(downloadUrl) === ".srt") {
                        subtitle = response.data;
                    }

                    if (subtitle !== '') {
                        const subDir = path.join(SUBS_DIR, fileId);
                        if (!fs.existsSync(subDir)) {
                            fs.mkdirSync(subDir, { recursive: true });
                        }
                        fs.writeFileSync(path.join(subDir, `${fileId}.srt`), subtitle, { encoding: "utf8" });
                        return respond(res, { subtitles: [subtitles], cacheMaxAge: 120, staleRevalidate: 60, staleError: 300 }, req);
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



module.exports = router;
