/**
 * Stremio Eklentisi Canlı Bağlantı ve Aktif Kullanıcı Takipçisi
 * Gerçek zamanlı SSE (Server-Sent Events) ve anlık veri akışı destekli
 */

const ADJECTIVES = [
    "strong", "fashionable", "clever", "brave", "cosmic", "sleepy", "speedy",
    "golden", "silent", "mighty", "mystic", "epic", "fluffy", "frosty", "jolly",
    "lucky", "noble", "playful", "quirky", "radiant", "shadow", "silver", "turbo",
    "vibrant", "wild", "happy", "zen", "hyper", "stormy", "gentle", "shiny", "iron",
    "cool", "sneaky", "chill", "funky", "snazzy", "dapper", "breezy", "stellar",
    "electric", "cyber", "phantom", "quantum", "neon", "amber", "atomic", "crystal",
    "blazing", "velvet", "dancing", "flying", "crimson", "frozen", "groovy", "fuzzy"
];

const NOUNS = [
    "potato", "car", "panda", "falcon", "tiger", "wizard", "phoenix", "dragon",
    "ninja", "samurai", "otter", "badger", "penguin", "fox", "wolf", "koala",
    "dolphin", "cheetah", "hamster", "rabbit", "cat", "bear", "eagle", "hawk",
    "robot", "comet", "rocket", "nebula", "sloth", "raccoon", "hedgehog", "corgi",
    "lynx", "owl", "jaguar", "mammoth", "bison", "moose", "orca", "turtle",
    "beaver", "chameleon", "gecko", "sparrow", "raven", "beetle", "cyborg", "shiba",
    "alpaca", "meerkat", "duck", "walrus", "llama", "lemur", "tiger"
];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getNickname(ip) {
    if (!ip) return 'nameless-potato';
    const clean = ip.replace('::ffff:', '');
    const h = hashString(clean);
    const adj = ADJECTIVES[h % ADJECTIVES.length];
    const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
    return `${adj}-${noun}`;
}

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

function parseAction(url) {
    if (!url) return { title: 'Ana Sayfa', type: 'home', badge: 'Ana Sayfa' };
    const clean = decodeURIComponent(url);

    if (clean.includes('/stream/')) {
        return { title: 'Video Yayını İzleme', type: 'stream', badge: '🎬 Yayın' };
    }
    if (clean.includes('animecix-calendar')) {
        let day = 'Tüm Hafta';
        if (clean.includes('today')) day = 'Bugün';
        else if (clean.includes('monday')) day = 'Pazartesi';
        else if (clean.includes('tuesday')) day = 'Salı';
        else if (clean.includes('wednesday')) day = 'Çarşamba';
        else if (clean.includes('thursday')) day = 'Perşembe';
        else if (clean.includes('friday')) day = 'Cuma';
        else if (clean.includes('saturday')) day = 'Cumartesi';
        else if (clean.includes('sunday')) day = 'Pazar';
        return { title: `Takvim: ${day}`, type: 'calendar', badge: '📅 Takvim' };
    }
    if (clean.includes('search=')) {
        const match = clean.match(/search=([^&.]+)/);
        const query = match ? match[1] : '';
        return { title: `Arama: "${query}"`, type: 'search', badge: '🔍 Arama' };
    }
    if (clean.includes('genre=')) {
        const match = clean.match(/genre=([^&.]+)/);
        const genre = match ? match[1] : '';
        return { title: `Tür: ${genre}`, type: 'catalog', badge: '🏷️ Tür' };
    }
    if (clean.includes('animecix-home')) {
        let col = 'Keşfet';
        if (clean.includes('latest')) col = 'Son Çıkanlar';
        else if (clean.includes('seasonal')) col = 'Sezonun İncileri';
        else if (clean.includes('top-rated')) col = 'En Yüksek Puanlılar';
        return { title: `Koleksiyon: ${col}`, type: 'catalog', badge: '📂 Koleksiyon' };
    }
    if (clean.includes('/catalog/')) {
        return { title: 'Anime Kataloğu Gezinme', type: 'catalog', badge: '📂 Katalog' };
    }
    if (clean.includes('/meta/')) {
        return { title: 'Anime Detay & Bölüm Listesi', type: 'meta', badge: 'ℹ️ Anime Detay' };
    }
    if (clean.includes('/manifest.json')) {
        return { title: 'Eklenti Tanımı & Bağlantı', type: 'manifest', badge: '📋 Manifest' };
    }
    if (clean.includes('/subs/')) {
        return { title: 'Altyazı İndirme', type: 'subtitle', badge: '💬 Altyazı' };
    }
    return { title: clean.split('?')[0].slice(0, 35), type: 'other', badge: '🌐 İstek' };
}

