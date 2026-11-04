// videos.ListVideos çıktısını Stremio akış nesnelerine çevirir (saf fonksiyon, testlerde kullanılır).

function qualityValue(label) {
    const match = String(label || '').match(/(\d{3,4})p/i);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * - Stremio'da oynayan akışlar önce, tarayıcıda açılanlar sonra gelir.
 * - Oynayan akışlar kaliteye göre (1080p > 720p > 480p), eşitse fansub adına göre sıralanır.
 * - bingeGroup: bir bölüm bitince Stremio sonraki bölümde aynı fansub + kaliteyi otomatik seçer.
 */
function buildStreams(streamLinks) {
    const playable = [];
    const external = [];

    for (const element of streamLinks || []) {
        const fansub = String(element.subName || '').trim();
        if (element.support == "stremio") {
            playable.push({
                url: element.parseUrl,
                name: element.label + "\n" + fansub,
                description: element.videoProvider + "\n" + element.size,
                behaviorHints: {
                    bingeGroup: `animecix-${fansub || 'bilinmiyor'}-${element.label}`.toLowerCase()
                },
                _quality: qualityValue(element.label),
                _fansub: fansub
            });
        } else {
            external.push({
                externalUrl: element.url,
                name: "Animecix \n" + fansub,
                description: element.videoProvider + "\n" + element.size,
            });
        }
    }

    playable.sort((a, b) => (b._quality - a._quality) || a._fansub.localeCompare(b._fansub, 'tr'));

    return [
        ...playable.map(({ _quality, _fansub, ...stream }) => stream),
        ...external
    ];
}

module.exports = { buildStreams, qualityValue };
