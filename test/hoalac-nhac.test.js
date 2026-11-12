// Nhắc việc hằng ngày của khu Dự án: nội dung từng dự án, giờ gửi, và nơi nhận là tổ chức chính của chủ dự án.
// Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nhacDuAn, noiNhan, soanNhacDuAn } from '../src/hoalac/nhac.js';
import { CAC_TAC_VU } from '../src/tac-vu.js';
import { TAC_VU } from '../src/lich-chay.js';
import { d1, dungCsdl } from './csdl-thu.js';

const HOM_NAY = '2026-11-12';

function moiEnv() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES
    ('tc-a', 'Du an A', 'hoalac', 'x'), ('tc-b', 'Du an B', 'hoalac', 'x'),
    ('tc-chung', 'Chung', 'chung', 'x'), ('tc-khac', 'Khac', 'chung', 'x')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-chu', 'chu@vi-du.vn', 'x'), ('nd-tv', 'tv@vi-du.vn', 'x')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-chung', 'nd-chu', 'chu', 'x'), ('tc-a', 'nd-chu', 'chu', 'x'), ('tc-b', 'nd-chu', 'chu', 'x'),
    ('tc-a', 'nd-tv', 'thanh_vien', 'x'), ('tc-khac', 'nd-tv', 'chu', 'x')`);
  db.exec(`INSERT INTO qlda_hang_muc (to_chuc_id, ten, la_moc, thoi_gian_ngay, ngay_ket_thuc, tien_do_pt, trang_thai, phu_trach, tao_luc, cap_nhat_luc) VALUES
    ('tc-a', 'Moc trong tuan', 1, 1, '2026-11-17', 0, 'chua_lam', '', 'x', 'x'),
    ('tc-a', 'Moc xa', 1, 1, '2026-12-30', 0, 'chua_lam', '', 'x', 'x'),
    ('tc-a', 'Moc da xong', 1, 1, '2026-11-14', 100, 'xong', '', 'x', 'x'),
    ('tc-a', 'Viec tre', 0, 3, '2026-11-01', 50, 'dang_lam', 'Phong KH', 'x', 'x'),
    ('tc-a', 'Viec tam dung', 0, 3, '2026-11-01', 0, 'tam_dung', '', 'x', 'x'),
    ('tc-b', 'Moc B', 1, 1, '2026-11-13', 0, 'chua_lam', '', 'x', 'x')`);
  db.exec(`INSERT INTO qlda_thu_tuc (to_chuc_id, nhom, ten, trang_thai, tao_boi, tao_luc, cap_nhat_luc) VALUES
    ('tc-a', 'A', 'Thu tuc vuong', 'block', 'x', 'x', 'x'), ('tc-a', 'A', 'Thu tuc dang lam', 'doing', 'x', 'x', 'x')`);
  db.exec(`INSERT INTO qlda_san_pham_ban_giao (to_chuc_id, ten, han, trang_thai, tao_boi, tao_luc, cap_nhat_luc) VALUES
    ('tc-b', 'Bao cao qua han', '2026-11-10', 'chua_giao', 'x', 'x', 'x'),
    ('tc-b', 'Bao cao da giao', '2026-11-11', 'da_giao', 'x', 'x', 'x'),
    ('tc-b', 'Bao cao xa', '2026-12-30', 'chua_giao', 'x', 'x', 'x')`);
  return { db, env: { CSDL: d1(db) } };
}

test('phần nhắc của một dự án chỉ gồm mốc 7 ngày chưa xong, việc quá hạn đang làm, thủ tục vướng', async () => {
  const { env } = moiEnv();
  const a = await soanNhacDuAn(env, 'tc-a', HOM_NAY);
  assert.match(a, /Mốc trong 7 ngày tới \(1\):\n- Moc trong tuan \(17\/11\)/);
  assert.match(a, /Việc quá hạn \(1\):\n- Viec tre \(hạn 01\/11, Phong KH\)/);
  assert.match(a, /Thủ tục đang chờ hoặc vướng \(1\):\n- Thu tuc vuong \(vướng\)/);
  for (const khong of ['Moc xa', 'Moc da xong', 'Viec tam dung', 'Thu tuc dang lam', 'Moc B']) assert.ok(!a.includes(khong), khong);
});

test('bàn giao chưa giao, quá hạn hoặc trong 7 ngày thì nhắc; đã giao hoặc còn xa thì không', async () => {
  const { env } = moiEnv();
  const b = await soanNhacDuAn(env, 'tc-b', HOM_NAY);
  assert.match(b, /- Bao cao qua han \(hạn 10\/11, đã quá\)/);
  assert.ok(!b.includes('Bao cao da giao') && !b.includes('Bao cao xa'));
  assert.ok(!b.includes('Moc trong tuan'), 'không lẫn dữ liệu dự án A');
});

test('dự án không có gì cần nhắc thì trả chuỗi rỗng', async () => {
  const { env, db } = moiEnv();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-trong', 'Trong', 'hoalac', 'x')`);
  assert.equal(await soanNhacDuAn(env, 'tc-trong', HOM_NAY), '');
});

