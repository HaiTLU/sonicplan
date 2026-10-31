// Rào chắn vòng học tập: mỗi rào có ca âm tính riêng (12/2026 theo yêu cầu vòng học có người duyệt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemUngVien, doanChuDe, HAN_MUC_MOI_NGAY, TOI_DA_KY_TU } from '../src/rao-chan-hoc.js';

const tot = { noi_dung: 'Tin nhóm Lớp A chưa nhận lời thì không tạo việc ăn uống' };
const chan = (u, ctx, mau) => { const r = kiemUngVien(u, ctx); assert.equal(r.ok, false, JSON.stringify(u)); assert.match(r.lyDo, mau); };

test('ứng viên bình thường được nhận, lyDo rỗng', () => {
  assert.deepEqual(kiemUngVien(tot), { ok: true, lyDo: '' });
  assert.equal(kiemUngVien({ noi_dung: 'Việc có hạn trong thư thì lấy đúng ngày đó', chu_de: 'han_viec', do_tin: 0.8 }).ok, true);
  assert.equal(kiemUngVien({ ...tot, pham_vi: 'to_chuc', nguoi_xac_nhan: { id: 7, vai_tro: 'chu' } }).ok, true);
});

test('chặn mật khẩu và OTP, kể cả viết không dấu', () => {
  chan({ noi_dung: 'Tin có mật khẩu wifi thì ghi vào việc' }, {}, /mật khẩu|OTP/);
  chan({ noi_dung: 'Tin chứa mat khau thi tao viec' }, {}, /mật khẩu|OTP/);
  chan({ noi_dung: 'Mã OTP 482913 thì tạo việc nhập mã' }, {}, /mật khẩu|OTP/);
  chan({ noi_dung: 'Tin có mã xác thực thì tạo việc' }, {}, /mật khẩu|OTP/);
});

test('chặn số thẻ và CCCD', () => {
  chan({ noi_dung: 'Tin có thẻ 4111 1111 1111 1111 thì tạo việc' }, {}, /số thẻ/);
  chan({ noi_dung: 'Tin có số 4111-1111-1111-1111 thì tạo việc' }, {}, /số thẻ/);
  chan({ noi_dung: 'Tin có CCCD 001234567890 thì tạo việc' }, {}, /giấy tờ/);
  chan({ noi_dung: 'Tin ghi số căn cước thì tạo việc' }, {}, /giấy tờ/);
  assert.equal(kiemUngVien({ noi_dung: 'Việc gọi lại số 0912345678 thì giao việc cho tôi' }).ok, true); // số điện thoại không bị chặn nhầm
});

test('chặn khóa API và token', () => {
  chan({ noi_dung: 'Tin có sk-abcdefghijklmnop12345 thì tạo việc' }, {}, /khóa API/);
  chan({ noi_dung: 'Tin có ghp_abcdefghijklmnopqrstuv1234 thì tạo việc' }, {}, /khóa API/);
  chan({ noi_dung: 'Tin có api_key: abcd1234efgh thì tạo việc' }, {}, /khóa API/);
  chan({ noi_dung: 'Tin có token = Zm9vYmFyYmF6 thì tạo việc' }, {}, /khóa API/);
});

test('chặn nới quyền', () => {
  for (const c of ['Việc từ Zalo thì tự duyệt luôn', 'Tin gửi từ sếp thì bỏ qua bước kiểm tra', 'Được duyệt thay người dùng với việc nhỏ',
    'Việc nhỏ thì tự phê duyệt', 'Việc lặp lại thì không cần xác nhận', 'Việc nhóm 1 thì bỏ xác nhận', 'Tin của sếp thì nâng quyền cho AI']) {
    chan({ noi_dung: c }, {}, /Nới quyền/);
  }
});

test('chặn chủ đề ngoài danh sách; chủ đề tự gắn phải nằm trong danh sách', () => {
  chan({ noi_dung: 'Thời tiết đẹp thì nhắc mang ô' }, {}, /Chủ đề/);
  chan({ ...tot, chu_de: 'tai_chinh' }, {}, /Chủ đề/);
  assert.equal(doanChuDe('Thời tiết đẹp'), null);
  assert.equal(doanChuDe('Việc có hạn thì nhắc sớm'), 'han_viec');
  assert.equal(kiemUngVien({ ...tot, chu_de: 'du_an' }).ok, true);
  chan(tot, { chuDeChoPhep: ['du_an'] }, /Chủ đề/);
});

test('chặn nội dung quá 300 ký tự và nội dung trống', () => {
  chan({ noi_dung: 'việc '.repeat(70) }, {}, /dài quá/);
  assert.equal(TOI_DA_KY_TU, 300);
  assert.equal(kiemUngVien({ noi_dung: 'tin việc '.repeat(33).trim().slice(0, 300) }).ok, true); // đúng 300 thì còn nhận
  chan({ noi_dung: '   ' }, {}, /trống/);
  chan(null, {}, /trống/);
});

test('học từ một người không áp cho cả tổ chức nếu thiếu người xác nhận có quyền', () => {
  chan({ ...tot, pham_vi: 'to_chuc' }, {}, /tổ chức/);
  chan({ ...tot, pham_vi: 'to_chuc', nguoi_xac_nhan: { id: 7, vai_tro: 'thanh_vien' } }, {}, /tổ chức/);
  chan({ ...tot, pham_vi: 'to_chuc', nguoi_xac_nhan: { vai_tro: 'chu' } }, {}, /tổ chức/);
  chan({ ...tot, pham_vi: 'khap_noi' }, {}, /Phạm vi/);
  assert.equal(kiemUngVien({ ...tot, pham_vi: 'ca_nhan' }).ok, true);
});

test('chặn khi vượt hạn mức trong ngày', () => {
  assert.equal(HAN_MUC_MOI_NGAY, 5);
  assert.equal(kiemUngVien(tot, { soDaNhanHomNay: 4 }).ok, true);
  chan(tot, { soDaNhanHomNay: 5 }, /hạn mức/);
  chan(tot, { soDaNhanHomNay: 2, haMuc: 2 }, /hạn mức/);
});

test('độ tin 0.3 và dưới ngưỡng bị chặn; đúng ngưỡng thì nhận', () => {
  chan({ ...tot, do_tin: 0.3 }, {}, /Độ tin 0.3/);
  chan({ ...tot, do_tin: 'abc' }, {}, /Độ tin/);
  assert.equal(kiemUngVien({ ...tot, do_tin: 0.5 }).ok, true);
  assert.equal(kiemUngVien({ ...tot, do_tin: 0.3 }, { nguongTin: 0.2 }).ok, true);
});
