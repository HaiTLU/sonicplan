// Nút Spam: ẩn nhóm, người gửi, địa chỉ thư; không tách việc; hủy và mở lại việc; tin mới tự ẩn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { boChan, danhDauSpam, diaChiThu, dsChan, khoaChan } from '../src/chan-tin.js';
import { luuTin } from '../src/hop-tin.js';

function moi() {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  return { db, env };
}
const them = (env, tc, t) => luuTin(env, tc, { thoi_diem: '2026-10-13T01:00:00Z', ...t });

test('khóa chặn: nhóm Zalo, người gửi Zalo, địa chỉ thư viết thường', () => {
  assert.deepEqual(khoaChan({ nguon: 'zalo', nhom: 'VIBE WORKING', nguoi_gui: 'A' }), { nguon: 'zalo', loai: 'nhom', ten: 'VIBE WORKING' });
  assert.deepEqual(khoaChan({ nguon: 'zalo', nhom: '', tieu_de: 'Lan', nguoi_gui: 'Lan' }), { nguon: 'zalo', loai: 'ca-nhan', ten: 'Lan' });
  assert.equal(diaChiThu('GitHub <Noreply@GitHub.com>'), 'noreply@github.com');
  assert.equal(diaChiThu('a@b.vn'), 'a@b.vn');
});

test('đánh dấu spam một nhóm: ẩn tin cũ, hủy việc mở, tin mới tự ẩn, nhóm khác không bị ảnh hưởng; bỏ chặn thì hiện lại', async () => {
  const { db, env } = moi();
  const a1 = await them(env, 'a', { nguon: 'zalo', ma_goc: '1', nhom: 'VIBE WORKING CÙNG AI AGENT', nguoi_gui: 'X', noi_dung: 'Mời tham gia' });
  const a2 = await them(env, 'a', { nguon: 'zalo', ma_goc: '2', nhom: 'VIBE WORKING CÙNG AI AGENT', nguoi_gui: 'Y', noi_dung: 'Hội thảo thứ 7' });
  const khac = await them(env, 'a', { nguon: 'zalo', ma_goc: '3', nhom: 'Phòng Đào tạo', nguoi_gui: 'Z', noi_dung: 'Nộp báo cáo' });
  const toChucKhac = await them(env, 'b', { nguon: 'zalo', ma_goc: '1', nhom: 'VIBE WORKING CÙNG AI AGENT', nguoi_gui: 'X', noi_dung: 'x' });
  db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, tin_nhan_id, tao_luc, cap_nhat_luc) VALUES
    (1, 'a', 'Đi hội thảo', 'mo', ${a2}, 't', 't'), (2, 'a', 'Đã xong từ trước', 'xong', ${a1}, 't', 't'), (3, 'a', 'Nộp báo cáo', 'mo', ${khac}, 't', 't')`);

  const kq = await danhDauSpam(env, 'a', a1);
  assert.equal(kq.so_tin, 2);
  assert.equal(kq.so_viec_huy, 1);
  assert.equal(db.prepare('SELECT trang_thai FROM viec WHERE id = 1').get().trang_thai, 'huy');
  assert.equal(db.prepare('SELECT trang_thai FROM viec WHERE id = 2').get().trang_thai, 'xong');
  assert.equal(db.prepare('SELECT trang_thai FROM viec WHERE id = 3').get().trang_thai, 'mo');
  assert.equal(db.prepare('SELECT spam FROM tin_nhan WHERE id = ?').get(khac).spam, 0);
  assert.equal(db.prepare('SELECT spam FROM tin_nhan WHERE id = ?').get(toChucKhac).spam, 0);
  // Không còn tin nào của nhóm chờ AI tách việc.
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM tin_nhan WHERE to_chuc_id = 'a' AND da_tach = 0 AND spam = 1`).get().n, 0);

  // Tin mới của nhóm bị chặn: lưu nhưng ẩn, coi như đã xem và đã tách.
  const a3 = await them(env, 'a', { nguon: 'zalo', ma_goc: '4', nhom: 'VIBE WORKING CÙNG AI AGENT', nguoi_gui: 'X', noi_dung: 'Tin mới' });
  assert.deepEqual({ ...db.prepare('SELECT spam, da_xem, da_tach FROM tin_nhan WHERE id = ?').get(a3) }, { spam: 1, da_xem: 1, da_tach: 1 });
  const k4 = await them(env, 'a', { nguon: 'zalo', ma_goc: '5', nhom: 'Phòng Đào tạo', nguoi_gui: 'Z', noi_dung: 'Tin thường' });
  assert.deepEqual({ ...db.prepare('SELECT spam, da_xem, da_tach FROM tin_nhan WHERE id = ?').get(k4) }, { spam: 0, da_xem: 0, da_tach: 0 });
  // Tin trùng vẫn bị bỏ như cũ.
  assert.equal(await them(env, 'a', { nguon: 'zalo', ma_goc: '4', nhom: 'VIBE WORKING CÙNG AI AGENT', noi_dung: 'lặp' }), null);

  const ds = await dsChan(env, 'a');
  assert.equal(ds.length, 1);
  assert.equal(ds[0].so_viec_huy, 1);
  assert.equal((await dsChan(env, 'b')).length, 0);
  assert.equal((await boChan(env, 'b', ds[0].id)).ma, 404, 'tổ chức khác không bỏ chặn được');

  const bo = await boChan(env, 'a', ds[0].id);
  assert.equal(bo.so_tin, 3);
  assert.equal(bo.so_viec_mo_lai, 1);
  assert.equal(db.prepare('SELECT trang_thai FROM viec WHERE id = 1').get().trang_thai, 'mo');
  assert.equal((await dsChan(env, 'a')).length, 0);
});

