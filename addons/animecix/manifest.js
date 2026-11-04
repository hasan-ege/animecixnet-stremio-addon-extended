require("dotenv").config();

const GENRES = [
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
];

const CALENDAR_DAYS = [
    "Bugün",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
    "Pazar",
    "Tüm Hafta"
];

const catalogs = [
    // 1. Yayın Takvimi (Diziler & Animeler)
    {
        type: "series",
        id: "animecix_takvim",
        name: "Yayın Takvimi",
        extra: [
            {
                name: "genre",
                isRequired: false,
                options: CALENDAR_DAYS
            },
            {
                name: "search",
                isRequired: false
            }
        ]
    },
    {
        type: "anime",
        id: "animecix_takvim",
        name: "Yayın Takvimi",
        extra: [
            {
                name: "genre",
                isRequired: false,
                options: CALENDAR_DAYS
            },
            {
                name: "search",
                isRequired: false
            }
        ]
    },

    // 2. Son Çıkanlar (Diziler & Animeler)
    {
        type: "series",
        id: "animecix_son_cikanlar",
        name: "AnimeciX - Son Çıkanlar",
        extra: [{ name: "search", isRequired: false }]
    },
    {
        type: "anime",
        id: "animecix_son_cikanlar",
        name: "AnimeciX - Son Çıkanlar",
        extra: [{ name: "search", isRequired: false }]
    },

    // 3. Sezonun İncileri (Diziler & Animeler)
    {
        type: "series",
        id: "animecix_sezonun_incileri",
        name: "AnimeciX - Sezonun İncileri",
        extra: [{ name: "search", isRequired: false }]
    },
    {
        type: "anime",
        id: "animecix_sezonun_incileri",
        name: "AnimeciX - Sezonun İncileri",
        extra: [{ name: "search", isRequired: false }]
    },

    // 4. En Yüksek Puanlılar (Diziler & Animeler)
    {
        type: "series",
        id: "animecix_en_iyiler",
        name: "AnimeciX - En Yüksek Puanlılar",
        extra: [{ name: "search", isRequired: false }]
    },
    {
        type: "anime",
        id: "animecix_en_iyiler",
        name: "AnimeciX - En Yüksek Puanlılar",
        extra: [{ name: "search", isRequired: false }]
    },

    // 5. AnimeciX Dizileri & Animeleri (Tüm Arşiv + Tür Filtresi + Sayfalama)
    {
        type: "series",
        id: "animecix",
        name: "AnimeciX Dizileri",
        extra: [
            { name: "search", isRequired: false },
            { name: "genre", isRequired: false, options: GENRES },
            { name: "skip", isRequired: false }
        ]
    },
    {
        type: "anime",
        id: "animecix",
        name: "AnimeciX Animeleri",
        extra: [
            { name: "search", isRequired: false },
            { name: "genre", isRequired: false, options: GENRES },
            { name: "skip", isRequired: false }
        ]
    },

    // 6. AnimeciX Filmleri (Tüm Film Arşivi + Tür Filtresi + Sayfalama)
    {
        type: "movie",
        id: "animecix",
        name: "AnimeciX Filmleri",
        extra: [
            { name: "search", isRequired: false },
            { name: "genre", isRequired: false, options: GENRES },
            { name: "skip", isRequired: false }
        ]
    }
];

const manifest = {
    id: 'animecix-stremio-addon',
    version: '1.4.2',
    name: 'AnimeciX',
    description: "AnimeciX'ten türkçe altyazılı animeleri stremionuza getirir.",
    contactEmail: "eyup.elitass@gmail.com",
    logo: `${process.env.HOSTING_URL}/images/animecix.png`,
    background: `${process.env.HOSTING_URL}/images/background.png`,
    behaviorHints: {
        configurable: false,
        configurationRequired: false
    },
    catalogs: catalogs,
    resources: ['catalog', 'meta', 'stream', 'subtitles'],
    types: ["movie", "series", "anime"],
    idPrefixes: ["0-", "kitsu:", "tt"]
};

module.exports = manifest;
