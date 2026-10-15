// Thông báo trên web: mã hóa Web Push đúng RFC 8291 (giải mã lại được như trình duyệt), chữ ký VAPID,
// công tắc từng loại, giờ yên lặng chỉ ghi chuông, địa chỉ hết hạn tự xóa, nhắc giờ hẹn tạo thông báo. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { kyVapid, laDiaChiDay, layKhoaVapid, maHoaDay, sangB64u, taoThongBao, tuB64u, xuLyApiThongBao } from '../src/thong-bao.js';
import { nhacViec } from '../src/nhac-viec.js';

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}
const phien = { to_chuc: { id: 'tc1', vai_tro: 'chu' }, email: 'a@b.c' };
const goiApi = (env, duong, phuongThuc = 'GET', than) => xuLyApiThongBao(
  new Request(`https://plan.vi-du.vn${duong}`, { method: phuongThuc, body: than ? JSON.stringify(than) : undefined, headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' } }),
  env, phien, new URL(`https://plan.vi-du.vn${duong}`),
).then((r) => r.json().then((j) => ({ ma: r.status, ...j })));

const noi = (...ds) => { const ra = new Uint8Array(ds.reduce((n, d) => n + d.length, 0)); let v = 0; for (const d of ds) { ra.set(d, v); v += d.length; } return ra; };
async function hkdf(muoi, ikm, info, n) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: muoi, info }, k, n * 8));
}

// Đóng vai trình duyệt: tạo khóa, rồi giải mã thân yêu cầu máy chủ gửi.
async function trinhDuyetGia() {
  const cap = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const congKhai = new Uint8Array(await crypto.subtle.exportKey('raw', cap.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    p256dh: sangB64u(congKhai),
    auth: sangB64u(auth),
    async giaiMa(than) {
      const b = new Uint8Array(than);
      const muoi = b.slice(0, 16);
      assert.equal(new DataView(b.buffer, b.byteOffset).getUint32(16), 4096);
      assert.equal(b[20], 65);
      const khoaMay = b.slice(21, 86);
      const may = await crypto.subtle.importKey('raw', khoaMay, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
      const chung = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: may }, cap.privateKey, 256));
      const ikm = await hkdf(auth, chung, noi(new TextEncoder().encode('WebPush: info\0'), congKhai, khoaMay), 32);
      const cek = await hkdf(muoi, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
      const nonce = await hkdf(muoi, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
      const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
      const ro = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, b.slice(86)));
      assert.equal(ro[ro.length - 1], 2);
      return new TextDecoder().decode(ro.slice(0, -1));
    },
  };
}

function giaFetch(traVe = 201) {
  const goi = [];
  const cu = globalThis.fetch;
  globalThis.fetch = async (dia, tuyChon) => { goi.push({ dia, ...tuyChon }); return new Response(null, { status: typeof traVe === 'function' ? traVe(dia) : traVe }); };
  return { goi, tra: () => { globalThis.fetch = cu; } };
}

test('mã hóa Web Push: trình duyệt giải mã ra đúng nội dung', async () => {
  const td = await trinhDuyetGia();
  const than = await maHoaDay('{"tieu_de":"Việc mới: Gửi báo cáo"}', td.p256dh, td.auth);
  assert.equal(await td.giaiMa(than), '{"tieu_de":"Việc mới: Gửi báo cáo"}');
});

test('chữ ký VAPID kiểm được bằng khóa công khai, khóa tạo một lần rồi dùng lại', async () => {
  const { env } = moiTruong();
  const khoa = await layKhoaVapid(env, 'https://plan.vi-du.vn');
  assert.deepEqual(await layKhoaVapid(env), khoa);
  assert.equal(khoa.sub, 'https://plan.vi-du.vn');
  const jwt = await kyVapid(khoa, 'https://fcm.googleapis.com', Date.parse('2026-10-15T00:00:00Z'));
  const [dau, noiDung, chuKy] = jwt.split('.');
  assert.equal(JSON.parse(new TextDecoder().decode(tuB64u(noiDung))).aud, 'https://fcm.googleapis.com');
  const pub = await crypto.subtle.importKey('raw', tuB64u(khoa.cong_khai), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, tuB64u(chuKy), new TextEncoder().encode(`${dau}.${noiDung}`)));
});

