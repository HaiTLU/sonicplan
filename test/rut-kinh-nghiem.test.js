import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { ghiHanhDong, docHanhDong } from '../src/nhat-ky-hanh-dong.js';
import { phanTichThoiQuen, loiDanTuThoiQuen, ghiTinHieuImLang, rutKinhNghiem, doHieuQuaLoiDan } from '../src/rut-kinh-nghiem.js';
import { themUngVienTuMau, docGoiYLoiDan } from '../src/loi-dan-tuan.js';
import { kiemUngVien, doanChuDe } from '../src/rao-chan-hoc.js';
import { apDungNutViec } from '../src/telegram.js';

const hd = (loai, nguon = 'zalo') => ({ loai, boi_canh: { nguon_viec: nguon } });
const lap = (loai, n, nguon) => Array.from({ length: n }, () => hd(loai, nguon));

test('đủ mẫu và đủ tỷ lệ thì ra thói quen', () => {
  const r = phanTichThoiQuen([...lap('nut_doi_mai', 6), ...lap('nut_xong', 2)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].ma, 'hay_doi');
  assert.equal(r[0].nguon, 'zalo');
});
test('nguồn lịch có nhãn tiếng Việt có dấu', () => {
  const r = phanTichThoiQuen(lap('nut_xong', 5, 'lich'));
  assert.equal(r[0].nhan, 'Việc Lịch thường được làm xong, giữ cách tách hiện tại');
});
test('thiếu mẫu thì không kết luận', () => {
  assert.deepEqual(phanTichThoiQuen(lap('nut_bo', 4)), []);
});
test('đủ mẫu nhưng tỷ lệ thấp thì không kết luận', () => {
  assert.deepEqual(phanTichThoiQuen([...lap('nut_bo', 5), ...lap('nut_xong', 6)]).filter((x) => x.ma === 'hay_bo'), []);
});
test('hai nguồn tách riêng', () => {
  const r = phanTichThoiQuen([...lap('web_huy', 5, 'gmail'), ...lap('nut_xong', 5, 'zalo')]);
  assert.deepEqual(r.map((x) => `${x.ma}:${x.nguon}`).sort(), ['hay_bo:gmail', 'on_dinh:zalo']);
});
test('mọi câu lời dặn sinh ra đều qua rào chắn và có chủ đề cho phép', () => {
  for (const ma of ['hay_doi', 'hay_bo', 'im_lang']) for (const nguon of ['zalo', 'gmail']) {
    const dong = loiDanTuThoiQuen({ ma, nguon });
    assert.ok(doanChuDe(dong), dong);
    assert.equal(kiemUngVien({ noi_dung: dong, do_tin: 0.3 }, { nguongTin: 0.3 }).ok, true, dong);
  }
  assert.equal(loiDanTuThoiQuen({ ma: 'hay_bo', nguon: 'tay' }), null);
  assert.equal(loiDanTuThoiQuen({ ma: 'on_dinh', nguon: 'zalo' }), null);
});

async function dung() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Thử', '2026-01-01T00:00:00Z')");
  return { env: { CSDL: d1(db) }, db };
}
const themViecThu = (db, id, nguon, taoLuc) => db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nguon, han_ngay, tao_luc, cap_nhat_luc) VALUES (?, 'tc1', 'Việc thử', 'mo', ?, '2026-11-10', ?, ?)").run(id, nguon, taoLuc, taoLuc);

