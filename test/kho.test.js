// Kiểm thử phần thuần của Drive kho: địa chỉ đăng nhập và văn bản lưu sang Drive. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemQuyTac, phanLoaiTep, taoDiaChiDangNhapKho, tenPhanLoai, vanBanBoNho, vanBanTinNgay, vanBanViec } from '../src/kho.js';

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

const QUY_TAC = kiemQuyTac([
  { thu_muc: '01_DaoTaoNganHan', mau: ['dao tao ngan han'] },
  { thu_muc: '02_NCS-K5', mau: ['ncs', 'trien khai bt nhom'], anh_con: 'Hinh-anh' },
  { thu_muc: '03_HopTac-SuKien', mau: ['hdht', 'thoa thuan hop tac'] },
]);

test('tên mới có tiền tố nguồn, ngày, nhóm; giữ phần mở rộng', () => {
  assert.equal(
    tenPhanLoai({ ten: '261012_Zalo_Triển khai BT nhóm_Bài luận nghiên cứu đầu vào_Hoàng Văn Hưởng .docx', nhom: 'Triển khai BT nhóm', nguon: 'zalo' }),
    '[Zalo] 261012 Triển khai BT nhóm - Bài luận nghiên cứu đầu vào_Hoàng Văn Hưởng .docx',
  );
  assert.equal(tenPhanLoai({ ten: 'bao-gia.pdf', nguon: 'gmail', tao_luc: '2026-10-12T05:00:00.000Z' }), '[Gmail] 261012 bao-gia.pdf');
  const dai = tenPhanLoai({ ten: `261012_Zalo_${'a'.repeat(400)}.docx`, nguon: 'zalo' });
  assert.ok(dai.length <= 196 && dai.endsWith('.docx'));
});

test('phân loại theo nhóm và tên tệp, ảnh vào thư mục con, ảnh nhỏ bị bỏ, không khớp thì cần xem', () => {
  const lop = (ten, nhom, kich = 200000) => phanLoaiTep({ ten, nhom, kich_thuoc: kich, nguon: 'zalo' }, QUY_TAC);
  assert.deepEqual(lop('261012_Zalo_TTC - Đào tạo Ngắn hạn_IIGxTLU_Kế hoạch workshop 30.10.pdf', 'TTC - Đào tạo Ngắn hạn').duong_dan, ['01_DaoTaoNganHan']);
  assert.deepEqual(lop('261012_Zalo_Triển khai BT nhóm_huonghv.docx', 'Triển khai BT nhóm').duong_dan, ['02_NCS-K5']);
  assert.deepEqual(lop('261011_Zalo_NCS_K5_TLU T_anh_135824.jpg', 'NCS_K5_TLU\\T').duong_dan, ['02_NCS-K5', 'Hinh-anh']);
  assert.deepEqual(lop('261012_Zalo_Hong Nguyen_260924-HDHT tổ chức cuộc thi-rvbyPCTLU.docx', null).duong_dan, ['03_HopTac-SuKien']);
  assert.deepEqual(lop('261011_Zalo_GLA Mỹ Đình_anh_183053.jpg', 'GLA Mỹ Đình').duong_dan, ['99_CanXem']);
  assert.equal(lop('sticker.jpg', 'NCS', 20000).bo_qua, true);
  assert.equal(lop('quy-dinh.pdf', 'NCS', 20000).bo_qua, undefined);
  assert.deepEqual(kiemQuyTac('hỏng'), []);
});
