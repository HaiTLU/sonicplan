// Khu "Dự án" nhiều dự án: mỗi dự án là một tổ chức phạm vi 'hoalac'. Kiểm dữ liệu hai dự án tách nhau,
// danh mục chỉ hiện dự án mình là thành viên, vai trò 'xem' chỉ đọc, chủ tạo được dự án mới,
// và sản phẩm bàn giao gắn theo dự án. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sonicplan from '../src/index.js';
import { d1, dungCsdl } from './csdl-thu.js';

function moiEnv() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, loai_du_an, tao_luc) VALUES
    ('tc-a', 'Vien Hoa Lac', 'hoalac', 'xay_dung', '2026-01-01'),
    ('tc-b', 'Nghien cuu thi truong', 'hoalac', 'nghien_cuu', '2026-01-01'),
    ('tc-chung', 'Chung', 'chung', 'xay_dung', '2026-01-01')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES
    ('nd-chu', 'chu@vi-du.vn', '2026-01-01'), ('nd-a', 'chi-a@vi-du.vn', '2026-01-01'),
    ('nd-xem', 'bgh@vi-du.vn', '2026-01-01'), ('nd-tv', 'tv@vi-du.vn', '2026-01-01')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-chung', 'nd-chu', 'chu', '2026-01-01'),
    ('tc-a', 'nd-chu', 'chu', '2026-01-02'), ('tc-b', 'nd-chu', 'chu', '2026-01-03'),
    ('tc-a', 'nd-a', 'thanh_vien', '2026-01-02'),
    ('tc-a', 'nd-xem', 'xem', '2026-01-02'), ('tc-b', 'nd-xem', 'xem', '2026-01-03'),
    ('tc-a', 'nd-tv', 'thanh_vien', '2026-01-02')`);
  db.exec(`INSERT INTO qlda_hang_muc (to_chuc_id, ten, la_moc, thoi_gian_ngay, ngay_ket_thuc, tien_do_pt, trang_thai, tao_luc, cap_nhat_luc) VALUES
    ('tc-a', 'Moc A1', 1, 1, '2099-01-10', 0, 'chua_lam', 'x', 'x'),
    ('tc-a', 'Viec A qua han', 0, 3, '2020-01-01', 50, 'dang_lam', 'x', 'x'),
    ('tc-b', 'Moc B1', 1, 1, '2099-02-01', 0, 'chua_lam', 'x', 'x')`);
  db.exec(`INSERT INTO qlda_rui_ro (to_chuc_id, ten, xac_suat, tac_dong, tao_boi, tao_luc, cap_nhat_luc) VALUES
    ('tc-b', 'Rui ro B cao', 4, 5, 'x', 'x', 'x')`);
  const ASSETS = { fetch: async (r) => new Response(new URL(r.url).pathname, { status: 200 }) };
  return { db, env: { CSDL: d1(db), ASSETS } };
}

// Mỗi lần gọi dùng một email "mới" theo bộ nhớ đệm 30 giây của phien.js? Không: bộ đệm theo email,
// nên các ca đổi quyền dùng email riêng. Ở đây chỉ đọc nên dùng chung được.
async function goi(env, email, duong, { method = 'GET', toChuc, than } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (toChuc) headers['x-to-chuc'] = toChuc;
  const yc = new Request(`https://localhost${duong}`, { method, headers, body: than !== undefined ? JSON.stringify(than) : undefined });
  const ra = await sonicplan.fetch(yc, { ...env, EMAIL_THU: email }, { waitUntil: () => {} });
  const chu = await ra.text();
  let du; try { du = JSON.parse(chu); } catch { du = chu; }
  return { status: ra.status, du };
}