test('chỉ chạy lúc 8h giờ Việt Nam, trừ khi bấm Chạy ngay', async () => {
  const { env } = moiEnv();
  assert.deepEqual(await nhacDuAn(env, '2026-11-12T03:00:00.000Z'), { bo_qua: true });
  const luc8 = await nhacDuAn(env, '2026-11-12T01:00:00.000Z');
  assert.equal(luc8.bo_qua, undefined);
  const ep = await nhacDuAn(env, '2026-11-12T03:00:00.000Z', { ep: true });
  assert.equal(ep.bo_qua, undefined);
});

test('nơi nhận là tổ chức chính của chủ dự án, không phải tổ chức của thành viên thường', async () => {
  const { env } = moiEnv();
  // Chưa cài bot nên không gửi được, nhưng đếm nơi nhận: chỉ tc-chung (nd-chu), không có tc-khac (nd-tv).
  const kq = await nhacDuAn(env, '2026-11-12T01:00:00.000Z');
  assert.equal(kq.ghi_chu, '2 dự án, gửi 0/1 nơi nhận');
});

test('nhóm có người ngoài dự án thì không nhận; một chủ chỉ một nơi nhận', async () => {
  const { env, db } = moiEnv();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-nhom', 'Nhom', 'chung', 'x'), ('tc-z', 'Rieng 2', 'chung', 'x')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-dong', 'dong@vi-du.vn', 'x')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-nhom', 'nd-chu', 'chu', 'x'), ('tc-nhom', 'nd-dong', 'chu', 'x'), ('tc-z', 'nd-chu', 'chu', 'x')`);
  // tc-nhom có nd-dong không thuộc dự án A: bị loại. tc-chung và tc-z đều hợp lệ: chỉ lấy một (mã nhỏ nhất).
  assert.deepEqual(await noiNhan(env, 'tc-a'), ['tc-chung']);
  // Thành viên thường của dự án (nd-tv) cùng nằm trong nhóm thì nhóm vẫn hợp lệ.
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-chung', 'nd-tv', 'thanh_vien', 'x')`);
  assert.deepEqual(await noiNhan(env, 'tc-a'), ['tc-chung']);
  // Dự án B không có nd-tv nên tc-chung (nay có nd-tv) không nhận tin của B; còn tc-z.
  assert.deepEqual(await noiNhan(env, 'tc-b'), ['tc-z']);
  // Đối tác của dự án ngồi trong nhóm thì nhóm không nhận (đối tác chỉ thấy phần được giao).
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-dt', 'dt@vi-du.vn', 'x')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-b', 'nd-dt', 'doi_tac', 'x'), ('tc-z', 'nd-dt', 'thanh_vien', 'x')`);
  assert.deepEqual(await noiNhan(env, 'tc-b'), []);
});

test('thủ tục vướng xếp trước đang chờ; mốc chỉ có ngày bắt đầu vẫn được nhắc', async () => {
  const { env, db } = moiEnv();
  db.exec(`INSERT INTO qlda_thu_tuc (to_chuc_id, nhom, ten, trang_thai, tao_boi, tao_luc, cap_nhat_luc) VALUES
    ('tc-b', 'A', 'Cho 1', 'wait', 'x', 'x', 'x'), ('tc-b', 'A', 'Vuong 2', 'block', 'x', 'x', 'x')`);
  db.exec(`INSERT INTO qlda_hang_muc (to_chuc_id, ten, la_moc, thoi_gian_ngay, ngay_bat_dau, tien_do_pt, trang_thai, tao_luc, cap_nhat_luc) VALUES
    ('tc-b', 'Moc chi bat dau', 1, 1, '2026-11-19', 0, 'chua_lam', 'x', 'x')`);
  const b = await soanNhacDuAn(env, 'tc-b', HOM_NAY);
  assert.match(b, /- Vuong 2 \(vướng\)\n- Cho 1 \(đang chờ\)/);
  assert.match(b, /- Moc chi bat dau \(19\/11\)/);
});

test('tác vụ nhac-du-an có trong lịch chạy mỗi giờ và trong bảng hàm', () => {
  const tv = TAC_VU.find((t) => t.ma === 'nhac-du-an');
  assert.ok(tv && tv.bat && tv.lich === '0 * * * *');
  assert.equal(CAC_TAC_VU['nhac-du-an'], nhacDuAn);
});
