import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sinema Projesi — Backend API Test Paneli (Hakan)</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #0f172a; color: #f8fafc; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    h1 { margin: 0; font-size: 22px; color: #38bdf8; }
    .badge { background: #1e293b; border: 1px solid #475569; padding: 6px 12px; border-radius: 999px; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 850px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px; }
    .card h2 { margin-top: 0; font-size: 16px; color: #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .method { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
    .GET { background: #0284c7; color: #fff; }
    .POST { background: #16a34a; color: #fff; }
    .PATCH { background: #d97706; color: #fff; }
    .DELETE { background: #dc2626; color: #fff; }
    label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; margin-top: 10px; }
    input { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 13px; }
    .btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    button { cursor: pointer; border: none; padding: 9px 14px; border-radius: 6px; font-weight: 600; font-size: 13px; background: #2563eb; color: #fff; transition: opacity 0.15s; }
    button:hover { opacity: 0.9; }
    button.secondary { background: #475569; }
    button.danger { background: #dc2626; }
    button.warning { background: #d97706; }
    .output-box { position: sticky; top: 24px; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 18px; max-height: 85vh; overflow: auto; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, monospace; font-size: 13px; color: #a7f3d0; }
    .status-pill { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
    .ok { background: #065f46; color: #6ee7b7; }
    .err { background: #7f1d1d; color: #fca5a5; }
    .screening-banner { background: #0f172a; border: 1px solid #38bdf8; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .stat { font-size: 13px; }
    .stat strong { color: #38bdf8; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🎬 Sinema Salonu Rezervasyon — Backend Canlı Test Paneli</h1>
        <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Hakan (Backend Sorumlusu) — Tüm API uç noktalarını buradan canlı test edebilirsin</div>
      </div>
      <div class="badge" id="authStatus">🔒 Oturum: Giriş Yapılmadı</div>
    </header>

    <div class="screening-banner" id="liveScreeningBanner">
      <div class="stat">Film: <strong id="bTitle">Yükleniyor...</strong></div>
      <div class="stat">Tarih/Saat: <strong id="bDate">-</strong></div>
      <div class="stat">Toplam Kapasite: <strong id="bTotal">-</strong></div>
      <div class="stat">Aktif Rezervasyon: <strong id="bActive">-</strong></div>
      <div class="stat">Kalan Kontenjan: <strong id="bRemaining">-</strong></div>
    </div>

    <div class="grid">
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- 1. Film ve Gösterim Bilgisi -->
        <div class="card">
          <h2><span class="method GET">GET</span> /api/screening — Film & Kontenjan Bilgisi</h2>
          <p style="font-size:13px;color:#94a3b8;margin:0;">Veritabanındaki aktif filmi, BLOB kapak fotoğrafını (cover_image), toplam kapasiteyi ve kalan kontenjanı getirir.</p>
          <div class="btn-row">
            <button onclick="fetchScreening()">Film Bilgilerini Getir</button>
          </div>
        </div>

        <!-- 2. Kullanıcı Kayıt -->
        <div class="card">
          <h2><span class="method POST">POST</span> /api/auth/register — Kullanıcı Kayıt</h2>
          <label>Ad Soyad</label>
          <input id="regName" value="Hakan Test" />
          <label>E-posta</label>
          <input id="regEmail" value="hakan@cinema.com" />
          <label>Parola</label>
          <input id="regPass" type="password" value="123456" />
          <div class="btn-row">
            <button onclick="registerUser()">Kayıt Ol</button>
          </div>
        </div>

        <!-- 3. Kullanıcı & Admin Giriş -->
        <div class="card">
          <h2><span class="method POST">POST</span> /api/auth/login — Giriş Yap (User / Admin)</h2>
          <label>E-posta</label>
          <input id="loginEmail" value="admin@cinema.com" />
          <label>Parola</label>
          <input id="loginPass" type="password" value="admin123" />
          <div class="btn-row">
            <button onclick="loginUser()">Giriş Yap</button>
            <button class="secondary" onclick="fillAdmin()">Admin Bilgilerini Doldur</button>
            <button class="secondary" onclick="fillNormalUser()">Normal Kullanıcı Doldur</button>
            <button class="danger" onclick="logoutUser()">Çıkış Yap</button>
          </div>
        </div>

        <!-- 4. Rezervasyon -->
        <div class="card">
          <h2><span class="method POST">POST</span> /api/reservations — Yer Ayırtma</h2>
          <p style="font-size:13px;color:#94a3b8;margin:0;">Giriş yapmış kullanıcı için yer ayırtır, kontenjanı 1 düşürür. 2. kez basarsan mükerrer kayıt engelini test eder.</p>
          <div class="btn-row">
            <button onclick="makeReservation()">Yer Ayırt (Rezervasyon Yap)</button>
            <button class="danger" onclick="cancelReservation()">Rezervasyonumu İptal Et</button>
          </div>
        </div>

        <!-- 5. Admin Film Güncelleme (BLOB) -->
        <div class="card">
          <h2><span class="method PATCH">PATCH</span> /api/admin/screening — Admin Film Güncelle (BLOB)</h2>
          <label>Film Adı</label>
          <input id="admTitle" value="Interstellar" />
          <label>Açıklama</label>
          <input id="admDesc" value="İnsanlığın yıldızlararası yolculuğunu anlatan bilim kurgu klasiği." />
          <label>Fragman Bağlantısı (YouTube)</label>
          <input id="admTrailer" value="https://www.youtube.com/watch?v=zSWdZVtXT7E" />
          <label>Kapak Fotoğrafı Dosyası (cover_image — BLOB / LONGBLOB)</label>
          <input id="admCoverFile" type="file" accept="image/*" />
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div>
              <label>Tarih</label>
              <input id="admDate" value="2026-11-01" />
            </div>
            <div>
              <label>Saat</label>
              <input id="admTime" value="21:00" />
            </div>
            <div>
              <label>Toplam Kontenjan</label>
              <input id="admCap" type="number" value="50" />
            </div>
          </div>
          <div class="btn-row">
            <button class="warning" onclick="updateScreening()">Filmi ve Kontenjanı Güncelle (Admin)</button>
          </div>
        </div>
      </div>

      <!-- Sağ Panel: Canlı JSON Cevabı -->
      <div>
        <div class="output-box">
          <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">📡 Son API İsteği ve Sunucu Cevabı (JSON):</div>
          <div id="statusBadge"></div>
          <pre id="jsonOutput">Bir butona tıklayarak API isteği gönderin...</pre>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentToken = '';

    function showResponse(method, url, status, data) {
      const badge = document.getElementById('statusBadge');
      const isOk = status >= 200 && status < 300;
      badge.innerHTML = '<span class="status-pill ' + (isOk ? 'ok' : 'err') + '">' + method + ' ' + url + ' — HTTP ' + status + '</span>';
      document.getElementById('jsonOutput').textContent = JSON.stringify(data, null, 2);
    }

    async function fetchScreening() {
      const res = await fetch('/api/screening', {
        headers: currentToken ? { 'Authorization': 'Bearer ' + currentToken } : {}
      });
      const data = await res.json();
      showResponse('GET', '/api/screening', res.status, data);
      if (res.ok) {
        document.getElementById('bTitle').textContent = data.movie_title;
        document.getElementById('bDate').textContent = data.screening_date + ' ' + data.screening_time;
        document.getElementById('bTotal').textContent = data.total_capacity;
        document.getElementById('bActive').textContent = data.active_reservations;
        document.getElementById('bRemaining').textContent = data.remaining_capacity + (data.is_full ? ' (DOLU)' : '');
      }
    }

    async function registerUser() {
      const body = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPass').value
      };
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      showResponse('POST', '/api/auth/register', res.status, data);
      if (res.ok && data.token) {
        currentToken = data.token;
        updateAuthBadge(data.user);
      }
    }

    async function loginUser() {
      const body = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPass').value
      };
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      showResponse('POST', '/api/auth/login', res.status, data);
      if (res.ok && data.token) {
        currentToken = data.token;
        updateAuthBadge(data.user);
      }
    }

    async function logoutUser() {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json();
      currentToken = '';
      document.getElementById('authStatus').textContent = '🔒 Oturum: Giriş Yapılmadı';
      showResponse('POST', '/api/auth/logout', res.status, data);
    }

    function updateAuthBadge(user) {
      document.getElementById('authStatus').textContent =
        '✅ ' + user.name + ' (' + user.email + ') — Rol: ' + user.role.toUpperCase();
    }

    function fillAdmin() {
      document.getElementById('loginEmail').value = 'admin@cinema.com';
      document.getElementById('loginPass').value = 'admin123';
    }

    function fillNormalUser() {
      document.getElementById('loginEmail').value = document.getElementById('regEmail').value;
      document.getElementById('loginPass').value = document.getElementById('regPass').value;
    }

    async function makeReservation() {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { 'Authorization': 'Bearer ' + currentToken } : {})
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      showResponse('POST', '/api/reservations', res.status, data);
      fetchScreening();
    }

    async function cancelReservation() {
      const res = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { 'Authorization': 'Bearer ' + currentToken } : {})
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      showResponse('DELETE', '/api/reservations', res.status, data);
      fetchScreening();
    }

    async function updateScreening() {
      const formData = new FormData();
      formData.append('movie_title', document.getElementById('admTitle').value);
      formData.append('description', document.getElementById('admDesc').value);
      formData.append('trailer_url', document.getElementById('admTrailer').value);
      formData.append('screening_date', document.getElementById('admDate').value);
      formData.append('screening_time', document.getElementById('admTime').value);
      formData.append('total_capacity', document.getElementById('admCap').value);

      const fileInput = document.getElementById('admCoverFile');
      if (fileInput.files && fileInput.files[0]) {
        formData.append('cover_image', fileInput.files[0]);
      }

      const res = await fetch('/api/admin/screening', {
        method: 'PATCH',
        headers: {
          ...(currentToken ? { 'Authorization': 'Bearer ' + currentToken } : {})
        },
        body: formData
      });
      const data = await res.json();
      showResponse('PATCH', '/api/admin/screening', res.status, data);
      fetchScreening();
    }

    fetchScreening();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
