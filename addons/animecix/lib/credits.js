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

/**
 * @param {Object} title AnimeciX /secure/titles/:id yanıtındaki `title`
 * @returns {{ cast?: string[], director?: string[], writer?: string[], trailers?: Object[], trailerStreams?: Object[] }}
 */
function buildCreditsMeta(title) {
    const result = {};
    const credits = Array.isArray(title && title.credits) ? title.credits : [];

    // Seslendirme kadrosu: karakteri olan ya da "cast" departmanındaki kişiler, AnimeciX'in sırasıyla
    const cast = uniqueNames(credits.filter(c => {
        const p = c.pivot || {};
        return p.character || p.department === 'cast';
    })).slice(0, MAX_CAST);

    const director = uniqueNames(credits.filter(c => {
        const p = c.pivot || {};
        return p.department === 'directing' && /^(series )?director$/i.test(p.job || '');
    }));

    const writer = uniqueNames(credits.filter(c => (c.pivot || {}).department === 'writing'));

    if (cast.length) result.cast = cast;
    if (director.length) result.director = director;
    if (writer.length) result.writer = writer;

    const ytId = extractYoutubeId(title && title.trailer);
    if (ytId) {
        result.trailers = [{ source: ytId, type: 'Trailer' }];
        result.trailerStreams = [{ ytId, title: 'Fragman' }];
    }

    return result;
}

module.exports = { extractYoutubeId, buildCreditsMeta };
