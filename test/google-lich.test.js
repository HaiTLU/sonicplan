// Kiểm thử Lịch về: sự kiện Google Lịch sửa, xóa, tạo mới thì việc đổi theo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keoLichVe, suKienThanhViec, thanSuKien, viecTuSuKien } from '../src/google.js';
import { chuanCauHinh } from '../src/google-nhan.js';
import { d1, dungCsdl } from './csdl-thu.js';

const HOM_NAY = '2026-11-03';
const gio = (ngay, bat, ket) => ({ start: { dateTime: `${ngay}T${bat}:00+07:00` }, end: { dateTime: `${ngay}T${ket}:00+07:00` } });

test('viecTuSuKien: sự kiện có giờ thành han_ngay và gio_hen theo giờ VN', () => {
  const r = viecTuSuKien({ summary: 'Họp BGH', ...gio('2026-11-05', '09:30', '10:00') }, { tieu_de: 'Họp BGH' });
  assert.deepEqual([r.han_ngay, r.gio_hen, r.buoi], ['2026-11-05', '09:30', null]);
  // Cùng một thời điểm nhưng Lịch trả theo múi giờ khác vẫn ra đúng giờ VN.
  const utc = viecTuSuKien({ summary: 'x', start: { dateTime: '2026-11-05T02:30:00Z' }, end: { dateTime: '2026-11-05T03:00:00Z' } }, { tieu_de: 'x' });
  assert.deepEqual([utc.han_ngay, utc.gio_hen], ['2026-11-05', '09:30']);
});

test('viecTuSuKien: cả ngày bỏ giờ; khung 8-12h, 13-17h thành buổi; đúng như thanSuKien đẩy lên', () => {
  assert.deepEqual(
    (({ han_ngay: a, gio_hen: b, buoi: c }) => [a, b, c])(viecTuSuKien({ summary: 'x', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } }, { tieu_de: 'x', gio_hen: '08:00' })),
    ['2026-11-06', null, null],
  );
  assert.equal(viecTuSuKien({ summary: 'x', ...gio('2026-11-06', '08:00', '12:00') }, { tieu_de: 'x' }).buoi, 'sang');
  assert.equal(viecTuSuKien({ summary: 'x', ...gio('2026-11-06', '13:00', '17:00') }, { tieu_de: 'x' }).buoi, 'chieu');
  // Vòng đi vòng về: sự kiện từ việc có giờ, buổi, hoặc chỉ ngày đọc lại ra đúng việc cũ, không đổi gì.
  for (const viec of [
    { tieu_de: 'A', han_ngay: '2026-11-04', gio_hen: '14:15', buoi: null },
    { tieu_de: 'B', han_ngay: '2026-11-04', gio_hen: null, buoi: 'sang' },
    { tieu_de: 'C', han_ngay: '2026-11-04', gio_hen: null, buoi: null },
    { tieu_de: 'D', han_ngay: '2026-11-04', gio_hen: null, buoi: 'ca_ngay' },
  ]) {
    // Lịch Google trả giờ kèm độ lệch múi giờ; thanSuKien gửi giờ trần kèm timeZone, nên thêm +07:00 như Lịch làm.
    const sk = thanSuKien(viec);
    for (const m of [sk.start, sk.end]) if (m.dateTime) m.dateTime += '+07:00';
    assert.equal(viecTuSuKien(sk, viec).doi, false, viec.tieu_de);
  }
});

