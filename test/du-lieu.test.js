// Câu hỏi xuất dữ liệu chạy được trên lược đồ thật (dựng từ migrations/) và không lộ khóa, mã băm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { BANG_XUAT, xuatDuLieu } from '../src/du-lieu.js';

function dungCsdl() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').sort()) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  db.exec('PRAGMA foreign_keys = OFF');
  return db;
}

// Bọc DatabaseSync thành dạng env.CSDL (D1) tối thiểu cho xuatDuLieu.
function d1(db) {
  return {
    prepare: (cau) => ({ bind: (...ts) => ({ all: () => ({ results: db.prepare(cau).all(...ts).map((r) => ({ ...r })) }) }) }),
    batch: async (ds) => ds.map((x) => x.all()),
  };
}

test('xuất đủ các bảng, chỉ của tổ chức mình, không có khóa và mã băm', async () => {
  const db = dungCsdl();
  db.exec(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('a', 'tich_hop_github', 'bi-mat'), ('a', 'nhan_viec_bam', 'x'), ('a', 'ho_so', 'Tên tôi'), ('b', 'ho_so', 'Người khác')`);
  db.exec(`INSERT INTO luot_claude (to_chuc_id, viec_id, ma_bam, tao_luc, cap_nhat_luc) VALUES ('a', 1, 'bam-bi-mat', 't', 't')`);
  const ra = await xuatDuLieu({ CSDL: d1(db) }, 'a', 'luc');
  for (const [ten] of BANG_XUAT) assert.ok(Array.isArray(ra[ten]), ten);
  assert.deepEqual(ra.cai_dat, [{ khoa: 'ho_so', gia_tri: 'Tên tôi' }]);
  assert.equal(ra.luot_claude.length, 1);
  assert.doesNotMatch(JSON.stringify(ra), /bi-mat|bam-bi-mat|Người khác/);
});

test('lệnh ghi từ trang khác bị chặn, từ chính trang thì qua', async () => {
  const { cungNguon } = await import('../src/index.js');
  const url = new URL('https://plan.vi-du.vn/api/viec');
  const yc = (h) => new Request(url, { method: 'POST', headers: h });
  assert.equal(cungNguon(yc({ 'sec-fetch-site': 'same-origin' }), url), true);
  assert.equal(cungNguon(yc({ 'sec-fetch-site': 'cross-site' }), url), false);
  assert.equal(cungNguon(yc({ 'sec-fetch-site': 'same-site' }), url), false);
  assert.equal(cungNguon(yc({ origin: 'https://ke-xau.vn' }), url), false);
  assert.equal(cungNguon(yc({ origin: 'https://plan.vi-du.vn' }), url), true);
  assert.equal(cungNguon(yc({}), url), true);
});
