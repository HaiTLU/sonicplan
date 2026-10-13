// Xóa cả tổ chức: chỉ chủ, phải gõ đúng tên, sao lưu trước, xóa đủ mọi bảng, không chạm tổ chức khác.
// Chạy trên cơ sở dữ liệu thử dựng từ migrations/, không bao giờ trên dữ liệu thật.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl, r2 } from './csdl-thu.js';
import { BANG_CUA_TO_CHUC, donTepDaXoa, GIU_NGAY, xoaToChuc } from '../src/xoa-to-chuc.js';
import { dsTruyCap, ghiTruyCap } from '../src/du-lieu.js';

function bangCoToChuc(db) {
  const bang = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all().map((r) => r.name);
  return bang.filter((b) => db.prepare(`PRAGMA table_info(${b})`).all().some((c) => c.name === 'to_chuc_id'));
}

function gieo(db, tc) {
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('${tc}', 'Tổ chức ${tc}', 't')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd_${tc}', '${tc}@vi-du.vn', 't')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('${tc}', 'nd_${tc}', 'chu', 't')`);
  db.exec(`INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, noi_dung, thoi_diem, tao_luc) VALUES ('${tc}', 'zalo', 'm1', 'Xin chào', 't', 't')`);
  db.exec(`INSERT INTO viec (to_chuc_id, tieu_de, tao_luc, cap_nhat_luc) VALUES ('${tc}', 'Việc 1', 't', 't')`);
  db.exec(`INSERT INTO nhac_da_gui (viec_id, loai, luc) SELECT id, 'han', 't' FROM viec WHERE to_chuc_id = '${tc}'`);
  db.exec(`INSERT INTO tep (to_chuc_id, ten, kich_thuoc, r2_khoa, tao_luc) VALUES ('${tc}', 'a.pdf', 3, '${tc}/2026-10/a.pdf', 't')`);
  db.exec(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('${tc}', 'tich_hop_github', 'bi-mat')`);
  db.exec(`INSERT INTO ket_noi (to_chuc_id, loai, cap_nhat_luc) VALUES ('${tc}', 'ai', 't')`);
  db.exec(`INSERT INTO khoa_truy_cap (ma_bam, to_chuc_id, loai, tao_luc) VALUES ('bam_${tc}', '${tc}', 'zalo', 't')`);
  db.exec(`INSERT INTO chan_tin (to_chuc_id, nguon, loai, ten, tao_luc) VALUES ('${tc}', 'zalo', 'nhom', 'Q', 't')`);
}

function moi() {
  const db = dungCsdl();
  gieo(db, 'a');
  gieo(db, 'b');
  const TEP = r2();
  TEP.kho.set('a/2026-10/a.pdf', 'pdf');
  TEP.kho.set('b/2026-10/a.pdf', 'pdf');
  return { db, env: { CSDL: d1(db), TEP } };
}
const chuA = { id: 'a', ten: 'Tổ chức a', vai_tro: 'chu' };
const dem = (db, b, tc) => db.prepare(`SELECT COUNT(*) AS n FROM ${b} WHERE to_chuc_id = ?`).get(tc).n;

test('danh sách bảng cần xóa có đủ mọi bảng có cột to_chuc_id', () => {
  const db = dungCsdl();
  const thieu = bangCoToChuc(db).filter((b) => b !== 'to_chuc' && !BANG_CUA_TO_CHUC.includes(b));
  assert.deepEqual(thieu, []);
});

test('không phải chủ, hoặc gõ sai tên: không xóa gì, không sao lưu', async () => {
  const { db, env } = moi();
  assert.equal((await xoaToChuc(env, { ...chuA, vai_tro: 'thanh_vien' }, 'x', 'Tổ chức a')).ma, 403);
  assert.equal((await xoaToChuc(env, chuA, 'x', 'Tổ chức b')).ma, 400);
  assert.equal((await xoaToChuc(env, chuA, 'x', '')).ma, 400);
  assert.equal(dem(db, 'viec', 'a'), 1);
  assert.equal([...env.TEP.kho.keys()].filter((k) => k.startsWith('sao-luu/')).length, 0);
});

test('xóa: sao lưu trước, xóa sạch mọi bảng của tổ chức, tổ chức khác còn nguyên', async () => {
  const { db, env } = moi();
  const kq = await xoaToChuc(env, chuA, 'a@vi-du.vn', '  Tổ chức a ');
  assert.equal(kq.ok, true);
  assert.equal(kq.giu_ngay, GIU_NGAY);
  const banSao = JSON.parse(env.TEP.kho.get(kq.ban_sao));
  assert.equal(banSao.viec.length, 1);
  assert.equal(banSao.tin_nhan.length, 1);
  assert.equal(banSao.tep[0].r2_khoa, 'a/2026-10/a.pdf');
  assert.doesNotMatch(JSON.stringify(banSao), /bi-mat|bam_a/, 'bản sao không chứa khóa');
  for (const b of bangCoToChuc(db)) if (b !== 'to_chuc') assert.equal(dem(db, b, 'a'), 0, b);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM to_chuc WHERE id = 'a'`).get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nhac_da_gui').get().n, 1, 'chỉ còn nhắc của tổ chức b');
  for (const b of ['viec', 'tin_nhan', 'tep', 'thanh_vien', 'ket_noi', 'chan_tin']) assert.equal(dem(db, b, 'b'), 1, b);
  // Tệp R2 còn giữ để khôi phục trong 30 ngày.
  assert.ok(env.TEP.kho.has('a/2026-10/a.pdf'));
  assert.ok(env.TEP.kho.has('xoa-cho/a.json'));
});

