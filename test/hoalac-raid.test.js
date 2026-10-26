// Phân hệ Viện Hòa Lạc, PR3: RAID (rủi ro, vấn đề, thay đổi, quyết định, bài học).
// Đối tác không có cơ chế gán từng dòng như hạng mục: mọi thao tác RAID trả 403 cho đối tác.
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

// ---------- Rủi ro ----------

test('chủ tạo rủi ro, mức độ = xác suất x tác động, không lưu cột tính sẵn', async () => {
  const { env } = moiEnv();
  const r = await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'Chậm cấp phép', xac_suat: 4, tac_dong: 3 }) });
  assert.equal(r.status, 201);
  const ds = await (await goi(env, CHU, '/api/hoalac/rui-ro')).json();
  assert.equal(ds.rui_ro[0].muc_do, 12);
});

test('rủi ro mức độ >= 15 tạo thông báo cao; dưới 15 thì không', async () => {
  const { env, db } = moiEnv();
  await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'Rủi ro cao', xac_suat: 5, tac_dong: 4 }) }); // 20
  await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'Rủi ro thấp', xac_suat: 2, tac_dong: 2 }) }); // 4
  const results = db.prepare("SELECT tieu_de FROM thong_bao WHERE to_chuc_id = 'tc-hl' AND loai = 'hoalac_rui_ro'").all();
  assert.equal(results.length, 1);
  assert.match(results[0].tieu_de, /Rủi ro cao/);
});

test('sửa rủi ro: đổi xác suất/tác động, không tìm thấy thì 404', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const sua = await goi(env, CHU, `/api/hoalac/rui-ro/${id}`, { method: 'PUT', body: JSON.stringify({ xac_suat: 5, tac_dong: 5, trang_thai: 'dang_xu_ly' }) });
  assert.equal(sua.status, 200);
  const ds = await (await goi(env, CHU, '/api/hoalac/rui-ro')).json();
  assert.equal(ds.rui_ro[0].muc_do, 25);
  assert.equal(ds.rui_ro[0].trang_thai, 'dang_xu_ly');
  const khongThay = await goi(env, CHU, '/api/hoalac/rui-ro/9999', { method: 'PUT', body: JSON.stringify({ ten: 'X' }) });
  assert.equal(khongThay.status, 404);
});

test('xóa rủi ro: xong thì 200, không tìm thấy thì 404', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  assert.equal((await goi(env, CHU, `/api/hoalac/rui-ro/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await goi(env, CHU, `/api/hoalac/rui-ro/${id}`, { method: 'DELETE' })).status, 404);
});

// ---------- Vấn đề ----------

test('chủ tạo và sửa vấn đề, gắn được vào một rủi ro', async () => {
  const { env } = moiEnv();
  const { id: ruiRoId } = await (await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'Rủi ro gốc' }) })).json();
  const r = await goi(env, CHU, '/api/hoalac/van-de', { method: 'POST', body: JSON.stringify({ ten: 'Thiếu nhân sự', rui_ro_id: ruiRoId, muc_do: 'cao' }) });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  await goi(env, CHU, `/api/hoalac/van-de/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'da_dong' }) });
  const ds = await (await goi(env, CHU, '/api/hoalac/van-de')).json();
  assert.equal(ds.van_de[0].rui_ro_id, ruiRoId);
  assert.equal(ds.van_de[0].trang_thai, 'da_dong');
});

// ---------- Thay đổi: luồng duyệt một chiều ----------

test('luồng thay đổi hợp lệ: de_xuat -> xem_xet -> duyet, ghi người duyệt', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thay-doi', { method: 'POST', body: JSON.stringify({ ten: 'Đổi vật liệu mái' }) })).json();
  const b1 = await (await goi(env, CHU, '/api/hoalac/thay-doi')).json();
  assert.equal(b1.thay_doi[0].trang_thai, 'de_xuat');

  assert.equal((await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'xem_xet' }) })).status, 200);
  assert.equal((await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'duyet', ghi_chu_duyet: 'Đồng ý' }) })).status, 200);

  const ds = await (await goi(env, CHU, '/api/hoalac/thay-doi')).json();
  assert.equal(ds.thay_doi[0].trang_thai, 'duyet');
  assert.equal(ds.thay_doi[0].duyet_boi, CHU);
  assert.equal(ds.thay_doi[0].ghi_chu_duyet, 'Đồng ý');
});

