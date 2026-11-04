const test = require('node:test');
const assert = require('node:assert/strict');
const {
    toTurkishTitleCase,
    formatEpisodeTitle,
    parseCatalogExtra,
    parseStreamId,
    resolveReleaseDate
} = require('../addons/animecix/lib/format');

test('formatEpisodeTitle: jenerik başlıklar "Bölüm N" olur', () => {
    assert.equal(formatEpisodeTitle('1. Bölüm', 1), 'Bölüm 1');
    assert.equal(formatEpisodeTitle('Bölüm 12', 12), 'Bölüm 12');
    assert.equal(formatEpisodeTitle('Episode 3', 3), 'Bölüm 3');
    assert.equal(formatEpisodeTitle('#7', 7), 'Bölüm 7');
});

test('formatEpisodeTitle: boş veya geçersiz başlık', () => {
    assert.equal(formatEpisodeTitle('', 4), 'Bölüm 4');
    assert.equal(formatEpisodeTitle(null, 4), 'Bölüm 4');
    assert.equal(formatEpisodeTitle(42, 4), 'Bölüm 4');
});

test('formatEpisodeTitle: önek atılır, asıl ad kalır', () => {
    assert.equal(formatEpisodeTitle('1. Bölüm: başlangıç', 1), 'Başlangıç');
    assert.equal(formatEpisodeTitle('Bölüm 2 - yeni dünya', 2), 'Yeni Dünya');
    assert.equal(formatEpisodeTitle('Episode 5: the end', 5), 'The End');
});

test('formatEpisodeTitle: başka bölüm numarası öneki silinmez', () => {
    assert.equal(formatEpisodeTitle('10. Bölüm', 1), '10. Bölüm');
});

test('toTurkishTitleCase: Türkçe büyük harf ve bağlaçlar', () => {
    assert.equal(toTurkishTitleCase('istanbul ve izmir'), 'İstanbul ve İzmir');
    assert.equal(toTurkishTitleCase('ve sonra'), 'Ve Sonra');
    assert.equal(toTurkishTitleCase('ova bölümü'), 'OVA Bölümü');
});

test("toTurkishTitleCase: büyük harfli kelimeler korunur", () => {
    assert.equal(toTurkishTitleCase("DIO'NUN dünyası"), "DIO'nun Dünyası");
    assert.equal(toTurkishTitleCase('JOJO macerası'), 'JOJO Macerası');
});

test('parseStreamId: AnimeciX ID biçimleri', () => {
    assert.deepEqual(parseStreamId('0-82-1-1'), { source: 'animecix', id: '82', season: 1, episode: 1 });
    assert.deepEqual(parseStreamId('0-82:2:13'), { source: 'animecix', id: '82', season: 2, episode: 13 });
    assert.deepEqual(parseStreamId('0-127036'), { source: 'animecix', id: '127036', season: null, episode: null });
});

test('parseStreamId: Kitsu ID biçimleri', () => {
    assert.deepEqual(parseStreamId('kitsu:46171'), { source: 'kitsu', id: '46171', season: 1, episode: 1 });
    assert.deepEqual(parseStreamId('kitsu:46171:5'), { source: 'kitsu', id: '46171', season: 1, episode: 5 });
    assert.deepEqual(parseStreamId('kitsu:46171:2:3'), { source: 'kitsu', id: '46171', season: 2, episode: 3 });
});

test('parseStreamId: IMDb ID biçimleri', () => {
    assert.deepEqual(parseStreamId('tt2560140'), { source: 'imdb', id: 'tt2560140', season: 1, episode: 1 });
    assert.deepEqual(parseStreamId('tt2560140:4'), { source: 'imdb', id: 'tt2560140', season: 1, episode: 4 });
    assert.deepEqual(parseStreamId('tt2560140:3:7'), { source: 'imdb', id: 'tt2560140', season: 3, episode: 7 });
});

test('parseStreamId: bozuk sayılar 1 olur', () => {
    assert.deepEqual(parseStreamId('0-82-x-y'), { source: 'animecix', id: '82', season: 1, episode: 1 });
});

test('parseCatalogExtra: yol ve query parametreleri birleşir', () => {
    assert.deepEqual(parseCatalogExtra('genre=Bilim%20Kurgu&skip=50.json', { search: 'a' }),
        { search: 'a', genre: 'Bilim Kurgu', skip: '50' });
    assert.deepEqual(parseCatalogExtra(undefined, { skip: '0' }), { skip: '0' });
});

test('resolveReleaseDate: bölüm tarihi öncelikli', () => {
    const date = resolveReleaseDate('2004-10-05T00:00:00.000Z', { release_date: '2004-10-03' });
    assert.equal(date.toISOString(), '2004-10-05T00:00:00.000Z');
});

test('resolveReleaseDate: bölüm tarihi yoksa anime tarihi, o da yoksa yıl', () => {
    assert.equal(resolveReleaseDate(null, { release_date: '2004-10-03' }).toISOString().slice(0, 10), '2004-10-03');
    assert.equal(resolveReleaseDate('geçersiz', { year: 2019 }).toISOString(), '2019-01-01T00:00:00.000Z');
    assert.ok(resolveReleaseDate(null, {}) instanceof Date);
});
