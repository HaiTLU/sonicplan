// Rà soát luồng phân việc 14/10/2026: dời hạn phải dời cả Google và lời nhắc, việc trùng nhận hạn mới,
// một tin báo việc mới, giao GitHub tự động tắt sẵn. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { CAC_TAC_VU, dongViecMoi } from '../src/tac-vu.js';
import { apDungNutViec } from '../src/telegram.js';
import { macDinhLuong } from '../src/luong.js';
import { doiHanKhiTrung, themViec, timTrung } from '../src/viec.js';

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}

const themDong = (db, han, gio = null) =>
  Number(db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, han_ngay, gio_hen, trang_thai, tao_luc, cap_nhat_luc, google_task_id, nhan_gg)
    VALUES ('tc1', 'Gửi báo giá cho đối tác IPSOS', ?, ?, 'mo', ?, ?, 'g1', 'x')`).run(han, gio, new Date().toISOString(), new Date().toISOString()).lastInsertRowid);

test('dọn cuối ngày: dời hạn thì đánh dấu đồng bộ lại Google và xóa dấu đã nhắc', async () => {
  const { db, env } = moiTruong();
  const id = themDong(db, '2026-10-14', '09:00');
  db.prepare("INSERT INTO nhac_da_gui (viec_id, loai, luc) VALUES (?, 'dung', 'x')").run(id);
  const kq = await CAC_TAC_VU['don-cuoi-ngay'](env, '2026-10-14T16:00:00.000Z');
  assert.equal(kq.so_muc, 1);
  const v = db.prepare('SELECT han_ngay, can_dong_bo FROM viec WHERE id = ?').get(id);
  assert.equal(v.han_ngay, '2026-10-15');
  assert.equal(v.can_dong_bo, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nhac_da_gui WHERE viec_id = ?').get(id).n, 0);
});

test('nút Dời mai trên Telegram: Google Tasks và Lịch dời theo', async () => {
  const { db, env } = moiTruong();
  const id = themDong(db, '2026-10-14');
  await apDungNutViec(env, 'tc1', { viec_id: id, hanh_dong: 'mai' }, '2026-10-14T03:00:00.000Z');
  assert.equal(db.prepare('SELECT can_dong_bo FROM viec WHERE id = ?').get(id).can_dong_bo, 1);
});

test('việc trùng: tin mới đổi hạn hoặc giờ thì cập nhật việc cũ, ngày quá khứ thì bỏ', () => {
  const cu = { han_ngay: '2026-10-15', gio_hen: '09:00' };
  assert.deepEqual(doiHanKhiTrung(cu, { han_ngay: '2026-10-17', gio_hen: null }, '2026-10-14'), { han_ngay: '2026-10-17', gio_hen: '09:00' });
  assert.deepEqual(doiHanKhiTrung(cu, { han_ngay: null, gio_hen: '15:00' }, '2026-10-14'), { han_ngay: '2026-10-15', gio_hen: '15:00' });
  assert.equal(doiHanKhiTrung(cu, { han_ngay: '2026-10-15', gio_hen: '09:00' }, '2026-10-14'), null);
  assert.equal(doiHanKhiTrung(cu, { han_ngay: '2026-10-01', gio_hen: null }, '2026-10-14'), null);
  assert.equal(doiHanKhiTrung({ han_ngay: null, gio_hen: null }, { han_ngay: null, gio_hen: null }, '2026-10-14'), null);
});

test('themViec trùng có hạn mới: không tạo việc thứ hai, hạn việc cũ đổi và đồng bộ lại', async () => {
  const { db, env } = moiTruong();
  const id = themDong(db, '2099-01-01');
  const r = await themViec(env, 'tc1', { tieu_de: 'Gửi báo giá cho đối tác IPSOS', han_ngay: '2099-01-03' });
  assert.equal(r.trung, true);
  assert.equal(r.id, id);
  assert.equal(r.doi_han, true);
  const v = db.prepare('SELECT han_ngay, can_dong_bo FROM viec WHERE id = ?').get(id);
  assert.equal(v.han_ngay, '2099-01-03');
  assert.equal(v.can_dong_bo, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 1);
});

test('tin báo việc mới mang luôn nhóm và bước tiếp từ gợi ý', () => {
  const ghiChu = 'Zalo Lan\n\n[Gợi ý] Nhóm 2: AI chuẩn bị, bạn quyết định. Cần duyệt.\n1. Đọc báo giá\n2. Trả lời';
  assert.equal(dongViecMoi({ tieu_de: 'Xem báo giá', han_ngay: '2026-10-15', gio_hen: '14:00', ghi_chu: ghiChu }), '- Xem báo giá (hạn 15/10 14:00): AI chuẩn bị, bạn quyết định. Bước tiếp: Đọc báo giá');
  assert.equal(dongViecMoi({ tieu_de: 'Gọi lại thầy Khẩn', han_ngay: null, ghi_chu: null }), '- Gọi lại thầy Khẩn');
});

test('giao việc sang GitHub tự động tắt sẵn, các khâu khác bật', () => {
  const lg = macDinhLuong();
  assert.equal(lg.bat['giao-github'], false);
  assert.equal(lg.bat['tach-viec'], true);
  assert.equal(lg.bat['don-cuoi-ngay'], true);
});

test('dọn cuối ngày nâng ưu tiên việc hạn đến hết ngày mai, không đụng việc còn xa', async () => {
  const { db, env } = moiTruong();
  const gan = themDong(db, '2026-10-15');
  const xa = themDong(db, '2026-10-20');
  db.prepare("UPDATE viec SET uu_tien = 'thap'").run();
  await CAC_TAC_VU['don-cuoi-ngay'](env, '2026-10-14T16:00:00.000Z');
  assert.equal(db.prepare('SELECT uu_tien FROM viec WHERE id = ?').get(gan).uu_tien, 'cao');
  assert.equal(db.prepare('SELECT uu_tien FROM viec WHERE id = ?').get(xa).uu_tien, 'thap');
});

test('chống trùng: cùng cuộc trò chuyện thì ngưỡng thấp hơn, khác chat vẫn 80%', () => {
  const ds = [{ id: 1, tieu_de: 'Gửi báo giá cho chị Lan', nguon_khoa: 'Chị Lan' }];
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds, 'Chị Lan')?.id, 1);
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds, 'Người khác'), null);
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds), null);
  // Việc khác trong cùng chat vẫn tách riêng (độ giống 0,62).
  assert.equal(timTrung('Gửi hợp đồng cho chị Lan', ds, 'Chị Lan'), null);
});

test('themViec: việc vừa xong 3 ngày không bị tạo lại, việc mở 30 ngày trước vẫn tính là trùng', async () => {
  const { db, env } = moiTruong();
  const cu = new Date(Date.now() - 30 * 86400000).toISOString();
  db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc, xong_luc) VALUES ('tc1', 'Nộp hồ sơ nghiệm thu đề tài', 'xong', ?, ?, ?)`).run(cu, cu, new Date().toISOString());
  db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc) VALUES ('tc1', 'Soạn tờ trình khóa Tiếng Anh giao tiếp', 'mo', ?, ?)`).run(cu, cu);
  assert.equal((await themViec(env, 'tc1', { tieu_de: 'Nộp hồ sơ nghiệm thu đề tài' })).trung, true);
  assert.equal((await themViec(env, 'tc1', { tieu_de: 'Soạn tờ trình khóa Tiếng Anh giao tiếp' })).trung, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM viec').get().n, 2);
});
