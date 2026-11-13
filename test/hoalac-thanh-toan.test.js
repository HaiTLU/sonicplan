// Đợt thanh toán gắn hợp đồng: đủ điều kiện, cảnh báo, đã trả tạo dòng giải ngân, quyền, tách dự án, tin nhắc không có tiền.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sonicplan from '../src/index.js';
import { d1, dungCsdl } from './csdl-thu.js';
import { canhBaoThanhToan } from '../src/hoalac/thanh-toan.js';
import { soanNhacDuAn } from '../src/hoalac/nhac.js';
import { BANG_CUA_TO_CHUC } from '../src/xoa-to-chuc.js';

const HOM_NAY = '2026-11-13';

function moiEnv() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-a', 'Du an A', 'hoalac', 'x'), ('tc-b', 'Du an B', 'hoalac', 'x')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-chu', 'chu@vi-du.vn', 'x'), ('nd-dt', 'dt@vi-du.vn', 'x'), ('nd-xem', 'xem@vi-du.vn', 'x'), ('nd-b', 'b@vi-du.vn', 'x')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-a', 'nd-chu', 'chu', 'x'), ('tc-a', 'nd-dt', 'doi_tac', 'x'), ('tc-a', 'nd-xem', 'xem', 'x'), ('tc-b', 'nd-b', 'chu', 'x')`);
  db.exec(`INSERT INTO qlda_hop_dong (id, to_chuc_id, ten, gia_tri, tao_boi, tao_luc, cap_nhat_luc) VALUES
    (1, 'tc-a', 'Tu van thiet ke', 1000, 'x', 'x', 'x'), (2, 'tc-b', 'Hop dong B', NULL, 'x', 'x', 'x')`);
  db.exec(`INSERT INTO qlda_hang_muc (id, to_chuc_id, ten, la_moc, thoi_gian_ngay, tien_do_pt, trang_thai, phu_trach, tao_luc, cap_nhat_luc) VALUES
    (10, 'tc-a', 'Thiet ke co so', 0, 1, 100, 'xong', '', 'x', 'x'), (11, 'tc-a', 'Thiet ke ky thuat', 0, 1, 0, 'dang_lam', '', 'x', 'x')`);
  db.exec(`INSERT INTO qlda_san_pham_ban_giao (id, to_chuc_id, ten, trang_thai, tao_boi, tao_luc, cap_nhat_luc) VALUES
    (20, 'tc-a', 'Bao cao dau ky', 'da_giao', 'x', 'x', 'x'), (21, 'tc-a', 'Bao cao cuoi ky', 'yeu_cau_sua', 'x', 'x', 'x')`);
  const ASSETS = { fetch: async () => new Response('trang', { status: 200 }) };
  return { db, env: { CSDL: d1(db), ASSETS, QUAN_TRI: 'quan-tri@vi-du.vn' } };
}

const goi = (env, email, duongDan, tuyChon = {}) => sonicplan.fetch(
  new Request(`https://localhost${duongDan}`, { ...tuyChon, headers: { ...(tuyChon.headers || {}), 'content-type': 'application/json' } }),
  { ...env, EMAIL_THU: email },
  { waitUntil: () => {} },
);
const CHU = 'chu@vi-du.vn';
const taoDot = async (env, than) => {
  const r = await goi(env, CHU, '/api/hoalac/dot-thanh-toan', { method: 'POST', body: JSON.stringify({ hop_dong_id: 1, ...than }) });
  assert.equal(r.status, 201, await r.clone().text());
  return (await r.json()).id;
};
const dsDot = async (env) => (await (await goi(env, CHU, '/api/hoalac/dot-thanh-toan')).json());

