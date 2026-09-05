/**
 * Stremio Eklentisi Canlı Bağlantı ve Aktif Kullanıcı Takipçisi
 */

function maskIp(ip) {
    if (!ip) return '0.0.0.0';
    const cleanIp = ip.replace('::ffff:', '');
    const parts = cleanIp.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    if (cleanIp.includes(':')) {
        const p = cleanIp.split(':');
        return `${p.slice(0, 3).join(':')}:****`;
    }
    return cleanIp;
}

function parseClientInfo(req) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const referer = (req.headers['referer'] || '').toLowerCase();

    if (referer.includes('web.stremio.com') || ua.includes('stremio-web')) {
        return 'Stremio Web';
    }
    if (ua.includes('stremio')) {
        if (ua.includes('android')) return 'Stremio (Android)';
        if (ua.includes('windows')) return 'Stremio (Windows)';
        if (ua.includes('macintosh') || ua.includes('mac os')) return 'Stremio (macOS)';
        if (ua.includes('linux')) return 'Stremio (Linux)';
        if (ua.includes('tizen') || ua.includes('webos')) return 'Stremio (Smart TV)';
        return 'Stremio Uygulaması';
    }
    if (ua.includes('exoplayer') || ua.includes('okhttp')) {
        return 'Stremio Oynatıcı (Android)';
    }
    if (ua.includes('android')) return 'Android Tarayıcı';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS Safari';
    if (ua.includes('chrome')) return 'Chrome Tarayıcı';
    if (ua.includes('firefox')) return 'Firefox Tarayıcı';
    if (ua.includes('curl')) return 'cURL / Script';
    return 'Web / API';
}

class ConnectionTracker {
    constructor() {
        this.activeRequests = 0;
        this.totalRequests = 0;
        // Map: clientId -> { id, ip, maskedIp, device, firstSeen, lastSeen, lastUrl, requestCount }
        this.clients = new Map();

        // 30 saniyede bir 5 dakikadır hareketsiz olan kullanıcıları temizle
        setInterval(() => this.cleanup(), 30 * 1000).unref();

        // Her 60 saniyede bir aktif kullanıcı varsa konsola canlı özet bas
        setInterval(() => this.logHeartbeat(), 60 * 1000).unref();
    }

    getClientId(req) {
        const rawIp = (req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : req.socket.remoteAddress) || '127.0.0.1';
        const ua = req.headers['user-agent'] || 'unknown';
        return `${rawIp}#${ua}`;
    }

    onStart(req) {
        this.activeRequests++;
        this.totalRequests++;

        const now = Date.now();
        const clientId = this.getClientId(req);
        const rawIp = (req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : req.socket.remoteAddress) || '127.0.0.1';

        let client = this.clients.get(clientId);
        const isNew = !client;

        if (isNew) {
            client = {
                id: clientId,
                ip: rawIp,
                maskedIp: maskIp(rawIp),
                device: parseClientInfo(req),
                firstSeen: now,
                lastSeen: now,
                lastUrl: req.url,
                requestCount: 1
            };
            this.clients.set(clientId, client);
        } else {
            client.lastSeen = now;
            client.lastUrl = req.url;
            client.requestCount++;
        }

        if (this.clients.size > 500) {
            this.cleanup();
        }

        return { isNew, client };
    }

    onEnd() {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
    }

    cleanup() {
        const now = Date.now();
        const timeoutMs = 5 * 60 * 1000; // 5 dakika inaktiflik
        for (const [id, client] of this.clients.entries()) {
            if (now - client.lastSeen > timeoutMs) {
                this.clients.delete(id);
            }
        }
    }

    getActiveCount(windowMs = 5 * 60 * 1000) {
        const now = Date.now();
        let count = 0;
        for (const client of this.clients.values()) {
            if (now - client.lastSeen <= windowMs) {
                count++;
            }
        }
        return count;
    }

    logHeartbeat() {
        const active5m = this.getActiveCount(5 * 60 * 1000);
        const active1m = this.getActiveCount(1 * 60 * 1000);
        if (active5m > 0) {
            console.log(`📊 [Canlı Durum] 👥 ${active5m} aktif kullanıcı (Son 5 dk: ${active5m}, Son 1 dk: ${active1m}) | ⚡ ${this.activeRequests} anlık istek | 📈 Toplam: ${this.totalRequests} istek`);
        }
    }

    getStats() {
        const now = Date.now();
        const active5m = this.getActiveCount(5 * 60 * 1000);
        const active1m = this.getActiveCount(1 * 60 * 1000);

        const activeList = [];
        for (const client of this.clients.values()) {
            if (now - client.lastSeen <= 5 * 60 * 1000) {
                const diffSec = Math.round((now - client.lastSeen) / 1000);
                activeList.push({
                    ip: client.maskedIp,
                    cihaz: client.device,
                    sonIstek: client.lastUrl,
                    sonGorulme: diffSec === 0 ? 'Şimdi' : `${diffSec} saniye önce`,
                    toplamIstek: client.requestCount
                });
            }
        }

        return {
            anlikEszamanliIstek: this.activeRequests,
            aktifKullanici5Dk: active5m,
            aktifKullanici1Dk: active1m,
            toplamIstekSayisi: this.totalRequests,
            aktifKullaniciListesi: activeList
        };
    }
}

const connectionTracker = new ConnectionTracker();

module.exports = {
    connectionTracker,
    maskIp,
    parseClientInfo
};