test('hai dự án không thấy hạng mục của nhau, chọn dự án bằng x-to-chuc', async () => {
  const { env } = moiEnv();
  const a = await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { toChuc: 'tc-a' });
  const b = await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { toChuc: 'tc-b' });
  assert.equal(a.status, 200);
  const tenA = a.du.hang_muc.map((h) => h.ten).sort();
  const tenB = b.du.hang_muc.map((h) => h.ten).sort();
  assert.deepEqual(tenA, ['Moc A1', 'Viec A qua han']);
  assert.deepEqual(tenB, ['Moc B1']);
});

test('x-to-chuc trỏ tới dự án mình không thuộc thì bị từ chối, không rơi âm thầm về dự án khác', async () => {
  const { env, db } = moiEnv();
  const doc = await goi(env, 'chi-a@vi-du.vn', '/api/hoalac/hang-muc', { toChuc: 'tc-b' });
  assert.equal(doc.status, 403);
  assert.ok(!JSON.stringify(doc.du).includes('Moc B1'));
  const truoc = db.prepare('SELECT COUNT(*) AS so FROM qlda_hang_muc').get().so;
  const ghi = await goi(env, 'chi-a@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', toChuc: 'tc-b', than: { ten: 'Ghi nham' } });
  assert.equal(ghi.status, 403);
  assert.equal(db.prepare('SELECT COUNT(*) AS so FROM qlda_hang_muc').get().so, truoc);
});

test('danh mục chỉ có dự án mình là thành viên, tính từ máy chủ', async () => {
  const { env } = moiEnv();
  const chiA = await goi(env, 'chi-a@vi-du.vn', '/api/hoalac/danh-muc');
  assert.equal(chiA.status, 200);
  assert.deepEqual(chiA.du.du_an.map((d) => d.id), ['tc-a']);
  const chu = await goi(env, 'chu@vi-du.vn', '/api/hoalac/danh-muc');
  assert.deepEqual(chu.du.du_an.map((d) => d.id).sort(), ['tc-a', 'tc-b']);
});

test('thẻ dự án có số quá hạn, rủi ro cao, mốc tới và màu', async () => {
  const { env } = moiEnv();
  const { du } = await goi(env, 'bgh@vi-du.vn', '/api/hoalac/danh-muc');
  const a = du.du_an.find((d) => d.id === 'tc-a');
  const b = du.du_an.find((d) => d.id === 'tc-b');
  assert.equal(a.qua_han, 1);
  assert.equal(a.rui_ro_cao, 0);
  assert.equal(a.mau, 'vang');
  assert.deepEqual(a.moc_toi.map((x) => x.ten), ['Moc A1']);
  assert.equal(a.tien_do_pt, 38); // (0 x 1 + 50 x 3) / 4 = 37,5, làm tròn 38
  assert.equal(b.rui_ro_cao, 1);
  assert.equal(b.loai_du_an, 'nghien_cuu');
  assert.equal(b.vai_tro, 'xem');
});

test('vai trò xem đọc được nhưng mọi POST, PUT, DELETE đều 403', async () => {
  const { env } = moiEnv();
  assert.equal((await goi(env, 'bgh@vi-du.vn', '/api/hoalac/rui-ro', { toChuc: 'tc-b' })).status, 200);
  const cacLenh = [
    ['POST', '/api/hoalac/giai-doan', { ten: 'x' }],
    ['PUT', '/api/hoalac/hang-muc/1', { tien_do_pt: 90 }],
    ['DELETE', '/api/hoalac/hang-muc/1'],
    ['POST', '/api/hoalac/rui-ro', { ten: 'x' }],
    ['POST', '/api/hoalac/ban-giao', { ten: 'x' }],
    ['POST', '/api/hoalac/danh-muc', { ten: 'x' }],
  ];
  for (const [method, duong, than] of cacLenh) {
    const r = await goi(env, 'bgh@vi-du.vn', duong, { method, toChuc: 'tc-a', than });
    assert.equal(r.status, 403, `${method} ${duong}`);
  }
});

