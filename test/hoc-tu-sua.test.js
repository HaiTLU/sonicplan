// Kiểm thử AI học từ việc người dùng sửa hoặc hủy (đề xuất 1 và 2, 18/10/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loiNhacTachViec } from '../src/ai.js';
import { docViecDaSua } from '../src/viec.js';
import { kiemViec } from '../src/api/viec.js';

test('lời nhắc tách việc kèm việc đã sửa, tối đa 10 dòng', () => {
  const daSua = Array.from({ length: 15 }, (_, i) => `- Hủy việc: "Việc ${i}"`);
  const [, nd] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-18', 'Hải', [], [], [], [], [], daSua);
  assert.match(nd.content, /đã sửa hoặc hủy gần đây/);
  assert.match(nd.content, /Việc 9"/);
  assert.doesNotMatch(nd.content, /Việc 10"/);
  const [, trong] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-18', 'Hải');
  assert.doesNotMatch(trong.content, /đã sửa hoặc hủy/);
});

test('đọc việc đã sửa: chỉ việc do AI tạo, kèm lý do hủy và tin gốc, bỏ việc gỡ do chặn nguồn', async () => {
  const { dungCsdl, d1 } = await import('./csdl-thu.js');
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  const bay = new Date().toISOString();
  db.exec(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, noi_dung, thoi_diem, tao_luc) VALUES (1,'t','zalo','m1','Mai ăn cơm với lớp nhé','x','x')`);
  db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, tin_nhan_id, nguon, tao_luc, cap_nhat_luc) VALUES (1,'t','Đi ăn cơm với lớp','huy',1,'zalo','x','x'),(2,'t','Việc tự thêm','huy',NULL,'tay','x','x'),(3,'t','Việc bị chặn','huy',NULL,'zalo','x','x')`);
  const ev = db.prepare(`INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('t', ?, ?, ?, ?)`);
  ev.run(1, 'huy', 'Đi ăn cơm với lớp | lý do: chuyện riêng', bay);
  ev.run(2, 'huy', 'Việc tự thêm', bay);
  ev.run(3, 'huy', 'Gỡ vì đã chặn Zalo', bay);
  const ds = await docViecDaSua(env, 't');
  assert.equal(ds.length, 1);
  assert.match(ds[0], /Hủy việc: "Đi ăn cơm với lớp", lý do: chuyện riêng/);
  assert.match(ds[0], /tin gốc: "Mai ăn cơm với lớp nhé"/);
});

test('kiểm việc nhận lý do hủy tùy chọn', () => {
  assert.equal(kiemViec({ trang_thai: 'huy', ly_do: ' chuyện riêng ' }, { batBuocTieuDe: false }).viec.ly_do, 'chuyện riêng');
});

test('đề xuất lời dặn: đọc dòng AI trả, bỏ dòng ngắn, tối đa 5, "KHONG" là không đề xuất', async () => {
  const { docDongDeXuat } = await import('../src/loi-dan-tuan.js');
  assert.deepEqual(docDongDeXuat('KHONG'), []);
  assert.deepEqual(docDongDeXuat('- Tin rủ ăn uống trong nhóm lớp thì không tạo việc\n- ngắn\n* Giờ 5h30 trong nhóm gia đình là 17:30'), ['Tin rủ ăn uống trong nhóm lớp thì không tạo việc', 'Giờ 5h30 trong nhóm gia đình là 17:30']);
  assert.equal(docDongDeXuat(Array.from({ length: 9 }, (_, i) => `- Quy tắc số ${i} dài đủ`).join('\n')).length, 5);
});

test('duyệt gợi ý nối vào hồ sơ, bỏ thì chỉ xóa khỏi danh sách', async () => {
  const { dungCsdl, d1 } = await import('./csdl-thu.js');
  const { ghiCaiDat } = await import('../src/hop-tin.js');
  const { docGoiYLoiDan, quyetGoiYLoiDan } = await import('../src/loi-dan-tuan.js');
  const { docHoSo, luuHoSo } = await import('../src/ghi-nho.js');
  const env = { CSDL: d1(dungCsdl()) };
  await luuHoSo(env, 't', 'Tôi là quản lý dự án.');
  await ghiCaiDat(env, 't', 'goi_y_loi_dan', JSON.stringify({ luc: 'x', ds: ['Rủ ăn uống thì không tạo việc', 'Giờ 5h30 là 17:30'] }));
  assert.equal((await quyetGoiYLoiDan(env, 't', 0, 'duyet')).ds.length, 1);
  assert.match(await docHoSo(env, 't'), /Quy tắc AI học được:\n- Rủ ăn uống thì không tạo việc/);
  await quyetGoiYLoiDan(env, 't', 0, 'bo');
  assert.deepEqual((await docGoiYLoiDan(env, 't')).ds, []);
  assert.doesNotMatch(await docHoSo(env, 't'), /5h30/);
  assert.ok((await quyetGoiYLoiDan(env, 't', 0, 'duyet')).loi);
});

test('bộ tin mẫu đúng khuôn và dựng được lời nhắc cho từng tin', async () => {
  const { readFileSync } = await import('node:fs');
  const bo = JSON.parse(readFileSync('test/tin-mau/tach-viec.json', 'utf8'));
  assert.ok(bo.cac_tin.length >= 10);
  for (const c of bo.cac_tin) {
    const lo = c.lo || [c.tin];
    assert.ok(c.ten && lo.every((t) => t.noi_dung) && typeof c.co_viec === 'boolean', c.ten);
    const [, nd] = loiNhacTachViec(lo.map((t, i) => ({ ...t, so: i + 1 })), bo.hom_nay, 'Hải');
    for (const t of lo) assert.ok(nd.content.includes(t.noi_dung));
  }
});

test('ghi lý do sau khi đã hủy: gắn vào sự kiện hủy, không ghi thêm sự kiện', async () => {
  const { dungCsdl, d1 } = await import('./csdl-thu.js');
  const { suaViec } = await import('../src/api/viec.js');
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nguon, tao_luc, cap_nhat_luc) VALUES (1,'t','Đi ăn lẩu','mo','zalo','x','x')`);
  await suaViec(env, 't', 1, { trang_thai: 'huy' });
  await suaViec(env, 't', 1, { trang_thai: 'huy', ly_do: 'chuyện riêng' });
  const ev = db.prepare(`SELECT noi_dung FROM viec_su_kien WHERE viec_id = 1 AND loai = 'huy'`).all();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].noi_dung, 'Đi ăn lẩu | lý do: chuyện riêng');
});
