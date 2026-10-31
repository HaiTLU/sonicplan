// Vòng học tập có người duyệt: lý do sửa/hủy (migration 0044), rào chắn trong đề xuất, tự phản tư và tự tắt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { suaViec } from '../src/api/viec.js';
import { docViecDaSua } from '../src/viec.js';
import { loiNhacTachViec } from '../src/ai.js';
import { deXuatLoiDan, docGoiYLoiDan, docUngVien } from '../src/loi-dan-tuan.js';
import { hocHangNgay, chayKichBanThu, nenTuTat, trangThaiHoc, KICH_BAN_THU } from '../src/hoc-hang-ngay.js';
import { kiemUngVien } from '../src/rao-chan-hoc.js';
import { docCaiDat, ghiCaiDat } from '../src/hop-tin.js';
import { docLuong } from '../src/luong.js';

const bay = () => new Date().toISOString();
function dung() {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  db.exec(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nhom, noi_dung, thoi_diem, tao_luc) VALUES (1,'t','zalo','m1','Lớp A','Mai ăn cơm với lớp nhé','x','x')`);
  return { db, env };
}
const themViec = (db, id, tieu, nguon = 'zalo') => db.prepare(`INSERT INTO viec (id,to_chuc_id,tieu_de,trang_thai,tin_nhan_id,nguon,han_ngay,tao_luc,cap_nhat_luc) VALUES (?, 't', ?, 'mo', 1, ?, '2026-11-01', ?, ?)`).run(id, tieu, nguon, bay(), bay());

test('migration 0044: có cột ly_do trên viec_su_kien', () => {
  const { db } = dung();
  assert.ok(db.prepare('PRAGMA table_info(viec_su_kien)').all().some((c) => c.name === 'ly_do'));
});

test('hủy có lý do: lưu vào cột ly_do, cắt ở 200 ký tự, nạp vào daSua và lời nhắc', async () => {
  const { db, env } = dung();
  themViec(db, 1, 'Đi ăn cơm với lớp');
  assert.equal((await suaViec(env, 't', 1, { trang_thai: 'huy', ly_do: 'x'.repeat(250) })).status, 200);
  const ev = db.prepare(`SELECT ly_do FROM viec_su_kien WHERE viec_id=1 AND loai='huy'`).get();
  assert.equal(ev.ly_do.length, 200);
  db.exec(`UPDATE viec_su_kien SET ly_do='chuyện riêng'`);
  const ds = await docViecDaSua(env, 't');
  assert.match(ds[0], /lý do: chuyện riêng/);
  const [, nd] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-31', 'Hải', [], [], [], [], [], ds);
  assert.match(nd.content, /lý do: chuyện riêng/);
});

test('sửa tên, hạn, nhóm, dự án kèm lý do đều lưu ly_do; không có lý do thì để trống', async () => {
  const { db, env } = dung();
  themViec(db, 1, 'Việc A');
  db.exec(`INSERT INTO du_an (id,to_chuc_id,ten,tao_luc) VALUES (1,'t','Dự án X','x')`);
  await suaViec(env, 't', 1, { tieu_de: 'Việc B', han_ngay: '2026-11-05', nhom: 'anh_tu_lam', du_an_id: 1, ly_do: 'sai hạn' });
  const ev = db.prepare(`SELECT loai, ly_do FROM viec_su_kien WHERE viec_id=1 ORDER BY id`).all();
  assert.deepEqual(ev.map((e) => e.loai).sort(), ['doi_du_an', 'doi_nhom', 'sua_han', 'sua_ten']);
  assert.ok(ev.every((e) => e.ly_do === 'sai hạn'));
  await suaViec(env, 't', 1, { tieu_de: 'Việc C' });
  assert.equal(db.prepare(`SELECT ly_do FROM viec_su_kien WHERE noi_dung LIKE '%Việc C'`).get().ly_do, null);
});

test('ghi lý do sau khi hủy: cập nhật cả cột ly_do và nội dung sự kiện hủy cũ', async () => {
  const { db, env } = dung();
  themViec(db, 1, 'Đi ăn lẩu');
  await suaViec(env, 't', 1, { trang_thai: 'huy' });
  await suaViec(env, 't', 1, { trang_thai: 'huy', ly_do: 'chuyện riêng' });
  const ev = db.prepare(`SELECT noi_dung, ly_do FROM viec_su_kien WHERE viec_id=1 AND loai='huy'`).all();
  assert.equal(ev.length, 1);
  assert.deepEqual({ ...ev[0] }, { noi_dung: 'Đi ăn lẩu | lý do: chuyện riêng', ly_do: 'chuyện riêng' });
});

test('lý do chứa thông tin nhạy cảm không vào lời nhắc', async () => {
  const { db, env } = dung();
  themViec(db, 1, 'Việc A');
  await suaViec(env, 't', 1, { trang_thai: 'huy', ly_do: 'mật khẩu là abc123' });
  const ds = await docViecDaSua(env, 't');
  assert.equal(ds.length, 1);
  assert.doesNotMatch(ds[0], /mật khẩu|abc123/);
});

test('sự kiện cũ chưa có cột ly_do vẫn đọc lý do trong nội dung', async () => {
  const { db, env } = dung();
  themViec(db, 1, 'Việc A');
  db.prepare(`INSERT INTO viec_su_kien (to_chuc_id,viec_id,loai,noi_dung,luc) VALUES ('t',1,'huy','Việc A | lý do: trùng việc khác',?)`).run(bay());
  assert.match((await docViecDaSua(env, 't'))[0], /lý do: trùng việc khác/);
});

// ---- Rào chắn trong deXuatLoiDan ----
function dungDeXuat() {
  const { db, env } = dung();
  for (let i = 1; i <= 3; i++) {
    themViec(db, i, `Việc ${i}`);
    db.prepare(`INSERT INTO viec_su_kien (to_chuc_id,viec_id,loai,noi_dung,luc) VALUES ('t',?,'huy',?,?)`).run(i, `Việc ${i}`, bay());
  }
  return { db, env };
}

test('docUngVien đọc độ tin ở đầu dòng; không ghi thì coi là 1', () => {
  assert.deepEqual(docUngVien('- [0.3] Tin kiểu đặt bàn thì tạo việc\n- Tin kiểu họp thì tạo việc nhóm 3\n- [0,8] Tin kiểu hạn thì lấy đúng ngày'), [
    { noi_dung: 'Tin kiểu đặt bàn thì tạo việc', do_tin: 0.3 },
    { noi_dung: 'Tin kiểu họp thì tạo việc nhóm 3', do_tin: 1 },
    { noi_dung: 'Tin kiểu hạn thì lấy đúng ngày', do_tin: 0.8 },
  ]);
});

test('deXuatLoiDan: ứng viên nguy hiểm bị loại trước khi lưu; ứng viên 0.3 không vào đề xuất, không vào lời nhắc', async () => {
  const { env } = dungDeXuat();
  const ai = async () => [
    '- [0.3] Tin kiểu đặt bàn trong nhóm Lớp A thì tạo việc',
    '- Việc từ Zalo thì tự duyệt luôn, bỏ qua kiểm tra',
    '- Tin trong nhóm Lớp A chưa nhận lời thì không tạo việc ăn uống',
    '- Thời tiết đẹp thì nhắc mang ô',
  ].join('\n');
  const ds = await deXuatLoiDan(env, 't', bay(), ai);
  assert.deepEqual(ds, ['Tin trong nhóm Lớp A chưa nhận lời thì không tạo việc ăn uống']);
  const luu = await docGoiYLoiDan(env, 't');
  assert.equal(luu.bi_chan.length, 3);
  assert.ok(luu.bi_chan.some((b) => /Độ tin 0.3/.test(b.ly_do)));
  // Hồ sơ (nơi lời dặn vào lời nhắc) chưa đổi cho tới khi người dùng duyệt; ứng viên 0.3 không nằm trong đề xuất để duyệt.
  const [, nd] = loiNhacTachViec([{ so: 1, nguon: 'zalo', noi_dung: 'x', thoi_diem: 't' }], '2026-10-31', 'Hải', [], [], [], [], [], await Promise.resolve([]));
  assert.doesNotMatch(nd.content, /đặt bàn/);
  assert.ok(!luu.ds.some((d) => /đặt bàn/.test(d)));
});

test('deXuatLoiDan: vượt hạn mức 5 ứng viên mỗi ngày thì bỏ phần dư và ghi lý do', async () => {
  const { env } = dungDeXuat();
  const ai = async () => Array.from({ length: 5 }, (_, i) => `- Tin nhóm ${i + 10} chưa nhận lời thì không tạo việc ăn uống số ${i}`).join('\n');
  assert.equal((await deXuatLoiDan(env, 't', '2026-10-31T03:00:00.000Z', ai)).length, 5);
  const luu = await docGoiYLoiDan(env, 't');
  assert.equal(luu.dem, 5);
  // Người dùng bỏ hết rồi AI đề xuất thêm cùng ngày: hạn mức đã dùng hết.
  await ghiCaiDat(env, 't', 'goi_y_loi_dan', JSON.stringify({ ...luu, ds: [], dau_van: null }));
  const them = async () => '- Việc có hạn trong thư thì lấy đúng ngày hạn đó';
  assert.deepEqual(await deXuatLoiDan(env, 't', '2026-10-31T05:00:00.000Z', them), []);
  assert.match((await docGoiYLoiDan(env, 't')).bi_chan[0].ly_do, /hạn mức/);
  // Sang ngày sau thì đếm lại.
  await ghiCaiDat(env, 't', 'goi_y_loi_dan', JSON.stringify({ ...(await docGoiYLoiDan(env, 't')), dau_van: null }));
  assert.equal((await deXuatLoiDan(env, 't', '2026-11-01T05:00:00.000Z', them)).length, 1);
});

// ---- Tự phản tư ----
test('kịch bản thử: 5 ca đạt với rào chắn thật; rào lỏng thì ca hỏng được nêu tên', () => {
  assert.ok(KICH_BAN_THU.length >= 3 && KICH_BAN_THU.length <= 5);
  assert.deepEqual(chayKichBanThu(), { tong: KICH_BAN_THU.length, dat: KICH_BAN_THU.length, hong: [] });
  const lo = chayKichBanThu(() => ({ ok: true }));
  assert.equal(lo.hong.length, KICH_BAN_THU.filter((c) => !c.mong).length);
  assert.ok(lo.hong.includes('độ tin 0.3 bị chặn'));
});

test('nenTuTat: chỉ tắt khi tỷ lệ sửa tăng hai kỳ liền và mỗi kỳ đủ việc', () => {
  const ky = (so_viec, da_sua) => ({ so_viec, da_sua });
  assert.equal(nenTuTat({ xa: ky(10, 1), truoc: ky(10, 3), gan: ky(10, 5) }).tat, true);
  assert.match(nenTuTat({ xa: ky(10, 1), truoc: ky(10, 3), gan: ky(10, 5) }).ly_do, /10% -> 30% -> 50%/);
  assert.equal(nenTuTat({ xa: ky(10, 1), truoc: ky(10, 3), gan: ky(10, 3) }).tat, false); // chỉ tăng một kỳ
  assert.equal(nenTuTat({ xa: ky(10, 5), truoc: ky(10, 3), gan: ky(10, 1) }).tat, false); // đang tốt lên
  assert.equal(nenTuTat({ xa: ky(10, 1), truoc: ky(3, 2), gan: ky(10, 9) }).tat, false); // một kỳ quá ít việc
  assert.equal(nenTuTat({ xa: ky(0, 0), truoc: ky(10, 3), gan: ky(10, 5) }).tat, false);
});

function dungKy(db, kyNgay, soViec, soSua, dau = 100) {
  // kyNgay: số ngày trước "bây giờ" ở giữa kỳ; tạo viec do AI rồi đánh dấu sửa.
  const luc = new Date(Date.now() - kyNgay * 86400000).toISOString();
  for (let i = 0; i < soViec; i++) {
    const id = dau + kyNgay * 100 + i;
    db.prepare(`INSERT INTO viec (id,to_chuc_id,tieu_de,trang_thai,nguon,tao_luc,cap_nhat_luc) VALUES (?, 't', 'V', 'mo', 'zalo', ?, ?)`).run(id, luc, luc);
    if (i < soSua) db.prepare(`INSERT INTO viec_su_kien (to_chuc_id,viec_id,loai,noi_dung,luc) VALUES ('t',?, 'sua_ten', 'a -> b', ?)`).run(id, new Date(Date.parse(luc) + 3600000).toISOString());
  }
}

test('hocHangNgay tự tắt công tắc khi tỷ lệ sửa tệ đi hai kỳ liền; không gọi AI; bật lại thì chạy lại và nghỉ xét 7 ngày', async () => {
  const { db, env } = dung();
  dungKy(db, 18, 10, 1); dungKy(db, 11, 10, 3); dungKy(db, 4, 10, 5);
  let so = 0;
  const goi = async () => { so++; return []; };
  const kq = await hocHangNgay(env, 't', bay(), goi);
  assert.equal(kq.tu_tat, true);
  assert.equal(so, 0);
  assert.equal((await docLuong(env, 't')).bat['hoc-hang-ngay'], false);
  const tt = await trangThaiHoc(env, 't');
  assert.match(tt.tu_tat.ly_do, /10% -> 30% -> 50%/);
  // Người dùng bật lại ở trang Luồng, hôm sau: dấu tự tắt được xóa, vòng chạy tiếp.
  await ghiCaiDat(env, 't', 'luong_bat_hoc-hang-ngay', '1');
  await env.CSDL.prepare("DELETE FROM cai_dat WHERE to_chuc_id='t' AND khoa='hoc_hang_ngay_lan_cuoi'").run();
  const kq2 = await hocHangNgay(env, 't', new Date(Date.now() + 86400000).toISOString(), goi);
  assert.equal(kq2.tu_tat, undefined);
  assert.equal(so, 1);
  assert.equal(await docCaiDat(env, 't', 'hoc_hang_ngay_tu_tat'), null);
});

test('hocHangNgay không tự tắt khi tỷ lệ sửa không tệ đi hai kỳ liền', async () => {
  const { db, env } = dung();
  dungKy(db, 18, 10, 3); dungKy(db, 11, 10, 1); dungKy(db, 4, 10, 2);
  let so = 0;
  const kq = await hocHangNgay(env, 't', bay(), async () => { so++; return []; });
  assert.equal(kq.tu_tat, undefined);
  assert.equal(so, 1);
  assert.equal((await docLuong(env, 't')).bat['hoc-hang-ngay'], true);
});

test('rào chắn được dùng chung: ứng viên 0.3 bị kiemUngVien chặn', () => {
  assert.equal(kiemUngVien({ noi_dung: 'Tin kiểu đặt bàn thì tạo việc', do_tin: 0.3 }).ok, false);
});