test('chủ tạo được dự án mới, thành viên thường thì không', async () => {
  const { env, db } = moiEnv();
  const tv = await goi(env, 'tv@vi-du.vn', '/api/hoalac/danh-muc', { method: 'POST', than: { ten: 'Du an moi' } });
  assert.equal(tv.status, 403);
  const thieu = await goi(env, 'chu@vi-du.vn', '/api/hoalac/danh-muc', { method: 'POST', toChuc: 'tc-a', than: { ten: '' } });
  assert.equal(thieu.status, 400);
  const sai = await goi(env, 'chu@vi-du.vn', '/api/hoalac/danh-muc', { method: 'POST', toChuc: 'tc-a', than: { ten: 'X', loai_du_an: 'khac' } });
  assert.equal(sai.status, 400);
  const r = await goi(env, 'chu@vi-du.vn', '/api/hoalac/danh-muc', { method: 'POST', toChuc: 'tc-a', than: { ten: 'Du an moi', loai_du_an: 'nghien_cuu' } });
  assert.equal(r.status, 201);
  const tc = db.prepare('SELECT * FROM to_chuc WHERE id = ?').get(r.du.id);
  assert.equal(tc.pham_vi_truy_cap, 'hoalac');
  assert.equal(tc.loai_du_an, 'nghien_cuu');
  const tv2 = db.prepare('SELECT vai_tro FROM thanh_vien WHERE to_chuc_id = ? AND nguoi_dung_id = ?').get(r.du.id, 'nd-chu');
  assert.equal(tv2.vai_tro, 'chu');
  // Danh mục thấy ngay dự án mới, không đợi bộ đệm 30 giây.
  const ds = await goi(env, 'chu@vi-du.vn', '/api/hoalac/danh-muc');
  assert.ok(ds.du.du_an.some((d) => d.id === r.du.id));
});

test('sản phẩm bàn giao gắn theo dự án, dự án khác không sửa hay xem được', async () => {
  const { env } = moiEnv();
  const tao = await goi(env, 'chu@vi-du.vn', '/api/hoalac/ban-giao', { method: 'POST', toChuc: 'tc-b', than: { ten: 'Bao cao thiet ke nghien cuu', han: '2026-11-30' } });
  assert.equal(tao.status, 201);
  const dsB = await goi(env, 'chu@vi-du.vn', '/api/hoalac/ban-giao', { toChuc: 'tc-b' });
  assert.equal(dsB.du.ban_giao.length, 1);
  const dsA = await goi(env, 'chu@vi-du.vn', '/api/hoalac/ban-giao', { toChuc: 'tc-a' });
  assert.equal(dsA.du.ban_giao.length, 0);
  const suaTuA = await goi(env, 'chu@vi-du.vn', `/api/hoalac/ban-giao/${tao.du.id}`, { method: 'PUT', toChuc: 'tc-a', than: { trang_thai: 'da_duyet' } });
  assert.equal(suaTuA.status, 404);
  const saiTrangThai = await goi(env, 'chu@vi-du.vn', `/api/hoalac/ban-giao/${tao.du.id}`, { method: 'PUT', toChuc: 'tc-b', than: { trang_thai: 'la' } });
  assert.equal(saiTrangThai.status, 400);
  const sua = await goi(env, 'chu@vi-du.vn', `/api/hoalac/ban-giao/${tao.du.id}`, { method: 'PUT', toChuc: 'tc-b', than: { trang_thai: 'da_giao', ngay_giao: '2026-11-29' } });
  assert.equal(sua.status, 200);
  const xoaTuA = await goi(env, 'chu@vi-du.vn', `/api/hoalac/ban-giao/${tao.du.id}`, { method: 'DELETE', toChuc: 'tc-a' });
  assert.equal(xoaTuA.status, 404);
  const tenRong = await goi(env, 'chu@vi-du.vn', `/api/hoalac/ban-giao/${tao.du.id}`, { method: 'PUT', toChuc: 'tc-b', than: { ten: '' } });
  assert.equal(tenRong.status, 400);
});

