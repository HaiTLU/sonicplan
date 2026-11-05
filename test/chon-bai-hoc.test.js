import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chonBaiHoc } from '../src/chon-bai-hoc.js';
import { docViecDaSua } from '../src/viec.js';

test('bài học liên quan cũ vượt 10 lần sửa mới không liên quan', () => {
  const cu = { nguon: 'zalo', nhom: 'Lớp A', tin: 'đặt bàn liên hoan' };
  const moi = Array.from({ length: 12 }, () => ({ ...cu, tin: 'nộp báo cáo tuyển sinh' }));
  assert.equal(chonBaiHoc([...moi, cu], [{ ...cu, noi_dung: cu.tin }], 1)[0], cu);
});

test('không chuyển bài học giữa nhóm, nguồn hay mã hội thoại khác nhau', () => {
  const tin = { nguon: 'zalo', nhom: 'Lớp A', nguoi_gui: 'Hải', ma_hoi_thoai: 'a', noi_dung: 'đặt bàn' };
  for (const doi of [{ nhom: 'Lớp B', ma_hoi_thoai: null }, { nguon: 'gmail' }, { ma_hoi_thoai: 'b' }]) {
    assert.deepEqual(chonBaiHoc([{ ...tin, ...doi, tin: tin.noi_dung }], [tin]), []);
  }
});

test('thiếu bối cảnh không đoán; tin riêng chỉ dùng đúng người gửi', () => {
  assert.deepEqual(chonBaiHoc([{ nguon: 'zalo', tin: 'đặt bàn' }], [{ nguon: 'zalo', noi_dung: 'đặt bàn' }]), []);
  const bai = { nguon: 'gmail', nguoi_gui: 'a@example.com' };
  assert.deepEqual(chonBaiHoc([bai], [{ ...bai }]), [bai]);
  assert.deepEqual(chonBaiHoc([bai], [{ ...bai, nguoi_gui: 'b@example.com' }]), []);
  assert.deepEqual(chonBaiHoc([bai], []), []);
});

test('truy vấn thực chọn đúng phạm vi và không đọc dữ liệu tổ chức khác', async () => {
  const { dungCsdl, d1 } = await import('./csdl-thu.js');
  const db = dungCsdl();
  const bay = new Date().toISOString();
  for (const [id, tc, nhom] of [[1, 't', 'Lớp A'], [2, 't', 'Lớp B'], [3, 'khac', 'Lớp A']]) {
    db.prepare(`INSERT INTO tin_nhan (id,to_chuc_id,nguon,ma_goc,nhom,noi_dung,thoi_diem,tao_luc) VALUES (?,?,'zalo',?,?,'đặt bàn',?,?)`).run(id, tc, String(id), nhom, bay, bay);
    db.prepare(`INSERT INTO viec (id,to_chuc_id,tieu_de,trang_thai,tin_nhan_id,nguon,tao_luc,cap_nhat_luc) VALUES (?,?,'Đặt bàn','huy',?,'zalo',?,?)`).run(id, tc, id, bay, bay);
    db.prepare(`INSERT INTO viec_su_kien (to_chuc_id,viec_id,loai,noi_dung,luc) VALUES (?,?,'huy','Đặt bàn | lý do: chưa nhận lời',?)`).run(tc, id, bay);
  }
  const env = { CSDL: d1(db) };
  const ds = await docViecDaSua(env, 't', 10, [{ nguon: 'zalo', nhom: 'Lớp A', noi_dung: 'đặt bàn' }]);
  assert.equal(ds.length, 1);
  assert.match(ds[0], /Lớp A/);
  assert.match(ds[0], /chưa nhận lời/);
  assert.equal((await docViecDaSua(env, 't', 30)).length, 2);
});
