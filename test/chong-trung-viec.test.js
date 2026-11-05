// Ca kiểm thử chống trùng việc (05/11/2026): hành vi giữ nguyên và trạng thái "nghi trùng" thêm ở bước 2. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { docViecDaSua, khacDuAn, themViec, timNghiTrung, timTrung, viecGiongKhiThemTay } from '../src/viec.js';
import { doGiong } from '../src/tien-ich.js';

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}

const bay = () => new Date().toISOString();
const ngayTruoc = (n) => new Date(Date.now() - n * 86400000).toISOString();

function themSan(db, tieuDe, { trangThai = 'mo', xongLuc = null, taoLuc = bay() } = {}) {
  return Number(db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, xong_luc, tao_luc, cap_nhat_luc) VALUES ('tc1', ?, ?, ?, ?, ?)`)
    .run(tieuDe, trangThai, xongLuc, taoLuc, taoLuc).lastInsertRowid);
}
const dem = (db) => db.prepare('SELECT COUNT(*) AS n FROM viec').get().n;

test('hiện trạng: cùng ý nhưng diễn đạt khác thì không bị coi là trùng', () => {
  assert.ok(doGiong('Gửi hợp đồng cho đối tác', 'Chuyển bản ký cho đối tác') < 0.8);
  assert.equal(timTrung('Chuyển bản ký cho đối tác', [{ id: 1, tieu_de: 'Gửi hợp đồng cho đối tác' }]), null);
});

test('khác dự án: cùng tiêu đề nhưng hai dự án khác nhau thì tạo việc riêng', async () => {
  const { db, env } = moiTruong();
  db.exec("INSERT INTO du_an (to_chuc_id, ten, tao_luc) VALUES ('tc1', 'A', 'x'), ('tc1', 'B', 'x')");
  const [a, b] = db.prepare('SELECT id FROM du_an ORDER BY id').all().map((r) => r.id);
  const id = themSan(db, 'Rà soát hợp đồng nhà cung cấp');
  db.prepare('UPDATE viec SET du_an_id = ? WHERE id = ?').run(a, id);
  const r = await themViec(env, 'tc1', { tieu_de: 'Rà soát hợp đồng nhà cung cấp' }, { duAnId: b });
  assert.equal(r.trung, false);
  assert.equal(dem(db), 2);
  // Cùng dự án, hoặc một bên chưa có dự án, thì vẫn trùng như cũ.
  assert.equal((await themViec(env, 'tc1', { tieu_de: 'Rà soát hợp đồng nhà cung cấp' }, { duAnId: a })).trung, true);
  assert.equal((await themViec(env, 'tc1', { tieu_de: 'Rà soát hợp đồng nhà cung cấp' })).trung, true);
});

test('khacDuAn: chỉ khác khi cả hai bên đều có dự án', () => {
  assert.equal(khacDuAn(1, 2), true);
  assert.equal(khacDuAn(1, 1), false);
  assert.equal(khacDuAn(null, 2), false);
  assert.equal(khacDuAn(1, undefined), false);
});

test('trùng việc vừa xong trong 3 ngày: không tạo mới, để lại dấu trong lịch sử việc cũ', async () => {
  const { db, env } = moiTruong();
  const id = themSan(db, 'Nộp báo cáo kinh phí quý 3', { trangThai: 'xong', xongLuc: ngayTruoc(1) });
  const r = await themViec(env, 'tc1', { tieu_de: 'Nộp báo cáo kinh phí quý 3', han_ngay: '2099-01-01' });
  assert.deepEqual(r, { id, trung: true, trung_xong: true });
  assert.equal(dem(db), 1);
  const sk = db.prepare("SELECT viec_id, noi_dung FROM viec_su_kien WHERE loai = 'tin_trung_xong'").all();
  assert.equal(sk.length, 1);
  assert.equal(sk[0].viec_id, id);
});

test('hiện trạng: việc đã xong quá 3 ngày thì tạo việc mới', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Nộp báo cáo kinh phí quý 3', { trangThai: 'xong', xongLuc: ngayTruoc(5) });
  const r = await themViec(env, 'tc1', { tieu_de: 'Nộp báo cáo kinh phí quý 3' });
  assert.equal(r.trung, false);
  assert.equal(dem(db), 2);
});

test('hiện trạng: việc mở tạo hơn 60 ngày trước không còn được so', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Chuẩn bị tài liệu tập huấn', { taoLuc: ngayTruoc(61) });
  const r = await themViec(env, 'tc1', { tieu_de: 'Chuẩn bị tài liệu tập huấn' });
  assert.equal(r.trung, false);
});

test('hiện trạng: thêm tay (boQuaTrung) luôn tạo việc mới dù trùng', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Gửi báo giá cho chị Lan');
  const r = await themViec(env, 'tc1', { tieu_de: 'Gửi báo giá cho chị Lan' }, { boQuaTrung: true, nguon: 'tay' });
  assert.equal(r.trung, false);
  assert.equal(dem(db), 2);
});

test('hiện trạng: cùng cuộc trò chuyện hạ ngưỡng xuống 0,65', () => {
  const ds = [{ id: 7, tieu_de: 'Gửi báo giá cho chị Lan', nguon_khoa: 'nhom-a' }];
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds, 'nhom-a')?.id, 7);
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds, 'nhom-b'), null);
});

test('nghi trùng: giống từ 0,55 đến dưới ngưỡng thì tạo việc kèm sự kiện và gợi ý việc cũ', async () => {
  const { db, env } = moiTruong();
  const cu = themSan(db, 'Gửi hợp đồng cho đối tác');
  const tieuDe = 'Gửi bản hợp đồng đã ký cho phòng kế toán';
  const diem = doGiong('Gửi hợp đồng cho đối tác', tieuDe);
  assert.ok(diem >= 0.55 && diem < 0.8, `điểm ${diem} phải nằm trong vùng nghi trùng`);
  const r = await themViec(env, 'tc1', { tieu_de: tieuDe });
  assert.equal(r.trung, false);
  assert.equal(r.nghi_trung.id, cu);
  assert.equal(dem(db), 2);
  const sk = db.prepare("SELECT viec_id, noi_dung FROM viec_su_kien WHERE loai = 'nghi_trung'").all();
  assert.equal(sk.length, 1);
  assert.equal(sk[0].viec_id, r.id);
  assert.match(sk[0].noi_dung, new RegExp(`#${cu}`));
});

