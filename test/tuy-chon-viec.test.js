import test from 'node:test';
import assert from 'node:assert/strict';

const kho = new Map();
globalThis.localStorage = { getItem: (k) => (kho.has(k) ? kho.get(k) : null), setItem: (k, v) => kho.set(k, String(v)) };
const { docTuyChonViec, luuTuyChonViec } = await import('../public/trang/tuy-chon-viec.js');

test('trang Việc nhớ cách hiển thị: kiểu xem, ẩn cột trống, bộ lọc phụ', () => {
  kho.clear();
  assert.deepEqual(docTuyChonViec(), { xem: 'du-an', anTrong: false, nguon: 'tat-ca', han: 'tat-ca', nang: 'tat-ca', gio: 'tat-ca', claude: 'tat-ca', sapXep: 'tay', anNhan: false, chiSao: false });
  luuTuyChonViec({ xem: 'han', anTrong: true, nguon: 'zalo', han: 'hom-nay', nang: 'nang', gio: 'co-gio', claude: 'hoi', sapXep: 'han', anNhan: true, chiSao: true });
  assert.deepEqual(docTuyChonViec(), { xem: 'han', anTrong: true, nguon: 'zalo', han: 'hom-nay', nang: 'nang', gio: 'co-gio', claude: 'hoi', sapXep: 'han', anNhan: true, chiSao: true });
});

test('giá trị lạ hoặc hỏng thì dùng mặc định, khóa cũ chỉ nhớ kiểu xem vẫn đọc được', () => {
  kho.clear();
  kho.set('sp.viec.tuy', JSON.stringify({ xem: 'x', nguon: '<script>', han: 5, anTrong: 'có', chiSao: 1 }));
  assert.deepEqual(docTuyChonViec(), { xem: 'du-an', anTrong: false, nguon: 'tat-ca', han: 'tat-ca', nang: 'tat-ca', gio: 'tat-ca', claude: 'tat-ca', sapXep: 'tay', anNhan: false, chiSao: false });
  kho.set('sp.viec.tuy', '{hỏng');
  assert.equal(docTuyChonViec().xem, 'du-an');
  kho.clear();
  kho.set('sp.viec.xem', 'han');
  assert.equal(docTuyChonViec().xem, 'han');
});
