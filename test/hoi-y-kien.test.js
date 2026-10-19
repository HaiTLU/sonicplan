// Ô hỏi ý kiến trên Telegram khi AI chưa chắc: tạo, giới hạn, áp câu trả lời, ghi nhớ bài học. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { docChuaChac } from '../src/ai.js';
import { apDungTraLoi, chonLuaChon, docCauHoiMoi, dungTinHoi, nutHoi, phanTichNutHoi, taoCauHoi, TOI_DA_DANG_CHO } from '../src/hoi-y-kien.js';
import { docViecDaSua } from '../src/viec.js';
import { tachViecChoToChuc } from '../src/viec.js';
import { guiCauHoiMoi } from '../src/telegram.js';

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (1, 'tc1', 'AI Lab', '2026-01-01'), (2, 'tc1', 'Đào tạo ngắn hạn', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}
const themViec = (db, v = {}) => db.prepare(
  `INSERT INTO viec (id, to_chuc_id, tieu_de, han_ngay, gio_hen, nhom, du_an_id, trang_thai, nguon, tao_luc, cap_nhat_luc) VALUES (?, 'tc1', ?, ?, ?, ?, ?, 'mo', 'zalo', '2026-10-19', '2026-10-19')`,
).run(v.id || 1, v.tieu_de || 'Qua chỗ lớp AI', v.han_ngay ?? '2026-10-20', v.gio_hen ?? '05:30', v.nhom ?? 'anh_tu_lam', v.du_an_id ?? null);

test('docChuaChac: bỏ loại lạ, thiếu câu hỏi, giá trị rỗng; tối đa 3 lựa chọn', () => {
  assert.equal(docChuaChac(null), null);
  assert.equal(docChuaChac({ loai: 'abc', cau_hoi: 'x' }), null);
  assert.equal(docChuaChac({ loai: 'gio', cau_hoi: '' }), null);
  assert.deepEqual(docChuaChac({ loai: 'gio', cau_hoi: 'Mấy giờ?', lua_chon: ['05:30', '17:30', '05:30', '', '06:00', '07:00'] }), { loai: 'gio', cau_hoi: 'Mấy giờ?', lua_chon: ['05:30', '17:30', '06:00'] });
});

test('lựa chọn: giờ, ngày, dự án phải đúng dạng; việc và nhóm do code đặt', () => {
  assert.deepEqual(chonLuaChon({ loai: 'gio', lua_chon: ['5h30', '17:30'] }), ['17:30']);
  assert.deepEqual(chonLuaChon({ loai: 'han', lua_chon: ['2026-10-25', 'thứ 6'] }), ['2026-10-25']);
  assert.deepEqual(chonLuaChon({ loai: 'du_an', lua_chon: ['ai lab', 'Dự án lạ'] }, ['AI Lab']), ['AI Lab']);
  assert.deepEqual(chonLuaChon({ loai: 'viec', lua_chon: ['bịa'] }), ['Đúng là việc', 'Không phải việc']);
  assert.equal(chonLuaChon({ loai: 'nhom' }).length, 3);
});

test('nút bấm: dữ liệu đủ ngắn, đọc lại được, từ chối dữ liệu lạ', () => {
  const nut = nutHoi({ id: 123456, loai: 'han', lua_chon: ['2026-10-25', '2026-10-26'] });
  assert.deepEqual(nut[0].map((n) => n.text), ['25/10', '26/10']);
  assert.deepEqual(nut[1].map((n) => n.text), ['Bỏ qua']);
  for (const n of nut.flat()) assert.ok(new TextEncoder().encode(n.callback_data).length <= 64);
  assert.deepEqual(phanTichNutHoi('h:12:1'), { cau_hoi_id: 12, chon: 1 });
  assert.deepEqual(phanTichNutHoi('h:12:bo'), { cau_hoi_id: 12, chon: 'bo' });
  assert.equal(phanTichNutHoi('h:12:x'), null);
  assert.equal(phanTichNutHoi('v:12:xong'), null);
  assert.equal(nutHoi({ id: 1, loai: 'nguoi', lua_chon: [] }).length, 1, 'không có lựa chọn thì chỉ còn nút Bỏ qua');
});

