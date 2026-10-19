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

test('đoạn chat hẹn lên gặp chưa có giờ: tin vẫn tới AI, việc "chờ liên hệ" được lưu, không có giờ', async () => {
  const { db, goi, env } = moiTruong();
  env.AI.run = async (_m, { messages }) => {
    goi.push(messages[1].content);
    return { response: JSON.stringify({ viec: [{ tieu_de: 'Gặp anh Hùng Vụ KHTC (chờ cô liên hệ, giờ chưa chốt)', han_ngay: '2026-10-19', gio_hen: null, ghi_chu: 'Cô Hoa nói chiều lên gặp vì Vụ ĐH và KHCN gửi hết rồi', tin_so: 1, nhom: 3, chua_chac: { loai: 'gio', cau_hoi: 'Mấy giờ gặp anh Hùng?', lua_chon: ['14:00', '15:00'] } }] }) };
  };
  for (const [nguoi, noi] of [['Cô Hoa', 'có khi chiều lên gặp Hùng Anh Vụ KHTC vì Vụ ĐH và KHCN gửi hết rồi'], ['Tôi', 'Vâng ạ'], ['Tôi', 'Mấy h đi ạ'], ['Cô Hoa', 'để cô liên hệ đã']]) {
    them(db, { nguoi, ten: 'Cô Hoa', ma: 'ca-nhan:9', noi });
  }
  const kq = await tachViecChoToChuc(env, 'tc1');
  assert.equal(goi.length, 1);
  assert.match(goi[0], /gặp Hùng Anh Vụ KHTC[\s\S]*Vâng ạ[\s\S]*Mấy h đi ạ[\s\S]*để cô liên hệ đã/);
  const v = db.prepare('SELECT tieu_de, han_ngay, gio_hen FROM viec').all();
  assert.equal(v.length, 1);
  assert.match(v[0].tieu_de, /Gặp anh Hùng Vụ KHTC/);
  assert.equal(v[0].han_ngay, '2026-10-19');
  assert.ok(!v[0].gio_hen);
  assert.equal(kq.so_viec, 1);
});

test('tin kế hoạch đi gặp đứng một mình: AI đưa vào phan_van thì có ô hỏi Telegram, không bị bỏ im lặng', async () => {
  const { db, env } = moiTruong();
  env.AI.run = async () => ({ response: JSON.stringify({ viec: [], phan_van: [{ tieu_de: 'Gặp anh Hùng Vụ KHTC chiều nay', tin_so: 1, han_ngay: '2026-10-19', ghi_chu: 'Cô Hoa nói chiều lên gặp' }] }) });
  them(db, { nguoi: 'Cô Hoa', ten: 'Cô Hoa', ma: 'ca-nhan:9', noi: 'có khi chiều lên gặp Hùng Anh Vụ KHTC vì Vụ ĐH và KHCN gửi hết rồi' });
  await tachViecChoToChuc(env, 'tc1');
  const hoi = db.prepare('SELECT COUNT(*) AS n FROM cau_hoi_ai').get().n;
  assert.equal(hoi, 1);
});
