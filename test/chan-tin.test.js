import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { anTinNeuBiChan, boChan, chanNguon, danhSachChan, diaChiTuNguoiGui, kiemChan, tuyChonChan } from '../src/chan-tin.js';

function csdlGia() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE nguon_chan (id INTEGER PRIMARY KEY AUTOINCREMENT, to_chuc_id TEXT, nguon TEXT, loai TEXT, gia_tri TEXT, nhan TEXT, tao_luc TEXT, UNIQUE (to_chuc_id, nguon, loai, gia_tri));
    CREATE TABLE tin_nhan (id INTEGER PRIMARY KEY, to_chuc_id TEXT, nguon TEXT, nguoi_gui TEXT, nhom TEXT, tieu_de TEXT, da_xem INTEGER DEFAULT 0, da_tach INTEGER DEFAULT 0, an INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE viec (id INTEGER PRIMARY KEY, to_chuc_id TEXT, tieu_de TEXT, trang_thai TEXT, tin_nhan_id INTEGER, can_dong_bo INTEGER DEFAULT 0, xong_luc TEXT, cap_nhat_luc TEXT);
    CREATE TABLE viec_su_kien (id INTEGER PRIMARY KEY AUTOINCREMENT, to_chuc_id TEXT, viec_id INTEGER, du_an_id INTEGER, loai TEXT, noi_dung TEXT, tin_nhan_id INTEGER, luc TEXT);`);
  return {
    db,
    CSDL: { prepare: (sql) => ({ bind: (...tham) => {
      const th = [...sql.matchAll(/\?(\d+)/g)].map((m) => tham[m[1] - 1]);
      const q = db.prepare(sql.replace(/\?(\d+)/g, '?'));
      return { all: async () => ({ results: q.all(...th) }), first: async () => q.get(...th) ?? null, run: async () => ({ meta: { changes: Number(q.run(...th).changes) } }) };
    } }) },
  };
}

function nap(env) {
  const them = env.db.prepare('INSERT INTO tin_nhan (id, to_chuc_id, nguon, nguoi_gui, nhom, tieu_de, da_tach) VALUES (?, ?, ?, ?, ?, ?, 1)');
  them.run(1, 't', 'zalo', 'An', 'Nhóm Quảng cáo', null);
  them.run(2, 't', 'zalo', 'Bình', 'Nhóm Thật', null);
  them.run(3, 't', 'zalo', 'Tôi', null, 'Chị Hoa');
  them.run(4, 't', 'gmail', '"codex[bot]" <notifications@github.com>', null, 'Re: PR');
  them.run(5, 't', 'gmail', '"claude[bot]" <notifications@github.com>', null, 'Re: PR 2');
  them.run(6, 'khac', 'zalo', 'An', 'Nhóm Quảng cáo', null);
  const v = env.db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, tin_nhan_id) VALUES (?, 't', ?, ?, ?)");
  v.run(1, 'Đăng ký ưu đãi', 'mo', 1);
  v.run(2, 'Việc đã xong', 'xong', 1);
  v.run(3, 'Họp nhóm thật', 'mo', 2);
}

const an = (env, id) => env.db.prepare('SELECT an FROM tin_nhan WHERE id = ?').get(id).an;
const tt = (env, id) => env.db.prepare('SELECT trang_thai FROM viec WHERE id = ?').get(id).trang_thai;

test('chặn nhóm Zalo: ẩn tin cũ của nhóm, gỡ việc chưa xong, không đụng nhóm khác hay tổ chức khác', async () => {
  const env = csdlGia();
  nap(env);
  const kq = await chanNguon(env, 't', { nguon: 'zalo', loai: 'nhom', gia_tri: 'Nhóm Quảng cáo', nhan: 'Nhóm Quảng cáo' });
  assert.deepEqual([kq.an_tin, kq.go_viec], [1, 1]);
  assert.deepEqual([an(env, 1), an(env, 2), an(env, 6)], [1, 0, 0]);
  assert.deepEqual([tt(env, 1), tt(env, 2), tt(env, 3)], ['huy', 'xong', 'mo']);
  assert.equal(env.db.prepare('SELECT can_dong_bo AS c FROM viec WHERE id = 1').get().c, 1);
  assert.equal(env.db.prepare("SELECT COUNT(*) AS n FROM viec_su_kien WHERE loai = 'huy'").get().n, 1);
});

test('tin riêng Zalo chặn theo tên người đối diện; thư chặn theo người gửi hoặc cả địa chỉ', async () => {
  const env = csdlGia();
  nap(env);
  await chanNguon(env, 't', { nguon: 'zalo', loai: 'nguoi', gia_tri: 'Chị Hoa', nhan: 'Chị Hoa' });
  assert.equal(an(env, 3), 1);
  await chanNguon(env, 't', { nguon: 'gmail', loai: 'nguoi', gia_tri: '"codex[bot]" <notifications@github.com>', nhan: 'codex[bot]' });
  assert.deepEqual([an(env, 4), an(env, 5)], [1, 0]);
  await chanNguon(env, 't', { nguon: 'gmail', loai: 'dia_chi', gia_tri: 'notifications@github.com', nhan: 'notifications@github.com' });
  assert.equal(an(env, 5), 1);
});

test('tin mới về từ nguồn đã chặn bị ẩn và đánh dấu đã tách, tin khác thì không', async () => {
  const env = csdlGia();
  nap(env);
  await chanNguon(env, 't', { nguon: 'zalo', loai: 'nhom', gia_tri: 'Nhóm Quảng cáo', nhan: 'x' });
  env.db.prepare("INSERT INTO tin_nhan (id, to_chuc_id, nguon, nguoi_gui, nhom) VALUES (10, 't', 'zalo', 'C', 'Nhóm Quảng cáo')").run();
  env.db.prepare("INSERT INTO tin_nhan (id, to_chuc_id, nguon, nguoi_gui, nhom) VALUES (11, 't', 'zalo', 'C', 'Nhóm Thật')").run();
  assert.equal(await anTinNeuBiChan(env, 't', 10), true);
  assert.equal(await anTinNeuBiChan(env, 't', 11), false);
  assert.deepEqual({ ...env.db.prepare('SELECT an, da_tach, da_xem FROM tin_nhan WHERE id = 10').get() }, { an: 1, da_tach: 1, da_xem: 1 });
  assert.equal(env.db.prepare('SELECT da_tach FROM tin_nhan WHERE id = 11').get().da_tach, 0);
});

test('bỏ chặn: tin hiện lại, trừ tin vẫn thuộc nguồn khác còn chặn', async () => {
  const env = csdlGia();
  nap(env);
  const a = await chanNguon(env, 't', { nguon: 'gmail', loai: 'nguoi', gia_tri: '"codex[bot]" <notifications@github.com>', nhan: 'codex' });
  const b = await chanNguon(env, 't', { nguon: 'gmail', loai: 'dia_chi', gia_tri: 'notifications@github.com', nhan: 'địa chỉ' });
  assert.deepEqual([an(env, 4), an(env, 5)], [1, 1]);
  await boChan(env, 't', b.id);
  assert.deepEqual([an(env, 4), an(env, 5)], [1, 0]); // tin 4 vẫn bị chặn theo tên người gửi
  assert.equal((await boChan(env, 't', a.id)).hien_tin, 1);
  assert.equal(an(env, 4), 0);
  assert.equal(await boChan(env, 't', 999), null);
  assert.equal((await danhSachChan(env, 't')).length, 0);
});

test('kiểm yêu cầu chặn và cách chặn gợi ý cho từng loại tin', () => {
  assert.ok(kiemChan({ nguon: 'zalo', loai: 'dia_chi', gia_tri: 'a@b.c' }).loi);
  assert.ok(kiemChan({ nguon: 'gmail', loai: 'nhom', gia_tri: 'x' }).loi);
  assert.ok(kiemChan({ nguon: 'zalo', loai: 'nhom', gia_tri: ' ' }).loi);
  assert.equal(kiemChan({ nguon: 'gmail', loai: 'dia_chi', gia_tri: 'Notifications@GitHub.com' }).chan.gia_tri, 'notifications@github.com');
  assert.equal(diaChiTuNguoiGui('"x" <A@B.com>'), 'a@b.com');
  assert.equal(diaChiTuNguoiGui('a@b.com'), 'a@b.com');
  assert.deepEqual(tuyChonChan({ nguon: 'zalo', nhom: 'Nhóm A' }).map((c) => c.loai), ['nhom']);
  assert.deepEqual(tuyChonChan({ nguon: 'zalo', tieu_de: 'Chị Hoa', nguoi_gui: 'Tôi' })[0].gia_tri, 'Chị Hoa');
  assert.deepEqual(tuyChonChan({ nguon: 'gmail', nguoi_gui: '"x" <a@b.com>' }).map((c) => c.loai), ['nguoi', 'dia_chi']);
});
