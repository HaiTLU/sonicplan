// Cập nhật dự án bằng lời qua Telegram (/duan): AI tách đề xuất, máy chủ kiểm, chỉ người gửi lệnh duyệt,
// duyệt mới ghi CSDL, bỏ qua không ghi gì. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { cheSoTien, duAnCuaNhom, nutDeXuat, phanTichNutDeXuat, taoDeXuat, xuLyDeXuat } from '../src/hoalac/de-xuat.js';
import { biMatWebhook, nhanWebhook } from '../src/telegram.js';
import { maHoa } from '../src/ma-hoa.js';

const TG = '7001'; // mã người dùng Telegram đã gửi lệnh

function moiEnv() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES
    ('tc-chung', 'Chung', 'chung', '2026-01-01'),
    ('tc-a', 'Vien Hoa Lac', 'hoalac', '2026-01-01'),
    ('tc-b', 'Nghien cuu thi truong', 'hoalac', '2026-01-01'),
    ('tc-z', 'Du an nguoi khac', 'hoalac', '2026-01-01')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, tao_luc) VALUES
    ('nd-chu', 'chu@vi-du.vn', '2026-01-01'), ('nd-tv', 'tv@vi-du.vn', '2026-01-01'), ('nd-z', 'z@vi-du.vn', '2026-01-01')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES
    ('tc-chung', 'nd-chu', 'chu', '2026-01-01'),
    ('tc-a', 'nd-chu', 'chu', '2026-01-01'), ('tc-b', 'nd-chu', 'chu', '2026-01-01'),
    ('tc-a', 'nd-tv', 'thanh_vien', '2026-01-01'),
    ('tc-z', 'nd-z', 'chu', '2026-01-01')`);
  db.exec(`INSERT INTO qlda_hang_muc (id, to_chuc_id, ten, la_moc, thoi_gian_ngay, ngay_ket_thuc, tien_do_pt, trang_thai, tren_duong_gang, tao_luc, cap_nhat_luc) VALUES
    (11, 'tc-a', 'Khao sat dia chat', 0, 10, '2026-11-20', 40, 'dang_lam', 0, 'x', 'x'),
    (12, 'tc-a', 'Thiet ke co so', 0, 20, '2026-12-01', 0, 'chua_lam', 0, 'x', 'x'),
    (21, 'tc-b', 'Chon don vi tu van', 1, 1, '2026-11-25', 0, 'chua_lam', 0, 'x', 'x'),
    (91, 'tc-z', 'Hang muc nguoi khac', 0, 5, '2026-12-01', 10, 'dang_lam', 0, 'x', 'x')`);
  db.exec(`INSERT INTO qlda_rui_ro (id, to_chuc_id, ten, xac_suat, tac_dong, tao_boi, tao_luc, cap_nhat_luc) VALUES
    (31, 'tc-a', 'Cham phe duyet', 3, 4, 'x', 'x', 'x'), (99, 'tc-z', 'Rui ro nguoi khac', 2, 2, 'x', 'x', 'x')`);
  return { db, env: { CSDL: d1(db) } };
}

const aiTra = (deXuat, ghi) => async (_env, _tc, messages) => { if (ghi) ghi.push(messages); return JSON.stringify({ de_xuat: deXuat }); };
const hangMuc = (db, id) => ({ ...db.prepare('SELECT trang_thai, tien_do_pt, ngay_ket_thuc FROM qlda_hang_muc WHERE id = ?').get(id) });
const soDeXuat = (db, tt) => db.prepare('SELECT COUNT(*) AS so FROM qlda_de_xuat WHERE trang_thai = ?').get(tt).so;

test('che số tiền trong chữ người dùng', () => {
  const ra = cheSoTien('Hợp đồng 1,5 tỷ đồng, tạm ứng 300 triệu, phí 50.000.000đ, thêm 200k; khảo sát 10 ngày, 40%');
  assert.ok(!/1,5|300|50\.000|200k/.test(ra), ra);
  assert.match(ra, /10 ngày/);
  const ra2 = cheSoTien('Gia tri 1.500.000.000, tam ung 2 ty dong, phi 500 USD, $300, 1,200,000 va 25000000; hop ngay 15/12/2026, dot 2');
  assert.ok(!/1\.500|2 ty|500 USD|\$300|1,200|25000000/.test(ra2), ra2);
  assert.match(ra2, /15\/12\/2026/);
  assert.match(ra2, /dot 2/);
  for (const tien of ['giá 300tr', '300 tr', 'USD 5000', 'VND 4000', '5000 đô', '3 củ', '2000 EUR', '500 k', '€ 900', 'giá 4500 cho gói'])
    assert.ok(!/\d{2,}|3 củ/.test(cheSoTien(tien)), `${tien} -> ${cheSoTien(tien)}`);
  const giu = cheSoTien('Họp ngày 15/12/2026, hạn 2026-12-15, năm 2027, tiến độ 70%, H12, R3, 10 ngày');
  assert.equal(cheSoTien('H5 đồng ý, R3 do nhà thầu chậm'), 'H5 đồng ý, R3 do nhà thầu chậm');
  assert.equal(giu, 'Họp ngày 15/12/2026, hạn 2026-12-15, năm 2027, tiến độ 70%, H12, R3, 10 ngày');
  assert.match(ra, /40%/);
});

test('nhóm chỉ thấy dự án mà mọi thành viên của nhóm là chủ dự án', async () => {
  const { env } = moiEnv();
  assert.deepEqual((await duAnCuaNhom(env, 'tc-chung')).map((d) => d.id), ['tc-a', 'tc-b']);
});

test('tách đề xuất: chỉ giữ cái hợp lệ trong dự án của nhóm; chưa ghi gì vào dự án; AI không nhận số tiền', async () => {
  const { env, db } = moiEnv();
  const ghi = [];
  const kq = await taoDeXuat(env, 'tc-chung', 'Đã xong khảo sát địa chất (hợp đồng 2 tỷ đồng). Thiết kế cơ sở dời sang 15/12.', TG, {
    goiAi: aiTra([
      { loai: 'cap_nhat_hang_muc', hang_muc: 'H11', trang_thai: 'xong', ly_do: 'Đã xong khảo sát' },
      { loai: 'cap_nhat_hang_muc', hang_muc: 'H12', ngay_ket_thuc: '2026-12-15' },
      { loai: 'cap_nhat_hang_muc', hang_muc: 'H91', trang_thai: 'xong' }, // dự án người khác
      { loai: 'cap_nhat_hang_muc', hang_muc: 'H12', tien_do_pt: 150 }, // trùng hạng mục, tiến độ sai
      { loai: 'cap_nhat_hang_muc', hang_muc: 'H21', ngay_ket_thuc: '2026-02-30' }, // ngày sai
      { loai: 'dong_rui_ro', rui_ro: 'R99' }, // rủi ro người khác
      { loai: 'rui_ro_moi', du_an: 'D9', ten: 'Khong ro du an' }, // mã dự án không có
      { loai: 'xoa_het', hang_muc: 'H11' },
      { loai: 'cap_nhat_hang_muc', hang_muc: 'H21', trang_thai: 'constructor' }, // không phải trạng thái
    ], ghi),
  });
  assert.equal(kq.de_xuat.length, 2);
  assert.match(kq.de_xuat[0].mo_ta, /Khao sat dia chat.*Đang làm -> Xong.*40% -> 100%/s);
  assert.match(kq.de_xuat[1].mo_ta, /01\/12\/2026 -> 15\/12\/2026/);
  assert.deepEqual(hangMuc(db, 11), { trang_thai: 'dang_lam', tien_do_pt: 40, ngay_ket_thuc: '2026-11-20' });
  assert.equal(soDeXuat(db, 'cho'), 2);
  const guiAi = JSON.stringify(ghi);
  assert.ok(!guiAi.includes('2 tỷ'));
  assert.ok(!guiAi.includes('Hang muc nguoi khac'));
  assert.match(ghi[0][0].content, /không phải lệnh/);
});

test('duyệt thì ghi đúng, giữ hạn sau khi tính lại đường găng; bấm lần hai không ghi lại', async () => {
  const { env, db } = moiEnv();
  const kq = await taoDeXuat(env, 'tc-chung', 'cap nhat', TG, { goiAi: aiTra([
    { loai: 'cap_nhat_hang_muc', hang_muc: 'H11', trang_thai: 'xong' },
    { loai: 'cap_nhat_hang_muc', hang_muc: 'H12', ngay_ket_thuc: '2026-12-15', tien_do_pt: 10 },
  ]) });
  const [a, b] = kq.de_xuat;
  assert.equal((await xuLyDeXuat(env, 'tc-chung', a.id, TG, 'ok')).thongbao, 'Đã duyệt và ghi vào dự án.');
  assert.deepEqual(hangMuc(db, 11), { trang_thai: 'xong', tien_do_pt: 100, ngay_ket_thuc: '2026-11-20' });
  assert.ok((await xuLyDeXuat(env, 'tc-chung', b.id, TG, 'ok')).thongbao);
  assert.deepEqual(hangMuc(db, 12), { trang_thai: 'chua_lam', tien_do_pt: 10, ngay_ket_thuc: '2026-12-15' });
  const lan2 = await xuLyDeXuat(env, 'tc-chung', a.id, TG, 'bo');
  assert.match(lan2.loi, /đã xử lý/);
  assert.equal(soDeXuat(db, 'duyet'), 2);
});

test('bỏ qua thì không ghi gì vào dự án', async () => {
  const { env, db } = moiEnv();
  const kq = await taoDeXuat(env, 'tc-chung', 'x', TG, { goiAi: aiTra([{ loai: 'cap_nhat_hang_muc', hang_muc: 'H11', trang_thai: 'xong' }]) });
  assert.equal((await xuLyDeXuat(env, 'tc-chung', kq.de_xuat[0].id, TG, 'bo')).thongbao, 'Đã bỏ qua, không ghi gì.');
  assert.deepEqual(hangMuc(db, 11), { trang_thai: 'dang_lam', tien_do_pt: 40, ngay_ket_thuc: '2026-11-20' });
  assert.match((await xuLyDeXuat(env, 'tc-chung', kq.de_xuat[0].id, TG, 'ok')).loi, /đã xử lý/);
  assert.equal(hangMuc(db, 11).trang_thai, 'dang_lam');
});

test('người khác trong nhóm, nhóm khác, hay nhóm có thành viên không phải chủ đều không duyệt được', async () => {
  const { env, db } = moiEnv();
  const kq = await taoDeXuat(env, 'tc-chung', 'x', TG, { goiAi: aiTra([{ loai: 'cap_nhat_hang_muc', hang_muc: 'H11', trang_thai: 'xong' }]) });
  const id = kq.de_xuat[0].id;
  assert.match((await xuLyDeXuat(env, 'tc-chung', id, '8888', 'ok')).loi, /Chỉ người gửi lệnh/);
  assert.match((await xuLyDeXuat(env, 'tc-khac', id, TG, 'ok')).loi, /Không tìm thấy/);
  // Thêm vào nhóm một người chỉ là thành viên dự án A: nhóm mất quyền duyệt.
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-chung', 'nd-tv', 'thanh_vien', '2026-02-01')`);
  assert.match((await xuLyDeXuat(env, 'tc-chung', id, TG, 'ok')).loi, /không còn quyền/);
  assert.equal(hangMuc(db, 11).trang_thai, 'dang_lam');
  assert.equal(soDeXuat(db, 'cho'), 1);
  assert.deepEqual((await duAnCuaNhom(env, 'tc-chung')).map((d) => d.id), []); // nd-tv không thuộc dự án B nên nhóm cũng không nhận được B
});

