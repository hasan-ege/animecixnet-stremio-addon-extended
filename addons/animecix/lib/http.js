const { connectionTracker } = require('../../../src/connectionTracker');

function corsAndTracking(req, res, next) {
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
}

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

module.exports = { corsAndTracking, respond, getBaseUrl };