test('viecTuSuKien: nhãn do ganNhan thêm không rò vào tên việc, sửa tên thì lấy tên mới', () => {
  const ch = chuanCauHinh({ che_do: 'ca-hai', cho: 'tieu_de', bat: ['han'] });
  const viec = { tieu_de: 'Nộp báo cáo', han_ngay: HOM_NAY, trang_thai: 'mo' };
  // Sự kiện còn nguyên tiêu đề có nhãn: không đổi.
  assert.equal(viecTuSuKien({ summary: '[Hôm nay] Nộp báo cáo', start: { date: HOM_NAY } }, viec, ch, HOM_NAY).doi, false);
  // Người dùng sửa tên và giữ nguyên nhãn: bỏ nhãn.
  assert.equal(viecTuSuKien({ summary: '[Hôm nay] Nộp báo cáo quý', start: { date: HOM_NAY } }, viec, ch, HOM_NAY).tieu_de, 'Nộp báo cáo quý');
  // Sửa tên và xóa nhãn: lấy đúng tên đó.
  assert.equal(viecTuSuKien({ summary: 'Nộp báo cáo quý', start: { date: HOM_NAY } }, viec, ch, HOM_NAY).tieu_de, 'Nộp báo cáo quý');
});

test('viecTuSuKien: ghi chú sửa đổi, mô tả HTML của Lịch đưa về chữ thường', () => {
  const viec = { tieu_de: 'x', ghi_chu: 'Dòng 1', han_ngay: '2026-11-05' };
  assert.equal(viecTuSuKien({ summary: 'x', description: 'Dòng 1<br>Dòng 2', start: { date: '2026-11-05' } }, viec).ghi_chu, 'Dòng 1\nDòng 2');
  assert.equal(viecTuSuKien({ summary: 'x', description: 'Dòng 1', start: { date: '2026-11-05' } }, viec).doi, false);
  assert.equal(viecTuSuKien({ summary: 'x', start: { date: '2026-11-05' } }, viec).ghi_chu, null);
});

test('suKienThanhViec: bỏ sự kiện lặp, loại đặc biệt, lời mời từ chối, sự kiện cũ', () => {
  const tot = { id: 'e', summary: 'Họp', organizer: { self: true }, start: { date: HOM_NAY } };
  assert.equal(suKienThanhViec(tot, HOM_NAY), true);
  assert.equal(suKienThanhViec({ ...tot, recurringEventId: 'r' }, HOM_NAY), false);
  assert.equal(suKienThanhViec({ ...tot, eventType: 'birthday' }, HOM_NAY), false);
  assert.equal(suKienThanhViec({ ...tot, organizer: {}, attendees: [{ self: true, responseStatus: 'declined' }] }, HOM_NAY), false);
  assert.equal(suKienThanhViec({ ...tot, start: { date: '2026-10-30' } }, HOM_NAY), false);
  assert.equal(suKienThanhViec({ ...tot, organizer: {}, attendees: [{ self: true, responseStatus: 'accepted' }] }, HOM_NAY), true);
});

// ---- keoLichVe với CSDL thử và Google giả ----

