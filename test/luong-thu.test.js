import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { docLuong, locTepTheoLuong, luongTheoQuyTac, phanLuongThu } from '../src/luong-thu.js';
import { dsDinhKemTuDong } from '../src/tho-claude.js';

function dung() {
  const db = dungCsdl();
  db.prepare(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Tổ chức', '2026-10-01T00:00:00Z')`).run();
  const thu = (id, gui, tieuDe, nd, nguon = 'gmail') => db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, tieu_de, noi_dung, thoi_diem, tao_luc) VALUES (?1, 'tc1', ?2, ?3, ?4, ?5, ?6, '2026-10-14T01:00:00Z', '2026-10-14T01:00:00Z')`).run(id, nguon, `m${id}`, gui, tieuDe, nd);
  const tep = (id, tinId, ten) => db.prepare(`INSERT INTO tep (id, to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, nguon, tao_luc) VALUES (?1, 'tc1', ?2, ?3, 'application/pdf', 4, ?4, 'gmail', '2026-10-14')`).run(id, tinId, ten, `k${id}`);
  return { db, env: { CSDL: d1(db) }, thu, tep };
}

test('thư E-Office luôn là thông tin chung, không hỏi AI', async () => {
  assert.equal(luongTheoQuyTac({ nguoi_gui: 'EOFFICE <noreply-eoffice@thanglong.edu.vn>' }), 'chung');
  assert.equal(luongTheoQuyTac({ nguoi_gui: 'Ai đó <a@congty.vn>' }), null);
  const { env, thu } = dung();
  thu(1, 'EOFFICE <noreply-eoffice@thanglong.edu.vn>', 'Thông báo', 'Quy chế mới');
  const hoi = async () => { throw new Error('không được hỏi AI'); };
  assert.equal((await phanLuongThu(env, 'tc1', [1], hoi)).get(1), 'chung');
  assert.equal((await env.CSDL.prepare('SELECT luong FROM tin_nhan WHERE id = 1').first()).luong, 'chung');
});

test('AI xếp luồng: đọc được cả khi bọc trong chữ, lưu lại, lần sau không hỏi lại; giá trị lạ hoặc lỗi thì chưa rõ và không lưu', async () => {
  const { env, thu } = dung();
  thu(2, 'Khoa A <a@thanglong.edu.vn>', 'Mở lớp Excel ngắn hạn', 'Danh sách học viên khóa Excel');
  thu(3, 'Công ty B <b@congty.vn>', 'Đề xuất tài trợ học bổng', 'Hợp đồng tài trợ');
  thu(4, 'Ai đó <c@x.vn>', 'Hi', 'Chào');
  let goi = 0;
  const hoi = async () => { goi++; return 'Kết quả:\n```json\n[{"id":2,"luong":"dao_tao"},{"id":3,"luong":"doanh_nghiep"},{"id":4,"luong":"lung_tung"},{"id":99,"luong":"chung"}]\n```'; };
  const kq = await phanLuongThu(env, 'tc1', [2, 3, 4], hoi);
  assert.deepEqual([kq.get(2), kq.get(3), kq.get(4)], ['dao_tao', 'doanh_nghiep', 'khong_ro']);
  assert.equal(goi, 1);
  const kq2 = await phanLuongThu(env, 'tc1', [2, 3], hoi);
  assert.equal(kq2.get(3), 'doanh_nghiep');
  assert.equal(goi, 1); // đã lưu, không hỏi lại
  assert.equal((await env.CSDL.prepare('SELECT luong FROM tin_nhan WHERE id = 4').first()).luong, null); // chưa rõ thì chưa lưu, lần sau hỏi lại
  const loi = await phanLuongThu(env, 'tc1', [4], async () => { throw new Error('AI hỏng'); });
  assert.equal(loi.get(4), 'khong_ro');
  assert.equal(docLuong('[{"id":1,"luong":"chung"}]', [1]).get(1), 'chung');
  assert.equal(docLuong('không phải JSON', [1]).size, 0);
});

test('lọc tệp theo luồng: bỏ tệp thư Kết nối doanh nghiệp, giữ Đào tạo ngắn hạn, chung, chưa rõ và tệp không phải thư', async () => {
  const { env, thu, tep } = dung();
  thu(2, 'k@thanglong.edu.vn', 'Lớp ngắn hạn', 'x');
  thu(3, 'b@congty.vn', 'Tài trợ', 'y');
  thu(4, 'c@x.vn', 'Chưa rõ', 'z');
  thu(5, 'An', null, 'Zalo gửi tệp', 'zalo');
  tep(20, 2, 'danh-sach.pdf'); tep(30, 3, 'hop-dong.pdf'); tep(40, 4, 'khong-ro.pdf'); tep(50, 5, 'tu-zalo.pdf');
  const hoi = async () => '[{"id":2,"luong":"dao_tao"},{"id":3,"luong":"doanh_nghiep"}]';
  const rows = [{ id: 20, tin_nhan_id: 2 }, { id: 30, tin_nhan_id: 3 }, { id: 40, tin_nhan_id: 4 }, { id: 50, tin_nhan_id: 5 }];
  assert.deepEqual((await locTepTheoLuong(env, 'tc1', rows, hoi)).map((r) => r.id), [20, 40, 50]);
});

test('danh sách tệp ở khung giao: tệp thư Kết nối doanh nghiệp được bỏ chọn sẵn kèm luồng', async () => {
  const { env, thu, tep, db } = dung();
  thu(2, 'k@thanglong.edu.vn', 'Lớp ngắn hạn', 'x');
  thu(3, 'b@congty.vn', 'Tài trợ', 'y');
  db.prepare("UPDATE tin_nhan SET ma_hoi_thoai = NULL, nhom = NULL").run();
  tep(20, 2, 'danh-sach.pdf'); tep(30, 3, 'hop-dong.pdf');
  const hoi = async () => '[{"id":2,"luong":"dao_tao"},{"id":3,"luong":"doanh_nghiep"}]';
  const ds = await dsDinhKemTuDong(env, 'tc1', [{ id: 10, tin_nhan_id: 2 }, { id: 11, tin_nhan_id: 3 }], hoi);
  const theo = Object.fromEntries(ds.map((t) => [t.ten, { luong: t.luong, bo_san: t.bo_san }]));
  assert.deepEqual(theo, { 'danh-sach.pdf': { luong: 'dao_tao', bo_san: false }, 'hop-dong.pdf': { luong: 'doanh_nghiep', bo_san: true } });
});
