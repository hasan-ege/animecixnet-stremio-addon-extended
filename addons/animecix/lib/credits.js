// AnimeciX başlık verisindeki fragman ve kadro bilgisini Stremio meta alanlarına çevirir (saf fonksiyonlar).

const MAX_CAST = 10;

/**
 * YouTube embed / watch / youtu.be adresinden video ID'sini çıkarır.
 */
function extractYoutubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:.*&)?v=|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

function uniqueNames(credits) {
    return [...new Set(credits.map(c => c && c.name && String(c.name).trim()).filter(Boolean))];
}

// TMDB orijinal boyutu çok büyük; kadro fotoğrafı için küçük boyut yeterli
function toPhotoUrl(poster) {
    if (!poster || typeof poster !== 'string') return undefined;
    return poster.replace('/t/p/original/', '/t/p/w185/');
}

/**
 * Nuvio'nun okuduğu app_extras kişi listesi: [{ name, character, photo, tmdbId }].
 * Aynı kişi birden fazla kez geçerse ilk kaydı (karakter/fotoğraf) kullanılır.
 */
function toPeople(credits, limit = Infinity) {
    const people = new Map();
    for (const c of credits) {
        const name = c && c.name && String(c.name).trim();
        if (!name || people.has(name)) continue;
        const person = { name };
        const character = c.pivot && c.pivot.character && String(c.pivot.character).trim();
        if (character) person.character = character;
        const photo = toPhotoUrl(c.poster);
        if (photo) person.photo = photo;
        if (c.tmdb_id) person.tmdbId = Number(c.tmdb_id);
        people.set(name, person);
        if (people.size >= limit) break;
    }
    return [...people.values()];
}

/**
 * @param {Object} title AnimeciX /secure/titles/:id yanıtındaki `title`
 * cast/director/writer Stremio için (sadece isim), app_extras Nuvio için (fotoğraf ve karakterle).
 * @returns {{ cast?: string[], director?: string[], writer?: string[], app_extras?: Object, trailers?: Object[], trailerStreams?: Object[] }}
 */
function buildCreditsMeta(title) {
    const result = {};
    const credits = Array.isArray(title && title.credits) ? title.credits : [];

    // Seslendirme kadrosu: karakteri olan ya da "cast" departmanındaki kişiler, AnimeciX'in sırasıyla
    const castCredits = credits.filter(c => {
        const p = c.pivot || {};
        return p.character || p.department === 'cast';
    });
    const directorCredits = credits.filter(c => {
        const p = c.pivot || {};
        return p.department === 'directing' && /^(series )?director$/i.test(p.job || '');
    });
    const writerCredits = credits.filter(c => (c.pivot || {}).department === 'writing');

    const cast = uniqueNames(castCredits).slice(0, MAX_CAST);
    const director = uniqueNames(directorCredits);
    const writer = uniqueNames(writerCredits);

    if (cast.length) result.cast = cast;
    if (director.length) result.director = director;
    if (writer.length) result.writer = writer;

    if (cast.length || director.length || writer.length) {
        result.app_extras = {};
        if (cast.length) result.app_extras.cast = toPeople(castCredits, MAX_CAST);
        if (director.length) result.app_extras.directors = toPeople(directorCredits);
        if (writer.length) result.app_extras.writers = toPeople(writerCredits);
    }

    const ytId = extractYoutubeId(title && title.trailer);
    if (ytId) {
        result.trailers = [{ source: ytId, type: 'Trailer' }];
        result.trailerStreams = [{ ytId, title: 'Fragman' }];
    }

    return result;
}

module.exports = { extractYoutubeId, buildCreditsMeta, toPhotoUrl };
