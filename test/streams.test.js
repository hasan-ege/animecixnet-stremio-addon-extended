const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStreams, qualityValue } = require('../addons/animecix/lib/streams');
const { findNextEpisode, formatNextEpisodeLine } = require('../addons/animecix/lib/nextEpisode');

const tau = (label, subName) => ({
    support: 'stremio', parseUrl: `https://cdn/${subName}/${label}`, label, subName,
    videoProvider: 'tau video', size: '100 MB'
});
const sibnet = (subName) => ({
    support: 'browser', url: `https://video.sibnet.ru/${subName}`, subName,
    videoProvider: 'sibnet', size: 'Boyut Bilinmiyor'
});

test('qualityValue: etiketten çözünürlük', () => {
    assert.equal(qualityValue('1080p'), 1080);
    assert.equal(qualityValue('720P'), 720);
    assert.equal(qualityValue('Bilinmiyor'), 0);
});

test('buildStreams: oynayanlar kaliteye göre önce, tarayıcı kaynakları sonda', () => {
    const streams = buildStreams([sibnet('A'), tau('480p', 'B'), tau('1080p', 'K'), tau('720p', 'K')]);
    assert.deepEqual(streams.map(s => s.name.split('\n')[0]), ['1080p', '720p', '480p', 'Animecix ']);
    assert.ok(streams[3].externalUrl);
});

test('buildStreams: aynı kalitede fansub adına göre sıralar', () => {
    const streams = buildStreams([tau('1080p', 'Zeta'), tau('1080p', 'Alfa')]);
    assert.deepEqual(streams.map(s => s.name), ['1080p\nAlfa', '1080p\nZeta']);
});

test('buildStreams: bingeGroup fansub ve kaliteye bağlı, yardımcı alanlar sızmaz', () => {
    const [s] = buildStreams([tau('1080p', 'Kazasker - Kanekabkz')]);
    assert.equal(s.behaviorHints.bingeGroup, 'animecix-kazasker - kanekabkz-1080p');
    assert.equal(s._quality, undefined);
    assert.equal(s._fansub, undefined);
    const [other] = buildStreams([tau('720p', 'Kazasker - Kanekabkz')]);
    assert.notEqual(other.behaviorHints.bingeGroup, s.behaviorHints.bingeGroup);
});

test('buildStreams: boş giriş', () => {
    assert.deepEqual(buildStreams(undefined), []);
});

const calendar = [
    { episodes: [{ title_id: 7, season_number: 1, episode_number: 9, release_date: '2026-11-03T17:00:00.000Z' }] },
    { episodes: [{ title: { id: 8 }, season_number: 2, episode_number: 4, release_date: '2026-11-07T16:00:00.000Z' }] }
];

test('findNextEpisode: bu hafta henüz çıkmadıysa takvimdeki bölüm', () => {
    const next = findNextEpisode(calendar, '8', new Date('2026-11-04T12:00:00Z'));
    assert.deepEqual(next, { season: 2, episode: 4, date: new Date('2026-11-07T16:00:00.000Z') });
});

test('findNextEpisode: bu hafta çıktıysa bir sonraki hafta, bir sonraki bölüm', () => {
    const next = findNextEpisode(calendar, 7, new Date('2026-11-04T12:00:00Z'));
    assert.deepEqual(next, { season: 1, episode: 10, date: new Date('2026-11-10T17:00:00.000Z') });
});

test('findNextEpisode: takvimde olmayan anime', () => {
    assert.equal(findNextEpisode(calendar, 999), null);
    assert.equal(findNextEpisode(null, 7), null);
});

test('formatNextEpisodeLine: Türkiye saatiyle tarih', () => {
    assert.equal(formatNextEpisodeLine({ episode: 10, date: new Date('2026-11-11T17:00:00Z') }),
        '⏭️ Sıradaki: 10. Bölüm — 11 Kasım Çarşamba, 20:00');
    assert.equal(formatNextEpisodeLine({ episode: 3, date: new Date('2026-11-09T00:00:00Z') }),
        '⏭️ Sıradaki: 3. Bölüm — 9 Kasım Pazartesi');
    assert.equal(formatNextEpisodeLine(null), '');
});