test('tạo ô hỏi: không hỏi trùng, không hỏi khi đang chờ quá nhiều', async () => {
  const { db, env } = moiTruong();
  themViec(db);
  const gio = { loai: 'gio', cau_hoi: 'Hẹn 5h30 sáng hay chiều?', lua_chon: ['05:30', '17:30'] };
  assert.ok(await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: gio, boiCanh: 'Lớp AI', tinTrich: 'a 5h30 nhé' }));
  assert.equal(await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: gio }), null, 'cùng việc, cùng loại: hỏi một lần');
  assert.equal(await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: { loai: 'gio', cau_hoi: 'x', lua_chon: [] } }), null, 'hỏi giờ mà không có giờ nào để chọn thì bỏ');
  for (let i = 2; i <= TOI_DA_DANG_CHO + 1; i++) themViec(db, { id: i, tieu_de: `Việc số ${i}` });
  for (let i = 2; i <= TOI_DA_DANG_CHO + 1; i++) await taoCauHoi(env, 'tc1', { viecId: i, chuaChac: { loai: 'viec', cau_hoi: 'Có phải việc?' } });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cau_hoi_ai WHERE trang_thai = 'moi'").get().n, TOI_DA_DANG_CHO);
  const ds = await docCauHoiMoi(env, 'tc1');
  assert.equal(ds.length, 3, 'mỗi lần gửi tối đa 3 ô');
  assert.match(dungTinHoi(ds[0]), /giờ hẹn[\s\S]*Qua chỗ lớp AI \(05:30 20\/10\)[\s\S]*Hẹn 5h30 sáng hay chiều/);
});

test('trả lời giờ: sửa việc, ghi lần sửa cho AI học, nhớ bài học; trả lời lần hai thì không áp lại', async () => {
  const { db, env } = moiTruong();
  themViec(db);
  const id = await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: { loai: 'gio', cau_hoi: 'Hẹn 5h30 sáng hay chiều?', lua_chon: ['05:30', '17:30'] }, boiCanh: 'Lớp AI', tinTrich: 'a 5h30 nhé' });
  db.prepare("UPDATE cau_hoi_ai SET trang_thai = 'cho', tg_tin_id = 9 WHERE id = ?").run(id);
  const kq = await apDungTraLoi(env, 'tc1', id, { chi_so: 1 });
  assert.match(kq.thongbao, /Đã đặt giờ 17:30/);
  assert.equal(db.prepare('SELECT gio_hen FROM viec WHERE id = 1').get().gio_hen, '17:30');
  const sua = await docViecDaSua(env, 'tc1');
  assert.match(sua[0], /Sửa hạn: giờ 05:30 -> 17:30, lý do: anh trả lời ô hỏi/);
  const nho = db.prepare("SELECT * FROM ghi_nho WHERE tieu_de LIKE 'Anh trả lời ô hỏi giờ hẹn%'").get();
  assert.equal(nho.nguon, 'tay');
  assert.match(nho.noi_dung, /a 5h30 nhé.*anh chọn "17:30"/);
  assert.equal(await apDungTraLoi(env, 'tc1', id, { chi_so: 0 }), null);
});

test('trả lời bằng chữ: giờ đọc từ chữ, chữ lạ thì giữ ô hỏi mở; xác nhận đúng thì ghi "đúng như AI đoán"', async () => {
  const { db, env } = moiTruong();
  themViec(db);
  const id = await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: { loai: 'gio', cau_hoi: 'Mấy giờ?', lua_chon: ['05:30', '17:30'] }, boiCanh: 'Lớp AI', tinTrich: 'a 5h30 nhé' });
  db.prepare("UPDATE cau_hoi_ai SET trang_thai = 'cho' WHERE id = ?").run(id);
  assert.match((await apDungTraLoi(env, 'tc1', id, { chu: 'lúc nào cũng được' })).loi, /chưa hiểu giờ/);
  assert.equal(db.prepare('SELECT trang_thai FROM cau_hoi_ai WHERE id = ?').get(id).trang_thai, 'cho');
  assert.match((await apDungTraLoi(env, 'tc1', id, { chu: '5h30' })).thongbao, /Đã đặt giờ 17:30/, '5h30 viết trống là buổi chiều, khác 05:30 AI đã điền');
  assert.equal(db.prepare('SELECT gio_hen FROM viec WHERE id = 1').get().gio_hen, '17:30');
  const kq2 = await (async () => {
    themViec(db, { id: 2, gio_hen: '17:30' });
    const id2 = await taoCauHoi(env, 'tc1', { viecId: 2, chuaChac: { loai: 'gio', cau_hoi: 'Mấy giờ nữa?', lua_chon: ['17:30'] }, boiCanh: 'Lớp AI', tinTrich: 'a 5h30 nhé' });
    db.prepare("UPDATE cau_hoi_ai SET trang_thai = 'cho' WHERE id = ?").run(id2);
    return apDungTraLoi(env, 'tc1', id2, { chi_so: 0 });
  })();
  assert.match(kq2.thongbao, /giữ nguyên/);
  const nho = db.prepare("SELECT noi_dung FROM ghi_nho WHERE tieu_de LIKE 'Anh trả lời ô hỏi giờ hẹn%'").get();
  assert.equal(nho.noi_dung.split('\n').length, 2, 'cùng bối cảnh gộp vào một mục');
  assert.match(nho.noi_dung, /đúng như AI đoán/);
});

