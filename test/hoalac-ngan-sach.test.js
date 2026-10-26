// Phân hệ Viện Hòa Lạc, PR5: ngân sách (dòng ngân sách, giải ngân) và EVM.
// Không có cơ chế gán theo dòng cho đối tác, nên api.js chặn hẳn cả 3 mục cho đối tác (403), như RAID.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sonicplan from '../src/index.js';
import { d1, dungCsdl, r2 } from './csdl-thu.js';
import { xoaToChuc } from '../src/xoa-to-chuc.js';

function moiEnv() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-hl', 'Vien Hoa Lac', 'hoalac', '2026-01-01')");
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-chu', 'chu@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-doi-tac', 'doi-tac@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-hl', 'nd-chu', 'chu', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-hl', 'nd-doi-tac', 'doi_tac', '2026-01-01')");
  const ASSETS = { fetch: async () => new Response('trang', { status: 200 }) };
  return { env: { CSDL: d1(db), ASSETS, QUAN_TRI: 'quan-tri@vi-du.vn' }, db };
}

const goi = (env, email, duongDan, tuyChon = {}) => sonicplan.fetch(
  new Request(`https://localhost${duongDan}`, { ...tuyChon, headers: { ...(tuyChon.headers || {}), 'content-type': 'application/json' } }),
  { ...env, EMAIL_THU: email },
  { waitUntil: () => {} },
);

const CHU = 'chu@vi-du.vn';
const DOI_TAC = 'doi-tac@vi-du.vn';

// ---------- Dòng ngân sách ----------

test('chủ tạo dòng ngân sách không có số (chưa thống nhất), sửa, xóa', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'Xây dựng', nhom: 'Công trình', nguon: '261026_v14.2' }) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const ds0 = await (await goi(env, CHU, '/api/hoalac/ngan-sach')).json();
  assert.equal(ds0.ngan_sach[0].ngan_sach_du_kien, null);
  assert.equal(ds0.ngan_sach[0].trang_thai_so_lieu, 'chua_thong_nhat');
  assert.equal((await goi(env, CHU, `/api/hoalac/ngan-sach/${id}`, { method: 'PUT', body: JSON.stringify({ ghi_chu: 'Theo bản rà soát 24/9' }) })).status, 200);
  const ds = await (await goi(env, CHU, '/api/hoalac/ngan-sach')).json();
  assert.equal(ds.ngan_sach[0].ghi_chu, 'Theo bản rà soát 24/9');
  assert.equal((await goi(env, CHU, `/api/hoalac/ngan-sach/${id}`, { method: 'DELETE' })).status, 200);
});

test('PUT số rồi PUT null phải xóa được số về chưa thống nhất (không phải giữ nguyên qua COALESCE)', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  await goi(env, CHU, `/api/hoalac/ngan-sach/${id}`, { method: 'PUT', body: JSON.stringify({ ngan_sach_du_kien: 1700000000000, trang_thai_so_lieu: 'da_xac_nhan' }) });
  let ds = await (await goi(env, CHU, '/api/hoalac/ngan-sach')).json();
  assert.equal(ds.ngan_sach[0].ngan_sach_du_kien, 1700000000000);
  await goi(env, CHU, `/api/hoalac/ngan-sach/${id}`, { method: 'PUT', body: JSON.stringify({ ngan_sach_du_kien: null }) });
  ds = await (await goi(env, CHU, '/api/hoalac/ngan-sach')).json();
  assert.equal(ds.ngan_sach[0].ngan_sach_du_kien, null, 'gửi null tường minh phải xóa được số, không được giữ số cũ');
});

test('không gửi ngan_sach_du_kien khi PUT thì giữ nguyên số cũ (phân biệt với gửi null)', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A', ngan_sach_du_kien: 500 }) })).json();
  await goi(env, CHU, `/api/hoalac/ngan-sach/${id}`, { method: 'PUT', body: JSON.stringify({ ghi_chu: 'chỉ sửa ghi chú' }) });
  const ds = await (await goi(env, CHU, '/api/hoalac/ngan-sach')).json();
  assert.equal(ds.ngan_sach[0].ngan_sach_du_kien, 500);
});

