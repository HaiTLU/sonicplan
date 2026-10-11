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