test('khóa VAPID được mã hóa khi có KHOA_MA_HOA', async () => {
  const { db, env } = moiTruong();
  env.KHOA_MA_HOA = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  await layKhoaVapid(env, 'https://plan.vi-du.vn');
  assert.match(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'vapid_khoa'").get().gia_tri, /^v1\./);
});

test('chỉ nhận địa chỉ của dịch vụ đẩy trình duyệt', () => {
  assert.ok(laDiaChiDay('https://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(laDiaChiDay('https://web.push.apple.com/QW1'));
  assert.ok(laDiaChiDay('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(laDiaChiDay('https://wns2-par02p.notify.windows.com/w/?token=1'));
  assert.ok(!laDiaChiDay('http://fcm.googleapis.com/x'));
  assert.ok(!laDiaChiDay('https://127.0.0.1/x'));
  assert.ok(!laDiaChiDay('https://googleapis.com.ke-xau.vn/x'));
  assert.ok(!laDiaChiDay('https://fcm.googleapis.com:8443/x'));
});

test('đăng ký máy, thông báo đẩy tới máy đó, giải mã được, chuông có số chưa đọc', async () => {
  const { env } = moiTruong();
  const td = await trinhDuyetGia();
  assert.equal((await goiApi(env, '/api/thong-bao/dang-ky', 'POST', { endpoint: 'https://ke-xau.vn/x', keys: { p256dh: td.p256dh, auth: td.auth } })).ma, 400);
  const cai = await goiApi(env, '/api/thong-bao/cai');
  assert.ok(cai.khoa_cong_khai);
  assert.equal((await goiApi(env, '/api/thong-bao/dang-ky', 'POST', { endpoint: 'https://fcm.googleapis.com/fcm/send/m1', keys: { p256dh: td.p256dh, auth: td.auth } })).ma, 200);

  const f = giaFetch(201);
  try {
    const kq = await taoThongBao(env, 'tc1', { loai: 'viec_moi', tieu_de: 'Việc mới: Gửi báo giá', noi_dung: 'Hạn 16/10', duong_dan: '#viec/5', viec_id: 5 }, { bayGio: '2026-10-15T03:00:00.000Z' });
    assert.deepEqual(kq.day, { ok: 1, loi: 0 });
    assert.equal(f.goi.length, 1);
    assert.equal(f.goi[0].headers['Content-Encoding'], 'aes128gcm');
    assert.match(f.goi[0].headers.Authorization, new RegExp(`^vapid t=.+, k=${cai.khoa_cong_khai}$`));
    const nd = JSON.parse(await td.giaiMa(f.goi[0].body));
    assert.equal(nd.tieu_de, 'Việc mới: Gửi báo giá');
    assert.equal(nd.duong_dan, '#viec/5');
  } finally { f.tra(); }

  const ds = await goiApi(env, '/api/thong-bao');
  assert.equal(ds.chua_doc, 1);
  assert.equal(ds.ds[0].viec_id, 5);
  const khongMoi = await goiApi(env, `/api/thong-bao?sau=${ds.moi_nhat}`);
  assert.equal(khongMoi.ds, null);
  assert.equal((await goiApi(env, '/api/thong-bao/doc', 'POST', { id: ds.ds[0].id })).chua_doc, 0);
});

test('giờ yên lặng: ghi vào chuông, không đẩy; loại đã tắt thì không ghi gì', async () => {
  const { db, env } = moiTruong();
  const td = await trinhDuyetGia();
  await goiApi(env, '/api/thong-bao/dang-ky', 'POST', { endpoint: 'https://web.push.apple.com/m2', keys: { p256dh: td.p256dh, auth: td.auth } });
  const f = giaFetch(201);
  try {
    // 16h UTC là 23h giờ Việt Nam, nằm trong giờ yên lặng mặc định 22h-7h.
    const kq = await taoThongBao(env, 'tc1', { loai: 'viec_moi', tieu_de: 'Việc đêm' }, { bayGio: '2026-10-15T16:00:00.000Z' });
    assert.ok(kq.id);
    assert.equal(kq.day, null);
    assert.equal(f.goi.length, 0);
    await goiApi(env, '/api/thong-bao/cai', 'PUT', { bat: { gio_hen: false } });
    assert.equal(await taoThongBao(env, 'tc1', { loai: 'gio_hen', tieu_de: 'Tắt rồi' }, { bayGio: '2026-10-15T03:00:00.000Z' }), null);
    assert.equal((await goiApi(env, '/api/thong-bao/cai', 'PUT', { bat: { khong_co: true } })).ma, 400);
  } finally { f.tra(); }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM thong_bao').get().n, 1);
});

test('dịch vụ đẩy báo địa chỉ hết hạn (410) thì xóa đăng ký', async () => {
  const { db, env } = moiTruong();
  const td = await trinhDuyetGia();
  await goiApi(env, '/api/thong-bao/dang-ky', 'POST', { endpoint: 'https://fcm.googleapis.com/fcm/send/cu', keys: { p256dh: td.p256dh, auth: td.auth } });
  const f = giaFetch(410);
  try {
    const kq = await taoThongBao(env, 'tc1', { loai: 'thu', tieu_de: 'Thử' });
    assert.deepEqual(kq.day, { ok: 0, loi: 0 });
  } finally { f.tra(); }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dang_ky_day').get().n, 0);
});

test('nhắc giờ hẹn tạo thông báo dẫn tới đúng việc', async () => {
  const { db, env } = moiTruong();
  const id = Number(db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, han_ngay, gio_hen, trang_thai, tao_luc, cap_nhat_luc)
    VALUES ('tc1', 'Họp với phòng Đào tạo', '2026-10-15', '10:00', 'mo', 'x', 'x')`).run().lastInsertRowid);
  // 02:45 UTC là 9h45 giờ Việt Nam: còn 15 phút.
  await nhacViec(env, '2026-10-15T02:45:00.000Z');
  const tb = db.prepare('SELECT loai, tieu_de, noi_dung, duong_dan FROM thong_bao').get();
  assert.equal(tb.loai, 'gio_hen');
  assert.equal(tb.tieu_de, '10:00 Họp với phòng Đào tạo');
  assert.match(tb.noi_dung, /còn 15 phút/);
  assert.equal(tb.duong_dan, `#viec/${id}`);
});

test('AI tách việc từ tin Zalo thì có thông báo việc mới; tin nhắc lại việc cũ không báo lần nữa', async () => {
  const { db, env } = moiTruong();
  env.AI = { run: async () => ({ response: '{"viec":[{"tieu_de":"Gửi báo giá cho đối tác IPSOS","han_ngay":"2026-10-20","tin_so":1}]}' }) };
  const them = (noi) => db.prepare(`INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, noi_dung, thoi_diem, tao_luc, da_tach)
    VALUES ('tc1', 'zalo', ?, 'Lan', ?, ?, ?, 0)`).run(`${Math.random()}`, noi, new Date().toISOString(), new Date().toISOString());
  const { tachViecChoToChuc } = await import('../src/viec.js');
  them('anh gửi báo giá cho IPSOS trước 20/10 nhé');
  await tachViecChoToChuc(env, 'tc1');
  const tb = db.prepare('SELECT loai, tieu_de, noi_dung, duong_dan, viec_id FROM thong_bao').all();
  assert.equal(tb.length, 1);
  assert.equal(tb[0].loai, 'viec_moi');
  assert.equal(tb[0].tieu_de, 'Việc mới: Gửi báo giá cho đối tác IPSOS');
  assert.match(tb[0].noi_dung, /Hạn 20\/10\. Từ Zalo, Lan/);
  assert.equal(tb[0].duong_dan, `#viec/${tb[0].viec_id}`);
  them('anh nhớ gửi báo giá IPSOS nhé');
  await tachViecChoToChuc(env, 'tc1');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM thong_bao').get().n, 1);
});
