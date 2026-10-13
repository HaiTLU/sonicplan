import test from 'node:test';
import assert from 'node:assert/strict';
import { timTinNguon } from '../src/viec.js';

const LO = [
  { id: 741, nguon: 'zalo', nguoi_gui: 'Nguyen Thi Thu Ha', noi_dung: 'Xem clip s đúng hay nhàm nhed' },
  { id: 742, nguon: 'zalo', nguoi_gui: 'Tôi', noi_dung: '@Nguyễn Văn Tuấn anh giúp em in 1 bộ hồ sơ để nộp lên Bộ giáo dục chiều nay ạ' },
  { id: 746, nguon: 'zalo', nguoi_gui: 'Tôi', noi_dung: 'Bản có chữ ký số rồi ạ' },
];

test('tin gốc của việc: ưu tiên tin_so, lô một tin, rồi tin trùng nhiều từ với tên việc', () => {
  assert.equal(timTinNguon({ tieu_de: 'Gì đó', tin_so: 3 }, LO).id, 746);
  assert.equal(timTinNguon({ tieu_de: 'Bất kỳ', tin_so: null }, [LO[0]]).id, 741);
  // AI bỏ trống tin_so: dò theo từ chung ("in", "hồ", "sơ")
  assert.equal(timTinNguon({ tieu_de: 'In hồ sơ', tin_so: null }, LO).id, 742);
  // tin_so sai (ngoài lô) cũng rơi về dò từ chung
  assert.equal(timTinNguon({ tieu_de: 'In hồ sơ', tin_so: 9 }, LO).id, 742);
});

test('tin gốc của việc: không đoán bừa khi chỉ chung một từ hay tên việc quá ngắn', () => {
  assert.equal(timTinNguon({ tieu_de: 'Họp bàn', tin_so: null }, LO), null);
  assert.equal(timTinNguon({ tieu_de: 'Nộp', tin_so: null }, LO), null);
  assert.equal(timTinNguon({ tieu_de: 'Gửi báo giá khách', tin_so: null }, LO), null);
});
