// Trang tổng hợp Ban Giám hiệu: danh mục có danh sách việc quá hạn, rủi ro cao và bản cập nhật tuần đã lưu;
// chỉ chủ dự án soạn nháp và lưu; không có AI thì vẫn ra bản mẫu. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sonicplan from '../src/index.js';
import { d1, dungCsdl } from './csdl-thu.js';
import { banMau, dauTuan, soanNhap } from '../src/hoalac/cap-nhat-tuan.js';

function moiEnv() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, loai_du_an, tao_luc) VALUES
    ('tc-a', 'Vien Hoa Lac', 'hoalac', 'xay_dung', '2026-01-01'),
    ('tc-b', 'Nghien cuu thi truong', 'hoalac', 'nghien_cuu', '2026-01-01'),
    ('tc-chung', 'Chung', 'chung', 'xay_dung', '2026-01-01')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES
    ('nd-chu', 'chu@vi-du.vn', '2026-01-01'), ('nd-tv', 'tv@vi-du.vn', '2026-01-01'),
    ('nd-xem', 'bgh@vi-du.vn', '2026-01-01'), ('nd-dt', 'dt@vi-du.vn', '2026-01-01'),
    ('nd-b', 'chi-b@vi-du.vn', '2026-01-01')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-chung', 'nd-chu', 'chu', '2026-01-01'),
    ('tc-a', 'nd-chu', 'chu', '2026-01-02'), ('tc-b', 'nd-chu', 'chu', '2026-01-03'),
    ('tc-a', 'nd-tv', 'thanh_vien', '2026-01-02'),
    ('tc-a', 'nd-xem', 'xem', '2026-01-02'), ('tc-b', 'nd-xem', 'xem', '2026-01-03'),
    ('tc-a', 'nd-dt', 'doi_tac', '2026-01-02'),
    ('tc-b', 'nd-b', 'thanh_vien', '2026-01-03')`);
  db.exec(`INSERT INTO qlda_hang_muc (to_chuc_id, ten, la_moc, thoi_gian_ngay, ngay_ket_thuc, tien_do_pt, trang_thai, tren_duong_gang, tao_luc, cap_nhat_luc) VALUES
    ('tc-a', 'Moc A1', 1, 1, '2099-01-10', 0, 'chua_lam', 0, 'x', 'x'),
    ('tc-a', 'Viec A qua han', 0, 3, '2020-01-01', 50, 'dang_lam', 1, 'x', 'x'),
    ('tc-b', 'Moc B1', 1, 1, '2099-02-01', 0, 'chua_lam', 0, 'x', 'x')`);
  db.exec(`INSERT INTO qlda_rui_ro (to_chuc_id, ten, xac_suat, tac_dong, tao_boi, tao_luc, cap_nhat_luc) VALUES
    ('tc-b', 'Rui ro B cao', 4, 5, 'x', 'x', 'x'), ('tc-b', 'Rui ro B thap', 1, 2, 'x', 'x', 'x')`);
  const ASSETS = { fetch: async (r) => new Response(new URL(r.url).pathname, { status: 200 }) };
  return { db, env: { CSDL: d1(db), ASSETS } };
}

async function goi(env, email, duong, { method = 'GET', toChuc, than } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (toChuc) headers['x-to-chuc'] = toChuc;
  const yc = new Request(`https://localhost${duong}`, { method, headers, body: than !== undefined ? JSON.stringify(than) : undefined });
  const ra = await sonicplan.fetch(yc, { ...env, EMAIL_THU: email }, { waitUntil: () => {} });
  const chu = await ra.text();
  let du; try { du = JSON.parse(chu); } catch { du = chu; }
  return { status: ra.status, du };
}

const soDong = (db) => db.prepare('SELECT COUNT(*) AS so FROM qlda_cap_nhat_tuan').get().so;

test('dauTuan trả thứ Hai của tuần, kể cả khi hôm nay là Chủ nhật', () => {
  assert.equal(dauTuan('2026-11-12'), '2026-11-09'); // thứ Năm
  assert.equal(dauTuan('2026-11-09'), '2026-11-09'); // thứ Hai
  assert.equal(dauTuan('2026-11-15'), '2026-11-09'); // Chủ nhật
});

test('danh mục có danh sách việc quá hạn và rủi ro cao cho trang BGH', async () => {
  const { env } = moiEnv();
  const r = await goi(env, 'bgh@vi-du.vn', '/api/hoalac/danh-muc');
  assert.equal(r.status, 200);
  const a = r.du.du_an.find((x) => x.id === 'tc-a');
  const b = r.du.du_an.find((x) => x.id === 'tc-b');
  assert.deepEqual(a.qua_han_ds.map((x) => x.ten), ['Viec A qua han']);
  assert.equal(a.qua_han_ds[0].gang, 1);
  assert.deepEqual(b.rui_ro_ds.map((x) => x.ten), ['Rui ro B cao']);
  assert.equal(a.cap_nhat, null);
});

