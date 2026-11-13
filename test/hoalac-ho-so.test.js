// Kho hồ sơ: tải lên, phiên bản, nhãn duyệt có người đổi, hạn hiệu lực, quyền, tách dự án, giới hạn 50 MB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sonicplan from '../src/index.js';
import { d1, dungCsdl } from './csdl-thu.js';
import { docHoSo, TEP_TOI_DA } from '../src/hoalac/ho-so.js';
import { soanNhacDuAn } from '../src/hoalac/nhac.js';
import { BANG_CUA_TO_CHUC } from '../src/xoa-to-chuc.js';
import { BANG_XUAT } from '../src/du-lieu.js';

const HOM_NAY = '2026-11-13';
const CHU = 'chu@vi-du.vn';
const TV = 'tv@vi-du.vn';
const XEM = 'xem@vi-du.vn';
const DT = 'dt@vi-du.vn';
const CHU_B = 'b@vi-du.vn';

function khoTep() {
  const m = new Map();
  return {
    m,
    put: async (k, v, o) => { m.set(k, { v, o }); },
    get: async (k) => (m.has(k) ? { body: m.get(k).v } : null),
    delete: async (k) => { m.delete(k); },
  };
}

function moiEnv() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-a', 'Du an A', 'hoalac', 'x'), ('tc-b', 'Du an B', 'hoalac', 'x')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-chu', '${CHU}', 'x'), ('nd-tv', '${TV}', 'x'), ('nd-xem', '${XEM}', 'x'), ('nd-dt', '${DT}', 'x'), ('nd-b', '${CHU_B}', 'x')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-a', 'nd-chu', 'chu', 'x'), ('tc-a', 'nd-tv', 'thanh_vien', 'x'), ('tc-a', 'nd-xem', 'xem', 'x'), ('tc-a', 'nd-dt', 'doi_tac', 'x'), ('tc-b', 'nd-b', 'chu', 'x')`);
  db.exec(`INSERT INTO qlda_hop_dong (id, to_chuc_id, ten, tao_boi, tao_luc, cap_nhat_luc) VALUES (1, 'tc-a', 'HD A', 'x', 'x', 'x'), (2, 'tc-b', 'HD B', 'x', 'x', 'x')`);
  const ASSETS = { fetch: async () => new Response('trang', { status: 200 }) };
  const TEP = khoTep();
  return { db, TEP, env: { CSDL: d1(db), ASSETS, TEP, QUAN_TRI: 'quan-tri@vi-du.vn' } };
}

const goi = (env, email, duongDan, tuyChon = {}) => sonicplan.fetch(
  new Request(`https://localhost${duongDan}`, tuyChon.body instanceof FormData ? tuyChon
    : { ...tuyChon, headers: { ...(tuyChon.headers || {}), 'content-type': 'application/json' } }),
  { ...env, EMAIL_THU: email },
  { waitUntil: () => {} },
);
const bieuMau = (truong, noiDung = 'noi dung', ten = 'quyet-dinh.pdf') => {
  const fd = new FormData();
  fd.set('tep', new File([noiDung], ten, { type: 'application/pdf' }));
  for (const [k, v] of Object.entries(truong)) fd.set(k, String(v));
  return fd;
};
const taiLen = async (env, email, truong, ...them) => goi(env, email, '/api/hoalac/ho-so', { method: 'POST', body: bieuMau(truong, ...them) });
const ds = async (env, email = CHU) => (await (await goi(env, email, '/api/hoalac/ho-so')).json()).ho_so;

test('tải lên tạo hồ sơ v1, gắn hợp đồng; tải bản mới thành v2; tải về đúng nội dung và tải về luôn là attachment', async () => {
  const { env, TEP } = moiEnv();
  const r = await taiLen(env, CHU, { thu_muc: 'hop_dong', ten: 'Hop dong VNCC', hop_dong_id: 1, han_hieu_luc: '2027-05-15' }, 'ban 1');
  assert.equal(r.status, 201, await r.clone().text());
  const { id } = await r.json();
  let [h] = await ds(env);
  assert.equal(h.id, id);
  assert.deepEqual([h.so, h.trang_thai, h.ten_hop_dong, h.ten_tep, h.thu_muc], [1, 'du_thao', 'HD A', 'quyet-dinh.pdf', 'hop_dong']);
  assert.ok([...TEP.m.keys()][0].startsWith('tc-a/ho-so/'), 'khóa tệp phải bắt đầu bằng mã dự án để dọn khi xóa dự án');

  const r2 = await goi(env, TV, `/api/hoalac/ho-so/${id}/phien-ban`, { method: 'POST', body: bieuMau({ ghi_chu: 'sua theo gop y' }, 'ban 2') });
  assert.equal(r2.status, 201, await r2.clone().text());
  [h] = await ds(env);
  assert.equal(h.so, 2);
  const { phien_ban } = await (await goi(env, CHU, `/api/hoalac/ho-so/${id}/phien-ban`)).json();
  assert.deepEqual(phien_ban.map((v) => [v.so, v.tao_boi]), [[2, TV], [1, CHU]]);

  const tai = await goi(env, XEM, `/api/hoalac/ho-so/phien-ban/${phien_ban[1].id}/tai`);
  assert.equal(tai.status, 200);
  assert.equal(new TextDecoder().decode(await tai.arrayBuffer()), 'ban 1');
  assert.match(tai.headers.get('content-disposition'), /^attachment/);
  assert.equal(tai.headers.get('x-content-type-options'), 'nosniff');
  const xem = await goi(env, CHU, `/api/hoalac/ho-so/phien-ban/${h.pb_id}/tai?xem=1`);
  assert.match(xem.headers.get('content-disposition'), /^inline/);
  assert.equal(xem.headers.get('content-type'), 'application/pdf');
});

