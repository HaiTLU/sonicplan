// Trang Việc: kiểu xem Theo trạng thái (suy cột, kéo thả đổi trạng thái), tab xem đã lưu, nhãn ưu tiên.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { chiaCotTrangThai, mocXong, suaKhiThaTrangThai, suyTrangThai } from '../public/trang/cot-trang-thai.js';
import { apTab, chupTab, chuanTab, laTabHienTai, maTabMoi } from '../public/trang/tab-viec.js';
import { chuanTabViec } from '../src/api/viec.js';
import { xuLyApi } from '../src/api.js';

const BAY_GIO = Date.parse('2026-11-22T10:00:00Z');
const tuLuc = mocXong(BAY_GIO);

// ---------- Suy trạng thái ----------

test('suy trạng thái: việc mở chưa đặt tiến độ vào Chưa làm, có ô hỏi AI đang chờ vào Chờ anh duyệt', () => {
  assert.equal(suyTrangThai({ trang_thai: 'mo' }), 'tt-chua-lam');
  assert.equal(suyTrangThai({ trang_thai: 'mo', tien_do: null, hoi_cho: 0 }), 'tt-chua-lam');
  assert.equal(suyTrangThai({ trang_thai: 'mo', hoi_cho: 1 }), 'tt-cho-duyet');
});

test('suy trạng thái: tiến độ người dùng tự đặt thắng ô hỏi AI', () => {
  assert.equal(suyTrangThai({ trang_thai: 'mo', tien_do: 'dang_lam' }), 'tt-dang-lam');
  assert.equal(suyTrangThai({ trang_thai: 'mo', tien_do: 'dang_lam', hoi_cho: 1 }), 'tt-dang-lam');
  assert.equal(suyTrangThai({ trang_thai: 'mo', tien_do: 'chua_lam', hoi_cho: 1 }), 'tt-chua-lam');
  assert.equal(suyTrangThai({ trang_thai: 'mo', tien_do: 'cho_duyet' }), 'tt-cho-duyet');
  assert.equal(suyTrangThai({ trang_thai: 'mo', tien_do: 'la' }), 'tt-chua-lam', 'giá trị lạ coi như chưa đặt');
});

test('suy trạng thái: Xong chỉ hiện việc xong trong 7 ngày, việc hủy không hiện', () => {
  assert.equal(tuLuc, '2026-11-15T10:00:00.000Z');
  assert.equal(suyTrangThai({ trang_thai: 'xong', xong_luc: '2026-11-21T08:00:00Z' }, { tuLuc }), 'tt-xong');
  assert.equal(suyTrangThai({ trang_thai: 'xong', xong_luc: '2026-11-15T10:00:00.000Z' }, { tuLuc }), 'tt-xong', 'đúng mốc vẫn tính');
  assert.equal(suyTrangThai({ trang_thai: 'xong', xong_luc: '2026-11-14T23:00:00Z' }, { tuLuc }), null);
  assert.equal(suyTrangThai({ trang_thai: 'xong', xong_luc: null }, { tuLuc }), null);
  assert.equal(suyTrangThai({ trang_thai: 'xong', tien_do: 'dang_lam', xong_luc: '2026-11-21T08:00:00Z' }, { tuLuc }), 'tt-xong', 'xong thắng tiến độ cũ');
  assert.equal(suyTrangThai({ trang_thai: 'huy', tien_do: 'dang_lam' }, { tuLuc }), null);
});

test('chia cột: đủ 4 cột, giữ thứ tự đầu vào trong mỗi cột', () => {
  const ds = [
    { id: 1, trang_thai: 'mo' },
    { id: 2, trang_thai: 'mo', tien_do: 'dang_lam' },
    { id: 3, trang_thai: 'mo', hoi_cho: 1 },
    { id: 4, trang_thai: 'mo' },
    { id: 5, trang_thai: 'xong', xong_luc: '2026-11-20T00:00:00Z' },
    { id: 6, trang_thai: 'xong', xong_luc: '2026-10-01T00:00:00Z' },
  ];
  const c = chiaCotTrangThai(ds, { tuLuc });
  assert.deepEqual(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.map((x) => x.id)])), {
    'tt-chua-lam': [1, 4], 'tt-dang-lam': [2], 'tt-cho-duyet': [3], 'tt-xong': [5],
  });
});

