import test from 'node:test';
import assert from 'node:assert/strict';
import { boSungHan, docNgayGio, gioTuChu, ngayChoGio } from '../src/ngay-viet.js';

const T2 = '2026-10-12T05:12:00Z'; // thứ Hai 12/10/2026, 12:12 giờ Việt Nam

test('các dạng ngày tuyệt đối', () => {
  for (const [chu, han] of [
    ['Đi siêu âm lúc 18:15 ngày 13/10 tại 125 Thái Thịnh', '2026-10-13'],
    ['nộp báo cáo 13-10', '2026-10-13'],
    ['họp ngày 13 tháng 10', '2026-10-13'],
    ['họp 5 tháng 11 lúc 9h', '2026-11-05'],
    ['hạn 15/10/2026', '2026-10-15'],
    ['hạn 15.10', '2026-10-15'],
    ['nộp ngày 3/1', '2027-01-03'], // đã qua quá lâu, lấy năm sau
  ]) assert.equal(docNgayGio(chu, T2).han_ngay, han, chu);
  assert.equal(docNgayGio('ngày 31/2', T2).han_ngay, null);
  assert.equal(docNgayGio('lúc 18:15 xong', T2).han_ngay, null);
});

test('các dạng ngày tương đối', () => {
  for (const [chu, han] of [
    ['gọi lại sáng mai', '2026-10-13'],
    ['ngày mai nộp', '2026-10-13'],
    ['ngày kia họp', '2026-10-14'],
    ['mốt đi công tác', '2026-10-14'],
    ['chiều nay gửi', '2026-10-12'],
    ['thứ 3 họp', '2026-10-13'],
    ['thứ Sáu nộp', '2026-10-16'],
    ['thứ hai họp', '2026-10-19'],
    ['chủ nhật đi', '2026-10-18'],
    ['thứ 3 tuần sau họp', '2026-10-20'],
    ['thứ Sáu tuần sau', '2026-10-23'],
    ['chủ nhật tuần sau', '2026-10-25'],
  ]) assert.equal(docNgayGio(chu, T2).han_ngay, han, chu);
});

test('các dạng giờ', () => {
  for (const [chu, gio] of [['lúc 18:15', '18:15'], ['18h15', '18:15'], ['18h', '18:00'], ['6 giờ chiều', '18:00'], ['6h30 tối', '18:30'], ['9 giờ sáng', '09:00'], ['14 giờ', '14:00'], ['trước 14h chiều nay', '14:00'], ['2h chiều', '14:00'], ['12h trưa', '12:00']]) assert.equal(gioTuChu(chu), gio, chu);
  assert.equal(gioTuChu('có 3 việc'), null);
});

test('có giờ mà không có ngày: hôm nay, hoặc mai nếu giờ đã qua', () => {
  assert.equal(ngayChoGio('18:15', T2), '2026-10-12');
  assert.equal(ngayChoGio('09:00', T2), '2026-10-13');
  assert.equal(boSungHan({ tieu_de: 'Gọi khách', gio_hen: '16:00' }, '', T2).han_ngay, '2026-10-12');
  assert.equal(boSungHan({ tieu_de: 'Gọi khách lúc 9h' }, '', T2).han_ngay, '2026-10-13');
});

test('việc "Đi siêu âm lúc 18:15 ngày 13/10": AI chỉ trả giờ vẫn có hạn; ngày ghi rõ thắng ngày AI đoán', () => {
  const v = boSungHan({ tieu_de: 'Đi siêu âm lúc 18:15 ngày 13/10 tại 125 Thái Thịnh', han_ngay: null, gio_hen: '18:15' }, '', T2);
  assert.deepEqual([v.han_ngay, v.gio_hen], ['2026-10-13', '18:15']);
  assert.equal(boSungHan({ tieu_de: 'Nộp báo cáo 15/10', han_ngay: '2026-10-12' }, '', T2).han_ngay, '2026-10-15');
  assert.equal(boSungHan({ tieu_de: 'Gọi lại thầy Khẩn', han_ngay: null }, 'Chắc sáng mai a gọi lại', T2).han_ngay, '2026-10-13');
  assert.equal(boSungHan({ tieu_de: 'Xem lại hồ sơ' }, 'không có ngày', T2).han_ngay, undefined);
  // Dễ đọc nhầm: "2-3 bên", phân số, thư dài, ghi chú nhắc ngày khác
  assert.equal(boSungHan({ tieu_de: 'Tìm 2-3 đơn vị tương đương để lấy báo giá' }, '', T2).han_ngay, undefined);
  assert.equal(boSungHan({ tieu_de: 'Review tờ trình', ghi_chu: 'hội thảo ngày 28/10' }, 'x'.repeat(400) + ' 15/10 11:33', T2).han_ngay, undefined);
  assert.equal(boSungHan({ tieu_de: 'Họp', han_ngay: '2026-10-20', gio_hen: '09:00' }, '', T2).han_ngay, '2026-10-20');
});

test('giờ 1-6 viết trống không là buổi chiều: "a 5h30 nhé" gửi 11:39 là 17:30 hôm đó', () => {
  const luc = '2026-10-18T04:39:00Z'; // 11:39 giờ Việt Nam
  for (const [chu, gio] of [['a 5h30 nhé', '17:30'], ['4 giờ họp', '16:00'], ['6h sáng', '06:00'], ['sáng mai 5h', '05:00'], ['9h', '09:00'], ['0h', '00:00']]) assert.equal(gioTuChu(chu), gio, chu);
  assert.deepEqual(boSungHan({ tieu_de: 'Qua tập với Văn' }, 'a 5h30 nhé', luc), { tieu_de: 'Qua tập với Văn', gio_hen: '17:30', han_ngay: '2026-10-18' });
  // AI đọc thành 05:30 thì sửa theo chữ gốc, không đẩy sang 5h30 sáng mai.
  assert.deepEqual(boSungHan({ tieu_de: 'Qua tập với Văn', gio_hen: '05:30' }, 'a 5h30 nhé', luc), { tieu_de: 'Qua tập với Văn', gio_hen: '17:30', han_ngay: '2026-10-18' });
  assert.equal(boSungHan({ tieu_de: 'Chạy bộ', gio_hen: '05:30' }, '5h30 sáng mai chạy', luc).gio_hen, '05:30');
});