test('xem trong trang chỉ cho ảnh và PDF; tệp HTML luôn tải về dạng octet-stream', async () => {
  const { env } = moiEnv();
  await taiLen(env, CHU, { thu_muc: 'khac' }, '<script>alert(1)</script>', 'trang.html');
  const [h] = await ds(env);
  const r = await goi(env, CHU, `/api/hoalac/ho-so/phien-ban/${h.pb_id}/tai?xem=1`);
  assert.match(r.headers.get('content-disposition'), /^attachment/);
  assert.equal(r.headers.get('content-type'), 'application/octet-stream');
});

test('đổi nhãn ghi người đổi và lúc đổi; trạng thái sai bị từ chối', async () => {
  const { env } = moiEnv();
  await taiLen(env, CHU, { thu_muc: 'phap_ly' });
  const [h] = await ds(env);
  const r = await goi(env, TV, `/api/hoalac/ho-so/phien-ban/${h.pb_id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'da_duyet' }) });
  assert.equal(r.status, 200);
  const [sau] = await ds(env);
  assert.equal(sau.trang_thai, 'da_duyet');
  assert.equal(sau.doi_boi, TV);
  assert.ok(sau.doi_luc && sau.doi_luc !== h.doi_luc);
  const sai = await goi(env, CHU, `/api/hoalac/ho-so/phien-ban/${h.pb_id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'xoa' }) });
  assert.equal(sai.status, 400);
});

test('quyền: đối tác bị chặn hẳn; vai trò xem chỉ đọc và tải về, không tải lên hay đổi nhãn', async () => {
  const { env } = moiEnv();
  await taiLen(env, CHU, { thu_muc: 'phap_ly' });
  const [h] = await ds(env);
  assert.equal((await goi(env, DT, '/api/hoalac/ho-so')).status, 403);
  assert.equal((await goi(env, DT, `/api/hoalac/ho-so/phien-ban/${h.pb_id}/tai`)).status, 403);
  assert.equal((await taiLen(env, DT, { thu_muc: 'phap_ly' })).status, 403);
  assert.equal((await goi(env, XEM, '/api/hoalac/ho-so')).status, 200);
  assert.equal((await taiLen(env, XEM, { thu_muc: 'phap_ly' })).status, 403);
  assert.equal((await goi(env, XEM, `/api/hoalac/ho-so/phien-ban/${h.pb_id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'da_duyet' }) })).status, 403);
  assert.equal((await goi(env, XEM, `/api/hoalac/ho-so/${h.id}`, { method: 'PUT', body: JSON.stringify({ ten: 'x' }) })).status, 403);
});

test('tách dự án: dự án B không thấy, không tải về, không sửa được hồ sơ của A, không gắn được hợp đồng của A', async () => {
  const { env } = moiEnv();
  await taiLen(env, CHU, { thu_muc: 'phap_ly' });
  const [h] = await ds(env);
  assert.equal((await ds(env, CHU_B)).length, 0);
  assert.equal((await goi(env, CHU_B, `/api/hoalac/ho-so/phien-ban/${h.pb_id}/tai`)).status, 404);
  assert.equal((await goi(env, CHU_B, `/api/hoalac/ho-so/${h.id}/phien-ban`)).status, 404);
  assert.equal((await goi(env, CHU_B, `/api/hoalac/ho-so/phien-ban/${h.pb_id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'da_duyet' }) })).status, 404);
  assert.equal((await goi(env, CHU_B, `/api/hoalac/ho-so/${h.id}`, { method: 'PUT', body: JSON.stringify({ ten: 'x' }) })).status, 404);
  assert.equal((await goi(env, CHU_B, `/api/hoalac/ho-so/${h.id}/phien-ban`, { method: 'POST', body: bieuMau({}) })).status, 404);
  assert.equal((await taiLen(env, CHU_B, { thu_muc: 'hop_dong', hop_dong_id: 1 })).status, 400);
  assert.equal((await ds(env))[0].trang_thai, 'du_thao');
});