// ---------- Thả thẻ vào cột ----------

test('thả thẻ: vào Xong thì đánh xong; vào cột mở thì đặt tiến độ; việc xong kéo ra thì mở lại', () => {
  assert.deepEqual(suaKhiThaTrangThai({ trang_thai: 'mo' }, 'tt-xong'), { trang_thai: 'xong' });
  assert.equal(suaKhiThaTrangThai({ trang_thai: 'xong' }, 'tt-xong'), null);
  assert.deepEqual(suaKhiThaTrangThai({ trang_thai: 'mo' }, 'tt-dang-lam'), { tien_do: 'dang_lam' });
  assert.deepEqual(suaKhiThaTrangThai({ trang_thai: 'mo', hoi_cho: 1 }, 'tt-chua-lam'), { tien_do: 'chua_lam' });
  assert.deepEqual(suaKhiThaTrangThai({ trang_thai: 'mo', tien_do: 'dang_lam' }, 'tt-cho-duyet'), { tien_do: 'cho_duyet' });
  assert.equal(suaKhiThaTrangThai({ trang_thai: 'mo', tien_do: 'dang_lam' }, 'tt-dang-lam'), null);
  assert.deepEqual(suaKhiThaTrangThai({ trang_thai: 'xong', tien_do: 'dang_lam' }, 'tt-dang-lam'), { trang_thai: 'mo', tien_do: 'dang_lam' }, 'mở lại luôn gửi kèm tiến độ');
  assert.deepEqual(suaKhiThaTrangThai({ trang_thai: 'xong' }, 'tt-chua-lam'), { trang_thai: 'mo', tien_do: 'chua_lam' });
  assert.equal(suaKhiThaTrangThai({ trang_thai: 'mo' }, 'hom-nay'), null, 'cột không phải trạng thái');
});

// ---------- API: cơ sở dữ liệu thật dựng từ migrations ----------