test('nghi trùng: việc khác hẳn thì không gắn cờ', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Gửi hợp đồng cho đối tác');
  const r = await themViec(env, 'tc1', { tieu_de: 'Chuẩn bị phòng học cho khóa Marketing' });
  assert.equal(r.trung, false);
  assert.equal(r.nghi_trung, undefined);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM viec_su_kien WHERE loai = 'nghi_trung'").get().n, 0);
});

test('timNghiTrung: bỏ việc đã xong và việc khác dự án', () => {
  const ds = [
    { id: 1, tieu_de: 'Gửi hợp đồng cho đối tác', trang_thai: 'xong' },
    { id: 2, tieu_de: 'Gửi hợp đồng cho đối tác', trang_thai: 'mo', du_an_id: 5 },
  ];
  const t = 'Gửi bản hợp đồng đã ký cho phòng kế toán';
  assert.equal(timNghiTrung(t, ds, null, 6), null);
  assert.equal(timNghiTrung(t, ds, null, 5)?.id, 2);
  assert.equal(timNghiTrung(t, ds, null, null)?.id, 2);
});

test('thêm tay trùng việc đang mở: cảnh báo kèm danh sách việc giống, không chặn', async () => {
  const { db, env } = moiTruong();
  const cu = themSan(db, 'Gửi báo giá cho chị Lan');
  const giong = await viecGiongKhiThemTay(env, 'tc1', 'Gửi báo giá cho chị Lan');
  assert.equal(giong.length, 1);
  assert.equal(giong[0].id, cu);
  assert.deepEqual(await viecGiongKhiThemTay(env, 'tc1', 'Dọn kho thiết bị'), []);
});

