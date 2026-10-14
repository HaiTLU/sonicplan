// Tách việc theo từng cuộc trò chuyện: mỗi lượt AI chỉ đọc tin của một cuộc, kèm tin trước của chính cuộc đó. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { tachViecChoToChuc } from '../src/viec.js';

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  const goi = [];
  const AI = { run: async (_m, { messages }) => { goi.push(messages[1].content); return { response: '{"viec":[]}' }; } };
  return { db, goi, env: { CSDL: d1(db), AI } };
}

const them = (db, { nguoi, nhom = null, ten = null, ma = null, noi, daTach = 0 }) => db.prepare(
  `INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai, da_tach)
   VALUES ('tc1', 'zalo', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(`${Math.random()}`, nguoi, nhom, ten, noi, new Date().toISOString(), new Date().toISOString(), ma, daTach);

test('mỗi cuộc trò chuyện một lượt AI, tin mình gửi nằm cùng cuộc với người kia', async () => {
  const { db, goi, env } = moiTruong();
  them(db, { nguoi: 'Lan', ten: 'Lan', ma: 'ca-nhan:1', noi: 'anh gửi em báo giá nhé' });
  them(db, { nguoi: 'Hùng', ten: 'Hùng', ma: 'ca-nhan:2', noi: 'anh gọi lại em nhé' });
  them(db, { nguoi: 'Tôi', ten: 'Lan', ma: 'ca-nhan:1', noi: 'ok chiều a gửi' });
  them(db, { nguoi: 'Mai', nhom: 'Phòng Đào tạo', noi: 'mn nộp kế hoạch tháng' });
  const kq = await tachViecChoToChuc(env, 'tc1');
  assert.equal(kq.so_hoi_thoai, 3);
  assert.equal(kq.so_tin, 4);
  assert.equal(goi.length, 3);
  assert.match(goi[0], /báo giá/);
  assert.match(goi[0], /chiều a gửi/);
  assert.doesNotMatch(goi[0], /gọi lại/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tin_nhan WHERE da_tach = 1').get().n, 4);
});

test('tin trước đó chỉ lấy của chính cuộc trò chuyện', async () => {
  const { db, goi, env } = moiTruong();
  them(db, { nguoi: 'Lan', ten: 'Lan', ma: 'ca-nhan:1', noi: 'anh xem giúp em hợp đồng IPSOS', daTach: 1 });
  them(db, { nguoi: 'Hùng', ten: 'Hùng', ma: 'ca-nhan:2', noi: 'chuyện khác hẳn', daTach: 1 });
  them(db, { nguoi: 'Lan', ten: 'Lan', ma: 'ca-nhan:1', noi: 'anh đã xem chưa ạ' });
  await tachViecChoToChuc(env, 'tc1');
  assert.equal(goi.length, 1);
  assert.match(goi[0], /Tin trước đó[\s\S]*hợp đồng IPSOS/);
  assert.doesNotMatch(goi[0], /chuyện khác hẳn/);
});
