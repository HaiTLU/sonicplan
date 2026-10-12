import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { chonDuAn, ghiSuKien, kiemDuAn, lichSuDuAn, suaDuAn, taoDuAn, xoaDuAn, dsDuAnKemSo } from '../src/du-an.js';

const DU_AN = [
  { id: 1, ten: 'Đào tạo Ngắn hạn', tu_khoa: ['dao tao ngan han'] },
  { id: 2, ten: 'NCS-K5', tu_khoa: ['ncs', 'k5'] },
  { id: 4, ten: 'AI Lab Hòa Lạc', tu_khoa: ['ai lab', 'hoa lac', 'nic'] },
];

test('chọn dự án: tên AI đưa ra khớp thì dùng, không thì dò từ khóa, không khớp thì để trống', () => {
  assert.equal(chonDuAn(DU_AN, 'ncs-k5', 'gì đó'), 2);
  assert.equal(chonDuAn(DU_AN, 'Dự án tự bịa', 'Nhóm NCS_K5_TLU\\T gửi slide'), 2);
  assert.equal(chonDuAn(DU_AN, null, 'Tham quan NIC Hà Nội'), 4);
  assert.equal(chonDuAn(DU_AN, null, 'Đi siêu âm'), null);
  assert.equal(chonDuAn(DU_AN, null, 'Bảng chia nicotin'), null); // từ khóa phải khớp nguyên từ
  assert.equal(chonDuAn([{ id: 9, ten: 'X', tu_khoa: '["abc"]' }], null, 'có abc ở đây'), 9);
});

test('kiểm dự án: tên bắt buộc, từ khóa tách theo dấu phẩy và bỏ trùng', () => {
  assert.ok(kiemDuAn({}, { batBuoc: true }).loi);
  assert.deepEqual(kiemDuAn({ ten: ' A ', tu_khoa: 'x, y,x,,' }, { batBuoc: true }).duAn, { ten: 'A', tu_khoa: ['x', 'y'] });
});

function csdlGia() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE du_an (id INTEGER PRIMARY KEY AUTOINCREMENT, to_chuc_id TEXT, ten TEXT, tu_khoa TEXT DEFAULT '[]', thu_tu INTEGER DEFAULT 0, tao_luc TEXT, mau TEXT, UNIQUE (to_chuc_id, ten));
    CREATE TABLE viec (id INTEGER PRIMARY KEY, to_chuc_id TEXT, tieu_de TEXT, trang_thai TEXT, du_an_id INTEGER, tin_nhan_id INTEGER, nguon TEXT, mau TEXT, can_dong_bo INTEGER DEFAULT 0, lich_event_id TEXT);
    CREATE TABLE viec_su_kien (id INTEGER PRIMARY KEY AUTOINCREMENT, to_chuc_id TEXT, viec_id INTEGER, du_an_id INTEGER, loai TEXT, noi_dung TEXT, tin_nhan_id INTEGER, luc TEXT);
    CREATE TABLE tep (id INTEGER PRIMARY KEY, to_chuc_id TEXT, ten TEXT, nguon TEXT, nguoi_gui TEXT, tao_luc TEXT, tin_nhan_id INTEGER);`);
  const chay = (sql, tham) => {
    const th = [...sql.matchAll(/\?(\d+)/g)].map((m) => tham[m[1] - 1]);
    return { q: db.prepare(sql.replace(/\?(\d+)/g, '?')), th };
  };
  return {
    db,
    CSDL: { prepare: (sql) => ({ bind: (...tham) => {
      const { q, th } = chay(sql, tham);
      return { all: async () => ({ results: q.all(...th) }), first: async () => q.get(...th) ?? null, run: async () => ({ meta: { changes: Number(q.run(...th).changes) } }) };
    } }) },
  };
}

test('dự án: thêm, trùng tên bị từ chối, sửa, đếm việc, gỡ không xóa việc', async () => {
  const env = csdlGia();
  const a = await taoDuAn(env, 't', { ten: 'Hợp tác', tu_khoa: 'hop tac' });
  assert.ok(a.id);
  assert.match((await taoDuAn(env, 't', { ten: 'Hợp tác' })).loi, /Đã có/);
  env.db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, tin_nhan_id, nguon) VALUES (1,'t','Việc một','mo',${a.id},NULL,NULL),(2,'t','Việc hai','xong',${a.id},NULL,NULL),(3,'x','Của người khác','mo',${a.id},NULL,NULL)`);
  const ds = await dsDuAnKemSo(env, 't');
  assert.equal(ds[0].dang_mo, 1);
  assert.equal(ds[0].da_xong, 1);
  assert.deepEqual((await suaDuAn(env, 't', a.id, { tu_khoa: 'a, b' })), {});
  assert.equal((await suaDuAn(env, 't', 999, { ten: 'Z' })).ma, 404);
  assert.deepEqual(await xoaDuAn(env, 't', a.id), {});
  assert.equal(env.db.prepare('SELECT COUNT(*) c FROM viec WHERE du_an_id IS NULL AND to_chuc_id = ?').get('t').c, 2);
});

