// Tìm ghi nhớ bằng FTS5: có dấu, không dấu, chữ đ, câu tự nhiên, ký tự đặc biệt, đồng bộ chỉ mục.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { d1, dungCsdl } from './csdl-thu.js';
import { timGhiNho, truyVanFts } from '../src/ghi-nho.js';
import { xuLyGhiNho } from '../src/api/ghi-nho.js';

function moi() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('A', 'A', '2026-01-01'), ('B', 'B', '2026-01-01')`);
  const them = (tc, loai, td, nd, luc = '2026-01-01') =>
    db.prepare('INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, tao_luc, cap_nhat_luc) VALUES (?, ?, ?, ?, ?, ?)').run(tc, loai, td, nd, luc, luc);
  them('A', 'nguoi', 'Chị Lan', 'Trưởng phòng đào tạo, hay họp sáng thứ Năm');
  them('A', 'du_an', 'Khóa AI', 'Đang tuyển học viên, đường dẫn đăng ký ở trang chủ');
  them('A', 'quyet_dinh', 'Dời hạn', 'Đã chốt dời hạn nộp sang 15/11');
  them('B', 'nguoi', 'Chị Lan', 'Người tổ chức khác, trưởng phòng kế toán');
  return { db, env: { CSDL: d1(db) } };
}
const tieuDe = (r) => r.map((x) => x.tieu_de);

test('truyVanFts: bỏ ký tự đặc biệt, nối OR, thêm biến thể đ/d, không còn từ thì null', () => {
  assert.equal(truyVanFts('Chị Lan là ai?'), '"chị" OR "lan"');
  assert.match(truyVanFts('đường dẫn'), /"đường" OR "dường" OR "dẫn"/);
  assert.match(truyVanFts('dang ky'), /"dang" OR "đang"/);
  assert.equal(truyVanFts('"*()-:^ ?'), null);
  assert.equal(truyVanFts(''), null);
  assert.ok(!truyVanFts('x" OR a:b NEAR(').includes('NEAR('));
});

test('migration 0043: chỉ mục dựng từ dữ liệu có sẵn khi áp lên bảng đã có dòng', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(readFileSync('migrations/0004_ghi_nho_nhac_viec.sql', 'utf8').split('-- Mỗi lời nhắc')[0]);
  db.exec(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, tao_luc, cap_nhat_luc) VALUES ('A','nguoi','Chị Lan','Trưởng phòng','x','x')`);
  db.exec(readFileSync('migrations/0043_ghi_nho_fts.sql', 'utf8'));
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM ghi_nho_fts WHERE ghi_nho_fts MATCH '"truong"'`).get().n, 1);
  db.exec(readFileSync('migrations/0043_ghi_nho_fts.sql', 'utf8'));
  assert.equal(db.prepare(`SELECT COUNT(*) n FROM ghi_nho_fts WHERE ghi_nho_fts MATCH '"truong"'`).get().n, 1, 'áp lại không nhân đôi');
});

test('tìm có dấu, không dấu, hoa thường, chỉ trong tổ chức mình', async () => {
  const t = moi();
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'trưởng phòng')), ['Chị Lan']);
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'TRUONG PHONG dao tao')), ['Chị Lan']);
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'B', 'chi lan')), ['Chị Lan']);
  assert.equal((await timGhiNho(t.env, 'B', 'trưởng phòng')).every((r) => /kế toán/.test(r.noi_dung)), true);
  assert.equal((await timGhiNho(t.env, 'B', 'khóa AI')).length, 0, 'không thấy ghi nhớ của tổ chức khác');
});

test('chữ đ: gõ đ hoặc d đều ra, gõ không dấu "dang" vẫn ra "đang"', async () => {
  const t = moi();
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'đường dẫn')), ['Khóa AI']);
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'duong dan')), ['Khóa AI']);
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'dang tuyen')), ['Khóa AI']);
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'doi han')), ['Dời hạn'], 'tiêu đề "Dời hạn" có d không phải đ');
});

test('câu tự nhiên có dấu hỏi, nháy, gạch: không lỗi cú pháp FTS và vẫn ra kết quả', async () => {
  const t = moi();
  for (const q of ['Chị Lan là trưởng phòng nào?', '"Khóa AI" (đang) tuyển -- gì thế?', "hạn nộp: 15/11 * NEAR AND OR NOT", 'chị Lan OR']) {
    const r = await timGhiNho(t.env, 'A', q);
    assert.ok(Array.isArray(r) && r.length > 0, `không ra gì cho: ${q}`);
  }
});

test('không ra kết quả thì mảng rỗng; chuỗi toàn ký tự đặc biệt cũng không lỗi', async () => {
  const t = moi();
  assert.deepEqual(await timGhiNho(t.env, 'A', 'xyzkhongco'), []);
  assert.deepEqual(await timGhiNho(t.env, 'A', '*** ???'), []);
  assert.deepEqual(await timGhiNho(t.env, 'A', '%_'), []);
});

test('FTS hỏng thì rơi về LIKE', async () => {
  const t = moi();
  t.db.exec('DROP TABLE ghi_nho_fts');
  const loi = console.error; console.error = () => {};
  try {
    assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'trưởng phòng')), ['Chị Lan']);
  } finally { console.error = loi; }
});

test('không từ khóa thì trả mục mới cập nhật nhất trước; tối đa 10', async () => {
  const t = moi();
  t.db.prepare("UPDATE ghi_nho SET cap_nhat_luc = '2026-05-01' WHERE tieu_de = 'Dời hạn'").run();
  assert.equal(tieuDe(await timGhiNho(t.env, 'A', ''))[0], 'Dời hạn');
  for (let i = 0; i < 15; i++) t.db.prepare("INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, tao_luc, cap_nhat_luc) VALUES ('A','su_that',?,'lặp lại','x','x')").run(`Mục ${i}`);
  assert.equal((await timGhiNho(t.env, 'A', 'lặp lại')).length, 10);
});

test('chỉ mục theo kịp sửa và xóa', async () => {
  const t = moi();
  t.db.prepare("UPDATE ghi_nho SET noi_dung = 'Phó giám đốc' WHERE tieu_de = 'Chị Lan' AND to_chuc_id = 'A'").run();
  assert.equal((await timGhiNho(t.env, 'A', 'trưởng phòng')).length, 0);
  assert.deepEqual(tieuDe(await timGhiNho(t.env, 'A', 'giám đốc')), ['Chị Lan']);
  t.db.prepare("DELETE FROM ghi_nho WHERE tieu_de = 'Chị Lan' AND to_chuc_id = 'A'").run();
  assert.equal((await timGhiNho(t.env, 'A', 'giám đốc')).length, 0);
});

test('API danh sách ghi nhớ: ô tìm dùng FTS5 (không dấu, nhiều từ), vẫn tách theo tổ chức và lọc loại', async () => {
  const { env } = moi();
  const goi = async (qs) => {
    const r = await xuLyGhiNho(new Request('http://x/api/ghi-nho'), env, { to_chuc: { id: 'A', vai_tro: 'chu' } }, new URL(`http://x/api/ghi-nho${qs}`));
    return (await r.json()).ghi_nho;
  };
  assert.deepEqual(tieuDe(await goi('?q=truong%20phong%20dao%20tao')), ['Chị Lan']);
  assert.deepEqual(tieuDe(await goi('?q=dang%20ky')), ['Khóa AI']);
  assert.deepEqual(tieuDe(await goi('?q=zzzkhongco')), []);
  assert.deepEqual(tieuDe(await goi('?q=lan&loai=du_an')), []);
  assert.equal((await goi('?q=lan')).length, 1, 'không lẫn ghi nhớ của tổ chức B');
});
