import test from 'node:test';
import assert from 'node:assert/strict';
import { boNhanDau, chuanCauHinh, dauVet, ganNhan, nhanCuaViec } from '../src/google-nhan.js';

const viec = { tieu_de: 'Gửi báo cáo', ghi_chu: 'Bản v2', han_ngay: '2026-10-12', trang_thai: 'mo', nguon: 'zalo', tin_nguon: 'zalo', tin_nguoi_gui: 'Nk Linh <x>', tin_nhom: 'Core team', du_an_ten: 'NCS-K5', mau: '9' };

test('cấu hình: bỏ loại lạ, trùng, đặt mặc định', () => {
  assert.deepEqual(chuanCauHinh(undefined), { che_do: 'ca-hai', cho: 'tieu_de', bat: [] });
  assert.deepEqual(chuanCauHinh('{"che_do":"tasks","cho":"ghi_chu","bat":["nguon","la","nguon","xong"]}'), { che_do: 'tasks', cho: 'ghi_chu', bat: ['nguon', 'xong'] });
  assert.equal(chuanCauHinh({ che_do: 'sai' }).che_do, 'ca-hai');
  assert.deepEqual(chuanCauHinh('không phải json'), { che_do: 'ca-hai', cho: 'tieu_de', bat: [] });
});

test('nhãn theo đúng thứ tự đã chọn và theo ngày hạn', () => {
  const ch = chuanCauHinh({ bat: ['han', 'nguon', 'du_an'] });
  assert.deepEqual(nhanCuaViec(viec, ch, '2026-10-12'), ['Hôm nay', 'Zalo', 'NCS-K5']);
  assert.deepEqual(nhanCuaViec(viec, ch, '2026-10-11'), ['Ngày mai', 'Zalo', 'NCS-K5']);
  assert.deepEqual(nhanCuaViec(viec, ch, '2026-10-13'), ['Quá hạn', 'Zalo', 'NCS-K5']);
  assert.deepEqual(nhanCuaViec(viec, ch, '2026-10-01'), ['Zalo', 'NCS-K5']); // hạn còn xa: không có nhãn hạn
  assert.deepEqual(nhanCuaViec(viec, chuanCauHinh({ bat: ['nguoi'] }), '2026-10-12'), ['Core team']);
  assert.deepEqual(nhanCuaViec({ ...viec, tin_nhom: null }, chuanCauHinh({ bat: ['nguoi'] }), '2026-10-12'), ['Nk Linh']);
});

test('gắn nhãn vào đầu tiêu đề hoặc đầu ghi chú, xong thì xám', () => {
  const ch = chuanCauHinh({ bat: ['han', 'nguon'] });
  assert.equal(ganNhan(viec, ch, '2026-10-12').tieu_de, '[Hôm nay] [Zalo] Gửi báo cáo');
  const g = ganNhan(viec, { ...ch, cho: 'ghi_chu' }, '2026-10-12');
  assert.equal(g.tieu_de, 'Gửi báo cáo');
  assert.equal(g.ghi_chu, '[Hôm nay] [Zalo]\nBản v2');
  assert.equal(g.mau, '9');
  const xong = ganNhan({ ...viec, trang_thai: 'xong' }, chuanCauHinh({ bat: ['xong'] }), '2026-10-12');
  assert.equal(xong.tieu_de, '[Xong] Gửi báo cáo');
  assert.equal(xong.mau, '8');
  assert.equal(ganNhan({ ...viec, trang_thai: 'xong' }, chuanCauHinh({ bat: [] }), '2026-10-12').mau, '9'); // không bật nhãn Xong thì giữ màu
  assert.equal(ganNhan(viec, chuanCauHinh({}), '2026-10-12').tieu_de, 'Gửi báo cáo'); // tắt hết nhãn: nguyên bản
});

test('dấu vết đổi khi nhãn đổi, bỏ nhãn khi đọc ngược', () => {
  const a = dauVet(ganNhan(viec, chuanCauHinh({ bat: ['han'] }), '2026-10-12'));
  const b = dauVet(ganNhan(viec, chuanCauHinh({ bat: ['han'] }), '2026-10-13'));
  assert.notEqual(a, b);
  assert.equal(boNhanDau('[Hôm nay] [Zalo] Gửi báo cáo'), 'Gửi báo cáo');
  assert.equal(boNhanDau('Họp [nội bộ] chiều'), 'Họp [nội bộ] chiều');
});