test('trang_thai_so_lieu ngoài 2 giá trị cho phép thì 400', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A', trang_thai_so_lieu: 'linh_tinh' }) });
  assert.equal(r.status, 400);
});

test('xóa dòng ngân sách đang có giải ngân thì 409', async () => {
  const { env } = moiEnv();
  const { id: dongId } = await (await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongId, so_tien: 1000 }) });
  const bi409 = await goi(env, CHU, `/api/hoalac/ngan-sach/${dongId}`, { method: 'DELETE' });
  assert.equal(bi409.status, 409);
});

// ---------- Giải ngân ----------

test('chủ tạo, xóa giải ngân; thiếu hoặc sai so_tien thì 400', async () => {
  const { env } = moiEnv();
  const { id: dongId } = await (await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongId, so_tien: 123.45, ngay: '2026-10-01' }) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const ds = await (await goi(env, CHU, '/api/hoalac/giai-ngan')).json();
  assert.equal(ds.giai_ngan[0].so_tien, 123.45);
  assert.equal((await goi(env, CHU, `/api/hoalac/giai-ngan/${id}`, { method: 'DELETE' })).status, 200);

  const thieu = await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongId }) });
  assert.equal(thieu.status, 400);
  const saiKieu = await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongId, so_tien: 'nhieu' }) });
  assert.equal(saiKieu.status, 400);
});

test('giải ngân với ngan_sach_dong_id của tổ chức khác thì 400', async () => {
  const { env, db } = moiEnv();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-khac', 'To chuc khac', 'hoalac', '2026-01-01')");
  db.exec("INSERT INTO qlda_ngan_sach_dong (to_chuc_id, ten, tao_boi, tao_luc, cap_nhat_luc) VALUES ('tc-khac', 'Dong la', 'x', '2026-01-01', '2026-01-01')");
  const { id: dongKhacId } = db.prepare("SELECT id FROM qlda_ngan_sach_dong WHERE to_chuc_id = 'tc-khac'").get();
  const r = await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongKhacId, so_tien: 100 }) });
  assert.equal(r.status, 400);
});

// ---------- EVM ----------

test('chủ tạo kỳ EVM, GET trả thêm cv/sv/cpi/spi tính từ pv/ac/ev', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-10', pv: 100, ac: 80, ev: 90 }) });
  assert.equal(r.status, 201);
  const ds = await (await goi(env, CHU, '/api/hoalac/evm')).json();
  const x = ds.evm[0];
  assert.equal(x.cv, 10);
  assert.equal(x.sv, -10);
  assert.equal(x.cpi, 90 / 80);
  assert.equal(x.spi, 90 / 100);
});

test('EVM thiếu pv hoặc ac thì cpi/spi trả null, không phải Infinity hay NaN', async () => {
  const { env } = moiEnv();
  await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-11', ev: 50 }) });
  const ds = await (await goi(env, CHU, '/api/hoalac/evm')).json();
  const x = ds.evm[0];
  assert.equal(x.pv, null);
  assert.equal(x.cpi, null);
  assert.equal(x.spi, null);
  assert.equal(x.cv, null);
});

test('hai kỳ EVM trùng ky thì 409', async () => {
  const { env } = moiEnv();
  await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-10' }) });
  const r = await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-10', pv: 1 }) });
  assert.equal(r.status, 409);
});

