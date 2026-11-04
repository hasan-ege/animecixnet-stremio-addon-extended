require("dotenv").config();
const os = require('os');
const path = require('path');
const express = require('express');

if (!process.env.HOSTING_URL && process.env.RENDER_EXTERNAL_URL) {
    process.env.HOSTING_URL = process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
}

const app = express();
app.disable('x-powered-by');

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

// Static assets (images, logos, subtitles)
app.use('/images', express.static(path.join(__dirname, "static/images"), { maxAge: '7d' }));
app.use('/subs', express.static(path.join(__dirname, "static/subs"), { maxAge: '1d' }));

const animecix = require('./addons/animecix');

// Eski kurulumlar /animecix/manifest.json adresini kullanıyor; kök adres de aynı eklentiyi sunar
app.use('/animecix', animecix.router);
app.use('/', animecix.router);

if (module.parent) {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 7000;
    app.listen(PORT, '0.0.0.0', function (err) {
        if (err) {
            return console.error("Error :" + err);
        }
        const localIP = getLocalIP();
        const displayUrl = (process.env.HOSTING_URL || `http://${localIP}:${PORT}`).replace(/\/+$/, '');

        console.log(`\n======================================================`);
        console.log(`🚀 AnimeciX Stremio Eklentisi Aktif! Port: ${PORT}`);
        console.log(`======================================================`);
        console.log(`🌐 Kurulum Sayfası:  ${displayUrl}`);
        console.log(`   Yerel:            http://localhost:${PORT}`);
        console.log(`   Ağ:               http://${localIP}:${PORT}`);
        console.log(`📦 Manifest:         ${displayUrl}/manifest.json`);
        console.log(`   Kurulum:          stremio://${displayUrl.replace(/^https?:\/\//, '')}/manifest.json`);
        console.log(`📊 İstatistikler:    ${displayUrl}/stats`);
        console.log(`======================================================\n`);
    });

    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
}
