function getLandingHTML(manifest, baseUrl) {
    const manifestUrl = `${baseUrl}/manifest.json`;
    const stremioUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');
    const stremioWebUrl = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${manifest.name} - Stremio Eklentisi</title>
    <link rel="icon" href="/images/animecix.png" type="image/png">
    <meta http-equiv="refresh" content="0; url=${stremioUrl}">
    <style>
        :root {
            --bg-color: #0c0d14;
            --card-bg: rgba(22, 24, 35, 0.96);
            --primary: #7c4dff;
            --primary-hover: #651fff;
            --secondary-bg: #26293d;
            --secondary-hover: #323652;
            --text-color: #ffffff;
            --text-dim: #9e9eb4;
            --border: rgba(255, 255, 255, 0.08);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            background-image: radial-gradient(circle at 50% 20%, rgba(124, 77, 255, 0.18) 0%, transparent 70%);
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 40px 32px;
            max-width: 460px;
            width: 100%;
            text-align: center;
            box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(12px);
            animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .logo-wrap {
            margin: 0 auto 20px;
            width: 90px;
            height: 90px;
            position: relative;
        }
        .logo {
            width: 100%;
            height: 100%;
            border-radius: 20px;
            object-fit: cover;
            box-shadow: 0 10px 25px rgba(124, 77, 255, 0.35);
        }
        .title-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        h1 {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .version {
            font-size: 13px;
            background: rgba(124, 77, 255, 0.22);
            color: #c5b3ff;
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid rgba(124, 77, 255, 0.35);
            font-weight: 600;
        }
        .desc {
            color: var(--text-dim);
            font-size: 14.5px;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .redirect-notice {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13.5px;
            color: #4ade80;
            background: rgba(74, 222, 128, 0.1);
            padding: 8px 16px;
            border-radius: 20px;
            margin-bottom: 26px;
            font-weight: 500;
        }
        .pulse {
            width: 8px;
            height: 8px;
            background: #4ade80;
            border-radius: 50%;
            box-shadow: 0 0 10px #4ade80;
            animation: pulseAnim 1.6s infinite ease-in-out;
        }
        @keyframes pulseAnim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.6; }
        }
        .btn-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 14px 20px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }
        .btn-primary {
            background: var(--primary);
            color: #ffffff;
            box-shadow: 0 8px 20px rgba(124, 77, 255, 0.35);
        }
        .btn-primary:hover {
            background: var(--primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(124, 77, 255, 0.45);
        }
        .btn-secondary {
            background: var(--secondary-bg);
            color: #ffffff;
            border: 1px solid var(--border);
        }
        .btn-secondary:hover {
            background: var(--secondary-hover);
            transform: translateY(-2px);
        }
        .hint {
            margin-top: 22px;
            font-size: 12.5px;
            color: var(--text-dim);
            line-height: 1.5;
        }
        #toast {
            display: none;
            position: fixed;
            bottom: 28px;
            left: 50%;
            transform: translateX(-50%);
            background: #22c55e;
            color: white;
            padding: 10px 22px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 6px 18px rgba(0,0,0,0.4);
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo-wrap">
            <img class="logo" src="/images/animecix.png" alt="AnimeciX">
        </div>
        <div class="title-row">
            <h1>${manifest.name}</h1>
            <span class="version">v${manifest.version}</span>
        </div>
        <p class="desc">${manifest.description}</p>
        <div class="redirect-notice">
            <span class="pulse"></span> Stremio'ya yönlendiriliyor...
        </div>

        <div class="btn-group">
            <a href="${stremioUrl}" class="btn btn-primary" id="installBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Stremio ile Kur
            </a>
            <a href="${stremioWebUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" id="webInstallBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Stremio Web ile Kur
            </a>
            <button class="btn btn-secondary" onclick="copyManifest()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Manifest URL'sini Kopyala
            </button>
        </div>

        <p class="hint">
            Stremio otomatik açılmadıysa yukarıdaki <strong>Stremio ile Kur</strong> butonuna tıklayabilirsiniz.
        </p>
    </div>

    <div id="toast">Manifest linki kopyalandı!</div>

    <script>
        (function() {
            const dynamicManifestUrl = window.location.origin + '/manifest.json';
            const dynamicStremioUrl = 'stremio://' + window.location.host + '/manifest.json';
            const dynamicWebUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(dynamicManifestUrl);

            const installBtn = document.getElementById('installBtn');
            const webBtn = document.getElementById('webInstallBtn');
            if (installBtn) installBtn.href = dynamicStremioUrl;
            if (webBtn) webBtn.href = dynamicWebUrl;

            try {
                window.location.href = dynamicStremioUrl;
            } catch (err) {
                console.warn(err);
            }

            window.copyManifest = function() {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(dynamicManifestUrl).then(showToast);
                } else {
                    prompt('Manifest URL:', dynamicManifestUrl);
                }
            };

            function showToast() {
                const toast = document.getElementById('toast');
                if (!toast) return;
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 2500);
            }
        })();
    </script>
</body>
</html>`;
}

module.exports = { getLandingHTML };