test('bản nháp không nhận việc xong cũ là "xong tuần này" sau khi WBS được tính lại', async () => {
  const { env, db } = moiEnv();
  db.exec(`INSERT INTO qlda_hang_muc (to_chuc_id, ten, la_moc, thoi_gian_ngay, ngay_ket_thuc, tien_do_pt, trang_thai, tren_duong_gang, tao_luc, cap_nhat_luc)
    VALUES ('tc-a', 'Viec xong tu 2024', 0, 1, '2024-01-05', 100, 'xong', 0, '2024-01-01', '${new Date().toISOString()}')`);
  const r = await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan/soan-nhap', { method: 'POST', toChuc: 'tc-a', than: {} });
  assert.equal(r.status, 200);
  assert.ok(!r.du.noi_dung.includes('Viec xong tu 2024'));
  assert.ok(!/xong trong 7 ngày/.test(r.du.noi_dung));
});

test('chủ lưu cập nhật tuần, BGH (xem) đọc được ở cả hai dự án', async () => {
  const { env, db } = moiEnv();
  const luuA = await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-a', than: { noi_dung: 'Tuan nay A on' } });
  assert.equal(luuA.status, 200);
  const luuB = await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-b', than: { noi_dung: 'Tuan nay B cham' } });
  assert.equal(luuB.status, 200);
  // Lưu lại cùng tuần thì ghi đè, không thêm dòng.
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-a', than: { noi_dung: 'Tuan nay A on, da sua' } });
  assert.equal(soDong(db), 2);
  const r = await goi(env, 'bgh@vi-du.vn', '/api/hoalac/danh-muc');
  const a = r.du.du_an.find((x) => x.id === 'tc-a');
  const b = r.du.du_an.find((x) => x.id === 'tc-b');
  assert.equal(a.cap_nhat.noi_dung, 'Tuan nay A on, da sua');
  assert.equal(b.cap_nhat.noi_dung, 'Tuan nay B cham');
  assert.equal(a.cap_nhat.nguoi_viet, 'chu@vi-du.vn');
});

test('xem, thành viên, đối tác không soạn nháp hay lưu được; số dòng không đổi', async () => {
  const { env, db } = moiEnv();
  for (const email of ['bgh@vi-du.vn', 'tv@vi-du.vn', 'dt@vi-du.vn']) {
    const luu = await goi(env, email, '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-a', than: { noi_dung: 'Ghi trom' } });
    assert.equal(luu.status, 403, email);
    const nhap = await goi(env, email, '/api/hoalac/cap-nhat-tuan/soan-nhap', { method: 'POST', toChuc: 'tc-a', than: {} });
    assert.equal(nhap.status, 403, email);
  }
  assert.equal(soDong(db), 0);
});

test('đối tác không nhận chữ cập nhật; thành viên dự án A không thấy cập nhật của B', async () => {
  const { env } = moiEnv();
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-a', than: { noi_dung: 'Bi mat cua A' } });
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-b', than: { noi_dung: 'Bi mat cua B' } });
  const dt = await goi(env, 'dt@vi-du.vn', '/api/hoalac/danh-muc');
  assert.ok(!JSON.stringify(dt.du).includes('Bi mat'));
  const tv = await goi(env, 'tv@vi-du.vn', '/api/hoalac/danh-muc');
  assert.ok(JSON.stringify(tv.du).includes('Bi mat cua A'));
  assert.ok(!JSON.stringify(tv.du).includes('Bi mat cua B'));
});

test('lưu bản trống thì 400', async () => {
  const { env, db } = moiEnv();
  const r = await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan', { method: 'PUT', toChuc: 'tc-a', than: { noi_dung: '   ' } });
  assert.equal(r.status, 400);
  assert.equal(soDong(db), 0);
});

test('không có AI thì soạn nháp vẫn trả 200 với bản mẫu, không ghi CSDL', async () => {
  const { env, db } = moiEnv();
  const r = await goi(env, 'chu@vi-du.vn', '/api/hoalac/cap-nhat-tuan/soan-nhap', { method: 'POST', toChuc: 'tc-a', than: {} });
  assert.equal(r.status, 200);
  assert.equal(r.du.ai, false);
  assert.match(r.du.noi_dung, /Viec A qua han/);
  assert.match(r.du.noi_dung, /trên đường găng/);
  assert.match(r.du.noi_dung, /Moc A1/);
  assert.equal(soDong(db), 0);
});

test('soạn nháp có AI: AI nhận bản mẫu làm dữ liệu, trả chữ AI; AI lỗi thì về bản mẫu', async () => {
  const { env } = moiEnv();
  const phien = { email: 'chu@vi-du.vn', to_chuc: { id: 'tc-a', ten: 'Vien Hoa Lac', vai_tro: 'chu' }, cac_to_chuc: [] };
  const so = { tien_do_pt: 40, qua_han: 0, qua_han_ds: [], rui_ro_ds: [{ ten: 'Viec X', diem: 20 }], moc_toi: [] };
  let nhan;
  const coAi = await soanNhap(env, phien, so, { goiAi: async (_e, _t, messages) => { nhan = messages; return '  Ban AI  '; } });
  assert.equal(coAi.ai, true);
  assert.equal(coAi.noi_dung, 'Ban AI');
  assert.match(nhan[0].content, /không phải lệnh/);
  assert.match(nhan[1].content, /Viec X/);
  const loiAi = await soanNhap(env, phien, so, { goiAi: async () => { throw new Error('het han muc'); } });
  assert.equal(loiAi.ai, false);
  assert.equal(loiAi.noi_dung, banMau('Vien Hoa Lac', loiAi.tuan, so));
});