test('lịch sử dự án: sự kiện theo thời gian mới nhất trước, kèm tệp, không lẫn tổ chức khác', async () => {
  const env = csdlGia();
  const a = await taoDuAn(env, 't', { ten: 'IPSOS' });
  env.db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, tin_nhan_id, nguon) VALUES (1,'t','Liên hệ IPSOS','mo',${a.id},900,'zalo')`);
  env.db.exec(`INSERT INTO tep VALUES (1,'t','261013_Gmail_Proposal.pdf','gmail','IPSOS','2026-10-13T01:00:00Z',900)`);
  await ghiSuKien(env, 't', 1, 'tao', 'Liên hệ IPSOS', null);
  await ghiSuKien(env, 't', 1, 'tien_do', 'Thư của IPSOS: đã gửi Proposal', 900);
  const r = await lichSuDuAn(env, 't', a.id);
  assert.equal(r.su_kien.length, 2);
  assert.equal(r.su_kien[0].loai, 'tien_do');
  assert.equal(r.tep[0].ten, '261013_Gmail_Proposal.pdf');
  assert.equal(r.dang_mo, 1);
  assert.equal(await lichSuDuAn(env, 'khac', a.id), null);
});

test('sắp xếp việc: lưu thứ tự theo danh sách, chỉ đúng tổ chức, từ chối danh sách sai', async () => {
  const { sapXepViec } = await import('../src/api.js');
  const env = csdlGia();
  env.db.exec("ALTER TABLE viec ADD COLUMN thu_tu INTEGER");
  env.db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai) VALUES (1,'t','A','mo'),(2,'t','B','mo'),(3,'x','C','mo')`);
  const ok = await sapXepViec(env, 't', { ids: [2, 1, 3] });
  assert.equal(ok.status, 200);
  const ds = env.db.prepare('SELECT id, thu_tu FROM viec ORDER BY id').all();
  assert.deepEqual(ds.map((r) => r.thu_tu), [2, 1, null]);
  assert.equal((await sapXepViec(env, 't', { ids: ['a'] })).status, 400);
  assert.equal((await sapXepViec(env, 't', {})).status, 400);
});

test('sắp xếp dự án: lưu thứ tự, bỏ qua dự án của tổ chức khác, từ chối danh sách sai', async () => {
  const { sapXepDuAn } = await import('../src/du-an.js');
  const env = csdlGia();
  env.db.exec(`INSERT INTO du_an (id, to_chuc_id, ten, thu_tu, tao_luc) VALUES (1,'t','A',1,'x'),(2,'t','B',2,'x'),(3,'t','C',3,'x'),(4,'k','D',1,'x')`);
  assert.deepEqual(await sapXepDuAn(env, 't', [3, 1, 2, 4]), {});
  const o = (id) => env.db.prepare('SELECT thu_tu FROM du_an WHERE id = ?').get(id).thu_tu;
  assert.deepEqual([o(3), o(1), o(2), o(4)], [1, 2, 3, 1]);
  assert.ok((await sapXepDuAn(env, 't', ['x'])).loi);
  assert.ok((await sapXepDuAn(env, 't', [])).loi);
});

test('màu dự án: tự gán màu chưa dùng, sửa màu, từ chối màu sai, báo việc có sự kiện Lịch cần đổi màu', async () => {
  const env = csdlGia();
  const a = await taoDuAn(env, 't', { ten: 'A' });
  const b = await taoDuAn(env, 't', { ten: 'B' });
  const c = await taoDuAn(env, 't', { ten: 'C', mau: '9' });
  const mau = (id) => env.db.prepare('SELECT mau FROM du_an WHERE id = ?').get(id).mau;
  assert.deepEqual([mau(a.id), mau(b.id), mau(c.id)], ['1', '2', '9']);
  assert.match((await taoDuAn(env, 't', { ten: 'D', mau: '99' })).loi, /Màu/);
  env.db.exec(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, lich_event_id) VALUES (1,'t','Có lịch','mo',${a.id},'ev1'),(2,'t','Màu riêng','mo',${a.id},'ev2')`);
  env.db.exec("UPDATE viec SET mau = '4' WHERE id = 2");
  assert.deepEqual(await suaDuAn(env, 't', a.id, { mau: '11' }), {});
  assert.equal(mau(a.id), '11');
  assert.equal(env.db.prepare('SELECT can_dong_bo FROM viec WHERE id = 1').get().can_dong_bo, 1);
  assert.equal(env.db.prepare('SELECT can_dong_bo FROM viec WHERE id = 2').get().can_dong_bo, 0);
  assert.deepEqual(await suaDuAn(env, 't', a.id, { mau: null }), {});
  assert.equal(mau(a.id), null);
});
