// Phân hệ Viện Hòa Lạc, PR4: pháp lý, hợp đồng, các bên liên quan, RACI, văn bản, họp.
// Đối tác chỉ GET được đúng thủ tục được gán ở qlda_giao_doi_tac (loai='thu_tuc'), 404 nếu không;
// 5 mục còn lại (các bên, RACI, hợp đồng, văn bản, họp) chặn hẳn cho đối tác (403), như RAID.
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

// ---------- Các bên liên quan ----------

test('chủ tạo, sửa, xóa bên liên quan', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/ben-lien-quan', { method: 'POST', body: JSON.stringify({ ten: 'VNCC', loai: 'tu_van', don_vi: 'Viện Quy hoạch' }) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.equal((await goi(env, CHU, `/api/hoalac/ben-lien-quan/${id}`, { method: 'PUT', body: JSON.stringify({ vai_tro: 'Tư vấn thiết kế' }) })).status, 200);
  const ds = await (await goi(env, CHU, '/api/hoalac/ben-lien-quan')).json();
  assert.equal(ds.ben_lien_quan[0].vai_tro, 'Tư vấn thiết kế');
  assert.equal((await goi(env, CHU, `/api/hoalac/ben-lien-quan/${id}`, { method: 'DELETE' })).status, 200);
});

test('xóa bên liên quan đang gắn với hợp đồng thì 409', async () => {
  const { env } = moiEnv();
  const { id: benId } = await (await goi(env, CHU, '/api/hoalac/ben-lien-quan', { method: 'POST', body: JSON.stringify({ ten: 'VNCC' }) })).json();
  await goi(env, CHU, '/api/hoalac/hop-dong', { method: 'POST', body: JSON.stringify({ ten: 'HĐ tư vấn', ben_lien_quan_id: benId }) });
  const bi409 = await goi(env, CHU, `/api/hoalac/ben-lien-quan/${benId}`, { method: 'DELETE' });
  assert.equal(bi409.status, 409);
});

// ---------- RACI ----------

test('chủ gán RACI cho một bên liên quan, xóa được', async () => {
  const { env } = moiEnv();
  const { id: benId } = await (await goi(env, CHU, '/api/hoalac/ben-lien-quan', { method: 'POST', body: JSON.stringify({ ten: 'BQL Khu CNC' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/raci', { method: 'POST', body: JSON.stringify({ hoat_dong: 'Thẩm định quy hoạch', ben_lien_quan_id: benId, vai_tro: 'A' }) });
  assert.equal(r.status, 201);
  const ds = await (await goi(env, CHU, '/api/hoalac/raci')).json();
  assert.equal(ds.raci[0].vai_tro, 'A');
  const { id } = await r.json();
  assert.equal((await goi(env, CHU, `/api/hoalac/raci/${id}`, { method: 'DELETE' })).status, 200);
});

test('RACI với vai_tro ngoài R/A/C/I thì 400', async () => {
  const { env } = moiEnv();
  const { id: benId } = await (await goi(env, CHU, '/api/hoalac/ben-lien-quan', { method: 'POST', body: JSON.stringify({ ten: 'X' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/raci', { method: 'POST', body: JSON.stringify({ hoat_dong: 'A', ben_lien_quan_id: benId, vai_tro: 'Z' }) });
  assert.equal(r.status, 400);
});

test('RACI với ben_lien_quan_id của tổ chức khác thì 400', async () => {
  const { env, db } = moiEnv();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-khac', 'To chuc khac', 'hoalac', '2026-01-01')");
  db.exec("INSERT INTO qlda_ben_lien_quan (to_chuc_id, ten, tao_boi, tao_luc, cap_nhat_luc) VALUES ('tc-khac', 'Ben la', 'x', '2026-01-01', '2026-01-01')");
  const { id: benKhacId } = db.prepare("SELECT id FROM qlda_ben_lien_quan WHERE to_chuc_id = 'tc-khac'").get();
  const r = await goi(env, CHU, '/api/hoalac/raci', { method: 'POST', body: JSON.stringify({ hoat_dong: 'A', ben_lien_quan_id: benKhacId, vai_tro: 'R' }) });
  assert.equal(r.status, 400);
});

// ---------- Hợp đồng tư vấn ----------

test('chủ tạo, đổi trạng thái, xóa hợp đồng', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/hop-dong', { method: 'POST', body: JSON.stringify({ ten: 'HĐ QLDA', gia_tri: 500000000, trang_thai: 'du_thao' }) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.equal((await goi(env, CHU, `/api/hoalac/hop-dong/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'da_ky' }) })).status, 200);
  const ds = await (await goi(env, CHU, '/api/hoalac/hop-dong')).json();
  assert.equal(ds.hop_dong[0].trang_thai, 'da_ky');
  assert.equal((await goi(env, CHU, `/api/hoalac/hop-dong/${id}`, { method: 'DELETE' })).status, 200);
});

// ---------- Thủ tục pháp lý: thành viên full CRUD, đối tác chỉ xem/sửa trạng thái đúng thủ tục được gán ----------

test('chủ tạo thủ tục, nhom ngoài A-E thì 400', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'Xin phép xây dựng', nhom: 'A' }) });
  assert.equal(r.status, 201);
  const sai = await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'X', nhom: 'Z' }) });
  assert.equal(sai.status, 400);
});

