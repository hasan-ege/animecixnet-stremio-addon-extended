require("dotenv").config()
const manifest = {
    id: 'animecix-stremio-addon',
    version: '1.4.1',
    name: 'AnimeciX',
    description: "AnimeciX'ten türkçe altyazılı animeleri stremionuza getirir.",
    contactEmail: "eyup.elitass@gmail.com",
    logo: `${process.env.HOSTING_URL}/images/animecix.png`,
    background: `${process.env.HOSTING_URL}/images/background.png`,
    behaviorHints: {

    },
    config: [{
        key: "animecix",
        type: "select",
        required: false
    }],
    catalogs: [
    {
        type: "series",
        id: "animecix_takvim",
        name: "Yayın Takvimi",
        extra: [{
            name: "genre",
            isRequired: false,
            options: [
                "Bugün",
                "Pazartesi",
                "Salı",
                "Çarşamba",
                "Perşembe",
                "Cuma",
                "Cumartesi",
                "Pazar",
                "Tüm Hafta"
            ]
        }, {
            name: "search",
            isRequired: false
        }],
        genres: [
            "Bugün",
            "Pazartesi",
            "Salı",
            "Çarşamba",
            "Perşembe",
            "Cuma",
            "Cumartesi",
            "Pazar",
            "Tüm Hafta"
        ]
    },
    {
        type: "series",
        id: "animecix_son_cikanlar",
        name: "AnimeciX - Son Çıkanlar",
        extra: [{
            name: "search",
            isRequired: false
        }]
    },
    {
        type: "series",
        id: "animecix_sezonun_incileri",
        name: "AnimeciX - Sezonun İncileri",
        extra: [{
            name: "search",
            isRequired: false
        }]
    },
    {
        type: "series",
        id: "animecix_en_iyiler",
        name: "AnimeciX - En Yüksek Puanlılar",
        extra: [{
            name: "search",
            isRequired: false
        }]
    },
    {
        type: "series",
        id: "animecix",
        name: "AnimeciX Dizileri",
        extra: [{
            name: "search",
            isRequired: false
        }, {
            name: "genre",
            isRequired: false,
            options: [
                "Dram",
                "Aksiyon",
                "Gerilim",
                "Komedi",
                "Bilim Kurgu",
                "Korku",
                "Gizem",
                "Romantik",
                "Tarihî",
                "Büyü",
                "Spor",
                "Isekai",
                "Askerî",
                "Dedektif",
                "Ölüm",
                "Gizli Organizasyon",
                "Ecchi",
                "Harem",
                "Ters Harem",
                "Vampir",
                "Kan, Vahşet",
                "Shounen",
                "Shounen Ai",
                "Seinen",
                "Canavar",
                "Doğaüstü",
                "Şeytan",
                "İntikam",
                "Zaman Yolculuğu",
                "Okul",
                "Uzay",
                "Shoujo",
                "Oyun",
                "Samuray",
                "Ninja",
                "Yaşamdan Kesitler",
                "İş Hayatı",
                "Dövüş Sanatları",
                "Yuri",
                "Yaoi"
            ]
        }, {
            name: "skip",
            isRequired: false
        }],
        genres: [
            "Dram",
            "Aksiyon",
            "Gerilim",
            "Komedi",
            "Bilim Kurgu",
            "Korku",
            "Gizem",
            "Romantik",
            "Tarihî",
            "Büyü",
            "Spor",
            "Isekai",
            "Askerî",
            "Dedektif",
            "Ölüm",
            "Gizli Organizasyon",
            "Ecchi",
            "Harem",
            "Ters Harem",
            "Vampir",
            "Kan, Vahşet",
            "Shounen",
            "Shounen Ai",
            "Seinen",
            "Canavar",
            "Doğaüstü",
            "Şeytan",
            "İntikam",
            "Zaman Yolculuğu",
            "Okul",
            "Uzay",
            "Shoujo",
            "Oyun",
            "Samuray",
            "Ninja",
            "Yaşamdan Kesitler",
            "İş Hayatı",
            "Dövüş Sanatları",
            "Yuri",
            "Yaoi"
        ]
    },
    {
        type: "movie",
        id: "animecix",
        name: "AnimeciX Filmleri",
        extra: [{
            name: "search",
            isRequired: false
        }, {
            name: "genre",
            isRequired: false,
            options: [
                "Dram",
                "Aksiyon",
                "Gerilim",
                "Komedi",
                "Bilim Kurgu",
                "Korku",
                "Gizem",
                "Romantik",
                "Tarihî",
                "Büyü",
                "Spor",
                "Isekai",
                "Askerî",
                "Dedektif",
                "Ölüm",
                "Gizli Organizasyon",
                "Ecchi",
                "Harem",
                "Ters Harem",
                "Vampir",
                "Kan, Vahşet",
                "Shounen",
                "Shounen Ai",
                "Seinen",
                "Canavar",
                "Doğaüstü",
                "Şeytan",
                "İntikam",
                "Zaman Yolculuğu",
                "Okul",
                "Uzay",
                "Shoujo",
                "Oyun",
                "Samuray",
                "Ninja",
                "Yaşamdan Kesitler",
                "İş Hayatı",
                "Dövüş Sanatları",
                "Yuri",
                "Yaoi"
            ]
        }, {
            name: "skip",
            isRequired: false
        }],
        genres: [
            "Dram",
            "Aksiyon",
            "Gerilim",
            "Komedi",
            "Bilim Kurgu",
            "Korku",
            "Gizem",
            "Romantik",
            "Tarihî",
            "Büyü",
            "Spor",
            "Isekai",
            "Askerî",
            "Dedektif",
            "Ölüm",
            "Gizli Organizasyon",
            "Ecchi",
            "Harem",
            "Ters Harem",
            "Vampir",
            "Kan, Vahşet",
            "Shounen",
            "Shounen Ai",
            "Seinen",
            "Canavar",
            "Doğaüstü",
            "Şeytan",
            "İntikam",
            "Zaman Yolculuğu",
            "Okul",
            "Uzay",
            "Shoujo",
            "Oyun",
            "Samuray",
            "Ninja",
            "Yaşamdan Kesitler",
            "İş Hayatı",
            "Dövüş Sanatları",
            "Yuri",
            "Yaoi"
        ]
    }],
    resources: ['addon_catalog', 'catalog', 'stream', 'meta', 'subtitles'],
    types: ["movie", 'series'],
    idPrefixes: ["0-"]
}

module.exports = manifest;
