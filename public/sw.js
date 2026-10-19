// Bộ nhớ đệm nhẹ để mở nhanh và vẫn thấy khung trang khi mất mạng. Không bao giờ đệm /api (dữ liệu luôn lấy mới).
const BAN = 'sonicplan-v5';
const KHUNG = ['/', '/kieu.css', '/apple.css', '/app.js', '/luong.js', '/bieu-tuong.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(BAN).then((c) => c.addAll(KHUNG)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ds) => Promise.all(ds.filter((k) => k !== BAN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // Phông chữ ít đổi: lấy từ đệm trước. Còn lại lấy mạng trước, hỏng mạng thì dùng bản đệm.
  if (u.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request).then((r) => { const b = r.clone(); caches.open(BAN).then((x) => x.put(e.request, b)); return r; })));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && r.type === 'basic') { const b = r.clone(); caches.open(BAN).then((x) => x.put(e.request, b)); }
    return r;
  }).catch(() => caches.match(e.request).then((c) => c || caches.match('/'))));
});

// Thông báo đẩy (Web Push): máy chủ gửi nội dung đã mã hóa, trình duyệt giải mã rồi giao vào đây.
// Trang đang mở thì báo trang làm mới chuông ngay; vẫn hiện thông báo để thấy được khi đang ở thẻ khác.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { tieu_de: e.data ? e.data.text() : '' }; }
  const tieuDe = d.tieu_de || 'Sonicplan';
  e.waitUntil((async () => {
    const cacTrang = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cacTrang) c.postMessage({ loai: 'thong-bao', id: d.id || null });
    await self.registration.showNotification(tieuDe, {
      body: d.noi_dung || '',
      icon: '/bieu-tuong-192.png',
      badge: '/bieu-tuong-192.png',
      tag: d.id ? `tb-${d.id}` : undefined,
      lang: 'vi',
      data: { id: d.id || null, duong_dan: d.duong_dan || '#tong-quan' },
    });
  })());
});

// Bấm vào thông báo: mở trang Sonicplan đang có (hoặc mở mới) đúng chỗ, và đánh dấu thông báo đã đọc.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { id, duong_dan: duongDan } = e.notification.data || {};
  const dich = new URL(`/${String(duongDan || '#tong-quan').replace(/^[^#]*/, '')}`, self.location.origin).href;
  e.waitUntil((async () => {
    if (id) fetch('/api/thong-bao/doc', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    const cacTrang = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const trang = cacTrang.find((c) => new URL(c.url).origin === self.location.origin);
    if (trang) {
      trang.postMessage({ loai: 'mo-thong-bao', duong_dan: duongDan, id });
      return trang.focus();
    }
    return self.clients.openWindow(dich);
  })());
});