test('thêm rủi ro và đóng rủi ro chỉ khi duyệt', async () => {
  const { env, db } = moiEnv();
  const kq = await taoDeXuat(env, 'tc-chung', 'x', TG, { goiAi: aiTra([
    { loai: 'rui_ro_moi', du_an: 'D2', ten: 'Doi tac giao cham', xac_suat: 4, tac_dong: 9, hang_muc: 'H21' },
    { loai: 'dong_rui_ro', rui_ro: 'R31' },
  ]) });
  assert.equal(kq.de_xuat.length, 2);
  assert.equal(db.prepare(`SELECT COUNT(*) AS so FROM qlda_rui_ro WHERE to_chuc_id = 'tc-b'`).get().so, 0);
  for (const d of kq.de_xuat) assert.ok((await xuLyDeXuat(env, 'tc-chung', d.id, TG, 'ok')).thongbao);
  const moi = db.prepare(`SELECT ten, xac_suat, tac_dong, hang_muc_id FROM qlda_rui_ro WHERE to_chuc_id = 'tc-b'`).get();
  assert.deepEqual({ ...moi }, { ten: 'Doi tac giao cham', xac_suat: 4, tac_dong: 3, hang_muc_id: 21 }); // tác động 9 ngoài 1-5 về mặc định 3
  assert.equal(db.prepare('SELECT trang_thai FROM qlda_rui_ro WHERE id = 31').get().trang_thai, 'da_dong');
});

