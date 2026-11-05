// Ca kiểm thử chống trùng việc (05/11/2026). Phần "hiện trạng" khóa hành vi hiện tại để bước sau (trạng thái "nghi trùng") đổi có chủ đích.
// Phần test.todo là hành vi mong muốn, chưa làm. Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { themViec, timTrung } from '../src/viec.js';
import { doGiong } from '../src/tien-ich.js';

function moiTruong() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'T', '2026-01-01')");
  return { db, env: { CSDL: d1(db) } };
}

const bay = () => new Date().toISOString();
const ngayTruoc = (n) => new Date(Date.now() - n * 86400000).toISOString();

function themSan(db, tieuDe, { trangThai = 'mo', xongLuc = null, taoLuc = bay() } = {}) {
  return Number(db.prepare(`INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, xong_luc, tao_luc, cap_nhat_luc) VALUES ('tc1', ?, ?, ?, ?, ?)`)
    .run(tieuDe, trangThai, xongLuc, taoLuc, taoLuc).lastInsertRowid);
}
const dem = (db) => db.prepare('SELECT COUNT(*) AS n FROM viec').get().n;

test('hiện trạng: cùng ý nhưng diễn đạt khác thì không bị coi là trùng', () => {
  assert.ok(doGiong('Gửi hợp đồng cho đối tác', 'Chuyển bản ký cho đối tác') < 0.8);
  assert.equal(timTrung('Chuyển bản ký cho đối tác', [{ id: 1, tieu_de: 'Gửi hợp đồng cho đối tác' }]), null);
});

test('hiện trạng: chỉ nhìn tiêu đề, cùng tiêu đề thì trùng dù khác dự án', async () => {
  const { db, env } = moiTruong();
  db.exec("INSERT INTO du_an (to_chuc_id, ten, tao_luc) VALUES ('tc1', 'A', 'x'), ('tc1', 'B', 'x')");
  const [a, b] = db.prepare('SELECT id FROM du_an ORDER BY id').all().map((r) => r.id);
  const id = themSan(db, 'Rà soát hợp đồng nhà cung cấp');
  db.prepare('UPDATE viec SET du_an_id = ? WHERE id = ?').run(a, id);
  const r = await themViec(env, 'tc1', { tieu_de: 'Rà soát hợp đồng nhà cung cấp' }, { duAnId: b });
  assert.equal(r.trung, true);
  assert.equal(r.id, id);
  assert.equal(dem(db), 1);
});

test('hiện trạng: trùng việc vừa xong trong 3 ngày thì bỏ tin mới, không tạo và không đổi gì', async () => {
  const { db, env } = moiTruong();
  const id = themSan(db, 'Nộp báo cáo kinh phí quý 3', { trangThai: 'xong', xongLuc: ngayTruoc(1) });
  const r = await themViec(env, 'tc1', { tieu_de: 'Nộp báo cáo kinh phí quý 3', han_ngay: '2099-01-01' });
  assert.deepEqual(r, { id, trung: true });
  assert.equal(dem(db), 1);
});

test('hiện trạng: việc đã xong quá 3 ngày thì tạo việc mới', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Nộp báo cáo kinh phí quý 3', { trangThai: 'xong', xongLuc: ngayTruoc(5) });
  const r = await themViec(env, 'tc1', { tieu_de: 'Nộp báo cáo kinh phí quý 3' });
  assert.equal(r.trung, false);
  assert.equal(dem(db), 2);
});

test('hiện trạng: việc mở tạo hơn 60 ngày trước không còn được so', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Chuẩn bị tài liệu tập huấn', { taoLuc: ngayTruoc(61) });
  const r = await themViec(env, 'tc1', { tieu_de: 'Chuẩn bị tài liệu tập huấn' });
  assert.equal(r.trung, false);
});

test('hiện trạng: thêm tay (boQuaTrung) luôn tạo việc mới dù trùng', async () => {
  const { db, env } = moiTruong();
  themSan(db, 'Gửi báo giá cho chị Lan');
  const r = await themViec(env, 'tc1', { tieu_de: 'Gửi báo giá cho chị Lan' }, { boQuaTrung: true, nguon: 'tay' });
  assert.equal(r.trung, false);
  assert.equal(dem(db), 2);
});

test('hiện trạng: cùng cuộc trò chuyện hạ ngưỡng xuống 0,65', () => {
  const ds = [{ id: 7, tieu_de: 'Gửi báo giá cho chị Lan', nguon_khoa: 'nhom-a' }];
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds, 'nhom-a')?.id, 7);
  assert.equal(timTrung('Gửi chị Lan bản báo giá', ds, 'nhom-b'), null);
});

// Hành vi mong muốn cho bước 2 (trạng thái "nghi trùng"). Chưa làm, chờ PR #155 gộp.
test.todo('nghi trùng: giống từ 0,55 đến dưới ngưỡng thì tạo việc kèm cờ và gợi ý việc cũ');
test.todo('nghi trùng: cùng tiêu đề nhưng khác dự án thì không tự coi là trùng');
test.todo('nghi trùng: tin bị bỏ vì trùng việc vừa xong thì báo người dùng');
test.todo('nghi trùng: thêm tay trùng việc đang mở thì cảnh báo, không chặn');
test.todo('nghi trùng: người dùng bấm gộp hoặc giữ cả hai thì ghi sự kiện cho vòng học');