test('PUT pv/ac/ev với null phải xóa được số, không gửi field thì giữ nguyên', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-10', pv: 10, ac: 10, ev: 10 }) })).json();
  await goi(env, CHU, `/api/hoalac/evm/${id}`, { method: 'PUT', body: JSON.stringify({ pv: null }) });
  let ds = await (await goi(env, CHU, '/api/hoalac/evm')).json();
  assert.equal(ds.evm[0].pv, null);
  assert.equal(ds.evm[0].ac, 10, 'ac không gửi trong PUT thì phải giữ nguyên');
  await goi(env, CHU, `/api/hoalac/evm/${id}`, { method: 'PUT', body: JSON.stringify({ ghi_chu: 'cập nhật' }) });
  ds = await (await goi(env, CHU, '/api/hoalac/evm')).json();
  assert.equal(ds.evm[0].ac, 10, 'PUT không đụng tới ac vẫn phải giữ nguyên');
});

// ---------- Đối tác: chặn hẳn cả 3 mục (403), như RAID ----------

test('đối tác bị chặn 403 trên dòng ngân sách, giải ngân, EVM', async () => {
  const { env } = moiEnv();
  const { id: dongId } = await (await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: giaiNganId } = await (await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongId, so_tien: 1 }) })).json();
  const { id: evmId } = await (await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-10' }) })).json();

  const canChan = [
    ['GET', '/api/hoalac/ngan-sach'], ['POST', '/api/hoalac/ngan-sach'], ['PUT', `/api/hoalac/ngan-sach/${dongId}`], ['DELETE', `/api/hoalac/ngan-sach/${dongId}`],
    ['GET', '/api/hoalac/giai-ngan'], ['POST', '/api/hoalac/giai-ngan'], ['DELETE', `/api/hoalac/giai-ngan/${giaiNganId}`],
    ['GET', '/api/hoalac/evm'], ['POST', '/api/hoalac/evm'], ['PUT', `/api/hoalac/evm/${evmId}`], ['DELETE', `/api/hoalac/evm/${evmId}`],
  ];
  for (const [method, duongDan] of canChan) {
    const r = await goi(env, DOI_TAC, duongDan, { method, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ ten: 'X', so_tien: 1, ky: '2026-01' }) });
    assert.equal(r.status, 403, `${method} ${duongDan} phải trả 403 cho đối tác`);
  }
});

// ---------- Xóa tổ chức: cascade 3 bảng ngân sách không vướng FK ----------

test('xóa tổ chức xóa sạch cả 3 bảng ngân sách, không lỗi khóa ngoại', async () => {
  const { env, db } = moiEnv();
  env.TEP = r2();
  const { id: dongId } = await (await goi(env, CHU, '/api/hoalac/ngan-sach', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  await goi(env, CHU, '/api/hoalac/giai-ngan', { method: 'POST', body: JSON.stringify({ ngan_sach_dong_id: dongId, so_tien: 1000 }) });
  await goi(env, CHU, '/api/hoalac/evm', { method: 'POST', body: JSON.stringify({ ky: '2026-10', pv: 1 }) });

  const toChuc = { id: 'tc-hl', ten: 'Vien Hoa Lac', vai_tro: 'chu' };
  const kq = await xoaToChuc(env, toChuc, CHU, 'Vien Hoa Lac');
  assert.equal(kq.ok, true);
  const khoaSaoLuu = [...env.TEP.kho.keys()].find((k) => k.startsWith('sao-luu/tc-hl/'));
  const banSao = JSON.parse(env.TEP.kho.get(khoaSaoLuu));
  assert.equal(banSao.qlda_ngan_sach_dong.length, 1);
  assert.equal(banSao.qlda_giai_ngan.length, 1);
  assert.equal(banSao.qlda_evm.length, 1);
  for (const bang of ['qlda_ngan_sach_dong', 'qlda_giai_ngan', 'qlda_evm']) {
    const con = db.prepare(`SELECT COUNT(*) AS n FROM ${bang} WHERE to_chuc_id = 'tc-hl'`).get().n;
    assert.equal(con, 0, `${bang} phải rỗng sau khi xóa tổ chức`);
  }
});