function dung(viecs = []) {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('t', 'T', '2026-01-01')");
  for (const v of viecs) {
    db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, han_ngay, gio_hen, trang_thai, tao_luc, cap_nhat_luc, can_dong_bo, lich_event_id, lich_cap_nhat)
      VALUES ('t', ?, ?, ?, ?, '2026-11-01T00:00:00.000Z', ?, ?, ?, ?)`)
      .run(v.tieu_de, v.han_ngay ?? null, v.gio_hen ?? null, v.trang_thai ?? 'mo', v.cap_nhat_luc ?? '2026-11-01T00:00:00.000Z', v.can_dong_bo ?? 0, v.ev ?? null, v.lich_cap_nhat ?? null);
  }
  return { db, env: { CSDL: d1(db) } };
}
const giaLich = (...trang) => {
  const goiDen = [];
  const goi = async (_t, duong) => { goiDen.push(duong); const t = trang.shift(); if (t instanceof Error) throw t; return t; };
  return { goi, goiDen };
};
const viecCuaEv = (db, ev) => db.prepare('SELECT * FROM viec WHERE lich_event_id = ?').get(ev);

test('keoLichVe: lần đầu chỉ ghi mốc, không biến cả lịch cũ thành việc', async () => {
  const { db, env } = dung();
  const { goi } = giaLich({ items: [{ id: 'e1', summary: 'Họp', organizer: { self: true }, status: 'confirmed', start: { date: '2099-01-01' }, end: { date: '2099-01-02' }, updated: '2026-11-03T01:00:00.000Z' }], nextSyncToken: 'M1' });
  const r = await keoLichVe(env, 't', 'tk', { goi });
  assert.equal(r.ve, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 0);
  assert.equal(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'google_lich_sync'").get().gia_tri, 'M1');
});

test('keoLichVe: sửa giờ sự kiện thì việc đổi giờ; dùng syncToken; phân trang', async () => {
  const { db, env } = dung([{ tieu_de: 'Họp BGH', han_ngay: '2026-11-05', gio_hen: '09:00', ev: 'e1', lich_cap_nhat: '2026-11-03T01:00:00.000Z' }]);
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'M0')");
  const { goi, goiDen } = giaLich(
    { items: [], nextPageToken: 'P2' },
    { items: [{ id: 'e1', summary: 'Họp BGH', status: 'confirmed', ...gio('2026-11-06', '14:00', '14:30'), updated: '2026-11-03T02:00:00.000Z' }], nextSyncToken: 'M2' },
  );
  const r = await keoLichVe(env, 't', 'tk', { goi });
  assert.equal(r.ve, 1);
  const v = viecCuaEv(db, 'e1');
  assert.deepEqual([v.han_ngay, v.gio_hen, v.can_dong_bo, v.lich_cap_nhat], ['2026-11-06', '14:00', 0, '2026-11-03T02:00:00.000Z']);
  assert.ok(goiDen[0].includes('syncToken=M0') && goiDen[1].includes('pageToken=P2'));
  assert.equal(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'google_lich_sync'").get().gia_tri, 'M2');
  assert.equal(db.prepare("SELECT loai FROM viec_su_kien WHERE viec_id = ?").get(v.id).loai, 'doi_lich');
});

test('keoLichVe: thay đổi do chính mình đẩy lên thì bỏ qua (không dội)', async () => {
  const { db, env } = dung([{ tieu_de: 'Họp', han_ngay: '2026-11-05', gio_hen: '09:00', ev: 'e1', lich_cap_nhat: '2026-11-03T02:00:00.000Z' }]);
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'M0')");
  const { goi } = giaLich({ items: [{ id: 'e1', summary: 'Tên khác', status: 'confirmed', ...gio('2026-11-09', '07:00', '07:30'), updated: '2026-11-03T02:00:00.000Z' }], nextSyncToken: 'M2' });
  assert.equal((await keoLichVe(env, 't', 'tk', { goi })).ve, 0);
  assert.equal(viecCuaEv(db, 'e1').tieu_de, 'Họp');
});

test('keoLichVe: xóa sự kiện thì việc đang mở bị hủy, việc đã xong chỉ gỡ liên kết', async () => {
  const { db, env } = dung([
    { tieu_de: 'Đang mở', han_ngay: '2026-11-05', ev: 'e1' },
    { tieu_de: 'Đã xong', han_ngay: '2026-11-05', ev: 'e2', trang_thai: 'xong' },
  ]);
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'M0')");
  const { goi } = giaLich({ items: [{ id: 'e1', status: 'cancelled' }, { id: 'e2', status: 'cancelled' }], nextSyncToken: 'M2' });
  const r = await keoLichVe(env, 't', 'tk', { goi });
  assert.equal(r.huy, 1);
  const ds = db.prepare('SELECT tieu_de, trang_thai, lich_event_id FROM viec ORDER BY id').all();
  assert.deepEqual(ds.map((x) => [x.tieu_de, x.trang_thai, x.lich_event_id]), [['Đang mở', 'huy', null], ['Đã xong', 'xong', null]]);
});

test('keoLichVe: bên sửa sau thắng', async () => {
  const sk = { id: 'e1', summary: 'Họp', status: 'confirmed', ...gio('2026-11-09', '10:00', '10:30'), updated: '2026-11-03T02:00:00.000Z' };
  // Việc có thay đổi chờ đẩy, sửa sau sự kiện: giữ việc.
  let { db, env } = dung([{ tieu_de: 'Họp', han_ngay: '2026-11-05', gio_hen: '09:00', ev: 'e1', can_dong_bo: 1, cap_nhat_luc: '2026-11-03T03:00:00.000Z' }]);
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'M0')");
  await keoLichVe(env, 't', 'tk', { goi: giaLich({ items: [sk], nextSyncToken: 'M2' }).goi });
  let v = viecCuaEv(db, 'e1');
  assert.deepEqual([v.han_ngay, v.gio_hen, v.can_dong_bo], ['2026-11-05', '09:00', 1]);
  // Việc có thay đổi chờ đẩy nhưng sự kiện sửa sau: lấy sự kiện, bỏ cờ đẩy.
  ({ db, env } = dung([{ tieu_de: 'Họp', han_ngay: '2026-11-05', gio_hen: '09:00', ev: 'e1', can_dong_bo: 1, cap_nhat_luc: '2026-11-03T01:00:00.000Z' }]));
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'M0')");
  await keoLichVe(env, 't', 'tk', { goi: giaLich({ items: [sk], nextSyncToken: 'M2' }).goi });
  v = viecCuaEv(db, 'e1');
  assert.deepEqual([v.han_ngay, v.gio_hen, v.can_dong_bo], ['2026-11-09', '10:00', 0]);
});

test('keoLichVe: sự kiện mới tạo việc mới; sự kiện của Sonicplan mất liên kết thì nối lại, không nhân đôi', async () => {
  const { db, env } = dung([{ tieu_de: 'Có sẵn', han_ngay: '2099-01-01' }]);
  const co = db.prepare('SELECT id FROM viec').get().id;
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'M0')");
  const homNay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const { goi } = giaLich({
    items: [
      { id: 'moi', summary: 'Gặp đối tác', description: 'Tại sảnh', status: 'confirmed', organizer: { self: true }, ...gio(homNay, '15:00', '16:00'), updated: '2026-11-03T02:00:00.000Z' },
      { id: 'cu', summary: 'Có sẵn', status: 'confirmed', organizer: { self: true }, start: { date: '2099-01-01' }, end: { date: '2099-01-02' }, extendedProperties: { private: { sonicplan_viec_id: String(co) } }, updated: '2026-11-03T02:00:00.000Z' },
      { id: 'lap', summary: 'Hằng tuần', status: 'confirmed', organizer: { self: true }, recurringEventId: 'r', start: { date: homNay }, updated: '2026-11-03T02:00:00.000Z' },
    ],
    nextSyncToken: 'M2',
  });
  const r = await keoLichVe(env, 't', 'tk', { goi });
  assert.equal(r.tao, 1);
  const v = viecCuaEv(db, 'moi');
  assert.deepEqual([v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.trang_thai, v.nguon], ['Gặp đối tác', 'Tại sảnh', homNay, '15:00', 'mo', 'lich']);
  assert.equal(viecCuaEv(db, 'cu').id, co);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 2);
});

test('keoLichVe: mốc hết hạn (410) thì xóa mốc, không báo lỗi', async () => {
  const { db, env } = dung();
  db.exec("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('t', 'google_lich_sync', 'CU')");
  const loi = Object.assign(new Error('gone'), { trangThai: 410 });
  const r = await keoLichVe(env, 't', 'tk', { goi: giaLich(loi).goi });
  assert.equal(r.ve, 0);
  assert.equal(db.prepare("SELECT gia_tri FROM cai_dat WHERE khoa = 'google_lich_sync'").get().gia_tri, '');
});