test('kiểm đầu vào: thư mục sai, gắn hai mục, ngày sai, thiếu tệp đều bị từ chối và không ghi gì vào kho tệp', async () => {
  const { env, TEP } = moiEnv();
  assert.equal((await taiLen(env, CHU, { thu_muc: 'linh_tinh' })).status, 400);
  assert.equal((await taiLen(env, CHU, { thu_muc: 'phap_ly', hop_dong_id: 1, thu_tuc_id: 1 })).status, 400);
  assert.equal((await taiLen(env, CHU, { thu_muc: 'phap_ly', han_hieu_luc: '2027-02-30' })).status, 400);
  const fd = new FormData(); fd.set('thu_muc', 'phap_ly');
  assert.equal((await goi(env, CHU, '/api/hoalac/ho-so', { method: 'POST', body: fd })).status, 400);
  assert.equal(TEP.m.size, 0);
});

test('tệp quá 50 MB bị từ chối 413, không lưu', async () => {
  const { env, TEP } = moiEnv();
  const r = await taiLen(env, CHU, { thu_muc: 'khac' }, new Uint8Array(TEP_TOI_DA + 1), 'lon.pdf');
  assert.equal(r.status, 413);
  assert.equal(TEP.m.size, 0);
});

test('sửa thông tin: đổi gắn sang hợp đồng, bỏ hạn; trường không gửi giữ nguyên', async () => {
  const { env } = moiEnv();
  await taiLen(env, CHU, { thu_muc: 'phap_ly', ten: 'Giay phep', han_hieu_luc: '2027-01-01', mo_ta: 'ban goc' });
  const [h] = await ds(env);
  const r = await goi(env, CHU, `/api/hoalac/ho-so/${h.id}`, { method: 'PUT', body: JSON.stringify({ hop_dong_id: 1, han_hieu_luc: null }) });
  assert.equal(r.status, 200, await r.clone().text());
  const [sau] = await ds(env);
  assert.deepEqual([sau.ten, sau.mo_ta, sau.hop_dong_id, sau.han_hieu_luc, sau.thu_muc], ['Giay phep', 'ban goc', 1, null, 'phap_ly']);
});

test('cảnh báo hạn: hết hạn, còn trong 30 ngày; hồ sơ đã đặt Hết hiệu lực thì thôi báo; tin nhắc có khối hồ sơ', async () => {
  const { env } = moiEnv();
  await taiLen(env, CHU, { thu_muc: 'phap_ly', ten: 'Da het', han_hieu_luc: '2026-11-01' });
  await taiLen(env, CHU, { thu_muc: 'phap_ly', ten: 'Sap het', han_hieu_luc: '2026-12-01' });
  await taiLen(env, CHU, { thu_muc: 'phap_ly', ten: 'Con xa', han_hieu_luc: '2027-06-01' });
  await taiLen(env, CHU, { thu_muc: 'phap_ly', ten: 'Bo roi', han_hieu_luc: '2026-10-01', trang_thai: 'het_hieu_luc' });
  const kq = Object.fromEntries((await docHoSo(env, 'tc-a', HOM_NAY)).map((x) => [x.ten, x.tinh_trang_han]));
  assert.deepEqual(kq, { 'Da het': 'het_han', 'Sap het': 'sap_het_han', 'Con xa': null, 'Bo roi': null });
  const nhac = await soanNhacDuAn(env, 'tc-a', HOM_NAY);
  assert.match(nhac, /Hồ sơ hết hạn hoặc sắp hết hạn \(2\)/);
  assert.match(nhac, /Da het .*đã hết/);
});

test('hai bảng hồ sơ có trong danh sách xóa (trước tep và các bảng được gắn) và trong bản xuất', () => {
  const vt = (b) => BANG_CUA_TO_CHUC.indexOf(b);
  for (const b of ['qlda_ho_so', 'qlda_ho_so_phien_ban']) {
    assert.ok(vt(b) >= 0, b);
    assert.ok(BANG_XUAT.some(([ten]) => ten === b), b);
  }
  assert.ok(vt('qlda_ho_so_phien_ban') < vt('qlda_ho_so'));
  for (const b of ['tep', 'qlda_thu_tuc', 'qlda_hop_dong', 'qlda_san_pham_ban_giao']) assert.ok(vt('qlda_ho_so') < vt(b), b);
});
