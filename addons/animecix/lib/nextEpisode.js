// Haftalık yayın takviminden bir animenin sıradaki bölümünü bulur (saf fonksiyonlar, testlerde kullanılır).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {Array<{episodes: Array}>} calendarDays AnimeciX /secure/calendar verisi (bu haftanın günleri)
 * @param {number|string} titleId AnimeciX başlık ID'si
 * @param {Date} now
 * @returns {{ season: number, episode: number, date: Date } | null}
 */
function findNextEpisode(calendarDays, titleId, now = new Date()) {
    if (!Array.isArray(calendarDays)) return null;
    const id = Number(titleId);

    let latest = null;
    for (const day of calendarDays) {
        for (const ep of (day && Array.isArray(day.episodes) ? day.episodes : [])) {
            const epTitleId = Number(ep.title_id || (ep.title && ep.title.id));
            const date = new Date(ep.release_date);
            if (epTitleId !== id || isNaN(date.getTime())) continue;
            if (!latest || date > latest.date) {
                latest = { season: ep.season_number || 1, episode: ep.episode_number || 1, date };
            }
        }
    }
    if (!latest) return null;

    // Takvim sadece bu haftayı içerir: bu haftaki bölüm çıktıysa bir sonraki haftaya kaydır
    if (latest.date <= now) {
        return { season: latest.season, episode: latest.episode + 1, date: new Date(latest.date.getTime() + WEEK_MS) };
    }
    return latest;
}

/**
 * "⏭️ Sıradaki: 10. Bölüm — 11 Kasım Salı, 20:00" (Türkiye saati).
 * Saat bilgisi olmayan (UTC gece yarısı) tarihlerde saat yazılmaz.
 */
function formatNextEpisodeLine(next) {
    if (!next || !(next.date instanceof Date) || isNaN(next.date.getTime())) return '';
    const hasTime = next.date.getUTCHours() !== 0 || next.date.getUTCMinutes() !== 0;
    const dayText = next.date.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long' });
    const timeText = hasTime
        ? ', ' + next.date.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
        : '';
    return `⏭️ Sıradaki: ${next.episode}. Bölüm — ${dayText.replace(',', '')}${timeText}`;
}

module.exports = { findNextEpisode, formatNextEpisodeLine };
