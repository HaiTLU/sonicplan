import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { hocHangNgay, trangThaiHoc } from '../src/hoc-hang-ngay.js';
import { deXuatLoiDan, quyetGoiYLoiDan, docGoiYLoiDan } from '../src/loi-dan-tuan.js';
import { ghiCaiDat, docCaiDat } from '../src/hop-tin.js';
import { docViecDaSua } from '../src/viec.js';
import { TAC_VU } from '../src/lich-chay.js';
import { CAC_TAC_VU } from '../src/tac-vu.js';
import { macDinhLuong } from '../src/luong.js';

function dung() {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  const bay = new Date().toISOString();
  db.prepare(`INSERT INTO tin_nhan(id,to_chuc_id,nguon,ma_goc,nhom,noi_dung,thoi_diem,tao_luc) VALUES (1,'t','zalo','1','Lớp A','đặt bàn',?,?)`).run(bay, bay);
  for (let id = 1; id <= 3; id++) {
    db.prepare(`INSERT INTO cau_hoi_ai(id,to_chuc_id,viec_id,loai,cau_hoi,tra_loi,trang_thai,tin_nhan_id,tao_luc,tra_loi_luc) VALUES (?,'t',0,'them','Thêm việc?','Không thêm','xong',1,?,?)`).run(id, bay, bay);
  }
  return { db, env, bay };
}

test('lựa chọn không thêm việc được học ngay trong đúng nhóm; không học câu hỏi chưa trả lời', async () => {
  const { db, env } = dung();
  db.exec("UPDATE cau_hoi_ai SET trang_thai='cho' WHERE id=3");
  const ds = await docViecDaSua(env, 't', 10, [{ nguon: 'zalo', nhom: 'Lớp A', noi_dung: 'đặt bàn' }]);
  assert.equal(ds.length, 2);
  assert.match(ds[0], /Không thêm/);
  assert.deepEqual(await docViecDaSua(env, 't', 10, [{ nguon: 'zalo', nhom: 'Lớp B' }]), []);
  assert.deepEqual(await docViecDaSua(env, 'khac', 30), []);
});

test('cron học mỗi ngày được nối với tác vụ và mặc định bật', () => {
  assert.equal(TAC_VU.find((t) => t.ma === 'hoc-hang-ngay').lich, '0 16 * * *');
  assert.equal(typeof CAC_TAC_VU['hoc-hang-ngay'], 'function');
  assert.equal(macDinhLuong().bat['hoc-hang-ngay'], true);
});

test('cùng ngày và hai lượt đồng thời chỉ tổng hợp một lần; ngày sau chạy tiếp', async () => {
  const { env, bay } = dung();
  let so = 0;
  const goi = async () => { so++; return []; };
  await Promise.all([hocHangNgay(env, 't', bay, goi), hocHangNgay(env, 't', bay, goi)]);
  await hocHangNgay(env, 't', bay, goi);
  assert.equal(so, 1);
  await hocHangNgay(env, 't', new Date(Date.parse(bay) + 86400000).toISOString(), goi);
  assert.equal(so, 2);
});

test('AI lỗi không báo thành công và có thể thử lại; khóa cũ hết hạn được phục hồi', async () => {
  const { env, bay } = dung();
  await assert.rejects(hocHangNgay(env, 't', bay, async () => { throw Error('AI lỗi'); }));
  assert.equal(await docCaiDat(env, 't', 'hoc_hang_ngay_lan_cuoi'), null);
  await ghiCaiDat(env, 't', 'hoc_hang_ngay_khoa', new Date(Date.parse(bay) - 3600000).toISOString());
  assert.equal((await hocHangNgay(env, 't', bay, async () => [])).ngay.length, 10);
});

test('giữ đề xuất đang chờ; nhớ lời dặn đã bỏ, không gọi AI lại khi dữ liệu chưa đổi', async () => {
  const { env, bay, db } = dung();
  let so = 0;
  const dong = 'Trong nhóm Lớp A, chưa nhận lời thì không tạo việc ăn uống';
  const ai = async () => { so++; return `- ${dong}`; };
  assert.deepEqual(await deXuatLoiDan(env, 't', bay, ai), [dong]);
  await deXuatLoiDan(env, 't', bay, ai);
  assert.equal(so, 1);
  assert.ok((await quyetGoiYLoiDan(env, 't', 0, 'bo', 'dòng cũ')).loi);
  await quyetGoiYLoiDan(env, 't', 0, 'bo', dong);
  await deXuatLoiDan(env, 't', bay, ai);
  assert.equal(so, 1);
  db.exec("UPDATE cau_hoi_ai SET tra_loi='Không thêm, tôi chưa nhận lời' WHERE id=3");
  assert.deepEqual(await deXuatLoiDan(env, 't', bay, ai), []);
  assert.equal(so, 2);
  assert.equal((await docGoiYLoiDan(env, 't')).da_quyet[0].quyet, 'bo');
});

test('thống kê tách biệt tổ chức, đếm việc một lần và không coi im lặng là đúng', async () => {
  const { env, db, bay } = dung();
  const luc = new Date(Date.parse(bay) - 1000).toISOString();
  db.prepare(`INSERT INTO viec(id,to_chuc_id,tieu_de,nguon,trang_thai,tao_luc,cap_nhat_luc) VALUES (1,'t','A','zalo','mo',?,?),(2,'khac','B','zalo','mo',?,?)`).run(luc, luc, luc, luc);
  for (const loai of ['sua_ten', 'sua_han']) db.prepare(`INSERT INTO viec_su_kien(to_chuc_id,viec_id,loai,noi_dung,luc) VALUES ('t',1,?,'sửa',?)`).run(loai, luc);
  const r = await trangThaiHoc(env, 't', bay);
  assert.equal(r.gan.so_viec, 1);
  assert.equal(r.gan.da_sua, 1);
  assert.equal(r.truoc.so_viec, 0);
  assert.match(r.luu_y, /không phải tỷ lệ chính xác/);
});