test('đủ điều kiện tính theo hạng mục xong hoặc bàn giao đã giao; đã đề nghị thì không còn báo', async () => {
  const { env } = moiEnv();
  await taoDot(env, { ten: 'Dot 1', hang_muc_id: 10 });
  await taoDot(env, { ten: 'Dot 2', hang_muc_id: 11 });
  await taoDot(env, { ten: 'Dot 3', ban_giao_id: 20 });
  await taoDot(env, { ten: 'Dot 4', ban_giao_id: 21 });
  await taoDot(env, { ten: 'Dot 5', hang_muc_id: 10, trang_thai: 'da_de_nghi' });
  const { dot_thanh_toan: ds } = await dsDot(env);
  assert.deepEqual(ds.map((d) => [d.ten, d.du_dieu_kien]), [['Dot 1', 1], ['Dot 2', 0], ['Dot 3', 1], ['Dot 4', 0], ['Dot 5', 0]]);
});

test('cảnh báo quá hạn, sắp đến hạn 7 ngày; đã trả, hủy, còn xa, hợp đồng hủy thì không', async () => {
  const { env, db } = moiEnv();
  await taoDot(env, { ten: 'Qua han', han: '2026-11-10', so_tien: 300 });
  await taoDot(env, { ten: 'Sap den', han: '2026-11-20', so_tien: 300, trang_thai: 'da_de_nghi' });
  await taoDot(env, { ten: 'Con xa', han: '2026-12-30', so_tien: 300 });
  await taoDot(env, { ten: 'Da huy', han: '2026-11-10', trang_thai: 'huy' });
  const ca = await canhBaoThanhToan(env, 'tc-a', HOM_NAY);
  assert.deepEqual(ca.filter((c) => c.loai !== 'lech_gia_tri').map((c) => [c.loai, c.ten]), [['qua_han', 'Qua han'], ['sap_den_han', 'Sap den']]);
  db.exec("UPDATE qlda_hop_dong SET trang_thai = 'da_huy' WHERE id = 1");
  assert.deepEqual(await canhBaoThanhToan(env, 'tc-a', HOM_NAY), []);
});

test('lệch giá trị: đủ số mà tổng khác, hoặc tổng đã vượt dù thiếu số; khớp thì không báo', async () => {
  const { env } = moiEnv();
  const a = await taoDot(env, { ten: 'A', so_tien: 400 });
  await taoDot(env, { ten: 'B', so_tien: 600 });
  assert.equal((await canhBaoThanhToan(env, 'tc-a', HOM_NAY)).filter((c) => c.loai === 'lech_gia_tri').length, 0);
  await goi(env, CHU, `/api/hoalac/dot-thanh-toan/${a}`, { method: 'PUT', body: JSON.stringify({ so_tien: 300 }) });
  let lech = (await canhBaoThanhToan(env, 'tc-a', HOM_NAY)).filter((c) => c.loai === 'lech_gia_tri');
  assert.equal(lech.length, 1);
  assert.equal(lech[0].tong_dot, 900);
  await goi(env, CHU, `/api/hoalac/dot-thanh-toan/${a}`, { method: 'PUT', body: JSON.stringify({ so_tien: null }) });
  assert.equal((await canhBaoThanhToan(env, 'tc-a', HOM_NAY)).filter((c) => c.loai === 'lech_gia_tri').length, 0, 'thiếu số mà chưa vượt thì không báo');
  await goi(env, CHU, `/api/hoalac/dot-thanh-toan/${a}`, { method: 'PUT', body: JSON.stringify({ so_tien: null }) });
  await taoDot(env, { ten: 'C', so_tien: 500 });
  lech = (await canhBaoThanhToan(env, 'tc-a', HOM_NAY)).filter((c) => c.loai === 'lech_gia_tri');
  assert.equal(lech.length, 1);
  assert.equal(lech[0].du_so, false);
});

