// Workers AI hết hạn mức ngày (429): giữ tin, dừng gọi tới 0:00 UTC, báo lên Tổng quan. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { tachViecChoToChuc } from '../src/viec.js';
import { TAC_VU } from '../src/lich-chay.js';
import { chayTacVu } from '../src/index.js';
import { goiYMoi } from '../src/ban-tin.js';
import { docHetHanMuc, laHetHanMucNgay, lucDatLaiHanMuc, moTaLucDatLai } from '../src/han-muc-ai.js';
import { moAi } from '../may-chu/lop-ai.js';

const LOI_429 = 'Workers AI lỗi 429: [{"message":"AiError: AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade to Cloudflare\'s Workers Paid plan if you would like to continue usage."}]';

function moiTruong(AI) {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db), AI } };
}

const them = (db, { noi, tao = new Date().toISOString(), daTach = 0, ma = `ca-nhan:${Math.random()}` }) => db.prepare(
  `INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, tieu_de, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai, da_tach)
   VALUES ('tc1', 'zalo', ?, 'Lan', 'Lan', ?, ?, ?, ?, ?)`,
).run(`${Math.random()}`, noi, tao, tao, ma, daTach);

const gioTruoc = (gio) => new Date(Date.now() - gio * 3600000).toISOString();
const daTachCua = (db) => db.prepare('SELECT da_tach FROM tin_nhan ORDER BY id').all().map((r) => r.da_tach);

test('nhận ra lỗi hết hạn mức ngày, không nhầm với lỗi 429 gọi dồn dập hay lỗi khác', () => {
  assert.equal(laHetHanMucNgay(new Error(LOI_429)), true);
  assert.equal(laHetHanMucNgay(new Error('AiError: you have used up your daily free allocation of 10,000 neurons')), true);
  assert.equal(laHetHanMucNgay(new Error('Workers AI lỗi 429: Too many requests, slow down')), false);
  assert.equal(laHetHanMucNgay(new Error('Workers AI lỗi 500: lỗi máy chủ')), false);
  assert.equal(laHetHanMucNgay(null), false);
});

test('mốc đặt lại là 0:00 UTC ngày sau, hiện là 7:00 giờ Việt Nam', () => {
  assert.equal(lucDatLaiHanMuc('2026-10-16T04:45:00.000Z'), '2026-10-17T00:00:00.000Z');
  assert.equal(lucDatLaiHanMuc('2026-10-16T23:59:59.000Z'), '2026-10-17T00:00:00.000Z');
  assert.equal(lucDatLaiHanMuc('2026-12-31T10:00:00.000Z'), '2027-01-01T00:00:00.000Z');
  assert.equal(moTaLucDatLai('2026-10-17T00:00:00.000Z'), '07:00 ngày 17/10');
});

test('lớp moAi báo mã 429 và nội dung hết hạn mức trong thông báo lỗi', async () => {
  const ai = moAi({
    taiKhoan: 'a', token: 't',
    fetchHam: async () => ({ ok: false, status: 429, json: async () => ({ success: false, errors: [{ message: 'AiError: you have used up your daily free allocation of 10,000 neurons' }] }) }),
  });
  await assert.rejects(() => ai.run('@cf/m', {}), (e) => /429/.test(e.message) && laHetHanMucNgay(e));
});

test('429 hết hạn mức: tin chờ quá 6 giờ vẫn được giữ (da_tach = 0), không bị bỏ như lỗi AI thường', async () => {
  const { db, env } = moiTruong({ run: async () => { throw new Error(LOI_429); } });
  them(db, { noi: 'anh gửi em báo giá nhé', tao: gioTruoc(7) });
  them(db, { noi: 'anh gọi lại em nhé', tao: gioTruoc(30) });
  them(db, { noi: 'tin mới', tao: gioTruoc(1) });
  await assert.rejects(() => tachViecChoToChuc(env, 'tc1'), /429/);
  assert.deepEqual(daTachCua(db), [0, 0, 0]);
});

