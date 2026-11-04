const express = require("express");
const { connectionTracker } = require('../../../src/connectionTracker');
const { getStatsHTML } = require('../../../src/statsTemplate');
const { getBaseUrl } = require('../lib/http');

const router = express.Router();

// Canlı bağlantı ve kullanıcı istatistikleri arayüzü ve API uç noktaları
router.get('/stats', function (req, res) {
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
router.get('/api/stats', function (req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.json(connectionTracker.getStats());
});

// SSE (Server-Sent Events) Gerçek Zamanlı Veri Akışı
router.get('/api/stats/stream', function (req, res) {
    connectionTracker.addSseClient(res);
});

// İstatistikleri ve aktif kullanıcıları sıfırlama (Clear) uç noktası.
// ADMIN_TOKEN tanımlıysa X-Admin-Token başlığı veya ?token= ile aynı değer gönderilmelidir.
router.post('/api/stats/clear', function (req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const adminToken = process.env.ADMIN_TOKEN;
    if (adminToken && (req.headers['x-admin-token'] || req.query.token) !== adminToken) {
        return res.status(403).json({ error: 'Yetkisiz' });
    }
    const cleared = connectionTracker.clear();
    return res.json(cleared);
});

module.exports = router;