test('đối tác không được gán thủ tục thì GET danh sách rỗng, GET từng thủ tục 404', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'Thủ tục A', nhom: 'A' }) })).json();
  const ds = await (await goi(env, DOI_TAC, '/api/hoalac/thu-tuc')).json();
  assert.equal(ds.thu_tuc.length, 0);
  assert.equal((await goi(env, DOI_TAC, `/api/hoalac/thu-tuc/${id}`)).status, 404);
});

test('đối tác được gán thủ tục thì thấy đúng thủ tục đó, sửa được trạng thái nhưng không đổi được tên/nhóm', async () => {
  const { env, db } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'Thủ tục A', nhom: 'A' }) })).json();
  await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'Thủ tục B', nhom: 'B' }) })).json();
  const { id: nguoiDungDoiTacId } = db.prepare("SELECT id FROM nguoi_dung WHERE email = 'doi-tac@vi-du.vn'").get();
  db.exec(`INSERT INTO qlda_giao_doi_tac (to_chuc_id, nguoi_dung_id, loai, doi_tuong_id, tao_luc) VALUES ('tc-hl', '${nguoiDungDoiTacId}', 'thu_tuc', ${id}, '2026-01-01')`);

  const ds = await (await goi(env, DOI_TAC, '/api/hoalac/thu-tuc')).json();
  assert.equal(ds.thu_tuc.length, 1);
  assert.equal(ds.thu_tuc[0].id, id);

  assert.equal((await goi(env, DOI_TAC, `/api/hoalac/thu-tuc/${id}`)).status, 200);
  const sua = await goi(env, DOI_TAC, `/api/hoalac/thu-tuc/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'doing', ten: 'Đổi tên trái phép', nhom: 'E' }) });
  assert.equal(sua.status, 200);
  const sauSua = await (await goi(env, CHU, '/api/hoalac/thu-tuc')).json();
  const thuTuc = sauSua.thu_tuc.find((t) => t.id === id);
  assert.equal(thuTuc.trang_thai, 'doing');
  assert.equal(thuTuc.ten, 'Thủ tục A', 'đối tác không đổi được tên dù gửi lên');
  assert.equal(thuTuc.nhom, 'A', 'đối tác không đổi được nhóm dù gửi lên');

  assert.equal((await goi(env, DOI_TAC, `/api/hoalac/thu-tuc/${id}`, { method: 'DELETE' })).status, 403, 'đối tác không xóa được thủ tục dù được gán xem');
});

test('xóa thủ tục đang được văn bản tham chiếu thì 409', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'A', nhom: 'A' }) })).json();
  await goi(env, CHU, '/api/hoalac/van-ban', { method: 'POST', body: JSON.stringify({ loai: 'den', trich_yeu: 'Công văn', lien_quan_thu_tuc_id: id }) });
  assert.equal((await goi(env, CHU, `/api/hoalac/thu-tuc/${id}`, { method: 'DELETE' })).status, 409);
});

// ---------- Phụ thuộc giữa thủ tục ----------

test('tạo, trùng thì 409, xóa phụ thuộc giữa hai thủ tục', async () => {
  const { env } = moiEnv();
  const { id: a } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'A', nhom: 'A' }) })).json();
  const { id: b } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'B', nhom: 'A' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/thu-tuc-phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: a, sau_id: b }) });
  assert.equal(r.status, 201);
  const trung = await goi(env, CHU, '/api/hoalac/thu-tuc-phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: a, sau_id: b }) });
  assert.equal(trung.status, 409);
  assert.equal((await goi(env, CHU, `/api/hoalac/thu-tuc-phu-thuoc/${a}/${b}`, { method: 'DELETE' })).status, 200);
});

test('phụ thuộc tự trỏ vào chính nó thì 400', async () => {
  const { env } = moiEnv();
  const { id: a } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'A', nhom: 'A' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/thu-tuc-phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: a, sau_id: a }) });
  assert.equal(r.status, 400);
});

// ---------- Văn bản đi/đến ----------

test('chủ tạo văn bản đến và đi, loai sai thì 400', async () => {
  const { env } = moiEnv();
  assert.equal((await goi(env, CHU, '/api/hoalac/van-ban', { method: 'POST', body: JSON.stringify({ loai: 'den', trich_yeu: 'Công văn đến' }) })).status, 201);
  assert.equal((await goi(env, CHU, '/api/hoalac/van-ban', { method: 'POST', body: JSON.stringify({ loai: 'di', trich_yeu: 'Công văn đi' }) })).status, 201);
  assert.equal((await goi(env, CHU, '/api/hoalac/van-ban', { method: 'POST', body: JSON.stringify({ loai: 'khac', trich_yeu: 'X' }) })).status, 400);
  const ds = await (await goi(env, CHU, '/api/hoalac/van-ban')).json();
  assert.equal(ds.van_ban.length, 2);
});

test('sửa văn bản gửi lien_quan_thu_tuc_id: null thì bỏ liên kết, không gửi field thì giữ nguyên', async () => {
  const { env } = moiEnv();
  const { id: thuTucId } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'A', nhom: 'A' }) })).json();
  const { id: vbId } = await (await goi(env, CHU, '/api/hoalac/van-ban', {
    method: 'POST', body: JSON.stringify({ loai: 'den', trich_yeu: 'Công văn', lien_quan_thu_tuc_id: thuTucId }),
  })).json();
  // Không gửi field này: giữ nguyên liên kết.
  await goi(env, CHU, `/api/hoalac/van-ban/${vbId}`, { method: 'PUT', body: JSON.stringify({ ghi_chu: 'cập nhật' }) });
  let ds = await (await goi(env, CHU, '/api/hoalac/van-ban')).json();
  assert.equal(ds.van_ban.find((x) => x.id === vbId).lien_quan_thu_tuc_id, thuTucId);
  // Gửi null: xóa liên kết, cho phép xóa thủ tục sau đó.
  assert.equal((await goi(env, CHU, `/api/hoalac/van-ban/${vbId}`, { method: 'PUT', body: JSON.stringify({ lien_quan_thu_tuc_id: null }) })).status, 200);
  ds = await (await goi(env, CHU, '/api/hoalac/van-ban')).json();
  assert.equal(ds.van_ban.find((x) => x.id === vbId).lien_quan_thu_tuc_id, null);
  assert.equal((await goi(env, CHU, `/api/hoalac/thu-tuc/${thuTucId}`, { method: 'DELETE' })).status, 200);
});

// ---------- Họp và việc sau họp ----------

test('chủ tạo cuộc họp, thêm/sửa/xóa việc sau họp, GET theo id trả kèm viec', async () => {
  const { env } = moiEnv();
  const { id: hopId } = await (await goi(env, CHU, '/api/hoalac/hop', { method: 'POST', body: JSON.stringify({ tieu_de: 'Họp giao ban', thoi_gian: '2026-02-01T08:00:00Z' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/hop-viec', { method: 'POST', body: JSON.stringify({ hop_id: hopId, noi_dung: 'Duyệt bản vẽ', phu_trach: 'A' }) });
  assert.equal(r.status, 201);
  const { id: viecId } = await r.json();
  const chiTiet = await (await goi(env, CHU, `/api/hoalac/hop/${hopId}`)).json();
  assert.equal(chiTiet.viec.length, 1);
  assert.equal(chiTiet.viec[0].noi_dung, 'Duyệt bản vẽ');
  assert.equal((await goi(env, CHU, `/api/hoalac/hop-viec/${viecId}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'xong' }) })).status, 200);
  assert.equal((await goi(env, CHU, `/api/hoalac/hop-viec/${viecId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await goi(env, CHU, `/api/hoalac/hop/${hopId}`, { method: 'DELETE' })).status, 200);
});

test('việc sau họp với hop_id của tổ chức khác thì 400', async () => {
  const { env, db } = moiEnv();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-khac', 'To chuc khac', 'hoalac', '2026-01-01')");
  db.exec("INSERT INTO qlda_hop (to_chuc_id, tieu_de, thoi_gian, tao_boi, tao_luc, cap_nhat_luc) VALUES ('tc-khac', 'Họp lạ', '2026-01-01T00:00:00Z', 'x', '2026-01-01', '2026-01-01')");
  const { id: hopKhacId } = db.prepare("SELECT id FROM qlda_hop WHERE to_chuc_id = 'tc-khac'").get();
  const r = await goi(env, CHU, '/api/hoalac/hop-viec', { method: 'POST', body: JSON.stringify({ hop_id: hopKhacId, noi_dung: 'X' }) });
  assert.equal(r.status, 400);
});

// ---------- Đối tác: chặn hẳn 5 mục còn lại (403), như RAID ----------

test('đối tác bị chặn 403 trên các bên liên quan, RACI, hợp đồng, văn bản, họp', async () => {
  const { env } = moiEnv();
  const { id: benId } = await (await goi(env, CHU, '/api/hoalac/ben-lien-quan', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: raciId } = await (await goi(env, CHU, '/api/hoalac/raci', { method: 'POST', body: JSON.stringify({ hoat_dong: 'A', ben_lien_quan_id: benId, vai_tro: 'R' }) })).json();
  const { id: hopDongId } = await (await goi(env, CHU, '/api/hoalac/hop-dong', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: vanBanId } = await (await goi(env, CHU, '/api/hoalac/van-ban', { method: 'POST', body: JSON.stringify({ loai: 'den', trich_yeu: 'A' }) })).json();
  const { id: hopId } = await (await goi(env, CHU, '/api/hoalac/hop', { method: 'POST', body: JSON.stringify({ tieu_de: 'A', thoi_gian: '2026-01-01T00:00:00Z' }) })).json();

  const canChan = [
    ['GET', '/api/hoalac/ben-lien-quan'], ['POST', '/api/hoalac/ben-lien-quan'], ['PUT', `/api/hoalac/ben-lien-quan/${benId}`], ['DELETE', `/api/hoalac/ben-lien-quan/${benId}`],
    ['GET', '/api/hoalac/raci'], ['POST', '/api/hoalac/raci'], ['DELETE', `/api/hoalac/raci/${raciId}`],
    ['GET', '/api/hoalac/hop-dong'], ['POST', '/api/hoalac/hop-dong'], ['PUT', `/api/hoalac/hop-dong/${hopDongId}`], ['DELETE', `/api/hoalac/hop-dong/${hopDongId}`],
    ['GET', '/api/hoalac/van-ban'], ['POST', '/api/hoalac/van-ban'], ['PUT', `/api/hoalac/van-ban/${vanBanId}`], ['DELETE', `/api/hoalac/van-ban/${vanBanId}`],
    ['GET', '/api/hoalac/hop'], ['POST', '/api/hoalac/hop'], ['PUT', `/api/hoalac/hop/${hopId}`], ['DELETE', `/api/hoalac/hop/${hopId}`],
    ['POST', '/api/hoalac/thu-tuc-phu-thuoc'],
  ];
  for (const [method, duongDan] of canChan) {
    const r = await goi(env, DOI_TAC, duongDan, { method, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ ten: 'X', loai: 'den', trich_yeu: 'X' }) });
    assert.equal(r.status, 403, `${method} ${duongDan} phải trả 403 cho đối tác`);
  }
});

// ---------- Xóa tổ chức: cascade 8 bảng pháp lý không vướng FK ----------

test('xóa tổ chức xóa sạch cả 8 bảng pháp lý, không lỗi khóa ngoại', async () => {
  const { env, db } = moiEnv();
  env.TEP = r2();
  const { id: benId } = await (await goi(env, CHU, '/api/hoalac/ben-lien-quan', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  await goi(env, CHU, '/api/hoalac/raci', { method: 'POST', body: JSON.stringify({ hoat_dong: 'A', ben_lien_quan_id: benId, vai_tro: 'R' }) });
  await goi(env, CHU, '/api/hoalac/hop-dong', { method: 'POST', body: JSON.stringify({ ten: 'A', ben_lien_quan_id: benId }) });
  const { id: thuTucA } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'A', nhom: 'A' }) })).json();
  const { id: thuTucB } = await (await goi(env, CHU, '/api/hoalac/thu-tuc', { method: 'POST', body: JSON.stringify({ ten: 'B', nhom: 'B' }) })).json();
  await goi(env, CHU, '/api/hoalac/thu-tuc-phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: thuTucA, sau_id: thuTucB }) });
  await goi(env, CHU, '/api/hoalac/van-ban', { method: 'POST', body: JSON.stringify({ loai: 'den', trich_yeu: 'A', lien_quan_thu_tuc_id: thuTucA }) });
  const { id: hopId } = await (await goi(env, CHU, '/api/hoalac/hop', { method: 'POST', body: JSON.stringify({ tieu_de: 'A', thoi_gian: '2026-01-01T00:00:00Z' }) })).json();
  await goi(env, CHU, '/api/hoalac/hop-viec', { method: 'POST', body: JSON.stringify({ hop_id: hopId, noi_dung: 'A' }) });
  const { id: nguoiDungDoiTacId } = db.prepare("SELECT id FROM nguoi_dung WHERE email = 'doi-tac@vi-du.vn'").get();
  db.exec(`INSERT INTO qlda_giao_doi_tac (to_chuc_id, nguoi_dung_id, loai, doi_tuong_id, tao_luc) VALUES ('tc-hl', '${nguoiDungDoiTacId}', 'thu_tuc', ${thuTucA}, '2026-01-01')`);

  const toChuc = { id: 'tc-hl', ten: 'Vien Hoa Lac', vai_tro: 'chu' };
  const kq = await xoaToChuc(env, toChuc, CHU, 'Vien Hoa Lac');
  assert.equal(kq.ok, true);
  const khoaSaoLuu = [...env.TEP.kho.keys()].find((k) => k.startsWith('sao-luu/tc-hl/'));
  const banSao = JSON.parse(env.TEP.kho.get(khoaSaoLuu));
  assert.equal(banSao.qlda_ben_lien_quan[0].ten, 'A');
  assert.equal(banSao.qlda_raci.length, 1);
  assert.equal(banSao.qlda_hop_dong.length, 1);
  assert.equal(banSao.qlda_thu_tuc.length, 2);
  assert.equal(banSao.qlda_thu_tuc_phu_thuoc.length, 1);
  assert.equal(banSao.qlda_van_ban.length, 1);
  assert.equal(banSao.qlda_hop.length, 1);
  assert.equal(banSao.qlda_hop_viec.length, 1);
  for (const bang of ['qlda_ben_lien_quan', 'qlda_raci', 'qlda_hop_dong', 'qlda_thu_tuc', 'qlda_thu_tuc_phu_thuoc', 'qlda_van_ban', 'qlda_hop', 'qlda_hop_viec', 'qlda_giao_doi_tac']) {
    const con = db.prepare(`SELECT COUNT(*) AS n FROM ${bang} WHERE to_chuc_id = 'tc-hl'`).get().n;
    assert.equal(con, 0, `${bang} phải rỗng sau khi xóa tổ chức`);
  }
});