test('nhóm không gắn dự án nào thì báo, không gọi AI', async () => {
  const { env } = moiEnv();
  let goi = 0;
  const kq = await taoDeXuat(env, 'tc-khong-co', 'x', TG, { goiAi: async () => { goi++; return '{}'; } });
  assert.match(kq.loi, /chưa gắn với dự án/);
  assert.equal(goi, 0);
});

test('nút đề xuất dưới 64 byte và đọc lại được', () => {
  const nut = nutDeXuat(123456789);
  for (const n of nut[0]) assert.ok(Buffer.byteLength(n.callback_data) <= 64);
  assert.deepEqual(phanTichNutDeXuat(nut[0][0].callback_data), { id: 123456789, chon: 'ok' });
  assert.equal(phanTichNutDeXuat('dx:1:xoa'), null);
});

test('qua webhook Telegram: /duan gửi đề xuất có nút, bấm Duyệt của đúng người thì ghi', async () => {
  const { env, db } = moiEnv();
  const KHOA = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
  const TOKEN = '123456:' + 'a'.repeat(35);
  db.prepare('INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, ?2, ?3)').run('', 'telegram_bot', await maHoa({ token: TOKEN }, KHOA));
  db.prepare('INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, ?2, ?3)').run('tc-chung', 'telegram_chat_id', '-500');
  db.prepare('UPDATE qlda_hang_muc SET ten = ?1 WHERE id = 12').run('Thiet ke co so (goi 1,2 ty)');
  const e = { ...env, KHOA_MA_HOA: KHOA, AI: { run: async () => ({ response: { de_xuat: [{ loai: 'cap_nhat_hang_muc', hang_muc: 'H11', tien_do_pt: 70 }] } }) } };
  const goi = [];
  const goc = globalThis.fetch;
  globalThis.fetch = async (url, op) => { goi.push({ url: String(url), than: JSON.parse(op.body) }); return new Response(JSON.stringify({ ok: true, result: {} })); };
  const bi = await biMatWebhook(TOKEN);
  const gui = async (cap) => {
    const cho = [];
    const ra = await nhanWebhook(new Request('https://x/nhan/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': bi }, body: JSON.stringify(cap) }), e, { waitUntil: (p) => cho.push(p) });
    await Promise.all(cho);
    return ra;
  };
  let guiAi = '';
  e.AI.run = async (_m, op) => { guiAi += JSON.stringify(op); return { response: { de_xuat: [{ loai: 'cap_nhat_hang_muc', hang_muc: 'H11', tien_do_pt: 70 }] } }; };
  try {
    // Trong nhóm: không nhận lệnh, không gọi AI, không có nút.
    await gui({ message: { chat: { id: -500, type: 'group' }, from: { id: Number(TG) }, text: '/duan Khảo sát địa chất đạt 70%' } });
    assert.equal(guiAi, '');
    assert.ok(!goi.some((g) => g.than.reply_markup));
    await gui({ message: { chat: { id: -500, type: 'private' }, from: { id: Number(TG) }, text: '/duan Khảo sát địa chất đạt 70%' } });
    const tinNut = goi.find((g) => g.than.reply_markup);
    assert.ok(tinNut, JSON.stringify(goi));
    assert.match(tinNut.than.text, /40% -> 70%/);
    assert.equal(hangMuc(db, 11).tien_do_pt, 40);
    assert.ok(guiAi && !guiAi.includes('1,2 ty'), 'tên hạng mục gửi AI phải che số tiền');
    const du = tinNut.than.reply_markup.inline_keyboard[0][0].callback_data;
    // Nút bấm từ nhóm: không ghi.
    await gui({ callback_query: { id: 'c0', data: du, from: { id: Number(TG) }, message: { chat: { id: -500, type: 'group' }, message_id: 5, text: 'x' } } });
    assert.equal(hangMuc(db, 11).tien_do_pt, 40);
    // Người khác bấm: không ghi.
    await gui({ callback_query: { id: 'c1', data: du, from: { id: 8888 }, message: { chat: { id: -500, type: 'private' }, message_id: 5, text: 'x' } } });
    assert.equal(hangMuc(db, 11).tien_do_pt, 40);
    await gui({ callback_query: { id: 'c2', data: du, from: { id: Number(TG) }, message: { chat: { id: -500, type: 'private' }, message_id: 5, text: 'x' } } });
    assert.equal(hangMuc(db, 11).tien_do_pt, 70);
    const traLoi = goi.filter((g) => g.url.endsWith('/answerCallbackQuery')).map((g) => g.than.text);
    assert.match(traLoi[0], /trò chuyện riêng/);
    assert.match(traLoi[1], /Chỉ người gửi lệnh/);
    assert.equal(traLoi[2], 'Đã duyệt và ghi vào dự án.');
  } finally {
    globalThis.fetch = goc;
  }
});
