// Kiểm thử bản tin theo giờ, gợi ý việc và lời nhắc tách việc có danh sách "đã có sẵn".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docGoiY, loiNhacTachViec } from '../src/ai.js';
import { dungBanTin, gioDayDuVN } from '../src/ban-tin.js';

const viec = [
  { tieu_de: 'Nộp báo cáo', han_ngay: '2026-10-09', gio_hen: null },
  { tieu_de: 'Gọi đối tác', han_ngay: '2026-10-11', gio_hen: '14:00' },
  { tieu_de: 'Duyệt kế hoạch', han_ngay: '2026-10-13', gio_hen: null },
  { tieu_de: 'Việc xa', han_ngay: '2026-10-20', gio_hen: null },
];

test('bản tin sáng gồm quá hạn, hôm nay, 3 ngày tới', () => {
  const t = dungBanTin(viec, '2026-10-11', true);
  assert.match(t, /^Bản tin sáng 11\/10/);
  assert.match(t, /Quá hạn \(1\):\n- Nộp báo cáo \(hạn 09\/10\)/);
  assert.match(t, /Hạn hôm nay \(1\):\n- Gọi đối tác \(hạn 11\/10 14:00\)/);
  assert.match(t, /Đến hạn trong 3 ngày tới \(1\):\n- Duyệt kế hoạch/);
  assert.doesNotMatch(t, /Việc xa/);
});

test('nhắc 17h bỏ khối 3 ngày tới; không có gì thì không gửi', () => {
  const t = dungBanTin(viec, '2026-10-11', false);
  assert.match(t, /^Việc còn mở cuối ngày/);
  assert.doesNotMatch(t, /3 ngày tới/);
  assert.equal(dungBanTin([{ tieu_de: 'x', han_ngay: '2026-12-01' }], '2026-10-11', true), '');
  assert.equal(dungBanTin([], '2026-10-11', false), '');
});

test('giờ Việt Nam dạng HH:mm dd/MM', () => {
  assert.equal(gioDayDuVN('2026-10-11T01:05:00.000Z'), '08:05 11/10');
});

test('đọc gợi ý ba nhóm, nhóm lạ về 2, tối đa 5 bước', () => {
  const kq = docGoiY('{"nhom":9,"lyDo":"Cần ký.","cacBuoc":["a","b","c","d","e","f"],"banNhap":"Chào anh"}');
  assert.equal(kq.nhom, 2);
  assert.match(kq.ghi_them, /^\[Gợi ý\] Nhóm 2: AI chuẩn bị, bạn quyết định\. Cần ký\.\n1\. a\n/);
  assert.equal(kq.ghi_them.split('\n').filter((d) => /^\d\. /.test(d)).length, 5);
  assert.match(kq.ghi_them, /Bản nháp: Chào anh$/);
  assert.throws(() => docGoiY('{"nhom":1,"cacBuoc":[]}'));
});

test('lời nhắc tách việc kèm tối đa 80 việc đã có', () => {
  const daCo = Array.from({ length: 100 }, (_, i) => `Việc ${i}`);
  const [he, nd] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-11', 'Hải', daCo);
  assert.match(he.content, /KHÔNG trích lại/);
  assert.match(nd.content, /Đã có sẵn \(80 việc/);
  assert.match(nd.content, /Việc 79/);
  assert.doesNotMatch(nd.content, /Việc 80"/);
});