test('không xóa được bên liên quan đang là bên giao của sản phẩm bàn giao (409, không lỗi khóa ngoại)', async () => {
  const { env, db } = moiEnv();
  db.exec("INSERT INTO qlda_ben_lien_quan (id, to_chuc_id, ten, tao_boi, tao_luc, cap_nhat_luc) VALUES (9, 'tc-b', 'Ipsos', 'x', 'x', 'x')");
  const tao = await goi(env, 'chu@vi-du.vn', '/api/hoalac/ban-giao', { method: 'POST', toChuc: 'tc-b', than: { ten: 'Bao cao', ben_giao_id: 9 } });
  assert.equal(tao.status, 201);
  const xoa = await goi(env, 'chu@vi-du.vn', '/api/hoalac/ben-lien-quan/9', { method: 'DELETE', toChuc: 'tc-b' });
  assert.equal(xoa.status, 409);
  assert.ok(db.prepare('SELECT 1 FROM qlda_ben_lien_quan WHERE id = 9').get());
});

test('thân JSON không phải object (null, số) thì trả lỗi 4xx, không ném 500', async () => {
  const { env } = moiEnv();
  const taoNull = await goi(env, 'chu@vi-du.vn', '/api/hoalac/danh-muc', { method: 'POST', toChuc: 'tc-a', than: null });
  assert.equal(taoNull.status, 400);
  const tao = await goi(env, 'chu@vi-du.vn', '/api/hoalac/hop-dong', { method: 'POST', toChuc: 'tc-a', than: { ten: 'HD2' } });
  const suaSo = await goi(env, 'chu@vi-du.vn', `/api/hoalac/hop-dong/${tao.du.id}`, { method: 'PUT', toChuc: 'tc-a', than: 5 });
  assert.ok(suaSo.status < 500, `nhận ${suaSo.status}`);
});

test('đối tác không dùng được mục bàn giao, thẻ danh mục của đối tác không có số liệu', async () => {
  const { env, db } = moiEnv();
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-dt', 'dt@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-a', 'nd-dt', 'doi_tac', '2026-01-02')");
  assert.equal((await goi(env, 'dt@vi-du.vn', '/api/hoalac/ban-giao')).status, 403);
  const { du } = await goi(env, 'dt@vi-du.vn', '/api/hoalac/danh-muc');
  assert.equal(du.du_an.length, 1);
  assert.equal(du.du_an[0].qua_han, undefined);
});

test('PUT hợp đồng: gửi null thì xóa được bên liên quan và giá trị, không gửi thì giữ nguyên', async () => {
  const { env, db } = moiEnv();
  db.exec("INSERT INTO qlda_ben_lien_quan (id, to_chuc_id, ten, tao_boi, tao_luc, cap_nhat_luc) VALUES (7, 'tc-a', 'Tu van', 'x', 'x', 'x')");
  const tao = await goi(env, 'chu@vi-du.vn', '/api/hoalac/hop-dong', { method: 'POST', toChuc: 'tc-a', than: { ten: 'HD1', ben_lien_quan_id: 7, gia_tri: 100, ngay_ky: '2026-11-01' } });
  assert.equal(tao.status, 201);
  const sua = await goi(env, 'chu@vi-du.vn', `/api/hoalac/hop-dong/${tao.du.id}`, { method: 'PUT', toChuc: 'tc-a', than: { ben_lien_quan_id: null, gia_tri: null } });
  assert.equal(sua.status, 200);
  const r = db.prepare('SELECT * FROM qlda_hop_dong WHERE id = ?').get(tao.du.id);
  assert.equal(r.ben_lien_quan_id, null);
  assert.equal(r.gia_tri, null);
  assert.equal(r.ngay_ky, '2026-11-01');
  assert.equal(r.ten, 'HD1');
});