test('đánh dấu spam một địa chỉ thư khớp mọi tên hiển thị của địa chỉ đó', async () => {
  const { db, env } = moi();
  const t1 = await them(env, 'a', { nguon: 'gmail', ma_goc: 'm1', nguoi_gui: 'GitHub <noreply@github.com>', tieu_de: 'PR', noi_dung: 'x' });
  await them(env, 'a', { nguon: 'gmail', ma_goc: 'm2', nguoi_gui: 'HaiTLU via GitHub <NOREPLY@github.com>', tieu_de: 'CI', noi_dung: 'y' });
  const giu = await them(env, 'a', { nguon: 'gmail', ma_goc: 'm3', nguoi_gui: 'Phòng Đào tạo <daotao@truong.vn>', tieu_de: 'Lịch', noi_dung: 'z' });
  const kq = await danhDauSpam(env, 'a', t1);
  assert.equal(kq.so_tin, 2);
  assert.equal(kq.chan.ten, 'noreply@github.com');
  assert.equal(db.prepare('SELECT spam FROM tin_nhan WHERE id = ?').get(giu).spam, 0);
  const moiVe = await them(env, 'a', { nguon: 'gmail', ma_goc: 'm4', nguoi_gui: 'noreply@github.com', tieu_de: 'Mới', noi_dung: 'w' });
  assert.equal(db.prepare('SELECT spam FROM tin_nhan WHERE id = ?').get(moiVe).spam, 1);
});

test('đánh dấu spam tin riêng Zalo chỉ ẩn hội thoại với người đó', async () => {
  const { db, env } = moi();
  const t1 = await them(env, 'a', { nguon: 'zalo', ma_goc: 'r1', tieu_de: 'Quảng cáo ABC', nguoi_gui: 'Quảng cáo ABC', noi_dung: 'Giảm giá' });
  const giu = await them(env, 'a', { nguon: 'zalo', ma_goc: 'r2', tieu_de: 'Chị Lan', nguoi_gui: 'Chị Lan', noi_dung: 'Họp lúc 9h' });
  const kq = await danhDauSpam(env, 'a', t1);
  assert.equal(kq.chan.loai, 'ca-nhan');
  assert.equal(kq.so_tin, 1);
  assert.equal(db.prepare('SELECT spam FROM tin_nhan WHERE id = ?').get(giu).spam, 0);
  assert.equal((await danhDauSpam(env, 'b', t1)).ma, 404, 'tổ chức khác không chạm được tin');
});
