// Lời gợi ý xử lý từng việc có thêm ngữ cảnh: dự án, cờ nghi trùng, việc giống đã xong (05/11/2026). Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { dongNguCanhGoiY } from '../src/ai.js';
import { goiYMoi, nguCanhGoiY } from '../src/ban-tin.js';

const bay = () => new Date().toISOString();

function moiTruong(AI = undefined) {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db), AI } };
}

test('dongNguCanhGoiY: không có ngữ cảnh thì không thêm dòng, có thì bọc JSON và cắt ngắn', () => {
  assert.deepEqual(dongNguCanhGoiY(null), []);
  assert.deepEqual(dongNguCanhGoiY({ duAn: null, nghiTrung: null, daXong: [] }), []);
  const d = dongNguCanhGoiY({ duAn: 'AI Lab', nghiTrung: 'x'.repeat(500), daXong: ['a', 'b', 'c', 'd'] });
  assert.equal(d.length, 3);
  assert.match(d[0], /Dự án của việc: "AI Lab"/);
  assert.ok(d[1].length < 260);
  assert.match(d[2], /\["a","b","c"\]/);
});

test('nguCanhGoiY: lấy tên dự án, cờ nghi trùng mới nhất và tối đa 3 việc giống đã xong', async () => {
  const { db, env } = moiTruong();
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (1, 'tc1', 'AI Lab', 'x')");
  db.exec("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, tao_luc, cap_nhat_luc) VALUES (5, 'tc1', 'Gửi bản hợp đồng đã ký cho kế toán', 'mo', 1, 'x', 'x')");
  const ev = db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 5, 'nghi_trung', ?, ?)");
  ev.run('cũ', '2026-11-01'); ev.run('Có thể trùng việc #9', '2026-11-02');
  const daXong = [
    { tieu_de: 'Gửi hợp đồng đã ký cho kế toán trường' },
    { tieu_de: 'Dọn kho thiết bị' },
    { tieu_de: 'Gửi bản hợp đồng đã ký cho kế toán' }, // giống hệt: bỏ (là chính nó hoặc bản trùng đã xử lý)
  ];
  const nc = await nguCanhGoiY(env, 'tc1', { id: 5, tieu_de: 'Gửi bản hợp đồng đã ký cho kế toán', du_an_id: 1 }, daXong);
  assert.equal(nc.duAn, 'AI Lab');
  assert.equal(nc.nghiTrung, 'Có thể trùng việc #9');
  assert.deepEqual(nc.daXong, ['Gửi hợp đồng đã ký cho kế toán trường']);
});

test('gợi ý việc: lời nhắc gửi AI có dòng nghi trùng và dự án của việc', async () => {
  const lanGoi = [];
  const AI = { run: async (_m, thamSo) => { lanGoi.push(JSON.stringify(thamSo.messages)); return { response: JSON.stringify({ nhom: 2, lyDo: 'cần quyết định', cacBuoc: ['Kiểm tra việc nghi trùng', 'Gửi'] }) }; } };
  const { db, env } = moiTruong(AI);
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (1, 'tc1', 'AI Lab', 'x')");
  const luc = bay();
  db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, tao_luc, cap_nhat_luc) VALUES (5, 'tc1', 'Gửi bản hợp đồng đã ký cho kế toán', 'mo', 1, ?, ?)").run(luc, luc);
  db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 5, 'nghi_trung', 'Có thể trùng việc #9 \"Gửi hợp đồng cho đối tác\"', ?)").run(luc);
  const kq = await goiYMoi(env, luc);
  assert.equal(kq.so_muc, 1);
  assert.equal(lanGoi.length, 1);
  assert.match(lanGoi[0], /Nghi trùng \(hệ thống gắn cờ\)/);
  assert.match(lanGoi[0], /Dự án của việc: \\"AI Lab\\"/);
  assert.match(db.prepare('SELECT ghi_chu FROM viec WHERE id = 5').get().ghi_chu, /\[Gợi ý\] Nhóm 2/);
});
