// Kiểm thử cài đặt luồng: giá trị mặc định, kiểm giới hạn, giờ yên lặng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KHAU_BAT_TAT, NGUONG, dangYenLang, kiemBoCuc } from '../src/luong.js';
import { loaiNhac } from '../src/nhac-viec.js';

test('giờ yên lặng: qua đêm, đổi theo cài đặt', () => {
  const mac = { yen_tu: 22, yen_den: 8 };
  assert.equal(dangYenLang(22, mac), true);
  assert.equal(dangYenLang(3, mac), true);
  assert.equal(dangYenLang(8, mac), false);
  assert.equal(dangYenLang(15, mac), false);
  assert.equal(dangYenLang(20, { yen_tu: 19, yen_den: 8 }), true);
});

test('ngưỡng mặc định nằm trong giới hạn và mỗi khâu có tên riêng', () => {
  for (const [k, g] of Object.entries(NGUONG)) assert.ok(g.min <= g.mac_dinh && g.mac_dinh <= g.max, k);
  assert.equal(new Set(KHAU_BAT_TAT).size, KHAU_BAT_TAT.length);
});

test('nhắc trước giờ hẹn theo số phút đã chỉnh', () => {
  const den = Date.parse('2026-10-12T02:00:00Z'); // 9h giờ VN
  assert.equal(loaiNhac('2026-10-12', '09:00', den - 45 * 60000), null);
  assert.equal(loaiNhac('2026-10-12', '09:00', den - 45 * 60000, 60), 'truoc');
  assert.equal(loaiNhac('2026-10-12', '09:00', den + 60000), 'dung');
});

test('bố cục sơ đồ: nhận vị trí và nhóm gọn hợp lệ, từ chối dữ liệu lạ', () => {
  assert.equal(kiemBoCuc({ ngang: { vi_tri: { ai: [352, 240], 'nhom-chay': [0, -48] }, thu_gon: ['chay'] }, doc: { vi_tri: {}, thu_gon: [] } }), true);
  assert.equal(kiemBoCuc({ nghieng: { vi_tri: {} } }), false);
  assert.equal(kiemBoCuc({ ngang: { vi_tri: { ai: [1, 'x'] } } }), false);
  assert.equal(kiemBoCuc({ ngang: { vi_tri: { 'A B': [1, 2] } } }), false);
  assert.equal(kiemBoCuc({ ngang: { vi_tri: { ai: [1e9, 0] } } }), false);
  assert.equal(kiemBoCuc({ ngang: { thu_gon: ['<script>'] } }), false);
  assert.equal(kiemBoCuc([]), false);
});