test('luồng thay đổi không lùi lại được: duyet rồi không chuyển về de_xuat hay xem_xet', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thay-doi', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'xem_xet' }) });
  await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'duyet' }) });
  const luiLai = await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'de_xuat' }) });
  assert.equal(luiLai.status, 409);
});

test('luồng thay đổi không nhảy cóc: de_xuat không chuyển thẳng sang duyet', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thay-doi', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const nhayCoc = await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'duyet' }) });
  assert.equal(nhayCoc.status, 409);
});

test('chuyển sang xem_xet tạo thông báo đúng tên yêu cầu thay đổi', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/thay-doi', { method: 'POST', body: JSON.stringify({ ten: 'Đổi mặt bằng tầng 2' }) })).json();
  await goi(env, CHU, `/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'xem_xet' }) });
  const tb = await (await goi(env, CHU, '/api/thong-bao')).json();
  const cua = tb.ds.find((t) => t.loai === 'hoalac_thay_doi');
  assert.match(cua.tieu_de, /Đổi mặt bằng tầng 2/);
});

// ---------- Quyết định, bài học: chỉ tạo và xóa, không có PUT ----------

test('quyết định: tạo rồi xóa được, không có cập nhật', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/quyet-dinh', { method: 'POST', body: JSON.stringify({ ten: 'Chọn nhà thầu A', can_cu: 'Biên bản họp 12/10' }) })).json();
  const ds = await (await goi(env, CHU, '/api/hoalac/quyet-dinh')).json();
  assert.equal(ds.quyet_dinh[0].can_cu, 'Biên bản họp 12/10');
  assert.equal((await goi(env, CHU, `/api/hoalac/quyet-dinh/${id}`, { method: 'DELETE' })).status, 200);
});

test('bài học: tạo rồi xóa được', async () => {
  const { env } = moiEnv();
  const { id } = await (await goi(env, CHU, '/api/hoalac/bai-hoc', { method: 'POST', body: JSON.stringify({ ten: 'Họp sớm với BQL', loai: 'tot' }) })).json();
  const ds = await (await goi(env, CHU, '/api/hoalac/bai-hoc')).json();
  assert.equal(ds.bai_hoc[0].loai, 'tot');
  assert.equal((await goi(env, CHU, `/api/hoalac/bai-hoc/${id}`, { method: 'DELETE' })).status, 200);
});

// ---------- Đối tác: chặn toàn bộ RAID (403), không như hạng mục ----------

test('đối tác bị chặn 403 trên mọi verb của cả 5 mục RAID', async () => {
  const { env } = moiEnv();
  const { id: ruiRoId } = await (await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: vanDeId } = await (await goi(env, CHU, '/api/hoalac/van-de', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: thayDoiId } = await (await goi(env, CHU, '/api/hoalac/thay-doi', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: quyetDinhId } = await (await goi(env, CHU, '/api/hoalac/quyet-dinh', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  const { id: baiHocId } = await (await goi(env, CHU, '/api/hoalac/bai-hoc', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();

  const canChan = [
    ['GET', '/api/hoalac/rui-ro'], ['POST', '/api/hoalac/rui-ro'], ['PUT', `/api/hoalac/rui-ro/${ruiRoId}`], ['DELETE', `/api/hoalac/rui-ro/${ruiRoId}`],
    ['GET', '/api/hoalac/van-de'], ['POST', '/api/hoalac/van-de'], ['PUT', `/api/hoalac/van-de/${vanDeId}`], ['DELETE', `/api/hoalac/van-de/${vanDeId}`],
    ['GET', '/api/hoalac/thay-doi'], ['POST', '/api/hoalac/thay-doi'], ['PUT', `/api/hoalac/thay-doi/${thayDoiId}`], ['DELETE', `/api/hoalac/thay-doi/${thayDoiId}`],
    ['GET', '/api/hoalac/quyet-dinh'], ['POST', '/api/hoalac/quyet-dinh'], ['DELETE', `/api/hoalac/quyet-dinh/${quyetDinhId}`],
    ['GET', '/api/hoalac/bai-hoc'], ['POST', '/api/hoalac/bai-hoc'], ['DELETE', `/api/hoalac/bai-hoc/${baiHocId}`],
  ];
  for (const [method, duongDan] of canChan) {
    const r = await goi(env, DOI_TAC, duongDan, { method, body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify({ ten: 'X' }) });
    assert.equal(r.status, 403, `${method} ${duongDan} phải trả 403 cho đối tác`);
  }
});

// ---------- Cách ly thông báo: đối tác không thấy RAID qua kênh thông báo chung ----------

test('đối tác không thấy thông báo RAID trong /api/thong-bao dù tổ chức có thông báo đó', async () => {
  const { env } = moiEnv();
  await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'Rủi ro cao', xac_suat: 5, tac_dong: 5 }) });
  const cuaChu = await (await goi(env, CHU, '/api/thong-bao')).json();
  assert.ok(cuaChu.ds.some((t) => t.loai === 'hoalac_rui_ro'));
  const cuaDoiTac = await (await goi(env, DOI_TAC, '/api/thong-bao')).json();
  assert.ok(!cuaDoiTac.ds.some((t) => t.loai === 'hoalac_rui_ro'));
});

test('đối tác không thấy nhãn loại thông báo RAID trong /api/thong-bao/cai, và không tắt/mở được', async () => {
  const { env } = moiEnv();
  const caiDoiTac = await (await goi(env, DOI_TAC, '/api/thong-bao/cai')).json();
  assert.ok(!('hoalac_rui_ro' in caiDoiTac.loai));
  assert.ok(!('hoalac_thay_doi' in caiDoiTac.loai));
  assert.ok(!('hoalac_rui_ro' in caiDoiTac.bat));

  const sua = await goi(env, DOI_TAC, '/api/thong-bao/cai', { method: 'PUT', body: JSON.stringify({ bat: { hoalac_rui_ro: false } }) });
  assert.equal(sua.status, 400);
});

test('chủ vẫn thấy đủ nhãn và bật/tắt được thông báo RAID', async () => {
  const { env } = moiEnv();
  const cai = await (await goi(env, CHU, '/api/thong-bao/cai')).json();
  assert.ok('hoalac_rui_ro' in cai.loai);
  assert.equal((await goi(env, CHU, '/api/thong-bao/cai', { method: 'PUT', body: JSON.stringify({ bat: { hoalac_rui_ro: false } }) })).status, 200);
});

// ---------- Xóa tổ chức: cascade RAID không vướng FK ----------

test('xóa tổ chức xóa sạch cả 5 bảng RAID, không lỗi khóa ngoại (qlda_van_de tham chiếu qlda_rui_ro)', async () => {
  const { env, db } = moiEnv();
  env.TEP = r2();
  const { id: ruiRoId } = await (await goi(env, CHU, '/api/hoalac/rui-ro', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json();
  await goi(env, CHU, '/api/hoalac/van-de', { method: 'POST', body: JSON.stringify({ ten: 'B', rui_ro_id: ruiRoId }) });
  await goi(env, CHU, '/api/hoalac/thay-doi', { method: 'POST', body: JSON.stringify({ ten: 'C' }) });
  await goi(env, CHU, '/api/hoalac/quyet-dinh', { method: 'POST', body: JSON.stringify({ ten: 'D' }) });
  await goi(env, CHU, '/api/hoalac/bai-hoc', { method: 'POST', body: JSON.stringify({ ten: 'E' }) });

  const toChuc = { id: 'tc-hl', ten: 'Vien Hoa Lac', vai_tro: 'chu' };
  const kq = await xoaToChuc(env, toChuc, CHU, 'Vien Hoa Lac');
  assert.equal(kq.ok, true);
  for (const bang of ['qlda_rui_ro', 'qlda_van_de', 'qlda_thay_doi', 'qlda_quyet_dinh', 'qlda_bai_hoc']) {
    const con = db.prepare(`SELECT COUNT(*) AS n FROM ${bang} WHERE to_chuc_id = 'tc-hl'`).get().n;
    assert.equal(con, 0, `${bang} phải rỗng sau khi xóa tổ chức`);
  }
});
