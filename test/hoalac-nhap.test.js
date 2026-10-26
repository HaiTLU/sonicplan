// Kiểm scripts/nhap-hoalac.mjs: dùng mảng T rút gọn (không đọc tệp Google Drive thật của PM, để kiểm
// chạy được trên máy/CI nào cũng vậy), kiểm lỗi dữ liệu nguồn và SQL sinh ra áp được, đúng số dòng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doucThuTuc, kiemThuTuc, sinhSql } from '../scripts/nhap-hoalac.mjs';
import { dungCsdl } from './csdl-thu.js';

const HTML_MAU = `<script>
const T=[
 {id:'a1',g:'A',name:'Nộp hồ sơ',fix:'2026-09-25',dur:1,owner:'Trường',src:'Thực tế',basis:'CV 3225.'},
 {id:'a2',g:'A',name:'Ra quyết định',dur:0,ms:1,after:['a1'],owner:'BQL',src:'Luật',basis:'Điều 25.',unclear:'Chưa rõ cơ quan.'},
 {id:'b1',g:'B',name:'Chọn tư vấn QLDA',dur:30,after:['a2'],owner:'Trường',src:'VNCC',basis:'Bước 2.'}
];
const DIFF=[];
</script>`;

test('doucThuTuc cắt đúng mảng T, kiemThuTuc không báo lỗi với dữ liệu hợp lệ', () => {
  const ds = doucThuTuc(HTML_MAU);
  assert.equal(ds.length, 3);
  assert.equal(ds[1].id, 'a2');
  assert.deepEqual(kiemThuTuc(ds), []);
});

test('kiemThuTuc báo lỗi nhóm sai và phụ thuộc vào id không tồn tại', () => {
  const ds = [
    { id: 'x1', g: 'Z', name: 'Việc lạ', dur: 1 },
    { id: 'x2', g: 'A', name: 'Phụ thuộc ma', dur: 1, after: ['khong-co'] },
  ];
  const loi = kiemThuTuc(ds);
  assert.ok(loi.some((l) => l.includes('Nhóm không hợp lệ')));
  assert.ok(loi.some((l) => l.includes('khong-co')));
});

test('sinhSql tạo được SQL áp đúng vào CSDL thử: đủ số thủ tục, đúng nhóm, đúng phụ thuộc', () => {
  const ds = doucThuTuc(HTML_MAU);
  const sqlText = sinhSql(ds, { toChuc: 'tc-mau', boi: 'nhap@vi-du.vn', luc: '2026-10-26T00:00:00.000Z' });
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-mau', 'Mau', 'hoalac', '2026-01-01')");
  db.exec(sqlText);
  const rows = db.prepare('SELECT ma_nguon, nhom, la_moc, ngay_co_dinh, tao_boi FROM qlda_thu_tuc WHERE to_chuc_id = ? ORDER BY ma_nguon').all('tc-mau');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].ma_nguon, 'a1');
  assert.equal(rows[0].ngay_co_dinh, '2026-09-25');
  assert.equal(rows[0].tao_boi, 'nhap@vi-du.vn');
  assert.equal(rows[1].la_moc, 1);
  const phu = db.prepare('SELECT truoc_id, sau_id FROM qlda_thu_tuc_phu_thuoc WHERE to_chuc_id = ?').all('tc-mau');
  assert.equal(phu.length, 2);
  const idCua = (ma) => db.prepare('SELECT id FROM qlda_thu_tuc WHERE to_chuc_id = ? AND ma_nguon = ?').get('tc-mau', ma).id;
  assert.ok(phu.some((p) => p.truoc_id === idCua('a1') && p.sau_id === idCua('a2')));
  assert.ok(phu.some((p) => p.truoc_id === idCua('a2') && p.sau_id === idCua('b1')));
});

test('sinhSql giữ dấu nháy đơn trong tên việc an toàn (escape)', () => {
  const ds = [{ id: 'y1', g: 'A', name: "Việc có dấu ' nháy", dur: 1 }];
  const sqlText = sinhSql(ds, { toChuc: 'tc-mau2', boi: 'nhap@vi-du.vn', luc: '2026-10-26T00:00:00.000Z' });
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-mau2', 'Mau2', 'hoalac', '2026-01-01')");
  db.exec(sqlText);
  const r = db.prepare('SELECT ten FROM qlda_thu_tuc WHERE to_chuc_id = ?').get('tc-mau2');
  assert.equal(r.ten, "Việc có dấu ' nháy");
});