test('sao lưu thất bại thì không xóa gì', async () => {
  const { db, env } = moi();
  env.TEP.head = async () => null;
  const kq = await xoaToChuc(env, chuA, 'a@vi-du.vn', 'Tổ chức a');
  assert.equal(kq.ma, 500);
  assert.equal(dem(db, 'viec', 'a'), 1);
});

test('dọn tệp: chưa đủ 30 ngày thì giữ, quá 30 ngày thì xóa hẳn tệp và bản sao của tổ chức đã xóa', async () => {
  const { env } = moi();
  const luc = new Date('2026-10-13T00:00:00Z');
  await xoaToChuc(env, chuA, 'a@vi-du.vn', 'Tổ chức a', luc);
  assert.equal(await donTepDaXoa(env, new Date('2026-10-20T00:00:00Z')), 0);
  assert.ok(env.TEP.kho.has('a/2026-10/a.pdf'));
  assert.equal(await donTepDaXoa(env, new Date('2026-11-13T01:00:00Z')), 1);
  const con = [...env.TEP.kho.keys()];
  assert.deepEqual(con, ['b/2026-10/a.pdf']);
});

test('nhật ký truy cập: mở trang ghi một lần mỗi ngày, tải dữ liệu ghi mỗi lần, tách theo tổ chức', async () => {
  const { env } = moi();
  const sang = new Date('2026-10-13T01:00:00Z');
  await ghiTruyCap(env, 'a', 'A@vi-du.vn', 'mo_trang', null, sang);
  await ghiTruyCap(env, 'a', 'a@vi-du.vn', 'mo_trang', null, new Date('2026-10-13T05:00:00Z'));
  await ghiTruyCap(env, 'a', 'a@vi-du.vn', 'xuat_du_lieu', null, sang);
  await ghiTruyCap(env, 'a', 'a@vi-du.vn', 'xuat_du_lieu', null, sang);
  await ghiTruyCap(env, 'a', 'a@vi-du.vn', 'mo_trang', null, new Date('2026-10-14T01:00:00Z'));
  await ghiTruyCap(env, 'b', 'b@vi-du.vn', 'tai_tep', 'a.pdf', sang);
  const ds = await dsTruyCap(env, 'a');
  assert.equal(ds.length, 4);
  assert.equal(ds.filter((r) => r.hanh_dong === 'mo_trang').length, 2);
  assert.equal(ds[0].email, 'a@vi-du.vn');
  assert.equal(ds.find((r) => r.hanh_dong === 'xuat_du_lieu').ten_hanh_dong, 'Tải toàn bộ dữ liệu');
  assert.equal((await dsTruyCap(env, 'b'))[0].chi_tiet, 'a.pdf');
});
