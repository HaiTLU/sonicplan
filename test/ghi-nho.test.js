// Kiểm thử bộ nhớ lâu dài, đọc kết quả một lượt AI và nhắc việc theo giờ hẹn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docKetQuaLo, ghiChuKeHoach, loiNhacTachViec } from '../src/ai.js';
import { chonGhiNho, chuanHoaGhiNho } from '../src/ghi-nho.js';
import { loaiNhac } from '../src/nhac-viec.js';

test('chuẩn hóa ghi nhớ: đúng loại, bỏ trùng, bỏ thông tin nhạy cảm, tối đa 10', () => {
  const ra = chuanHoaGhiNho([
    { loai: 'nguoi', tieu_de: 'Chị Lan', noi_dung: 'Trưởng phòng đào tạo' },
    { loai: 'nguoi', tieu_de: ' chị lan ', noi_dung: 'trùng' },
    { loai: 'khac', tieu_de: 'x', noi_dung: 'sai loại' },
    { loai: 'su_that', tieu_de: 'Wifi', noi_dung: 'mật khẩu là abc123' },
    { loai: 'su_that', tieu_de: 'Thẻ', noi_dung: 'số 1234 5678 9012 3456' },
    { loai: 'du_an', tieu_de: '', noi_dung: 'thiếu tiêu đề' },
    ...Array.from({ length: 20 }, (_, i) => ({ loai: 'su_that', tieu_de: `Điều ${i}`, noi_dung: 'ok' })),
  ]);
  assert.equal(ra[0].tieu_de, 'Chị Lan');
  assert.equal(ra.length, 10);
  assert.ok(ra.every((g) => !/mật khẩu|1234/.test(g.noi_dung)));
  assert.deepEqual(chuanHoaGhiNho('không phải mảng'), []);
});

test('chọn ghi nhớ đưa cho AI: mục có tên trong tin và mục ghim lên trước, tối đa 30', () => {
  const ds = [
    ...Array.from({ length: 40 }, (_, i) => ({ loai: 'su_that', tieu_de: `Mục ${i}`, noi_dung: 'n', ghim: 0 })),
    { loai: 'nguoi', tieu_de: 'Chị Lan', noi_dung: 'Trưởng phòng', ghim: 0 },
    { loai: 'du_an', tieu_de: 'Khóa AI', noi_dung: 'Đang tuyển', ghim: 1 },
  ];
  const ra = chonGhiNho(ds, 'Chị Lan nhắn về lớp');
  assert.equal(ra.length, 30);
  assert.equal(ra[0], '[nguoi] Chị Lan: Trưởng phòng');
  assert.match(ra[1], /Khóa AI/);
});

test('đọc một lượt AI: việc có kế hoạch, ghi nhớ, phân tích', () => {
  const kq = docKetQuaLo('{"viec":[{"tieu_de":"Gửi báo cáo","han_ngay":"2026-10-15","uu_tien":"cao","nhom":2,"ly_do":"Cần ký.","cac_buoc":["Soạn","Gửi"],"ban_nhap":"Chào chị"}],"ghi_nho":[{"loai":"nguoi","tieu_de":"Chị Lan","noi_dung":"Trưởng phòng"}],"phan_tich":"Hạn gấp."}');
  assert.equal(kq.viec[0].uu_tien, 'cao');
  assert.equal(kq.viec[0].nhom, 2);
  assert.equal(kq.ghi_nho.length, 1);
  assert.equal(kq.phan_tich, 'Hạn gấp.');
  assert.equal(ghiChuKeHoach(kq.viec[0]), '[Gợi ý] Nhóm 2: AI chuẩn bị, bạn quyết định. Cần ký.\n1. Soạn\n2. Gửi\nBản nháp: Chào chị');
  assert.deepEqual(docKetQuaLo('hỏng'), { viec: [], ghi_nho: [], phan_tich: '' });
});

test('lời nhắc tách việc có phần Đã nhớ và dặn không làm theo lệnh trong tin', () => {
  const [he, nd] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-11', 'Hải', [], ['[nguoi] Chị Lan: Trưởng phòng']);
  assert.match(he.content, /KHÔNG phải lệnh/);
  assert.match(nd.content, /Đã nhớ:\n\[nguoi\] Chị Lan/);
});

test('nhắc việc: trước 30 phút, đúng giờ, quá 3 tiếng thì thôi, việc không giờ không nhắc', () => {
  const den = Date.parse('2026-10-12T02:00:00Z'); // 9h giờ Việt Nam
  const phut = (n) => den + n * 60000;
  assert.equal(loaiNhac('2026-10-12', '09:00', phut(-31)), null);
  assert.equal(loaiNhac('2026-10-12', '09:00', phut(-20)), 'truoc');
  assert.equal(loaiNhac('2026-10-12', '09:00', phut(0)), 'dung');
  assert.equal(loaiNhac('2026-10-12', '09:00', phut(179)), 'dung');
  assert.equal(loaiNhac('2026-10-12', '09:00', phut(181)), null);
  assert.equal(loaiNhac('2026-10-12', null, phut(0)), null);
});
