// Kiểm thử phần thuần của Drive kho: địa chỉ đăng nhập và văn bản lưu sang Drive. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoDiaChiDangNhapKho, vanBanBoNho, vanBanTinNgay, vanBanViec } from '../src/kho.js';

test('đăng nhập Drive kho: chỉ xin quyền Drive hẹp và cho chọn tài khoản', () => {
  const u = new URL(taoDiaChiDangNhapKho('abc.apps.googleusercontent.com', 'https://plan.example/api/google/goi-lai', 'tt1'));
  const scope = u.searchParams.get('scope').split(' ');
  assert.deepEqual(scope, ['openid', 'email', 'https://www.googleapis.com/auth/drive.file']);
  assert.equal(u.searchParams.get('prompt'), 'consent select_account');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('state'), 'tt1');
});

test('tin trong ngày thành một tệp, giờ Việt Nam, cắt tin quá dài', () => {
  const van = vanBanTinNgay('zalo', '2026-10-12', [
    { nguoi_gui: 'An', nhom: 'Lớp AI', tieu_de: null, noi_dung: 'Chào', thoi_diem: '2026-10-12T02:05:00.000Z' },
    { nguoi_gui: null, nhom: null, tieu_de: 'Báo giá', noi_dung: 'x'.repeat(7000), thoi_diem: '2026-10-12T17:30:00.000Z' },
  ]);
  assert.match(van, /^# Tin nhắn Zalo ngày 2026-10-12/);
  assert.match(van, /## 09:05 - An \(nhóm Lớp AI\)/);
  assert.match(van, /## 00:30 - \(không rõ người gửi\)/);
  assert.match(van, /Tiêu đề: Báo giá/);
  assert.ok(van.length < 7000);
  assert.match(vanBanTinNgay('gmail', '2026-10-12', []), /^# Thư Gmail ngày/);
});

test('bộ nhớ AI: hồ sơ, ghi nhớ theo loại, không có giờ hiện tại nên nội dung ổn định', () => {
  const ghi = [
    { loai: 'du_an', tieu_de: 'Sonicplan', noi_dung: 'Nền tảng\ntự động', ghim: 1, da_duyet: 1 },
    { loai: 'nguoi', tieu_de: 'Lan', noi_dung: 'Kế toán', ghim: 0, da_duyet: 0 },
  ];
  const van = vanBanBoNho('Tôi là PM', ghi);
  assert.match(van, /## Hồ sơ\n\nTôi là PM/);
  assert.match(van, /### Người\n\n- \*\*Lan\*\* \(chờ duyệt\): Kế toán/);
  assert.match(van, /### Dự án\n\n- \*\*Sonicplan\*\* \(ghim\): Nền tảng tự động/);
  assert.equal(van, vanBanBoNho('Tôi là PM', ghi));
  assert.match(vanBanBoNho('', []), /\(chưa có\)[\s\S]*\(chưa có\)/);
});

test('danh sách việc nhóm theo trạng thái, kèm hạn và giờ hẹn', () => {
  const van = vanBanViec([
    { tieu_de: 'Gửi báo cáo', ghi_chu: 'Bước 1\nBước 2', han_ngay: '2026-10-13', gio_hen: '09:00', trang_thai: 'mo' },
    { tieu_de: 'Họp xong', ghi_chu: null, han_ngay: null, gio_hen: null, trang_thai: 'xong' },
  ]);
  assert.match(van, /## Đang mở \(1\)\n\n- Gửi báo cáo - hạn 2026-10-13 09:00\n  Bước 1\n  Bước 2/);
  assert.match(van, /## Đã xong \(1\)\n\n- Họp xong/);
  assert.doesNotMatch(van, /Đã hủy/);
});
