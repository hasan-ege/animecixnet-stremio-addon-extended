# 🎬 AnimeciX Stremio Eklentisi (Stremio Addon)

<p align="center">
  <img src="static/images/animecix.png" alt="AnimeciX Logo" width="120" />
</p>

<p align="center">
  <strong>AnimeciX üzerindeki binlerce anime dizi ve filmini Türkçe altyazılı olarak Stremio'ya getiren resmi olmayan eklenti.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Versiyon-1.4.1-8A5AAB.svg" alt="Versiyon" />
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg" alt="Node" />
  <img src="https://img.shields.io/badge/Docker-Destekli-blue.svg" alt="Docker" />
  <img src="https://img.shields.io/badge/Stremio-v4%20%2F%20v5-purple.svg" alt="Stremio" />
</p>

---

## ✨ Özellikler

- 📅 **Canlı Yayın Takvimi (Stremio Kategori Takvimi)**:
  - Türkiye saatine (`Europe/Istanbul`) göre çalışan haftalık anime yayın takvimi.
  - Stremio arayüzünden doğrudan kategori olarak seçilebilir: **Bugün**, **Pazartesi**, **Salı**, **Çarşamba**, **Perşembe**, **Cuma**, **Cumartesi**, **Pazar** ve **Tüm Hafta**.
  - 5 dakikalık akıllı önbellek ile gün geçişlerinde ve yeni bölüm yayınlandığında otomatik güncellenir.
- 📺 **Geniş Arşiv (Diziler & Filmler)**:
  - 2500'den fazla anime dizisi ve 500'den fazla anime filmi.
  - 39 farklı türe (Aksiyon, Dram, Komedi, Isekai, Shounen, Seinen, Romantik vb.) göre listeleme ve filtreleme.
- 🎯 **Özel Keşfet Koleksiyonları**:
  - **Son Çıkanlar**: Platforma yeni eklenen ve güncellenen animeler.
  - **Sezonun İncileri**: İçinde bulunulan sezonun popüler yapımları.
  - **En Yüksek Puanlılar**: MyAnimeList ve TMDB puanlarına göre sıralı başyapıtlar.
- 📝 **Türkçe Bölüm Adları & Kitsu/TMDB Görselleri**:
  - Bölümler Türkçeleştirilmiş isimleriyle, kapak görselleri ve bölüm özetleriyle sunulur.
  - Otomatik `.ass` -> `.srt` altyazı dönüştürme ve çoklu kaynak desteği.
- 🔍 **Kapsamlı Arama**:
  - Anime adıyla arama veya takvim içinde anlık filtreleme.

---

## 🚀 Hızlı Kurulum

### 1. Uzak / Yayındaki Sunucu Üzerinden Kurulum

Eğer eklenti bir sunucuda çalışıyorsa, Stremio arama çubuğuna manifest bağlantısını yapıştırmanız yeterlidir:

```text
stremio://<SUNUCU_ADRESI>/addon/manifest.json
```

Web tarayıcınızdan açmak için:
```text
https://<SUNUCU_ADRESI>/
```
Sayfadaki **"STREMIO'YA YÜKLE"** butonuna basarak tek tıkla Stremio uygulamanıza ekleyebilirsiniz.

---

## 🛠️ Kendi Sunucunuzda / Bilgisayarınızda Çalıştırma

### Yöntem A: Docker ile Çalıştırma (Önerilen)

Docker kurulu olan herhangi bir sistemde kolayca ayağa kaldırabilirsiniz:

```bash
docker run -d \
  --name animecix-stremio \
  -p 7000:7000 \
  --restart unless-stopped \
  -e PORT=7000 \
  -e HOSTING_URL=http://SUNUCU_IP_ADRESINIZ:7000 \
  ghcr.io/aflextr/animecixnet-stremio-addon-image:latest
```

#### Docker Compose ile:
`docker-compose.yml` dosyası oluşturun:

```yaml
version: '3.8'

services:
  animecix-stremio:
    image: ghcr.io/aflextr/animecixnet-stremio-addon-image:latest
    container_name: animecix-stremio
    restart: unless-stopped
    ports:
      - "7000:7000"
    environment:
      - PORT=7000
      - HOSTING_URL=http://SUNUCU_IP_ADRESINIZ:7000
```

Ardından başlatın:
```bash
docker compose up -d
```

---

### Yöntem B: Node.js ile Kaynak Koddan Çalıştırma

Gereksinim: **Node.js 18+**

1. Depoyu klonlayın ve klasöre girin:
   ```bash
   git clone https://github.com/aflextr/animecixnet-stremio-addon.git
   cd animecixnet-stremio-addon
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyasını oluşturun / düzenleyin:
   ```env
   PORT=7000
   HOSTING_URL=http://localhost:7000
   API_HOST=https://animecix.tv/secure
   ```

4. Sunucuyu başlatın:
   ```bash
   npm start
   ```

5. Stremio'ya ekleyin:
   Stremio eklenti arama kutusuna şu bağlantıyı yapıştırın:
   ```text
   http://127.0.0.1:7000/addon/manifest.json
   ```

---

## ⚙️ Ortam Değişkenleri (`.env`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `7000` | Eklenti sunucusunun dinleyeceği port |
| `HOSTING_URL` | `http://localhost:7000` | Eklentiye dış ağdan erişilen tam adres (IP veya alan adı) |
| `API_HOST` | `https://animecix.tv/secure` | AnimeciX API adresi |
| `SUBTITLEAI_URL`| `https://tau-video.xyz` | Altyazı ve video kaynak çözümleme servisi |
| `USERAGENT` | Chrome User Agent | İsteklerde kullanılan tarayıcı kimliği |
| `DISCORD_RPC_ENABLED` | `true` | Discord Rich Presence etkinleştirme |

---

## 📁 Proje Mimarisi

```text
├── index.js                  # Express sunucusu, Stremio rota tanımları & katalog yönlendiricisi
├── manifest.js               # Stremio Addon manifestosu (kataloglar, türler, versiyon)
├── header.js                 # API istekleri için yapılandırılmış başlıklar
├── Dockerfile                # Konteyner derleme talimatları
├── .github/workflows/        # Portainer ve GitHub Container Registry (GHCR) CI/CD akışları
└── src/
    ├── calendarService.js    # Yayın takvimi veri çekme, önbellekleme ve Stremio meta formatlama
    ├── titleBrowseService.js # 2500+ Dizi & Film arşivinin sayfalanmış katalog servisi
    ├── episodeService.js     # Bölüm listesi ve Türkçe bölüm isimleri çözümleme
    ├── homepage.js           # Son çıkanlar, en iyiler ve sezon incileri katalogları
    ├── landingTemplate.js    # Eklenti kurulum web sayfası
    ├── kitsu.js              # Kitsu meta ve kapak görseli entegrasyonu
    ├── search.js             # Video arama ve detay çözümleme
    └── videos.js             # Oynatma kaynakları ve altyazı stream yönlendirmeleri
```

---

- ⭐ Projeyi beğendiyseniz GitHub üzerinden bir yıldız bırakabilirsiniz!

---

## ⚖️ Yasal Uyarı / Disclaimer

Bu proje resmi bir AnimeciX veya Stremio eklentisi değildir. Herhangi bir video barındırmaz veya depolamaz. Yalnızca kamuya açık kaynaklardan elde edilen meta verileri ve akış bağlantılarını Stremio protokolüne dönüştürür.
