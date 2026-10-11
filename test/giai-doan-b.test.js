// Kiểm thử giai đoạn B: lệnh Telegram, nhận việc từ dịch vụ ngoài, nhãn nguồn trong lời nhắc AI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loiNhacTachViec } from '../src/ai.js';
import { nhanViecNgoai } from '../src/nhan-ngoai.js';
import { dongViecTelegram, ghiNhoTuLenh } from '../src/telegram.js';

test('dòng việc trong Telegram: giờ, ngày, tên', () => {
  assert.equal(dongViecTelegram({ tieu_de: 'Họp với chị Lan', han_ngay: '2026-10-12', gio_hen: '09:00' }), '- 09:00 12/10 Họp với chị Lan');
  assert.equal(dongViecTelegram({ tieu_de: 'Nộp báo cáo', han_ngay: '2026-10-15' }), '- 15/10 Nộp báo cáo');
  assert.equal(dongViecTelegram({ tieu_de: 'Gọi lại' }), '- Gọi lại');
});

test('/nho: lấy vài chữ đầu làm tiêu đề, chặn thông tin nhạy cảm và câu rỗng', () => {
  assert.match(ghiNhoTuLenh('').loi, /Gõ kèm/);
  assert.match(ghiNhoTuLenh('mật khẩu wifi là abc123').loi, /không lưu/);
  const g = ghiNhoTuLenh('Chị Lan là trưởng phòng đào tạo, liên hệ qua Zalo là nhanh nhất');
  assert.equal(g.tieu_de, 'Chị Lan là trưởng phòng đào tạo, liên');
  assert.ok(g.noi_dung.startsWith('Chị Lan'));
});

test('lời nhắc AI gọi đúng tên nguồn Telegram và dịch vụ ngoài', () => {
  const nd = loiNhacTachViec([
    { so: 1, nguon: 'telegram', nguoi_gui: 'Hải', noi_dung: 'mai 9h họp', thoi_diem: 'x' },
    { so: 2, nguon: 'api', nguoi_gui: 'Zapier', noi_dung: 'đơn mới', thoi_diem: 'x' },
  ], '2026-10-11', 'Hải')[1].content;
  assert.match(nd, /\[1\] Telegram/);
  assert.match(nd, /\[2\] Dịch vụ ngoài/);
});

test('nhận việc từ ngoài: sai phương thức, thiếu mã, mã không có trong hệ thống', async () => {
  const env = { CSDL: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } };
  const yc = (phuongThuc, tieuDe = {}) => new Request('https://x/nhan/viec', { method: phuongThuc, headers: tieuDe, body: phuongThuc === 'POST' ? '{}' : undefined });
  assert.equal((await nhanViecNgoai(yc('GET'), env, {})).status, 405);
  assert.equal((await nhanViecNgoai(yc('POST'), env, {})).status, 401);
  assert.equal((await nhanViecNgoai(yc('POST', { authorization: `Bearer ${'a'.repeat(40)}` }), env, {})).status, 401);
});