test('trả lời loại việc, dự án, có phải việc không', async () => {
  const { db, env } = moiTruong();
  themViec(db, { id: 1 });
  themViec(db, { id: 2, tieu_de: 'Mua nước cho lớp' });
  const hoi = async (viecId, chuaChac) => {
    const id = await taoCauHoi(env, 'tc1', { viecId, chuaChac, tenDuAn: ['AI Lab', 'Đào tạo ngắn hạn'], boiCanh: 'Nhóm A', tinTrich: 'tin gốc' });
    db.prepare("UPDATE cau_hoi_ai SET trang_thai = 'cho' WHERE id = ?").run(id);
    return id;
  };
  await apDungTraLoi(env, 'tc1', await hoi(1, { loai: 'du_an', cau_hoi: 'Dự án nào?', lua_chon: ['AI Lab', 'Đào tạo ngắn hạn'] }), { chi_so: 1 });
  assert.equal(db.prepare('SELECT du_an_id FROM viec WHERE id = 1').get().du_an_id, 2);
  await apDungTraLoi(env, 'tc1', await hoi(1, { loai: 'nhom', cau_hoi: 'Ai làm?' }), { chi_so: 0 });
  assert.equal(db.prepare('SELECT nhom FROM viec WHERE id = 1').get().nhom, 'claude_tu_lam');
  const kq = await apDungTraLoi(env, 'tc1', await hoi(2, { loai: 'viec', cau_hoi: 'Có phải việc thật?' }), { chu: 'không phải' });
  assert.match(kq.thongbao, /Đã bỏ việc này/);
  assert.equal(db.prepare('SELECT trang_thai FROM viec WHERE id = 2').get().trang_thai, 'huy');
  assert.match((await docViecDaSua(env, 'tc1')).join('\n'), /Hủy việc: "Mua nước cho lớp", lý do: anh trả lời ô hỏi/);
  await apDungTraLoi(env, 'tc1', await hoi(1, { loai: 'nguoi', cau_hoi: 'Chị Lan nào?' }), { chu: 'Chị Lan phòng Đào tạo' });
  assert.match(db.prepare('SELECT ghi_chu FROM viec WHERE id = 1').get().ghi_chu, /Người liên quan \(anh xác nhận\): Chị Lan phòng Đào tạo/);
});

test('câu trả lời có mật khẩu hoặc số thẻ thì không lưu', async () => {
  const { db, env } = moiTruong();
  themViec(db);
  const id = await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: { loai: 'nguoi', cau_hoi: 'Ai?' } });
  db.prepare("UPDATE cau_hoi_ai SET trang_thai = 'cho' WHERE id = ?").run(id);
  assert.match((await apDungTraLoi(env, 'tc1', id, { chu: 'mật khẩu là 1234' })).loi, /không lưu mật khẩu/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ghi_nho').get().n, 0);
});

test('chưa nối Telegram thì ô hỏi bị bỏ, không dồn lại', async () => {
  const { db, env } = moiTruong();
  themViec(db);
  await taoCauHoi(env, 'tc1', { viecId: 1, chuaChac: { loai: 'viec', cau_hoi: 'Có phải việc?' } });
  assert.equal(await guiCauHoiMoi(env, 'tc1'), 0);
  assert.equal(db.prepare('SELECT trang_thai FROM cau_hoi_ai').get().trang_thai, 'bo');
});

test('luồng đủ: AI báo chưa chắc thì tạo việc kèm ô hỏi, tối đa 3 ô mỗi lượt', async () => {
  const { db, env } = moiTruong();
  const viec = ['Gọi lại thầy Khẩn về lịch dạy', 'Gửi báo giá cho chị Lan', 'Nộp hồ sơ dự án AI Lab', 'Soạn kế hoạch khóa Marketing'].map((tieu_de) => ({
    tieu_de, han_ngay: '2026-10-25', tin_so: 1, chua_chac: { loai: 'han', cau_hoi: `Hạn của "${tieu_de}" là ngày nào?`, lua_chon: ['2026-10-25', '2026-10-27'] },
  }));
  env.AI = { run: async () => ({ response: JSON.stringify({ viec }) }) };
  db.prepare(`INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai, da_tach) VALUES ('tc1','zalo','a','Lan','Nhóm A','anh làm giúp em mấy việc này nhé','2026-10-19T01:00:00Z','2026-10-19T01:00:00Z','nhom:1',0)`).run();
  const kq = await tachViecChoToChuc(env, 'tc1');
  assert.equal(kq.so_viec, 4);
  assert.equal(kq.so_cau_hoi, 3);
  const dong = db.prepare('SELECT boi_canh, loai FROM cau_hoi_ai').all();
  assert.equal(dong.length, 3);
  assert.equal(dong[0].boi_canh, 'Nhóm A');
});
