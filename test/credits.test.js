const test = require('node:test');
const assert = require('node:assert/strict');
const { extractYoutubeId, buildCreditsMeta } = require('../addons/animecix/lib/credits');

test('extractYoutubeId: embed, watch ve kısa adresler', () => {
    assert.equal(extractYoutubeId('https://www.youtube.com/embed/Qx01pn9l-6g?enablejsapi=1&autoplay=1'), 'Qx01pn9l-6g');
    assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=Qx01pn9l-6g&t=3'), 'Qx01pn9l-6g');
    assert.equal(extractYoutubeId('https://youtu.be/Qx01pn9l-6g'), 'Qx01pn9l-6g');
    assert.equal(extractYoutubeId(''), null);
    assert.equal(extractYoutubeId(null), null);
    assert.equal(extractYoutubeId('https://vimeo.com/123'), null);
});

const person = (name, pivot) => ({ name, pivot });

test('buildCreditsMeta: kadro, yönetmen, senarist ve fragman', () => {
    const meta = buildCreditsMeta({
        trailer: 'https://www.youtube.com/embed/Qx01pn9l-6g?autoplay=1',
        credits: [
            person('Masakazu Morita', { character: 'Ichigo Kurosaki', department: null }),
            person('Fumiko Orikasa', { character: 'Rukia Kuchiki', department: null }),
            person('Masakazu Morita', { character: 'Hollow Ichigo', department: null }),
            person('Manabu Okamoto', { department: 'directing', job: 'director' }),
            person('Manabu Okamoto', { department: 'directing', job: 'series director' }),
            person('Biri', { department: 'directing', job: 'assistant director' }),
            person('Yazar', { department: 'writing', job: 'series composition' }),
            person('Ses', { department: 'sound', job: 'sound director' })
        ]
    });
    assert.deepEqual(meta.cast, ['Masakazu Morita', 'Fumiko Orikasa']);
    assert.deepEqual(meta.director, ['Manabu Okamoto']);
    assert.deepEqual(meta.writer, ['Yazar']);
    assert.deepEqual(meta.trailers, [{ source: 'Qx01pn9l-6g', type: 'Trailer' }]);
    assert.deepEqual(meta.trailerStreams, [{ ytId: 'Qx01pn9l-6g', title: 'Fragman' }]);
});

test('buildCreditsMeta: kadro en fazla 10 kişi', () => {
    const credits = Array.from({ length: 15 }, (_, i) => person(`Kişi ${i}`, { character: `Karakter ${i}` }));
    assert.equal(buildCreditsMeta({ credits }).cast.length, 10);
});

test('buildCreditsMeta: veri yoksa boş alan eklemez', () => {
    assert.deepEqual(buildCreditsMeta({ trailer: '', credits: [] }), {});
    assert.deepEqual(buildCreditsMeta(undefined), {});
});