class ConnectionTracker {
    constructor() {
        this.startTime = Date.now();
        this.activeRequests = 0;
        this.totalRequests = 0;
        // Map: clientId -> { id, ip, maskedIp, nickname, device, firstSeen, lastSeen, lastUrl, lastAction, requestCount }
        this.clients = new Map();
        this.recentRequests = []; // Max 30 eleman
        this.sseClients = new Set();
        this.broadcastTimeout = null;

        // 30 saniyede bir 5 dakikadır hareketsiz olan kullanıcıları temizle
        setInterval(() => this.cleanup(), 30 * 1000).unref();

        // Her 60 saniyede bir aktif kullanıcı varsa konsola canlı özet bas
        setInterval(() => this.logHeartbeat(), 60 * 1000).unref();

        // 1 saniyede bir SSE abonelerine canlı uptime ve durum verisi gönder (Canlı Sayaçlar İçin)
        setInterval(() => {
            if (this.sseClients.size > 0) {
                this.broadcastStats();
            }
        }, 1000).unref();

        // 10 saniyede bir SSE bağlantılarını canlı tutmak için ping gönder
        setInterval(() => this.pingSseClients(), 10 * 1000).unref();
    }

    getClientId(req) {
        const rawIp = (req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : req.socket.remoteAddress) || '127.0.0.1';
        const ua = req.headers['user-agent'] || 'unknown';
        return `${rawIp}#${ua}`;
    }

