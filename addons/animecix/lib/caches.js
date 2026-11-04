const NodeCache = require("node-cache");

// Meta yanıtları; akış isteği bölüm ID'sini çözerken de buradan okur
const metaCache = new NodeCache({ stdTTL: 30 * 60, checkperiod: 120 });

// Akış isteğinde bulunan altyazı URL'leri (id -> caption url)
const subsCache = new NodeCache({ stdTTL: 2 * 60 * 60, checkperiod: 300 });

module.exports = { metaCache, subsCache };
