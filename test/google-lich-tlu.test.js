// Kiểm thử Lịch thanglong: chỉ đọc, sự kiện mới thành việc, sửa thì việc đổi theo, xóa thì việc huy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keoLichTlu, layTruyCapTlu, taoDiaChiDangNhapTlu } from '../src/google.js';
import { d1, dungCsdl } from './csdl-thu.js';

const HOM_NAY = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const gio = (ngay, bat, ket) => ({ start: { dateTime: `${ngay}T${bat}:00+07:00` }, end: { dateTime: `${ngay}T${ket}:00+07:00` } });
const MOC = "INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_tlu_sync', 'M0')";

function dung(viecs = []) {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('t', 'T', '2026-01-01')");
  for (const v of viecs) {
    db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, han_ngay, gio_hen, trang_thai, tao_luc, cap_nhat_luc, can_dong_bo, lich_event_id, lich_tlu_event_id)
      VALUES ('t', ?, ?, ?, ?, '2026-11-01T00:00:00.000Z', ?, ?, ?, ?)`)
      .run(v.tieu_de, v.han_ngay ?? null, v.gio_hen ?? null, v.trang_thai ?? 'mo', v.cap_nhat_luc ?? '2026-11-01T00:00:00.000Z', v.can_dong_bo ?? 0, v.gmail ?? null, v.tlu ?? null);
  }
  return { db, env: { CSDL: d1(db) } };
}
const giaLich = (...trang) => {
  const goiDen = [];
  const goi = async (_t, duong, tuyChon) => { goiDen.push({ duong, tuyChon }); const t = trang.shift(); if (t instanceof Error) throw t; return t; };
  return { goi, goiDen };
};
const viecTlu = (db, ev) => db.prepare('SELECT * FROM viec WHERE lich_tlu_event_id = ?').get(ev);
const sk = (id, ten, them = {}) => ({ id, summary: ten, status: 'confirmed', organizer: { self: true }, ...gio(HOM_NAY, '15:00', '16:00'), updated: '2026-11-03T02:00:00.000Z', ...them });

test('keoLichTlu: lần đầu cũng tạo việc cho sự kiện từ hôm qua trở đi, bỏ sự kiện lặp, đã từ chối, cũ', async () => {
  const { db, env } = dung();
  const { goi, goiDen } = giaLich({
    items: [
      sk('e1', 'Họp giao ban', { description: 'Phòng 301' }),
      sk('e2', 'Hằng tuần', { recurringEventId: 'r' }),
      sk('e3', 'Từ chối', { organizer: {}, attendees: [{ self: true, responseStatus: 'declined' }] }),
      sk('e4', 'Cũ', { ...gio('2026-10-01', '09:00', '10:00') }),
    ],
    nextSyncToken: 'M1',
  });
  const r = await keoLichTlu(env, 't', 'tk', { goi });
  assert.equal(r.tao, 1);
  const v = viecTlu(db, 'e1');
  assert.deepEqual([v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.nguon, v.lich_event_id, v.trang_thai], ['Họp giao ban', 'Phòng 301', HOM_NAY, '15:00', 'lich_tlu', null, 'mo']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 1);
  assert.equal(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'google_lich_tlu_sync'").get().gia_tri, 'M1');
  // Chỉ đọc: một lần GET, không ghi gì lên lịch thanglong.
  assert.equal(goiDen.length, 1);
  assert.ok(!goiDen[0].tuyChon?.method || goiDen[0].tuyChon.method === 'GET');
});

test('keoLichTlu: không tạo trùng với việc đang mở cùng tên cùng ngày, và không tạo lại khi đã có mã nguồn', async () => {
  const { db, env } = dung([{ tieu_de: 'họp giao ban ', han_ngay: HOM_NAY }, { tieu_de: 'Đã nối', han_ngay: HOM_NAY, tlu: 'e2' }]);
  db.exec(MOC);
  const { goi } = giaLich({ items: [sk('e1', 'Họp giao ban'), sk('e2', 'Đã nối')], nextSyncToken: 'M2' });
  const r = await keoLichTlu(env, 't', 'tk', { goi });
  assert.equal(r.tao, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 2);
});

test('keoLichTlu: sửa sự kiện thì việc đổi theo và được đánh dấu đẩy sang Lịch gmail', async () => {
  const { db, env } = dung([{ tieu_de: 'Họp', han_ngay: HOM_NAY, gio_hen: '09:00', tlu: 'e1', gmail: 'g1' }]);
  db.exec(MOC);
  const { goi } = giaLich({ items: [sk('e1', 'Họp mở rộng', { ...gio('2026-12-01', '10:30', '11:00') })], nextSyncToken: 'M2' });
  const r = await keoLichTlu(env, 't', 'tk', { goi });
  assert.equal(r.ve, 1);
  const v = viecTlu(db, 'e1');
  assert.deepEqual([v.tieu_de, v.han_ngay, v.gio_hen, v.can_dong_bo, v.lich_event_id], ['Họp mở rộng', '2026-12-01', '10:30', 1, 'g1']);
  assert.equal(db.prepare('SELECT loai FROM viec_su_kien WHERE viec_id = ?').get(v.id).loai, 'doi_lich');
});

test('keoLichTlu: xóa sự kiện thì việc mở chuyển huy và giữ lich_event_id để gỡ sự kiện gmail; việc đã xong giữ nguyên', async () => {
  const { db, env } = dung([
    { tieu_de: 'Mở', han_ngay: HOM_NAY, tlu: 'e1', gmail: 'g1' },
    { tieu_de: 'Xong', han_ngay: HOM_NAY, tlu: 'e2', trang_thai: 'xong' },
  ]);
  db.exec(MOC);
  const { goi } = giaLich({ items: [{ id: 'e1', status: 'cancelled' }, { id: 'e2', status: 'cancelled' }], nextSyncToken: 'M2' });
  const r = await keoLichTlu(env, 't', 'tk', { goi });
  assert.equal(r.huy, 1);
  assert.deepEqual(db.prepare('SELECT trang_thai, lich_event_id FROM viec ORDER BY id').all().map((x) => [x.trang_thai, x.lich_event_id]), [['huy', 'g1'], ['xong', null]]);
});

test('keoLichTlu: bên sửa sau thắng', async () => {
  const doi = sk('e1', 'Họp', { ...gio('2026-12-01', '10:00', '10:30') });
  let { db, env } = dung([{ tieu_de: 'Họp', han_ngay: HOM_NAY, gio_hen: '09:00', tlu: 'e1', cap_nhat_luc: '2026-11-03T03:00:00.000Z' }]);
  db.exec(MOC);
  await keoLichTlu(env, 't', 'tk', { goi: giaLich({ items: [doi], nextSyncToken: 'M2' }).goi });
  assert.equal(viecTlu(db, 'e1').gio_hen, '09:00');
  ({ db, env } = dung([{ tieu_de: 'Họp', han_ngay: HOM_NAY, gio_hen: '09:00', tlu: 'e1', cap_nhat_luc: '2026-11-03T01:00:00.000Z' }]));
  db.exec(MOC);
  await keoLichTlu(env, 't', 'tk', { goi: giaLich({ items: [doi], nextSyncToken: 'M2' }).goi });
  assert.equal(viecTlu(db, 'e1').gio_hen, '10:00');
});

test('keoLichTlu: mốc hết hạn (410) thì xóa mốc, không báo lỗi', async () => {
  const { db, env } = dung();
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_tlu_sync', 'CU')");
  const e = Object.assign(new Error('gone'), { trangThai: 410 });
  const r = await keoLichTlu(env, 't', 'tk', { goi: giaLich(e).goi });
  assert.equal(r.ve, 0);
  assert.equal(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'google_lich_tlu_sync'").get().gia_tri, '');
});

test('đăng nhập thanglong: chỉ xin quyền đọc Lịch, không xin Gmail, Tasks, Drive; chưa nối thì không có mã truy cập', async () => {
  const u = new URL(taoDiaChiDangNhapTlu('cid.apps.googleusercontent.com', 'https://x/cb', 's'));
  assert.equal(u.searchParams.get('scope'), 'openid email https://www.googleapis.com/auth/calendar.readonly');
  const { env } = dung();
  assert.equal(await layTruyCapTlu(env, 't'), null);
});