    onStart(req) {
        // Stats ve stream gibi admin/panel rotalarını aktif kullanıcı sayacından izole et
        const isStatsOrInternal = req.url.startsWith('/stats') || 
                                  req.url.startsWith('/api/stats') || 
                                  req.url === '/favicon.ico';

        if (isStatsOrInternal) {
            return { isNew: false, client: null, isIgnored: true };
        }

        this.activeRequests++;
        this.totalRequests++;

        const now = Date.now();
        const clientId = this.getClientId(req);
        const rawIp = (req.headers['x-forwarded-for'] 
            ? req.headers['x-forwarded-for'].split(',')[0].trim() 
            : req.socket.remoteAddress) || '127.0.0.1';

        const action = parseAction(req.url);
        let client = this.clients.get(clientId);
        const isNew = !client;
        const nickname = getNickname(rawIp);

        if (isNew) {
            client = {
                id: clientId,
                ip: rawIp,
                maskedIp: maskIp(rawIp),
                nickname: nickname,
                device: parseClientInfo(req),
                firstSeen: now,
                lastSeen: now,
                lastUrl: req.url,
                lastAction: action,
                requestCount: 1
            };
            this.clients.set(clientId, client);
        } else {
            client.lastSeen = now;
            client.lastUrl = req.url;
            client.lastAction = action;
            client.requestCount++;
        }

        // Son istek akışına ekle (Maksimum 30 adet)
        this.recentRequests.unshift({
            id: `${now}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: now,
            time: new Date(now).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }),
            method: req.method || 'GET',
            path: req.url,
            action: action.title,
            badge: action.badge,
            category: action.type,
            device: client.device,
            nickname: client.nickname,
            ip: client.maskedIp
        });

        if (this.recentRequests.length > 30) {
            this.recentRequests.pop();
        }

        if (this.clients.size > 500) {
            this.cleanup();
        }

        this.scheduleBroadcast();
        return { isNew, client, isIgnored: false };
    }

    onEnd(isIgnored = false) {
        if (!isIgnored) {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            this.scheduleBroadcast();
        }
    }

    cleanup() {
        const now = Date.now();
        const timeoutMs = 5 * 60 * 1000; // 5 dakika inaktiflik
        let changed = false;
        for (const [id, client] of this.clients.entries()) {
            if (now - client.lastSeen > timeoutMs) {
                this.clients.delete(id);
                changed = true;
            }
        }
        if (changed) {
            this.scheduleBroadcast();
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

    getUptimeFormatted() {
        const diffMs = Date.now() - this.startTime;
        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;

        const parts = [];
        if (days > 0) parts.push(`${days} gün`);
        if (hours > 0 || days > 0) parts.push(`${hours} saat`);
        if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes} dk`);
        parts.push(`${seconds} sn`);
        return parts.join(' ');
    }

    getStats() {
        const now = Date.now();
        const active5m = this.getActiveCount(5 * 60 * 1000);
        const active1m = this.getActiveCount(1 * 60 * 1000);

        const activeList = [];
        const deviceCounts = {};
        const categoryCounts = {};

        for (const client of this.clients.values()) {
            const isWithin5m = (now - client.lastSeen <= 5 * 60 * 1000);
            if (isWithin5m) {
                const diffSec = Math.round((now - client.lastSeen) / 1000);
                const isActiveNow = diffSec <= 60;

                // Cihaz sayımı
                deviceCounts[client.device] = (deviceCounts[client.device] || 0) + 1;

                // Kategori sayımı
                const catType = client.lastAction ? client.lastAction.type : 'other';
                categoryCounts[catType] = (categoryCounts[catType] || 0) + 1;

                activeList.push({
                    id: client.id,
                    nickname: client.nickname || getNickname(client.ip),
                    ip: client.maskedIp,
                    cihaz: client.device,
                    sonIstek: client.lastUrl,
                    sonEylem: client.lastAction ? client.lastAction.title : 'Bilinmiyor',
                    eylemRozet: client.lastAction ? client.lastAction.badge : '🌐 İstek',
                    eylemTuru: catType,
                    sonGorulmeMs: client.lastSeen,
                    sonGorulmeSn: diffSec,
                    sonGorulme: diffSec === 0 ? 'Şimdi' : `${diffSec} sn önce`,
                    toplamIstek: client.requestCount,
                    durum: isActiveNow ? 'aktif' : 'bosta'
                });
            }
        }

        // Son görülmeye göre sırala (en yeni en üstte)
        activeList.sort((a, b) => b.sonGorulmeMs - a.sonGorulmeMs);

        const mem = process.memoryUsage();
        const ramMb = Math.round((mem.rss / (1024 * 1024)) * 10) / 10;

        return {
            status: "online",
            zaman: new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }),
            tarih: new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }),
            anlikEszamanliIstek: this.activeRequests,
            aktifKullanici5Dk: active5m,
            aktifKullanici1Dk: active1m,
            toplamIstekSayisi: this.totalRequests,
            calismaSuresi: this.getUptimeFormatted(),
            calismaSuresiSn: Math.floor((now - this.startTime) / 1000),
            ramMb: ramMb,
            cihazDagilimi: deviceCounts,
            kategoriDagilimi: categoryCounts,
            aktifKullaniciListesi: activeList,
            sonAktiviteler: this.recentRequests.slice(0, 20)
        };
    }

    // --- Server-Sent Events (SSE) Canlı İletim Sistemi ---

    addSseClient(res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });

        // İlk veriyi hemen gönder
        const initialData = JSON.stringify(this.getStats());
        res.write(`data: ${initialData}\n\n`);

        this.sseClients.add(res);

        res.on('close', () => {
            this.sseClients.delete(res);
        });
    }

    pingSseClients() {
        if (this.sseClients.size === 0) return;
        for (const client of this.sseClients) {
            try {
                client.write(': ping\n\n');
            } catch (e) {
                this.sseClients.delete(client);
            }
        }
    }

    scheduleBroadcast() {
        if (this.sseClients.size === 0) return;
        if (this.broadcastTimeout) return;

        // Çok sık güncellemede CPU harcamamak için 100ms debounce
        this.broadcastTimeout = setTimeout(() => {
            this.broadcastTimeout = null;
            this.broadcastStats();
        }, 100);
    }

    broadcastStats() {
        if (this.sseClients.size === 0) return;
        const payload = `data: ${JSON.stringify(this.getStats())}\n\n`;
        for (const client of this.sseClients) {
            try {
                client.write(payload);
            } catch (err) {
                this.sseClients.delete(client);
            }
        }
    }
}

const connectionTracker = new ConnectionTracker();

module.exports = {
    connectionTracker,
    getNickname,
    maskIp,
    parseClientInfo,
    parseAction
};