test('lỗi AI khác vẫn bỏ tin chờ quá 6 giờ như cũ', async () => {
  const { db, env } = moiTruong({ run: async () => { throw new Error('Workers AI lỗi 500: hỏng'); } });
  them(db, { noi: 'tin cũ', tao: gioTruoc(7) });
  await assert.rejects(() => tachViecChoToChuc(env, 'tc1'), /500/);
  assert.deepEqual(daTachCua(db), [3]);
  const moi = moiTruong({ run: async () => { throw new Error('Workers AI lỗi 500: hỏng'); } });
  them(moi.db, { noi: 'tin mới', tao: gioTruoc(1) });
  await assert.rejects(() => tachViecChoToChuc(moi.env, 'tc1'), /500/);
  assert.deepEqual(daTachCua(moi.db), [0]);
});

test('gặp 429 hết hạn mức thì ghi mốc, các lần sau không gọi Workers AI nữa tới khi đặt lại', async () => {
  let goi = 0;
  const { db, env } = moiTruong({ run: async () => { goi++; throw new Error(LOI_429); } });
  them(db, { noi: 'anh gửi em báo giá nhé' });
  await assert.rejects(() => tachViecChoToChuc(env, 'tc1'), /429/);
  assert.equal(goi, 1);
  const den = await docHetHanMuc(env);
  assert.equal(den, lucDatLaiHanMuc(new Date()));
  // Lượt sau: lỗi tạm dừng, không gọi AI, tin vẫn ở hàng chờ.
  await assert.rejects(() => tachViecChoToChuc(env, 'tc1'), (e) => e.tamDung === true && e.hetHanMuc === true);
  await assert.rejects(() => tachViecChoToChuc(env, 'tc1'), (e) => e.tamDung === true);
  assert.equal(goi, 1);
  assert.deepEqual(daTachCua(db), [0]);
  // Qua mốc đặt lại thì gọi lại được và xử lý tin đã giữ.
  assert.equal(await docHetHanMuc(env, new Date(Date.parse(den) + 1000)), null);
  db.prepare("UPDATE cai_dat SET gia_tri = ? WHERE khoa = 'ai_het_han_muc_den'").run(new Date(Date.now() - 1000).toISOString());
  env.AI = { run: async () => { goi++; return { response: '{"viec":[]}' }; } };
  const kq = await tachViecChoToChuc(env, 'tc1');
  assert.equal(kq.so_tin, 1);
  assert.equal(goi, 2);
  assert.deepEqual(daTachCua(db), [1]);
});

test('tác vụ tach-viec: lượt đầu báo lỗi 429, các lượt sau đang tạm dừng thì không ghi nhật ký', async () => {
  const { db, env } = moiTruong({ run: async () => { throw new Error(LOI_429); } });
  them(db, { noi: 'anh gửi em báo giá nhé' });
  const tv = TAC_VU.find((t) => t.ma === 'tach-viec');
  const dau = await chayTacVu(env, tv);
  assert.equal(dau.trang_thai, 'loi');
  const sau = await chayTacVu(env, tv);
  assert.equal(sau.trang_thai, 'bo-qua', 'tạm dừng: không thêm dòng lỗi mỗi 5 phút');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nhat_ky_chay WHERE tac_vu = 'tach-viec'").get().n, 1);
  assert.deepEqual(daTachCua(db), [0]);
});

test('gợi ý việc: hết hạn mức không đánh dấu lỗi vào việc (hai lần là bị bỏ hẳn)', async () => {
  const { db, env } = moiTruong({ run: async () => { throw new Error(LOI_429); } });
  db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc) VALUES ('tc1', 'Gửi báo giá cho chị Lan', 'mo', ?, ?)`).run(new Date().toISOString(), new Date().toISOString());
  const kq = await goiYMoi(env, new Date().toISOString());
  assert.equal(kq.bo_qua, true);
  assert.doesNotMatch(db.prepare('SELECT COALESCE(ghi_chu, \'\') AS g FROM viec').get().g, /Gợi ý: lỗi/);
});
