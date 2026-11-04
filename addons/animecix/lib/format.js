// Saf (ağ/IO kullanmayan) yardımcılar: başlık düzenleme, ID ve katalog parametresi ayrıştırma.
// test/ altındaki birim testleri bu dosyayı doğrudan kullanır.

/**
 * Türkçe başlık düzeni (Bağlaçlar hariç her kelimenin ilk harfi büyük).
 */
function toTurkishTitleCase(str) {
    if (!str) return '';
    const conjunctions = new Set([
        've', 'ile', 'veya', 'ama', 'fakat', 'lakin', 'ancak', 'de', 'da', 'ki', 'mi', 'mu', 'mü', 'mı', 'ise', 'ya', 'yahut'
    ]);

    const words = str.split(/\s+/);
    const formattedWords = words.map((word, index) => {
        if (!word) return '';
        const lower = word.toLocaleLowerCase('tr-TR');
        const cleanWord = lower.replace(/[^a-zçğıöşü]/gi, '');

        if (['ova', 'tv', 'ona', 'bd', 'dvd'].includes(cleanWord)) {
            return lower.toUpperCase();
        }

        // DIO veya DIO'nun gibi büyük harfli kelimeleri koru
        const basePart = word.split(/['’]/)[0].replace(/[^A-Za-zÇĞİÖŞÜ]/g, '');
        if (basePart.length >= 2 && basePart === basePart.toUpperCase() && !conjunctions.has(cleanWord)) {
            const parts = word.split(/['’]/);
            if (parts.length > 1) {
                return parts[0].toUpperCase() + "'" + parts.slice(1).join("'").toLocaleLowerCase('tr-TR');
            }
            return word.toUpperCase();
        }

        if (index > 0 && conjunctions.has(cleanWord)) {
            return lower;
        }

        return lower.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (match, prefix, firstChar, rest) => {
            return prefix + firstChar.toLocaleUpperCase('tr-TR') + rest;
        });
    });

    return formattedWords.join(' ');
}

/**
 * Bölüm başlıklarını temizler ve Türkçeleştirir.
 * "1. Bölüm", "Bölüm 1", "Episode 1" gibi jenerik başlıkları "Bölüm 1" yapar.
 * "1. Bölüm: Başlangıç" veya "Bölüm 1 - Başlangıç" gibi başlıklardan "Başlangıç" adını çıkarır.
 */
function formatEpisodeTitle(rawTitle, ep) {
    if (!rawTitle || typeof rawTitle !== 'string') return `Bölüm ${ep}`;
    let title = rawTitle.trim();

    const isGenericEpisode = new RegExp(`^(?:bölüm\\s*${ep}|${ep}\\.?\\s*bölüm|episode\\s*${ep}|ep\\.?\\s*${ep}|#?${ep})$`, 'i');
    if (isGenericEpisode.test(title)) {
        return `Bölüm ${ep}`;
    }

    const prefixRegex = new RegExp(`^(?:bölüm\\s*${ep}|${ep}\\.?\\s*bölüm|episode\\s*${ep}|ep\\.?\\s*${ep}|${ep})\\s*[-–:.]\\s*`, 'i');
    title = title.replace(prefixRegex, '').trim();
    title = title.replace(/^[-–:.]\s*/, '').trim();

    if (!title) {
        return `Bölüm ${ep}`;
    }

    return toTurkishTitleCase(title);
}

function parseCatalogExtra(extraString, queryParams = {}) {
    const extra = { ...queryParams };
    if (!extraString) return extra;
    const clean = extraString.replace(/\.json$/, "");
    const pairs = clean.split("&");
    for (const pair of pairs) {
        const [k, v] = pair.split("=");
        if (k && v !== undefined) {
            extra[decodeURIComponent(k)] = decodeURIComponent(v);
        }
    }
    return extra;
}

/**
 * Stremio akış ID'sini ayrıştırır.
 *  - kitsu:46171 | kitsu:46171:3 | kitsu:46171:2:3
 *  - tt2560140   | tt2560140:3   | tt2560140:2:3
 *  - 0-82-1-1 | 0-82:1:1 | 0-127036 (eski sürümlerin bölüm ID'si)
 * @returns {{ source: 'kitsu'|'imdb'|'animecix', id: string, season: number|null, episode: number|null }}
 */
function parseStreamId(rawId) {
    const value = String(rawId || '').trim();

    if (value.startsWith('kitsu:') || value.startsWith('tt')) {
        const source = value.startsWith('kitsu:') ? 'kitsu' : 'imdb';
        const parts = (source === 'kitsu' ? value.slice('kitsu:'.length) : value).split(':');
        let season = 1;
        let episode = 1;
        if (parts.length >= 3) {
            season = parseInt(parts[1], 10) || 1;
            episode = parseInt(parts[2], 10) || 1;
        } else if (parts.length === 2) {
            episode = parseInt(parts[1], 10) || 1;
        }
        return { source, id: parts[0], season, episode };
    }

    const parts = value.replace(/^0-/, '').split(/[-:]/);
    if (parts.length >= 3) {
        return {
            source: 'animecix',
            id: parts[0],
            season: parseInt(parts[1], 10) || 1,
            episode: parseInt(parts[2], 10) || 1
        };
    }
    // Sezon/bölüm yoksa: eski bölüm ID'si veya film ID'si
    return { source: 'animecix', id: parts[0], season: null, episode: null };
}

function toValidDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Bölümün yayın tarihini seçer: bölümün kendi tarihi, yoksa animenin çıkış tarihi/yılı.
 * Stremio "yeni bölüm" bildirimlerini bu tarihe göre gösterir.
 */
function resolveReleaseDate(episodeDate, title = {}) {
    return toValidDate(episodeDate)
        || toValidDate(title.release_date)
        || (title.year ? new Date(Date.UTC(Number(title.year), 0, 1)) : null)
        || new Date(Date.UTC(2000, 0, 1));
}

module.exports = {
    toTurkishTitleCase,
    formatEpisodeTitle,
    parseCatalogExtra,
    parseStreamId,
    resolveReleaseDate
};