const phien = { email: 'a@vi-du.vn', nguoi_dung: { id: 'nd1' }, to_chuc: { id: 'tc1', vai_tro: 'chu' }, cac_to_chuc: [{ id: 'tc1' }] };
function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01'), ('tc2', 'K', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}
async function goiApi(env, duong, tuyChon = {}, ph = phien) {
  const url = new URL(`http://x${duong}`);
  const kq = await xuLyApi(new Request(url, tuyChon), env, ph, url);
  return { ma: kq.status, du: await kq.json() };
}
const themViec = (db, tieuDe, them = '') => Number(db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc${them ? `, ${them.split('=')[0]}` : ''}) VALUES ('tc1', ?, 'mo', 'x', 'x'${them ? `, '${them.split('=')[1]}'` : ''})`).run(tieuDe).lastInsertRowid);

test('migration 0056: cột tien_do có, mặc định NULL, chặn giá trị lạ', () => {
  const { db } = moiTruong();
  const cot = db.prepare("SELECT name, dflt_value, \"notnull\" AS nn FROM pragma_table_info('viec') WHERE name = 'tien_do'").get();
  assert.deepEqual({ ...cot }, { name: 'tien_do', dflt_value: null, nn: 0 });
  const id = themViec(db, 'A');
  assert.equal(db.prepare('SELECT tien_do FROM viec WHERE id = ?').get(id).tien_do, null);
  assert.throws(() => db.prepare("UPDATE viec SET tien_do = 'bay' WHERE id = ?").run(id), /CHECK/);
});

test('API: danh sách việc trả uu_tien, tien_do, hoi_cho (chỉ tính ô hỏi đang chờ của đúng tổ chức)', async () => {
  const { db, env } = moiTruong();
  const a = themViec(db, 'Có ô hỏi chờ', 'uu_tien=cao');
  const b = themViec(db, 'Ô hỏi đã trả lời');
  const c = themViec(db, 'Đang làm', 'tien_do=dang_lam');
  db.exec(`INSERT INTO cau_hoi_ai (to_chuc_id, viec_id, loai, cau_hoi, trang_thai, tao_luc) VALUES
    ('tc1', ${a}, 'gio', 'Mấy giờ?', 'cho', 'x'), ('tc1', ${b}, 'gio', 'Mấy giờ?', 'xong', 'x'), ('tc2', ${c}, 'gio', 'Lạ', 'cho', 'x')`);
  const ds = (await goiApi(env, '/api/viec')).du.viec;
  const theo = Object.fromEntries(ds.map((v) => [v.id, v]));
  assert.equal(theo[a].hoi_cho, 1);
  assert.equal(theo[a].uu_tien, 'cao');
  assert.equal(theo[b].hoi_cho, 0);
  assert.equal(theo[c].hoi_cho, 0, 'ô hỏi của tổ chức khác không tính');
  assert.equal(theo[c].tien_do, 'dang_lam');
  assert.deepEqual(ds.map((v) => suyTrangThai(v)).sort(), ['tt-cho-duyet', 'tt-chua-lam', 'tt-dang-lam']);
});

test('API: kéo thẻ (PATCH theo suaKhiThaTrangThai) đổi đúng trạng thái trong cơ sở dữ liệu', async () => {
  const { db, env } = moiTruong();
  const id = themViec(db, 'Soạn tờ trình');
  const dong = () => ({ ...db.prepare('SELECT trang_thai, tien_do, xong_luc FROM viec WHERE id = ?').get(id) });
  const tha = async (denCot) => {
    const x = (await goiApi(env, '/api/viec')).du.viec.find((v) => v.id === id) || (await goiApi(env, '/api/viec?trang_thai=xong')).du.viec.find((v) => v.id === id);
    const sua = suaKhiThaTrangThai(x, denCot);
    if (sua) assert.equal((await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify(sua) })).ma, 200);
  };
  await tha('tt-dang-lam');
  assert.deepEqual(dong(), { trang_thai: 'mo', tien_do: 'dang_lam', xong_luc: null });
  await tha('tt-cho-duyet');
  assert.equal(dong().tien_do, 'cho_duyet');
  await tha('tt-xong');
  assert.equal(dong().trang_thai, 'xong');
  assert.ok(dong().xong_luc, 'đánh xong thì có giờ xong');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM viec_su_kien WHERE viec_id = ? AND loai = 'xong'").get(id).n, 1, 'ghi sự kiện xong như nút tích');
  await tha('tt-chua-lam');
  assert.deepEqual(dong(), { trang_thai: 'mo', tien_do: 'chua_lam', xong_luc: null });
  // Bỏ đặt và giá trị lạ.
  assert.equal((await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ tien_do: null }) })).ma, 200);
  assert.equal(dong().tien_do, null);
  assert.equal((await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ tien_do: 'bay' }) })).ma, 400);
});

// ---------- Tab xem đã lưu ----------

test('tab: chụp, áp, so khớp tổ hợp hiện tại; giá trị lạ về mặc định', () => {
  const v = { tab: 'xong', xem: 'trang-thai', duAn: 7, nguon: 'zalo', han: 'tat-ca', gio: 'tat-ca', nang: 'tat-ca', claude: 'tat-ca', sapXep: 'han', chiSao: true, anNhan: true };
  const t = { id: 't1', ten: 'Gấp', ...chupTab(v) };
  assert.equal(laTabHienTai(v, t), true);
  const moi = apTab({ xem: 'du-an', duAn: 'tat-ca', tab: 'xong' }, t);
  assert.equal(moi.duAn, 7, 'dự án là số như chip dự án');
  assert.equal(moi.tab, 'mo');
  assert.equal(moi.xem, 'trang-thai');
  assert.equal(laTabHienTai({ ...v, sapXep: 'ten' }, t), false);
  assert.deepEqual(chuanTab({ ten: 'x', xem: '<script>', duAn: 'abc', sapXep: 'han', chiSao: 'có' }), { id: '', ten: 'x', xem: 'du-an', duAn: 'tat-ca', nguon: 'tat-ca', han: 'tat-ca', gio: 'tat-ca', nang: 'tat-ca', claude: 'tat-ca', sapXep: 'han', chiSao: false });
  assert.equal(maTabMoi([{ id: 't1' }, { id: 't2' }]), 't3');
  assert.equal(maTabMoi([{ id: 't2' }]), 't3');
});

test('tab: máy chủ chỉ giữ trường đã biết, tối đa 12 tab, bỏ tab không tên', () => {
  const ds = chuanTabViec([{ id: 't1', ten: '  Gấp  ', xem: 'han', la: 'x', chiSao: true }, { ten: '' }, ...Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, ten: `T${i}` }))]);
  assert.equal(ds.length, 11, '12 dòng đầu, bỏ một dòng không tên');
  assert.deepEqual(ds[0], { id: 't1', ten: 'Gấp', xem: 'han', chiSao: true });
  assert.equal(chuanTabViec('x'), null);
  const trung = chuanTabViec([{ id: 't2', ten: 'A' }, { ten: 'B' }, { id: 't2', ten: 'C' }]);
  assert.equal(new Set(trung.map((t) => t.id)).size, 3, 'mã tab trùng hoặc thiếu được sinh lại');
});

test('API tab: lưu theo từng người dùng trong cai_dat, đọc lại được, dữ liệu sai thì 400', async () => {
  const { db, env } = moiTruong();
  assert.deepEqual((await goiApi(env, '/api/viec/tab')).du, { tab: [] });
  const kq = await goiApi(env, '/api/viec/tab', { method: 'PUT', body: JSON.stringify({ tab: [{ id: 't1', ten: 'Chờ duyệt', xem: 'trang-thai', duAn: '3' }] }) });
  assert.equal(kq.ma, 200);
  assert.deepEqual((await goiApi(env, '/api/viec/tab')).du.tab, [{ id: 't1', ten: 'Chờ duyệt', xem: 'trang-thai', duAn: '3' }]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cai_dat WHERE to_chuc_id = 'tc1' AND khoa = 'viec_tab:nd1'").get().n, 1);
  // Người khác cùng tổ chức không thấy tab của mình.
  const khac = { ...phien, nguoi_dung: { id: 'nd2' } };
  assert.deepEqual((await goiApi(env, '/api/viec/tab', {}, khac)).du.tab, []);
  assert.equal((await goiApi(env, '/api/viec/tab', { method: 'PUT', body: JSON.stringify({ tab: 'x' }) })).ma, 400);
  assert.equal((await goiApi(env, '/api/viec/tab', {}, { ...phien, nguoi_dung: null })).ma, 403);
});

test('API: mở lại việc xong không kèm tiến độ thì về Chưa làm; hủy thì ra khỏi mọi cột', async () => {
  const { db, env } = moiTruong();
  const id = themViec(db, 'Việc từng đang làm', 'tien_do=dang_lam');
  const dong = () => ({ ...db.prepare('SELECT trang_thai, tien_do FROM viec WHERE id = ?').get(id) });
  await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'xong' }) });
  assert.equal(dong().tien_do, 'dang_lam', 'đánh xong không xóa tiến độ');
  await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'mo' }) });
  assert.deepEqual(dong(), { trang_thai: 'mo', tien_do: null });
  await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'xong' }) });
  await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'mo', tien_do: 'cho_duyet' }) });
  assert.deepEqual(dong(), { trang_thai: 'mo', tien_do: 'cho_duyet' }, 'kéo từ Xong ra cột nào giữ đúng cột đó');
  await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'huy' }) });
  assert.equal(suyTrangThai({ ...dong() }, { tuLuc }), null);
});

test('API: không đụng được việc và tab của tổ chức khác', async () => {
  const { db, env } = moiTruong();
  const id = Number(db.prepare("INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc) VALUES ('tc2', 'Của khách khác', 'mo', 'x', 'x')").run().lastInsertRowid);
  assert.equal((await goiApi(env, `/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify({ tien_do: 'dang_lam' }) })).ma, 404);
  assert.equal(db.prepare('SELECT tien_do FROM viec WHERE id = ?').get(id).tien_do, null);
  await goiApi(env, '/api/viec/tab', { method: 'PUT', body: JSON.stringify({ tab: [{ id: 't1', ten: 'Riêng' }] }) });
  const tc2 = { ...phien, to_chuc: { id: 'tc2', vai_tro: 'chu' }, cac_to_chuc: [{ id: 'tc2' }] };
  assert.deepEqual((await goiApi(env, '/api/viec/tab', {}, tc2)).du.tab, [], 'cùng người dùng ở tổ chức khác không thấy tab');
  assert.equal((await goiApi(env, '/api/viec', {}, tc2)).du.viec.some((v) => v.tien_do), false);
});
