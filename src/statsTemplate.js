/**
 * AnimeciX Stremio Eklentisi - Canlı Aktif Kullanıcı & İstatistik Paneli Arayüzü
 * Gerçek zamanlı SSE (Server-Sent Events), kullanıcı bazlı özel log modalı ve anlık sayaç akışı destekli
 */

function getStatsHTML(baseUrl) {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AnimeciX - Canlı Aktif Kullanıcı & İstatistik Paneli</title>
    <link rel="icon" href="/images/animecix.png" type="image/png">
    <style>
        :root {
            --bg-color: #0c0d14;
            --card-bg: rgba(22, 24, 35, 0.95);
            --card-hover: rgba(28, 31, 46, 0.98);
            --primary: #8b5cf6;
            --primary-hover: #7c3aed;
            --primary-glow: rgba(139, 92, 246, 0.35);
            --secondary-bg: #1e2132;
            --secondary-hover: #292d44;
            --text-main: #ffffff;
            --text-dim: #9ca3af;
            --text-muted: #6b7280;
            --border: rgba(255, 255, 255, 0.08);
            --border-highlight: rgba(139, 92, 246, 0.35);
            --green: #10b981;
            --green-glow: rgba(16, 185, 129, 0.3);
            --amber: #f59e0b;
            --cyan: #06b6d4;
            --rose: #f43f5e;
            --radius-lg: 20px;
            --radius-md: 14px;
            --radius-sm: 8px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: var(--bg-color);
            color: var(--text-main);
            min-height: 100vh;
            padding: 24px;
            background-image: 
                radial-gradient(circle at 15% 10%, rgba(139, 92, 246, 0.15) 0%, transparent 45%),
                radial-gradient(circle at 85% 20%, rgba(6, 182, 212, 0.12) 0%, transparent 45%),
                radial-gradient(circle at 50% 90%, rgba(16, 185, 129, 0.09) 0%, transparent 50%);
            background-attachment: fixed;
        }

        .container {
            max-width: 1260px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 22px;
        }

        /* Üst Çubuk (Header) */
        header {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 18px 26px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(16px);
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .logo-box {
            width: 50px;
            height: 50px;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 6px 18px var(--primary-glow);
            flex-shrink: 0;
        }

        .logo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .header-info h1 {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header-info p {
            font-size: 13px;
            color: var(--text-dim);
            margin-top: 2px;
        }

        .version-badge {
            font-size: 11px;
            background: rgba(139, 92, 246, 0.2);
            color: #c4b5fd;
            padding: 2px 8px;
            border-radius: 6px;
            border: 1px solid rgba(139, 92, 246, 0.35);
            font-weight: 600;
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 7px 14px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 600;
        }

        .pulse-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 10px #10b981;
            animation: pulseDot 1.6s infinite ease-in-out;
        }

        @keyframes pulseDot {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.4); opacity: 0.4; }
        }

        .clock-box {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            padding: 7px 14px;
            border-radius: 30px;
            color: var(--text-main);
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
        }

        .action-btn {
            background: var(--secondary-bg);
            color: var(--text-main);
            border: 1px solid var(--border);
            padding: 8px 14px;
            border-radius: var(--radius-sm);
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .action-btn:hover {
            background: var(--secondary-hover);
            border-color: rgba(255, 255, 255, 0.18);
            transform: translateY(-1px);
        }

        .action-btn.btn-danger {
            background: rgba(244, 63, 94, 0.15);
            border-color: rgba(244, 63, 94, 0.3);
            color: #fda4af;
        }

        .action-btn.btn-danger:hover {
            background: rgba(244, 63, 94, 0.3);
            border-color: rgba(244, 63, 94, 0.5);
            color: #ffffff;
        }

        /* İstatistik Kartları Izgarası */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
        }

        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 18px 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(12px);
            position: relative;
            overflow: hidden;
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            border-color: var(--border-highlight);
        }

        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            opacity: 0.85;
        }

        .stat-card.green::before { background: linear-gradient(90deg, transparent, var(--green), transparent); }
        .stat-card.purple::before { background: linear-gradient(90deg, transparent, var(--primary), transparent); }
        .stat-card.cyan::before { background: linear-gradient(90deg, transparent, var(--cyan), transparent); }
        .stat-card.amber::before { background: linear-gradient(90deg, transparent, var(--amber), transparent); }
        .stat-card.rose::before { background: linear-gradient(90deg, transparent, var(--rose), transparent); }

        .stat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }

        .stat-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .stat-icon {
            font-size: 17px;
            opacity: 0.9;
        }

        .stat-value {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -1px;
            color: var(--text-main);
            line-height: 1.1;
            margin-bottom: 6px;
            font-variant-numeric: tabular-nums;
        }

        .stat-sub {
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* İki Sütun: Cihaz Dağılımı & İstek Günlüğü */
        .two-cols {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
            gap: 16px;
        }

        .panel {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 22px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(12px);
        }

        .panel-title {
            font-size: 15px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }

        .distribution-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .dist-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .dist-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13.5px;
        }

        .dist-name {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
        }

        .dist-count {
            font-weight: 600;
            color: var(--text-dim);
            font-size: 13px;
        }

        .progress-track {
            height: 6px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--cyan));
            border-radius: 4px;
            transition: width 0.4s ease;
        }

        /* Kullanıcılar Paneli ve Tablosu */
        .users-panel {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 22px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(12px);
        }

        .panel-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 18px;
        }

        .search-box {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            padding: 8px 14px;
            border-radius: var(--radius-sm);
            font-size: 13px;
            color: var(--text-main);
            outline: none;
            width: 260px;
            transition: border-color 0.2s ease;
        }

        .search-box:focus {
            border-color: var(--primary);
        }

        .table-wrap {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13.5px;
        }

        th {
            color: var(--text-dim);
            font-size: 11.5px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            font-weight: 600;
        }

        td {
            padding: 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            vertical-align: middle;
        }

        tr.user-row {
            cursor: pointer;
            transition: background 0.2s ease;
        }

        tr.user-row:hover td {
            background: rgba(139, 92, 246, 0.07);
        }

        tr.just-updated td {
            background: rgba(139, 92, 246, 0.18) !important;
            transition: background 0.8s ease;
        }

        /* Sıfat-İsim Takma Ad Rozeti */
        .user-cell {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .nickname-badge {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            font-weight: 700;
            font-size: 14px;
            color: #f3f4f6;
            letter-spacing: -0.2px;
        }

        .nickname-badge .avatar-icon {
            font-size: 16px;
        }

        .ip-sub {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11.5px;
            color: var(--text-muted);
        }

        .device-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-weight: 500;
            color: #e5e7eb;
        }

        .action-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12.5px;
            font-weight: 500;
        }

        .action-stream { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
        .action-calendar { background: rgba(139, 92, 246, 0.15); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.25); }
        .action-search { background: rgba(6, 182, 212, 0.15); color: #67e8f9; border: 1px solid rgba(6, 182, 212, 0.25); }
        .action-catalog { background: rgba(245, 158, 11, 0.15); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.25); }
        .action-meta { background: rgba(244, 63, 94, 0.15); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.25); }
        .action-other { background: rgba(255, 255, 255, 0.08); color: #e5e7eb; border: 1px solid rgba(255, 255, 255, 0.1); }

        .time-badge {
            font-variant-numeric: tabular-nums;
            color: var(--text-dim);
            font-size: 12.5px;
            font-weight: 500;
        }

        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
        }

        .status-dot.active { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .status-dot.idle { background: #f59e0b; }

        .btn-log {
            background: rgba(139, 92, 246, 0.18);
            border: 1px solid rgba(139, 92, 246, 0.35);
            color: #c4b5fd;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn-log:hover {
            background: var(--primary);
            border-color: var(--primary);
            color: #ffffff;
            transform: translateY(-1px);
        }

        .empty-state {
            text-align: center;
            padding: 44px 20px;
            color: var(--text-dim);
        }

        .empty-icon {
            font-size: 42px;
            margin-bottom: 12px;
            opacity: 0.7;
        }

        .empty-state p {
            font-size: 14px;
            max-width: 440px;
            margin: 0 auto;
            line-height: 1.5;
        }

        /* Canlı Aktivite Akışı */
        .feed-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 280px;
            overflow-y: auto;
            padding-right: 4px;
        }

        .feed-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: var(--radius-sm);
            font-size: 12.5px;
            transition: background 0.2s ease;
        }

        .feed-item:hover {
            background: rgba(255, 255, 255, 0.05);
        }

        .feed-left {
            display: flex;
            align-items: center;
            gap: 10px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .feed-time {
            font-family: ui-monospace, monospace;
            color: var(--text-muted);
            font-size: 11px;
            flex-shrink: 0;
        }

        .method-badge {
            font-size: 10.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(139, 92, 246, 0.25);
            color: #c4b5fd;
            flex-shrink: 0;
        }

        .feed-path {
            color: var(--text-dim);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 420px;
        }

        .feed-user {
            font-weight: 600;
            color: #c4b5fd;
            background: rgba(139, 92, 246, 0.15);
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11.5px;
            flex-shrink: 0;
        }

        /* Kullanıcı Özel Log Modalı (Glassmorphism Modal) */
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(5, 6, 12, 0.82);
            backdrop-filter: blur(12px);
            z-index: 9999;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: fadeIn 0.2s ease;
        }

        .modal-overlay.active {
            display: flex;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .modal-box {
            background: #141724;
            border: 1px solid rgba(139, 92, 246, 0.35);
            border-radius: var(--radius-lg);
            width: 100%;
            max-width: 820px;
            max-height: 88vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75);
            overflow: hidden;
            animation: slideUp 0.22s ease-out;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(22px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-header {
            padding: 18px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.02);
        }

        .modal-user-info {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .modal-avatar {
            font-size: 32px;
            background: rgba(139, 92, 246, 0.15);
            width: 52px;
            height: 52px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(139, 92, 246, 0.3);
            flex-shrink: 0;
        }

        .modal-title h2 {
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .modal-title p {
            font-size: 12.5px;
            color: var(--text-dim);
            margin-top: 3px;
        }

        .modal-close {
            background: var(--secondary-bg);
            border: 1px solid var(--border);
            color: var(--text-dim);
            width: 38px;
            height: 38px;
            border-radius: 10px;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }

        .modal-close:hover {
            color: #ffffff;
            background: rgba(244, 63, 94, 0.3);
            border-color: rgba(244, 63, 94, 0.5);
        }

        .modal-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            padding: 14px 24px;
            background: rgba(0, 0, 0, 0.25);
            border-bottom: 1px solid var(--border);
        }

        .m-stat {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .m-stat .m-label {
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }

        .m-stat .m-val {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-main);
        }

        .modal-body {
            padding: 20px 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            flex-grow: 1;
        }

        .log-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: var(--radius-sm);
            gap: 12px;
            font-size: 13px;
            transition: background 0.15s ease;
        }

        .log-row:hover {
            background: rgba(255, 255, 255, 0.04);
        }

        .log-main {
            display: flex;
            flex-direction: column;
            gap: 5px;
            flex-grow: 1;
            overflow: hidden;
        }

        .log-header-line {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .log-time {
            font-family: ui-monospace, monospace;
            font-size: 11.5px;
            color: var(--text-muted);
        }

        .log-url {
            font-family: ui-monospace, monospace;
            font-size: 11.5px;
            color: var(--text-dim);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            background: rgba(0, 0, 0, 0.2);
            padding: 4px 8px;
            border-radius: 4px;
        }

        /* Özel Kaydırma Çubuğu */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }

        @media (max-width: 768px) {
            body { padding: 14px; }
            header { padding: 16px; }
            .header-info h1 { font-size: 18px; }
            .stat-value { font-size: 26px; }
            .search-box { width: 100%; }
            .modal-stats { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Başlık & Kontrol Çubuğu -->
        <header>
            <div class="header-left">
                <div class="logo-box">
                    <img src="/images/animecix.png" alt="AnimeciX">
                </div>
                <div class="header-info">
                    <h1>AnimeciX Canlı İstatistikler <span class="version-badge">v1.4.1</span></h1>
                    <p>Stremio Eklentisi Gerçek Zamanlı Trafik & Kullanıcı Monitörü</p>
                </div>
            </div>
            <div class="header-right">
                <div class="status-pill" id="connStatus">
                    <span class="pulse-dot"></span>
                    <span id="connStatusText">Canlı Veri Akışı Açık</span>
                </div>
                <div class="clock-box" id="istanbulClock">
                    ⏱️ --:--:--
                </div>
                <button class="action-btn" id="pauseBtn" onclick="togglePause()" title="Canlı akışı duraklat veya devam ettir">
                    <span id="pauseIcon">⏸️</span>
                    <span id="pauseText">Duraklat</span>
                </button>
                <button class="action-btn" onclick="fetchManual()" title="Manuel yenile">
                    🔄 Yenile
                </button>
                <button class="action-btn btn-danger" onclick="clearStats()" title="Tüm sayaçları ve aktif kullanıcı listesini sıfırla">
                    🗑️ Temizle
                </button>
                <a href="/" class="action-btn" title="Eklenti Ana Sayfası">
                    🏠 Ana Sayfa
                </a>
                <a href="/api/stats" target="_blank" class="action-btn" title="Ham JSON API Çıktısı">
                    📋 JSON API
                </a>
            </div>
        </header>

        <!-- Özet Sayaç Kartları (Anlık Tıklayan & Akıcı) -->
        <div class="stats-grid">
            <div class="stat-card green">
                <div class="stat-header">
                    <span class="stat-label">Aktif Kullanıcı</span>
                    <span class="stat-icon">👥</span>
                </div>
                <div class="stat-value" id="active1m">0</div>
                <div class="stat-sub">🟢 Son 1 dakika içinde aktif</div>
            </div>

            <div class="stat-card purple">
                <div class="stat-header">
                    <span class="stat-label">Son 5 Dk Oturum</span>
                    <span class="stat-icon">🕒</span>
                </div>
                <div class="stat-value" id="active5m">0</div>
                <div class="stat-sub">🟣 Son 5 dakika içindeki cihazlar</div>
            </div>

            <div class="stat-card cyan">
                <div class="stat-header">
                    <span class="stat-label">Anlık İstek</span>
                    <span class="stat-icon">⚡</span>
                </div>
                <div class="stat-value" id="inFlight">0</div>
                <div class="stat-sub">İşlenen eşzamanlı istekler</div>
            </div>

            <div class="stat-card amber">
                <div class="stat-header">
                    <span class="stat-label">Toplam İstek</span>
                    <span class="stat-icon">📈</span>
                </div>
                <div class="stat-value" id="totalRequests">0</div>
                <div class="stat-sub">Açılıştan beri toplam istek</div>
            </div>

            <div class="stat-card rose">
                <div class="stat-header">
                    <span class="stat-label">Bellek (RAM)</span>
                    <span class="stat-icon">💾</span>
                </div>
                <div class="stat-value" id="ramMb">0 MB</div>
                <div class="stat-sub">Node.js RSS kullanımı</div>
            </div>

            <div class="stat-card purple">
                <div class="stat-header">
                    <span class="stat-label">Çalışma Süresi</span>
                    <span class="stat-icon">⏱️</span>
                </div>
                <div class="stat-value" id="uptimeText" style="font-size: 20px; padding-top: 6px;">0 sn</div>
                <div class="stat-sub">Kesintisiz uptime (Canlı)</div>
            </div>
        </div>

        <!-- İki Sütun: Cihaz Dağılımı & Canlı Aktivite Akışı -->
        <div class="two-cols">
            <!-- Cihaz Dağılımı -->
            <div class="panel">
                <div class="panel-title">
                    <span>📱 Bağlı Cihaz Dağılımı</span>
                    <span id="deviceTotalBadge" class="version-badge">0 Cihaz</span>
                </div>
                <div class="distribution-list" id="deviceList">
                    <div class="empty-state" style="padding: 20px;">
                        <p>Şu an bağlı cihaz tespit edilmedi.</p>
                    </div>
                </div>
            </div>

            <!-- Canlı İstek Akışı (Feed) -->
            <div class="panel">
                <div class="panel-title">
                    <span>⚡ Canlı İstek Günlüğü</span>
                    <span class="version-badge">Son İstekler</span>
                </div>
                <div class="feed-list" id="activityFeed">
                    <div class="empty-state" style="padding: 20px;">
                        <p>Henüz istek akışı kaydedilmedi.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Aktif Kullanıcılar Detay Tablosu -->
        <div class="users-panel">
            <div class="panel-toolbar">
                <div class="panel-title" style="margin: 0; padding: 0; border: none;">
                    <span>👥 Aktif Kullanıcı Listesi <small style="font-size: 12px; font-weight: normal; color: var(--text-dim); margin-left: 8px;">(Kullanıcıya tıklayarak tüm loglarını görebilirsiniz)</small></span>
                </div>
                <input type="text" class="search-box" id="searchInput" placeholder="🔍 İsim, cihaz veya IP ara..." oninput="renderTable()">
            </div>

            <div class="table-wrap">
                <table id="usersTable">
                    <thead>
                        <tr>
                            <th>Kullanıcı (Takma Ad)</th>
                            <th>Cihaz / Platform</th>
                            <th>Son Eylem / İstek</th>
                            <th>Son Görülme</th>
                            <th>İstekler</th>
                            <th>Durum</th>
                            <th>İşlem / Loglar</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr>
                            <td colspan="7">
                                <div class="empty-state">
                                    <div class="empty-icon">📺</div>
                                    <p>Şu anda aktif kullanıcı bulunmuyor.<br>Stremio'da bir anime izlendiğinde veya tıklandığında burada <strong>anında</strong> görünecektir.</p>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Kullanıcı Özel Log Modalı (Detaylı İstek Geçmişi) -->
    <div id="userLogsModal" class="modal-overlay" onclick="closeUserLogs(event)">
        <div class="modal-box" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-user-info">
                    <div class="modal-avatar" id="modalAvatar">🥔</div>
                    <div class="modal-title">
                        <h2><span id="modalNickname">strong-potato</span> <span class="version-badge" id="modalStatusBadge">🟢 Aktif</span></h2>
                        <p id="modalUserMeta">Stremio (Android) • 176.240.***</p>
                    </div>
                </div>
                <button class="modal-close" onclick="closeUserLogs()">&times;</button>
            </div>
            <div class="modal-stats">
                <div class="m-stat">
                    <span class="m-label">Toplam İstek</span>
                    <span class="m-val" id="modalTotalReq">0</span>
                </div>
                <div class="m-stat">
                    <span class="m-label">İlk Görülme</span>
                    <span class="m-val" id="modalFirstSeen">--:--:--</span>
                </div>
                <div class="m-stat">
                    <span class="m-label">Son İstek Zamanı</span>
                    <span class="m-val" id="modalLastSeen">Şimdi</span>
                </div>
            </div>
            <div class="modal-body" id="modalLogsContainer">
                <!-- Kullanıcı logları buraya render edilir -->
            </div>
        </div>
    </div>

    <script>
        let isPaused = false;
        let latestData = null;
        let eventSource = null;
        let localUptimeSec = 0;
        let activeModalUserId = null;
        const knownUsers = new Map(); // id -> lastSeen

        const NOUN_EMOJIS = {
            potato: '🥔', car: '🚗', panda: '🐼', falcon: '🦅', tiger: '🐯',
            wizard: '🧙', phoenix: '🔥', dragon: '🐉', ninja: '🥷', samurai: '⚔️',
            otter: '🦦', badger: '🦡', penguin: '🐧', fox: '🦊', wolf: '🐺',
            koala: '🐨', dolphin: '🐬', cheetah: '🐆', hamster: '🐹', rabbit: '🐰',
            cat: '🐱', bear: '🐻', eagle: '🦅', hawk: '🦅', robot: '🤖',
            comet: '☄️', rocket: '🚀', nebula: '🌌', sloth: '🦥', raccoon: '🦝',
            hedgehog: '🦔', corgi: '🐶', lynx: '🐱', owl: '🦉', jaguar: '🐆',
            mammoth: '🦣', orca: '🐋', turtle: '🐢', duck: '🦆', walrus: '🦭',
            llama: '🦙', meerkat: '🐾', cyborg: '🦾'
        };

        function getNicknameEmoji(nickname) {
            if (!nickname) return '👤';
            const parts = nickname.split('-');
            const noun = parts[parts.length - 1];
            return NOUN_EMOJIS[noun] || '✨';
        }

        function getDeviceIcon(device) {
            if (!device) return '🌐';
            const d = device.toLowerCase();
            if (d.includes('android')) return '📱';
            if (d.includes('windows')) return '💻';
            if (d.includes('mac') || d.includes('ios') || d.includes('apple')) return '🍎';
            if (d.includes('linux')) return '🐧';
            if (d.includes('tv') || d.includes('tizen') || d.includes('webos')) return '📺';
            if (d.includes('web')) return '🌐';
            if (d.includes('curl') || d.includes('script')) return '⚙️';
            return '📱';
        }

        function getActionClass(category) {
            switch(category) {
                case 'stream': return 'action-stream';
                case 'calendar': return 'action-calendar';
                case 'search': return 'action-search';
                case 'catalog': return 'action-catalog';
                case 'meta': return 'action-meta';
                default: return 'action-other';
            }
        }

        function formatSecondsToUptime(totalSec) {
            if (totalSec <= 0) return '0 sn';
            const days = Math.floor(totalSec / 86400);
            const hours = Math.floor((totalSec % 86400) / 3600);
            const minutes = Math.floor((totalSec % 3600) / 60);
            const seconds = totalSec % 60;
            const parts = [];
            if (days > 0) parts.push(days + ' gün');
            if (hours > 0 || days > 0) parts.push(hours + ' saat');
            if (minutes > 0 || hours > 0 || days > 0) parts.push(minutes + ' dk');
            parts.push(seconds + ' sn');
            return parts.join(' ');
        }

        function formatRelativeTime(seconds) {
            if (seconds <= 0) return 'Şimdi';
            if (seconds < 60) return seconds + ' sn önce';
            const minutes = Math.floor(seconds / 60);
            const remainingSec = seconds % 60;
            if (minutes < 60) return minutes + ' dk ' + (remainingSec > 0 ? remainingSec + ' sn' : '') + ' önce';
            const hours = Math.floor(minutes / 60);
            return hours + ' saat ' + (minutes % 60) + ' dk önce';
        }

        function updateDashboard(data) {
            if (!data) return;
            latestData = data;

            if (typeof data.calismaSuresiSn === 'number') {
                localUptimeSec = data.calismaSuresiSn;
                document.getElementById('uptimeText').textContent = formatSecondsToUptime(localUptimeSec);
            }

            document.getElementById('active1m').textContent = data.aktifKullanici1Dk || 0;
            document.getElementById('active5m').textContent = data.aktifKullanici5Dk || 0;
            document.getElementById('inFlight').textContent = data.anlikEszamanliIstek || 0;
            document.getElementById('totalRequests').textContent = (data.toplamIstekSayisi || 0).toLocaleString('tr-TR');
            document.getElementById('ramMb').textContent = (data.ramMb || 0) + ' MB';

            renderDeviceDistribution(data.cihazDagilimi, data.aktifKullanici5Dk);
            renderActivityFeed(data.sonAktiviteler);
            renderTable();

            // Eğer modal açıksa içindeki logları anında canlı güncelle
            if (activeModalUserId) {
                renderModalLogs();
            }
        }

        function renderDeviceDistribution(devices, total) {
            const container = document.getElementById('deviceList');
            const totalBadge = document.getElementById('deviceTotalBadge');
            if (!devices || Object.keys(devices).length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 20px;"><p>Şu an bağlı cihaz tespit edilmedi.</p></div>';
                totalBadge.textContent = '0 Cihaz';
                return;
            }

            const entries = Object.entries(devices).sort((a, b) => b[1] - a[1]);
            const totalCount = entries.reduce((sum, item) => sum + item[1], 0);
            totalBadge.textContent = totalCount + ' Cihaz';

            let html = '';
            for (const [name, count] of entries) {
                const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                const icon = getDeviceIcon(name);
                html += '<div class="dist-item">' +
                    '<div class="dist-info">' +
                        '<div class="dist-name"><span>' + icon + '</span> <span>' + name + '</span></div>' +
                        '<div class="dist-count">' + count + ' (%' + pct + ')</div>' +
                    '</div>' +
                    '<div class="progress-track">' +
                        '<div class="progress-bar" style="width: ' + pct + '%;"></div>' +
                    '</div>' +
                '</div>';
            }
            container.innerHTML = html;
        }

        function renderActivityFeed(activities) {
            const container = document.getElementById('activityFeed');
            if (!activities || activities.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 20px;"><p>Henüz istek akışı kaydedilmedi.</p></div>';
                return;
            }

            let html = '';
            for (const item of activities) {
                const actionClass = getActionClass(item.category);
                const emoji = getNicknameEmoji(item.nickname);
                html += '<div class="feed-item">' +
                    '<div class="feed-left">' +
                        '<span class="feed-time">' + item.time + '</span>' +
                        '<span class="method-badge">' + item.method + '</span>' +
                        '<span class="action-tag ' + actionClass + '">' + item.badge + '</span>' +
                        '<span class="feed-path" title="' + item.path + '">' + item.action + '</span>' +
                    '</div>' +
                    '<span class="feed-user" title="' + item.ip + '">' + emoji + ' ' + (item.nickname || 'anon') + '</span>' +
                '</div>';
            }
            container.innerHTML = html;
        }

        function renderTable() {
            if (!latestData) return;
            const tbody = document.getElementById('usersTableBody');
            const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
            const list = latestData.aktifKullaniciListesi || [];

            const filtered = list.filter(u => {
                if (!search) return true;
                return (u.nickname && u.nickname.toLowerCase().includes(search)) ||
                       (u.cihaz && u.cihaz.toLowerCase().includes(search)) ||
                       (u.ip && u.ip.toLowerCase().includes(search)) ||
                       (u.sonEylem && u.sonEylem.toLowerCase().includes(search));
            });

            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">' +
                    '<div class="empty-state">' +
                        '<div class="empty-icon">📺</div>' +
                        '<p>' + (search ? 'Aramanıza uygun kullanıcı bulunamadı.' : 'Şu anda aktif kullanıcı bulunmuyor.<br>Stremio\\'da bir anime izlendiğinde veya tıklandığında burada <strong>anında</strong> görünecektir.') + '</p>' +
                    '</div>' +
                '</td></tr>';
                return;
            }

            const now = Date.now();
            let html = '';
            for (const u of filtered) {
                const diffSec = Math.max(0, Math.round((now - u.sonGorulmeMs) / 1000));
                const isActive = diffSec <= 60;
                const icon = getDeviceIcon(u.cihaz);
                const actionClass = getActionClass(u.eylemTuru);
                const relTime = formatRelativeTime(diffSec);
                const emoji = getNicknameEmoji(u.nickname);
                const logCount = u.logs ? u.logs.length : 0;

                // Yeni istek geldiğinde yanıp sönen efekt
                const prevTime = knownUsers.get(u.id);
                const isFresh = prevTime && (u.sonGorulmeMs > prevTime);
                knownUsers.set(u.id, u.sonGorulmeMs);

                html += '<tr class="user-row ' + (isFresh ? 'just-updated' : '') + '" onclick="openUserLogs(\\'' + u.id + '\\')" title="Detaylı log geçmişini görmek için tıklayın">' +
                    '<td>' +
                        '<div class="user-cell">' +
                            '<span class="nickname-badge"><span class="avatar-icon">' + emoji + '</span>' + (u.nickname || 'anon') + '</span>' +
                            '<span class="ip-sub">' + u.ip + '</span>' +
                        '</div>' +
                    '</td>' +
                    '<td><div class="device-badge"><span>' + icon + '</span> <span>' + u.cihaz + '</span></div></td>' +
                    '<td><span class="action-tag ' + actionClass + '" title="' + (u.sonIstek || '') + '">' + u.eylemRozet + ' ' + (u.sonEylem || '') + '</span></td>' +
                    '<td><span class="time-badge">' + relTime + '</span></td>' +
                    '<td><strong>' + u.toplamIstek + '</strong></td>' +
                    '<td>' +
                        '<span class="status-dot ' + (isActive ? 'active' : 'idle') + '"></span>' +
                        '<span>' + (isActive ? '🟢 Aktif' : '🟡 Beklemede') + '</span>' +
                    '</td>' +
                    '<td>' +
                        '<button class="btn-log" onclick="event.stopPropagation(); openUserLogs(\\'' + u.id + '\\')">' +
                            '📜 Loglar (' + logCount + ')' +
                        '</button>' +
                    '</td>' +
                '</tr>';
            }
            tbody.innerHTML = html;
        }

        // --- Kullanıcı Özel Log Modalı Fonksiyonları ---

        function openUserLogs(userId) {
            activeModalUserId = userId;
            renderModalLogs();
            document.getElementById('userLogsModal').classList.add('active');
        }

        function closeUserLogs(e) {
            if (e && e.target !== document.getElementById('userLogsModal') && !e.target.classList.contains('modal-close')) {
                return;
            }
            activeModalUserId = null;
            document.getElementById('userLogsModal').classList.remove('active');
        }

        function renderModalLogs() {
            if (!activeModalUserId || !latestData) return;
            const list = latestData.aktifKullaniciListesi || [];
            const user = list.find(u => u.id === activeModalUserId);
            if (!user) return;

            const emoji = getNicknameEmoji(user.nickname);
            document.getElementById('modalAvatar').textContent = emoji;
            document.getElementById('modalNickname').textContent = user.nickname || 'anon';
            document.getElementById('modalStatusBadge').textContent = user.durum === 'aktif' ? '🟢 Aktif' : '🟡 Beklemede';
            document.getElementById('modalUserMeta').textContent = user.cihaz + ' • ' + user.ip;
            document.getElementById('modalTotalReq').textContent = user.toplamIstek;
            document.getElementById('modalFirstSeen').textContent = user.ilkGorulme || '--:--:--';
            document.getElementById('modalLastSeen').textContent = user.sonGorulme;

            const container = document.getElementById('modalLogsContainer');
            const logs = user.logs || [];

            if (logs.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>Bu kullanıcı için henüz kayıtlı istek kaydı bulunmuyor.</p></div>';
                return;
            }

            let html = '';
            for (const log of logs) {
                const actionClass = getActionClass(log.category);
                html += '<div class="log-row">' +
                    '<div class="log-main">' +
                        '<div class="log-header-line">' +
                            '<span class="log-time">' + log.time + '</span>' +
                            '<span class="method-badge">' + log.method + '</span>' +
                            '<span class="action-tag ' + actionClass + '">' + log.badge + ' ' + (log.action || '') + '</span>' +
                        '</div>' +
                        '<div class="log-url" title="' + log.path + '">' + log.path + '</div>' +
                    '</div>' +
                '</div>';
            }
            container.innerHTML = html;
        }

        // ESC tuşuyla modalı kapatma
        window.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeUserLogs();
            }
        });

        // SSE Canlı Bağlantı Fonksiyonu
        function connectSSE() {
            if (eventSource) {
                eventSource.close();
            }

            const statusText = document.getElementById('connStatusText');
            const statusBox = document.getElementById('connStatus');

            eventSource = new EventSource('/api/stats/stream');

            eventSource.onopen = function() {
                statusBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                statusBox.style.color = '#34d399';
                statusText.textContent = 'Canlı Veri Akışı Açık';
            };

            eventSource.onmessage = function(event) {
                if (isPaused) return;
                try {
                    const data = JSON.parse(event.data);
                    updateDashboard(data);
                } catch (e) {
                    console.error('SSE veri hatası:', e);
                }
            };

            eventSource.onerror = function() {
                statusBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                statusBox.style.color = '#fbbf24';
                statusText.textContent = 'Yeniden bağlanıyor...';
                setTimeout(connectSSE, 3000);
            };
        }

        // Manuel / Otomatik Arka Plan Fetch (SSE Kesilirse veya Proxy Varsa)
        async function fetchManual() {
            if (isPaused) return;
            try {
                const res = await fetch('/api/stats?t=' + Date.now(), {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (res.ok) {
                    const data = await res.json();
                    updateDashboard(data);
                }
            } catch (err) {
                console.error('Fetch hatası:', err);
            }
        }

        async function clearStats() {
            if (!confirm("Tüm aktif kullanıcıları ve sayaçları sıfırlamak istediğinize emin misiniz?")) return;
            try {
                const res = await fetch('/api/stats/clear', {
                    method: 'POST',
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                if (res.ok) {
                    const data = await res.json();
                    knownUsers.clear();
                    closeUserLogs();
                    updateDashboard(data);
                }
            } catch (err) {
                console.error('Temizleme hatası:', err);
            }
        }

        function togglePause() {
            isPaused = !isPaused;
            const btn = document.getElementById('pauseBtn');
            const icon = document.getElementById('pauseIcon');
            const text = document.getElementById('pauseText');
            const statusText = document.getElementById('connStatusText');
            const statusBox = document.getElementById('connStatus');

            if (isPaused) {
                icon.textContent = '▶️';
                text.textContent = 'Devam Et';
                statusBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                statusBox.style.color = '#fbbf24';
                statusText.textContent = 'Canlı Akış Duraklatıldı';
            } else {
                icon.textContent = '⏸️';
                text.textContent = 'Duraklat';
                statusBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                statusBox.style.color = '#34d399';
                statusText.textContent = 'Canlı Veri Akışı Açık';
                fetchManual();
            }
        }

        // 1 saniyede bir çalışan gerçek zamanlı döngü:
        // - Saati saniye saniye günceller
        // - Uptime'ı (Çalışma süresini) saniye saniye kesintisiz ilerletir
        // - Tablodaki tüm kullanıcıların "X sn önce" sayaçlarını dinamik olarak artırır
        setInterval(function() {
            if (isPaused) return;

            // Uptime ilerletme
            localUptimeSec++;
            document.getElementById('uptimeText').textContent = formatSecondsToUptime(localUptimeSec);

            // Saat güncelleme
            const now = new Date();
            document.getElementById('istanbulClock').textContent = '⏱️ ' + now.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });

            // Tablodaki ve açıksa modaldeki zamanları güncelle
            renderTable();
            if (activeModalUserId) {
                renderModalLogs();
            }
        }, 1000);

        // Her 2 saniyede bir arka planda tam veri senkronizasyonu yap (F5 gereksinimini %100 sıfırlar)
        setInterval(function() {
            fetchManual();
        }, 2000);

        window.addEventListener('DOMContentLoaded', function() {
            connectSSE();
            fetchManual();
        });
    </script>
</body>
</html>`;
}

module.exports = {
    getStatsHTML
};
