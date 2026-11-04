require("dotenv").config();
if (!process.env.HOSTING_URL && process.env.RENDER_EXTERNAL_URL) {
    process.env.HOSTING_URL = process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
}
const path = require('path');
const express = require("express");
const MANIFEST = require('./manifest');
const calendarService = require('../../src/calendarService');
const { getLandingHTML } = require('./landing');
const { corsAndTracking, respond, getBaseUrl } = require('./lib/http');

const router = express.Router();

calendarService.initCalendarService();

router.use('/images', express.static(path.join(__dirname, '../../static/images'), { maxAge: '7d' }));
router.use('/subs', express.static(path.join(__dirname, '../../static/subs'), { maxAge: '1d' }));
router.use(corsAndTracking);

function getDynamicManifest(req) {
    const baseUrl = getBaseUrl(req);
    return {
        ...MANIFEST,
        logo: `${baseUrl}/images/animecix.png`,
        background: `${baseUrl}/images/background.png`
    };
}

// Tarayıcıdan girildiğinde otomatik Stremio'ya yönlendirir / Kurulum arayüzü sunar;
// Stremio Web, mobil veya API girerse 302 yerine doğrudan manifest.json döndürür (CORS hatasını önler).
router.get('/', function (req, res) {
    const acceptHeader = req.headers['accept'] || '';
    const origin = req.headers['origin'] || '';
    const isBrowser = acceptHeader.includes('text/html') && !origin.includes('stremio') && req.headers['sec-fetch-dest'] !== 'empty';

    if (!isBrowser) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return respond(res, getDynamicManifest(req), req);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(getLandingHTML(MANIFEST, getBaseUrl(req)));
});

router.get(['/manifest.json', '/addon/manifest.json', '/:userConf/manifest.json'], function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return respond(res, getDynamicManifest(req), req);
});

router.use(require('./routes/stats'));
router.use(require('./routes/catalog'));
router.use(require('./routes/meta'));
router.use(require('./routes/stream'));
router.use(require('./routes/subtitles'));

module.exports = {
    router,
    manifest: MANIFEST
};
