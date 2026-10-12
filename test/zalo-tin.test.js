import test from 'node:test';
import assert from 'node:assert/strict';
import { phanTichTin, tachLienKet, nhanTep } from '../public/zalo-tin.js';
import { docDiaChiNgoai, choPhepMayChu } from '../src/zalo-ngoai.js';

test('ảnh, tệp, thu hồi, nhãn dán, bình chọn', () => {
  assert.deepEqual(phanTichTin('[chat.photo] https://photo-stal-30.zdn.vn/gr/jpg/a.jpg'), { kieu: 'anh', url: 'https://photo-stal-30.zdn.vn/gr/jpg/a.jpg' });
  const t = phanTichTin('[share.file] Thùy Trang_Bài 24.pptx - https://file-stal-19.dlfl.vn/gr/x/AgHc');
  assert.equal(t.kieu, 'tep-ngoai');
  assert.equal(t.ten, 'Thùy Trang_Bài 24.pptx');
  assert.equal(phanTichTin('[chat.undo]').kieu, 'thu-hoi');
  assert.equal(phanTichTin('[chat.sticker]').kieu, 'nhan-dan');
  assert.equal(phanTichTin('[group.poll]').kieu, 'binh-chon');
  assert.equal(phanTichTin('Chào anh').kieu, 'chu');
});

test('thẻ liên kết, danh thiếp, cuộc gọi', () => {
  const the = phanTichTin('[chat.recommended] https://oic.vinuni.edu.vn/call-for-papers/ - We are pleased to invite submissions. - https://oic.vinuni.edu.vn/call-for-papers/');
  assert.equal(the.kieu, 'the-lien-ket');
  assert.equal(the.mien, 'oic.vinuni.edu.vn');
  assert.match(the.mo_ta, /pleased to invite/);
  const dt = phanTichTin('[chat.recommended] Nguyễn Văn An - {"phone":"081 3615206","caption":"x","qrCodeUrl":"https:\\/\\/qr.jpg"} - https://zaloapp.com');
  assert.deepEqual([dt.kieu, dt.ten, dt.dien_thoai], ['danh-thiep', 'Nguyễn Văn An', '081 3615206']);
  assert.equal(phanTichTin('[chat.recommended] sendBubbleMessage - Cuộc gọi').chu, 'Cuộc gọi');
});

test('chữ có liên kết được tách, bỏ dấu câu cuối', () => {
  assert.deepEqual(tachLienKet('Xem https://a.vn/x, rồi nhé'), [{ chu: 'Xem ' }, { url: 'https://a.vn/x' }, { chu: ', rồi nhé' }]);
  assert.deepEqual(nhanTep('Báo giá.PDF'), { nhan: 'PDF', nhom: 'pdf' });
});

test('chỉ tải từ máy chủ Zalo', () => {
  assert.equal(choPhepMayChu('https://photo-stal-30.zdn.vn/a.jpg'), true);
  assert.equal(choPhepMayChu('https://evil.example/zdn.vn'), false);
  assert.equal(choPhepMayChu('http://photo.zdn.vn/a.jpg'), false);
  assert.equal(choPhepMayChu('https://zdn.vn.evil.com/a'), false);
  assert.deepEqual(docDiaChiNgoai('[share.file] a b.docx - https://f.dlfl.vn/x'), { kieu: 'tep', url: 'https://f.dlfl.vn/x', ten: 'a b.docx' });
  assert.equal(docDiaChiNgoai('xin chào'), null);
});

test('dòng xem nhanh: tin đặc biệt thành câu ngắn', async () => {
  const { trichTin } = await import('../public/zalo-tin.js');
  assert.equal(trichTin('[chat.photo] https://photo-stal-16.zdn.vn/gr/jpg/abc.jpg'), 'Đã gửi một ảnh');
  assert.equal(trichTin('[chat.recommended] sendBubbleMessage - Tiêu đề - mô tả - https://a.vn/x'), 'Liên kết: Tiêu đề');
  assert.equal(trichTin('Gửi tệp: 261012_anh.jpg\nghi chú'), 'Đã gửi tệp: 261012_anh.jpg');
  assert.equal(trichTin('[chat.recommended] sendBubbleMessage'), '');
  assert.equal(trichTin('xin chào'), 'xin chào');
});
