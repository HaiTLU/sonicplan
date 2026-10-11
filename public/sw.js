// Bộ nhớ đệm nhẹ để mở nhanh và vẫn thấy khung trang khi mất mạng. Không bao giờ đệm /api (dữ liệu luôn lấy mới).
const BAN = 'sonicplan-v1';
const KHUNG = ['/', '/kieu.css', '/app.js', '/luong.js', '/bieu-tuong.svg'];

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
