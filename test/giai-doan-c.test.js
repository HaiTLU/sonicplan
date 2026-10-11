// Kiểm thử giai đoạn C: nút trả lời nhanh trên lời nhắc việc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apDungNutViec, nutNhacViec, phanTichNut } from '../src/telegram.js';

test('dữ liệu nút: tạo và đọc lại, từ chối dữ liệu lạ', () => {
  const nut = nutNhacViec(42)[0];
  assert.deepEqual(nut.map((n) => n.text), ['Xong', 'Dời mai', 'Dời tuần sau', 'Bỏ']);
  for (const n of nut) assert.ok(new TextEncoder().encode(n.callback_data).length <= 64);
  assert.deepEqual(phanTichNut('v:42:tuan'), { viec_id: 42, hanh_dong: 'tuan' });
  assert.equal(phanTichNut('v:42:xoa'), null);
  assert.equal(phanTichNut('x'), null);
});

// Môi trường giả: ghi lại câu lệnh đã chạy và trả việc cho câu SELECT.
function envGia(viec) {
  const lenh = [];
  return {
    lenh,
    CSDL: {
      prepare: (sql) => ({
        bind: (...tham) => ({
          first: async () => viec,
          run: async () => { lenh.push({ sql, tham }); return { meta: { changes: 1 } }; },
        }),
      }),
    },
  };
}

test('bấm Xong, Bỏ, Dời mai, Dời tuần sau', async () => {
  const bayGio = '2026-10-11T03:00:00Z'; // 10h giờ VN, ngày 11/10
  let env = envGia({ id: 7, tieu_de: 'Họp', han_ngay: '2026-10-11' });
  assert.equal(await apDungNutViec(env, 't', { viec_id: 7, hanh_dong: 'xong' }, bayGio), 'Đã đánh dấu xong.');
  assert.equal(env.lenh[0].tham[2], 'xong');
  env = envGia({ id: 7, tieu_de: 'Họp', han_ngay: '2026-10-11' });
  assert.equal(await apDungNutViec(env, 't', { viec_id: 7, hanh_dong: 'bo' }, bayGio), 'Đã bỏ việc này.');
  assert.equal(env.lenh[0].tham[2], 'huy');
  env = envGia({ id: 7, tieu_de: 'Họp', han_ngay: '2026-10-11' });
  assert.equal(await apDungNutViec(env, 't', { viec_id: 7, hanh_dong: 'mai' }, bayGio), 'Đã dời sang 12/10.');
  assert.ok(env.lenh.some((l) => /DELETE FROM nhac_da_gui/.test(l.sql)));
  env = envGia({ id: 7, tieu_de: 'Họp', han_ngay: '2026-10-20' }); // hạn ở tương lai: dời tính từ hạn cũ
  assert.equal(await apDungNutViec(env, 't', { viec_id: 7, hanh_dong: 'tuan' }, bayGio), 'Đã dời sang 27/10.');
  env = envGia(null);
  assert.equal(await apDungNutViec(env, 't', { viec_id: 9, hanh_dong: 'xong' }, bayGio), null);
});

import { themHoSo, loiNhacTachViec } from '../src/ai.js';
import { luuHoSo } from '../src/ghi-nho.js';

test('hồ sơ được nối vào lời nhắc hệ thống, rỗng thì giữ nguyên', () => {
  const m = [{ role: 'system', content: 'A' }, { role: 'user', content: 'B' }];
  assert.equal(themHoSo(m, '').length, 2);
  assert.equal(themHoSo(m, '  ')[0].content, 'A');
  const r = themHoSo(m, 'Chị Lan là trưởng phòng');
  assert.ok(r[0].content.startsWith('A') && r[0].content.includes('Chị Lan là trưởng phòng'));
  assert.equal(r[1].content, 'B');
  assert.equal(m[0].content, 'A');
});

test('tin trước đó chỉ xuất hiện khi có, và dặn AI không trích việc từ đó', () => {
  const tin = [{ so: 1, nguon: 'zalo', nguoi_gui: 'Lan', nhom: 'Dự án A', noi_dung: 'ok', thoi_diem: '2026-10-11T01:00:00Z' }];
  const co = loiNhacTachViec(tin, '2026-10-11', 'Hải', [], [], ['[x] gửi báo cáo trước thứ Sáu']);
  assert.ok(co[1].content.includes('Tin trước đó') && co[1].content.includes('gửi báo cáo trước thứ Sáu'));
  assert.ok(co[0].content.includes('KHÔNG trích việc từ phần đó'));
  assert.ok(!loiNhacTachViec(tin, '2026-10-11', 'Hải')[1].content.includes('Tin trước đó (chỉ'));
});

test('hồ sơ chứa mật khẩu hoặc số thẻ thì từ chối lưu', async () => {
  const env = { CSDL: { prepare: () => { throw new Error('không được chạm CSDL'); } } };
  assert.match(await luuHoSo(env, 't', 'mật khẩu của tôi là abc'), /mật khẩu/);
  assert.match(await luuHoSo(env, 't', 'thẻ 1234 5678 9012 3456'), /số thẻ/);
});

import { tongHopAi } from '../src/ai.js';

test('tổng hợp: gửi toàn bộ dữ liệu một lần kèm hồ sơ, trả văn bản đã cắt gọn', async () => {
  let goi;
  const env = { AI: { run: async (_mh, tham) => { goi = tham; return { response: '  Tình hình:\n- ok  ' }; } } };
  const kq = await tongHopAi(env, { homNay: '2026-10-11', viecMo: [{ tieu_de: 'Gửi báo cáo' }], tin: [] }, { hoSo: 'Chị Lan là trưởng phòng' });
  assert.equal(kq, 'Tình hình:\n- ok');
  assert.equal(goi.messages.length, 2);
  assert.ok(goi.messages[0].content.includes('Chị Lan là trưởng phòng'));
  assert.ok(goi.messages[0].content.includes('2026-10-11'));
  assert.ok(goi.messages[1].content.includes('Gửi báo cáo'));
});