test('nút Telegram dời mai ghi nhật ký kèm hạn trước và sau, không ghi tiêu đề', async () => {
  const { env, db } = await dung();
  themViecThu(db, 1, 'zalo', '2026-11-01T00:00:00Z');
  await apDungNutViec(env, 'tc1', { viec_id: 1, hanh_dong: 'mai' }, '2026-11-08T03:00:00Z');
  const r = await docHanhDong(env, 'tc1', '2026');
  assert.equal(r.length, 1);
  assert.equal(r[0].loai, 'nut_doi_mai');
  assert.equal(r[0].nguon, 'telegram');
  assert.equal(r[0].truoc, '2026-11-10');
  assert.equal(r[0].boi_canh.nguon_viec, 'zalo');
  assert.ok(!JSON.stringify(r[0]).includes('Việc thử'));
});
test('ghi lỗi không làm hỏng thao tác chính', async () => {
  assert.equal(await ghiHanhDong({ CSDL: { prepare: () => { throw new Error('hỏng'); } } }, 'tc1', { nguon: 'web', loai: 'x', boiCanh: null }), false);
});
test('im lặng: chỉ tính việc AI tạo sau mốc bắt đầu, đủ 7 ngày, chưa ai đụng, và không ghi lặp', async () => {
  const { env, db } = await dung();
  const bay = '2026-11-20T00:00:00Z';
  await ghiTinHieuImLang(env, 'tc1', '2026-11-01T00:00:00Z'); // đặt mốc bắt đầu
  themViecThu(db, 1, 'zalo', '2026-10-25T00:00:00Z'); // trước mốc: bỏ
  themViecThu(db, 2, 'zalo', '2026-11-05T00:00:00.000Z'); // đủ điều kiện (tao_luc có mili giây như toISOString thật)
  themViecThu(db, 6, 'zalo', '2026-11-05T00:00:00.000Z'); // có sự kiện sửa tên sau khi tạo: bỏ
  themViecThu(db, 3, 'tay', '2026-11-05T00:00:00Z'); // tự nhập: bỏ
  themViecThu(db, 4, 'zalo', '2026-11-18T00:00:00Z'); // quá mới: bỏ
  themViecThu(db, 5, 'gmail', '2026-11-05T00:00:00Z'); // đã có hành động: bỏ
  await ghiHanhDong(env, 'tc1', { nguon: 'web', loai: 'web_xong', viecId: 5 });
  // Việc AI tạo thật luôn có sự kiện 'tao' (và có thể 'nghi_trung') ghi sau tao_luc vài ms: không được coi là có người đụng tới.
  db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 2, 'tao', 'x', '2026-11-05T00:00:00.050Z')").run();
  db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 6, 'tao', 'x', '2026-11-05T00:00:00.050Z')").run();
  db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 6, 'sua_ten', 'x', '2026-11-06T00:00:00.000Z')").run();
  db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 2, 'nghi_trung', 'x', '2026-11-05T00:00:00.060Z')").run();
  assert.equal(await ghiTinHieuImLang(env, 'tc1', bay), 1);
  assert.equal(await ghiTinHieuImLang(env, 'tc1', bay), 0);
});
test('rút kinh nghiệm: ra thói quen, đề xuất vào danh sách chờ duyệt, chạy lại không trùng', async () => {
  const { env, db } = await dung();
  for (let i = 0; i < 6; i++) await ghiHanhDong(env, 'tc1', { nguon: 'telegram', loai: 'nut_bo', boiCanh: { nguon_viec: 'zalo' } });
  const rut = await rutKinhNghiem(env, 'tc1', '2026-11-08T16:00:00Z');
  assert.equal(rut.thoi_quen[0].ma, 'hay_bo');
  assert.equal(rut.loi_dan.length, 1);
  const them = await themUngVienTuMau(env, 'tc1', rut.loi_dan, '2026-11-08T16:00:00Z');
  assert.equal(them.length, 1);
  assert.equal((await docGoiYLoiDan(env, 'tc1')).ds.length, 1);
  assert.equal((await themUngVienTuMau(env, 'tc1', rut.loi_dan, '2026-11-08T16:00:00Z')).length, 0);
  assert.ok(db);
});
test('thói quen đếm số việc khác nhau: một việc dời nhiều lần không thành thói quen', () => {
  const dời = (viec, id) => ({ id, loai: 'nut_doi_mai', viec_id: viec, boi_canh: { nguon_viec: 'zalo' } });
  assert.equal(phanTichThoiQuen([1, 2, 3, 4, 5].map((i) => dời(1, i))).length, 0);
  const ra = phanTichThoiQuen([1, 2, 3, 4, 5].map((i) => dời(i, i)).concat([dời(1, 9)]));
  assert.equal(ra[0].so_lan, 5);
  assert.equal(ra[0].tong, 5);
  // Việc dời rồi xong: chỉ tính kết cục cuối (xong).
  const cuoi = phanTichThoiQuen([{ id: 1, loai: 'nut_doi_mai', viec_id: 1, boi_canh: { nguon_viec: 'zalo' } }, { id: 2, loai: 'nut_xong', viec_id: 1, boi_canh: { nguon_viec: 'zalo' } }], { mauToiThieu: 1 });
  assert.deepEqual(cuoi.map((x) => x.ma), ['on_dinh']);
});
test('ứng viên chứa bí mật bị rào chắn chặn', async () => {
  const { env } = await dung();
  assert.deepEqual(await themUngVienTuMau(env, 'tc1', ['Việc tạo từ tin Zalo có mật khẩu wifi thì ghi vào hạn việc.']), []);
});

test('đo hiệu quả lời dặn: giảm, không giảm, chưa đủ ngày hoặc thiếu mẫu', async () => {
  const { env, db } = await dung();
  const them = (id, taoLuc, sua) => {
    themViecThu(db, id, 'zalo', taoLuc);
    if (sua) db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', ?, 'sua_ten', 'x', ?)").run(id, taoLuc);
  };
  // Duyệt lúc 2026-10-01: 6 việc trước (4 sửa), 6 việc sau (1 sửa) thì giảm.
  for (let i = 1; i <= 6; i++) them(i, `2026-09-${17 + i}T01:00:00Z`, i <= 4);
  for (let i = 7; i <= 12; i++) them(i, `2026-10-${String(i - 5).padStart(2, '0')}T01:00:00Z`, i === 7);
  // Duyệt lúc 2026-10-20: chưa đủ 21 ngày tại 2026-11-01.
  const guiY = { ds: [], da_quyet: [
    { noi_dung: 'A', quyet: 'duyet', luc: '2026-10-01T00:00:00Z' },
    { noi_dung: 'B', quyet: 'bo', luc: '2026-10-01T00:00:00Z' },
    { noi_dung: 'C', quyet: 'duyet', luc: '2026-10-20T00:00:00Z' },
  ] };
  db.prepare("INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('tc1', 'goi_y_loi_dan', ?)").run(JSON.stringify(guiY));
  // Mới 15 ngày sau lúc duyệt: việc tạo ở ngày 13-14 chưa đủ 7 ngày để biết có bị sửa, nên chưa được kết luận.
  const som = await doHieuQuaLoiDan(env, 'tc1', '2026-10-16T00:00:00Z');
  assert.equal(som.find((x) => x.noi_dung === 'A').ket_luan, 'chua_du');
  let r = await doHieuQuaLoiDan(env, 'tc1', '2026-11-01T00:00:00Z');
  assert.deepEqual(r.map((x) => `${x.noi_dung}:${x.ket_luan}`), ['A:giam', 'C:chua_du']);
  // Thêm việc sau duyệt bị sửa nhiều thì thành không giảm.
  for (let i = 13; i <= 22; i++) them(i, `2026-10-${String(8 + (i % 6)).padStart(2, '0')}T01:00:00Z`, true);
  r = await doHieuQuaLoiDan(env, 'tc1', '2026-11-01T00:00:00Z');
  assert.equal(r[0].ket_luan, 'khong_giam');
  assert.equal(r[0].goi_y_go, true);
});