test('đã trả tạo đúng một dòng giải ngân, bấm lại 409; bỏ trả gỡ dòng đó; không xóa được dòng giải ngân đang gắn', async () => {
  const { env, db } = moiEnv();
  const id = await taoDot(env, { ten: 'Tam ung', so_tien: 300 });
  const tra = (than) => goi(env, CHU, `/api/hoalac/dot-thanh-toan/${id}/tra`, { method: 'POST', body: JSON.stringify(than) });
  assert.equal((await tra({ so_tien: 300 })).status, 400, 'thiếu ngày');
  assert.equal((await tra({ so_tien: 300, ngay: '2026-11-13' })).status, 200);
  assert.equal((await tra({ so_tien: 300, ngay: '2026-11-13' })).status, 409);
  const gn = db.prepare('SELECT * FROM qlda_giai_ngan').all();
  assert.equal(gn.length, 1);
  assert.equal(gn[0].so_tien, 300);
  assert.match(gn[0].noi_dung, /Tam ung - HĐ Tu van thiet ke/);
  const dot = db.prepare('SELECT * FROM qlda_dot_thanh_toan WHERE id = ?').get(id);
  assert.equal(dot.trang_thai, 'da_tra');
  assert.equal(dot.giai_ngan_id, gn[0].id);
  assert.equal((await goi(env, CHU, `/api/hoalac/giai-ngan/${gn[0].id}`, { method: 'DELETE' })).status, 409);
  const dsGn = (await (await goi(env, CHU, '/api/hoalac/giai-ngan')).json()).giai_ngan;
  assert.equal(dsGn[0].dot_id, id, 'danh sách giải ngân trả dot_id để giao diện ẩn nút Xóa');
  assert.equal((await goi(env, CHU, `/api/hoalac/dot-thanh-toan/${id}`, { method: 'PUT', body: JSON.stringify({ ten: 'X' }) })).status, 409, 'đã trả thì không sửa');
  assert.equal((await goi(env, CHU, `/api/hoalac/dot-thanh-toan/${id}/bo-tra`, { method: 'POST' })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM qlda_giai_ngan').get().n, 0);
  const sau = db.prepare('SELECT * FROM qlda_dot_thanh_toan WHERE id = ?').get(id);
  assert.equal(sau.trang_thai, 'da_de_nghi');
  assert.equal(sau.giai_ngan_id, null);
});

test('PUT không đặt được da_tra; gắn cả hạng mục lẫn bàn giao thì 400; hạng mục dự án khác thì 400', async () => {
  const { env, db } = moiEnv();
  const id = await taoDot(env, { ten: 'D', hang_muc_id: 10 });
  const put = (than) => goi(env, CHU, `/api/hoalac/dot-thanh-toan/${id}`, { method: 'PUT', body: JSON.stringify(than) });
  assert.equal((await put({ trang_thai: 'da_tra' })).status, 400);
  assert.equal((await put({ ban_giao_id: 20 })).status, 400);
  assert.equal((await put({ hang_muc_id: null, ban_giao_id: 20 })).status, 200);
  db.exec(`INSERT INTO qlda_hang_muc (id, to_chuc_id, ten, la_moc, thoi_gian_ngay, tien_do_pt, trang_thai, phu_trach, tao_luc, cap_nhat_luc) VALUES (99, 'tc-b', 'HM B', 0, 1, 0, 'xong', '', 'x', 'x')`);
  assert.equal((await put({ ban_giao_id: null, hang_muc_id: 99 })).status, 400);
  assert.equal((await put({ han: '2026-02-30' })).status, 400);
  assert.equal((await put({ dieu_kien: { a: 1 } })).status, 200, 'object không làm lỗi 500');
});

test('đối tác 403, vai trò xem đọc được nhưng không ghi được', async () => {
  const { env } = moiEnv();
  assert.equal((await goi(env, 'dt@vi-du.vn', '/api/hoalac/dot-thanh-toan')).status, 403);
  assert.equal((await goi(env, 'xem@vi-du.vn', '/api/hoalac/dot-thanh-toan')).status, 200);
  const r = await goi(env, 'xem@vi-du.vn', '/api/hoalac/dot-thanh-toan', { method: 'POST', body: JSON.stringify({ hop_dong_id: 1, ten: 'X' }) });
  assert.equal(r.status, 403);
});

test('hai dự án tách nhau: dự án B không thấy, không sửa, không gắn được hợp đồng của A', async () => {
  const { env } = moiEnv();
  const id = await taoDot(env, { ten: 'Cua A' });
  const B = 'b@vi-du.vn';
  assert.deepEqual((await (await goi(env, B, '/api/hoalac/dot-thanh-toan')).json()).dot_thanh_toan, []);
  assert.equal((await goi(env, B, `/api/hoalac/dot-thanh-toan/${id}`, { method: 'PUT', body: JSON.stringify({ ten: 'X' }) })).status, 404);
  assert.equal((await goi(env, B, `/api/hoalac/dot-thanh-toan/${id}/tra`, { method: 'POST', body: JSON.stringify({ so_tien: 1, ngay: '2026-11-13' }) })).status, 404);
  const r = await goi(env, B, '/api/hoalac/dot-thanh-toan', { method: 'POST', body: JSON.stringify({ hop_dong_id: 1, ten: 'X' }) });
  assert.equal(r.status, 400);
});

test('xóa hợp đồng còn đợt thì 409; xóa hạng mục gắn đợt thì đợt mất liên kết (khóa ngoại thật)', async () => {
  const { env, db } = moiEnv();
  db.exec('PRAGMA foreign_keys = ON');
  const id = await taoDot(env, { ten: 'D', hang_muc_id: 11 });
  assert.equal((await goi(env, CHU, '/api/hoalac/hop-dong/1', { method: 'DELETE' })).status, 409);
  assert.equal((await goi(env, CHU, '/api/hoalac/hang-muc/11', { method: 'DELETE' })).status, 200);
  assert.equal(db.prepare('SELECT hang_muc_id FROM qlda_dot_thanh_toan WHERE id = ?').get(id).hang_muc_id, null);
});

test('tin nhắc có mục đợt thanh toán, không có số tiền, không báo lệch giá trị', async () => {
  const { env } = moiEnv();
  await taoDot(env, { ten: 'Dot 1 - 300 trieu', han: '2026-11-10', so_tien: 300 });
  await taoDot(env, { ten: 'Dot 2', hang_muc_id: 10, so_tien: 900 });
  const tin = await soanNhacDuAn(env, 'tc-a', HOM_NAY);
  assert.match(tin, /Đợt thanh toán \(2\):/);
  assert.match(tin, /- Dot 1 - \[số tiền\] - HĐ Tu van thiet ke \(đã quá hạn, hạn 10\/11\)/);
  assert.match(tin, /- Dot 2 - HĐ Tu van thiet ke \(đủ điều kiện, chưa đề nghị\)/);
  assert.ok(!/300|900|1000/.test(tin), tin);
});

test('xóa tổ chức: thứ tự bảng xóa đợt trước hợp đồng và giải ngân, chạy được khi bật khóa ngoại', async () => {
  const { env, db } = moiEnv();
  const id = await taoDot(env, { ten: 'D' });
  await goi(env, CHU, `/api/hoalac/dot-thanh-toan/${id}/tra`, { method: 'POST', body: JSON.stringify({ so_tien: 5, ngay: '2026-11-13' }) });
  const viTri = (b) => BANG_CUA_TO_CHUC.indexOf(b);
  assert.ok(viTri('qlda_dot_thanh_toan') >= 0);
  for (const b of ['qlda_hop_dong', 'qlda_giai_ngan', 'qlda_hang_muc', 'qlda_san_pham_ban_giao']) {
    if (viTri(b) >= 0) assert.ok(viTri('qlda_dot_thanh_toan') < viTri(b), b);
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('BEGIN');
  for (const b of BANG_CUA_TO_CHUC) db.prepare(`DELETE FROM ${b} WHERE to_chuc_id = ?`).run('tc-a');
  db.exec('COMMIT');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM qlda_dot_thanh_toan WHERE to_chuc_id = 'tc-a'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM qlda_giai_ngan WHERE to_chuc_id = 'tc-a'").get().n, 0);
});