test('vòng học: việc bị hủy sau khi bị gắn cờ nghi trùng thì dòng học ghi rõ, việc hủy thường thì không', async () => {
  const { db, env } = moiTruong();
  db.exec("INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, noi_dung, thoi_diem, tao_luc) VALUES (1,'tc1','zalo','m1','Gửi bản hợp đồng đã ký','x','x')");
  db.exec("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, tin_nhan_id, nguon, tao_luc, cap_nhat_luc) VALUES (1,'tc1','Gửi bản hợp đồng đã ký','huy',1,'zalo','x','x'),(2,'tc1','Việc huỷ thường','huy',1,'zalo','x','x')");
  const luc = bay();
  const ev = db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', ?, ?, ?, ?)");
  ev.run(1, 'nghi_trung', 'Có thể trùng việc #9 "Gửi hợp đồng cho đối tác" (giống 62%)', luc);
  ev.run(1, 'huy', 'Gửi bản hợp đồng đã ký', luc);
  ev.run(2, 'huy', 'Việc huỷ thường', luc);
  const ds = await docViecDaSua(env, 'tc1');
  assert.equal(ds.length, 2);
  const co = ds.find((d) => d.startsWith('- Hủy việc: "Gửi bản hợp đồng đã ký"'));
  const khong = ds.find((d) => d.startsWith('- Hủy việc: "Việc huỷ thường"'));
  assert.match(co, /từng bị gắn cờ nghi trùng: "Có thể trùng việc #9/);
  assert.doesNotMatch(khong, /nghi trùng/);
});

test.todo('nghi trùng: người dùng bấm gộp hoặc giữ cả hai thì ghi sự kiện cho vòng học (cần giao diện, làm ở bước sau)');

// ---- Giao diện: cờ nghi trùng trong danh sách việc, giữ cả hai, gộp ----
import { xuLyApi } from '../src/api.js';

const phien = { email: 'a@vi-du.vn', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc1', vai_tro: 'chu' }, cac_to_chuc: [{ id: 'tc1' }] };
async function goiApi(env, duong, tuyChon = {}) {
  const url = new URL(`http://x${duong}`);
  const kq = await xuLyApi(new Request(url, tuyChon), env, phien, url);
  return { ma: kq.status, du: await kq.json() };
}

test('danh sách việc có nghi_trung; giữ cả hai thì cờ biến mất, chỉ gọi được khi đang có cờ', async () => {
  const { db, env } = moiTruong();
  const cu = themSan(db, 'Gửi hợp đồng cho đối tác');
  const moi = (await themViec(env, 'tc1', { tieu_de: 'Gửi bản hợp đồng đã ký cho phòng kế toán' })).id;
  const ds = (await goiApi(env, '/api/viec')).du.viec;
  assert.match(ds.find((v) => v.id === moi).nghi_trung, new RegExp(`#${cu}`));
  assert.equal(ds.find((v) => v.id === cu).nghi_trung, null);

  // Việc không có cờ: 409, việc không tồn tại: 404.
  assert.equal((await goiApi(env, `/api/viec/${cu}/giu-ca-hai`, { method: 'POST' })).ma, 409);
  assert.equal((await goiApi(env, '/api/viec/9999/giu-ca-hai', { method: 'POST' })).ma, 404);

  assert.equal((await goiApi(env, `/api/viec/${moi}/giu-ca-hai`, { method: 'POST' })).ma, 200);
  const sau = (await goiApi(env, '/api/viec')).du.viec;
  assert.equal(sau.find((v) => v.id === moi).nghi_trung, null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM viec_su_kien WHERE loai = 'giu_ca_hai' AND viec_id = ?").get(moi).n, 1);
  // Bấm lần hai khi cờ đã gỡ: không ghi thêm.
  assert.equal((await goiApi(env, `/api/viec/${moi}/giu-ca-hai`, { method: 'POST' })).ma, 409);
});

test('gộp: hủy việc mới kèm lý do trùng thì dòng học của vòng học có cả lý do lẫn cờ nghi trùng', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Gửi hợp đồng cho đối tác');
  db.exec("INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, noi_dung, thoi_diem, tao_luc) VALUES (1,'tc1','zalo','m1','Gửi bản hợp đồng đã ký','x','x')");
  const moi = (await themViec(env, 'tc1', { tieu_de: 'Gửi bản hợp đồng đã ký cho phòng kế toán' }, { tinNhanId: 1, nguon: 'zalo' })).id;
  const kq = await goiApi(env, `/api/viec/${moi}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'huy', ly_do: 'Trùng việc #1' }) });
  assert.equal(kq.ma, 200);
  const ds = await docViecDaSua(env, 'tc1');
  assert.equal(ds.length, 1);
  assert.match(ds[0], /lý do: "Trùng việc #1"/);
  assert.match(ds[0], /từng bị gắn cờ nghi trùng/);
});
