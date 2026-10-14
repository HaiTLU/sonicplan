import test from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { xuLyApi, chuanBoCuc, KHOI_TONG_QUAN } from '../src/api.js';

const phien = { email: 'a@vi-du.vn', nguoi_dung: { id: 'nd' }, to_chuc: { id: 'tc', vai_tro: 'chu' }, cac_to_chuc: [{ id: 'tc' }] };

async function goi(env, duong, tuyChon = {}) {
  const url = new URL(`http://x${duong}`);
  const kq = await xuLyApi(new Request(url, tuyChon), env, phien, url);
  return kq.json();
}

test('chuanBoCuc giữ khối hợp lệ, bỏ khối lạ, thêm khối còn thiếu vào cuối', () => {
  const bc = chuanBoCuc({ thu_tu: ['nhip', 'la', 'nhip', 'can-lam'], an: ['tin-moi', 'xyz'] });
  assert.deepEqual(bc.thu_tu.slice(0, 2), ['nhip', 'can-lam']);
  assert.equal(bc.thu_tu.length, KHOI_TONG_QUAN.length);
  assert.deepEqual(bc.an, ['tin-moi']);
  assert.deepEqual(chuanBoCuc(null), { thu_tu: KHOI_TONG_QUAN, an: [] });
});

test('Tổng quan trả số theo ngày, theo dự án và lưu bố cục theo từng người', async () => {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  const homNay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  db.prepare("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (1, 'tc', 'Dự án A', '2026-01-01T00:00:00Z')").run();
  const them = db.prepare("INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, han_ngay, du_an_id, tao_luc, cap_nhat_luc) VALUES ('tc', ?1, 'mo', ?2, 1, ?3, ?3)");
  them.run('trễ', '2020-01-01', new Date().toISOString());
  them.run('hôm nay', homNay, new Date().toISOString());
  const kq = await goi(env, '/api/tong-quan');
  assert.equal(kq.theo_ngay.viec.length, 8);
  assert.equal(kq.theo_ngay.viec[7], 2);
  assert.deepEqual(kq.du_an.map((d) => [d.ten, d.mo, d.qua_han, d.sap_han]), [['Dự án A', 2, 1, 1]]);
  assert.equal(kq.claude.cho_ban, 0);
  assert.deepEqual(kq.bo_cuc.an, []);

  const luu = await goi(env, '/api/tong-quan/bo-cuc', { method: 'PUT', body: JSON.stringify({ thu_tu: ['tin-moi'], an: ['he-thong'] }) });
  assert.equal(luu.bo_cuc.thu_tu[0], 'tin-moi');
  const sau = await goi(env, '/api/tong-quan');
  assert.equal(sau.bo_cuc.thu_tu[0], 'tin-moi');
  assert.deepEqual(sau.bo_cuc.an, ['he-thong']);
});

test('số đếm nhẹ: chỉ trả tin chưa xem và việc mở, khớp với Tổng quan', async () => {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  const bay = new Date().toISOString();
  db.prepare("INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, tao_luc, cap_nhat_luc) VALUES ('tc', 'a', 'mo', ?1, ?1), ('tc', 'b', 'xong', ?1, ?1), ('khac', 'c', 'mo', ?1, ?1)").run(bay);
  const dem = await goi(env, '/api/dem');
  assert.deepEqual(Object.keys(dem).sort(), ['tin_chua_xem', 'viec_mo']);
  assert.equal(dem.viec_mo, 1);
  const tq = await goi(env, '/api/tong-quan');
  assert.equal(dem.viec_mo, tq.so_lieu.viec_mo);
  assert.equal(dem.tin_chua_xem, tq.so_lieu.tin_chua_xem);
});

test('Đề xuất giao Claude: chỉ việc mở nhóm Claude tự làm, chưa giao; "Để tôi làm" bỏ khỏi danh sách', async () => {
  const db = dungCsdl();
  const env = { CSDL: d1(db) };
  const bay = new Date().toISOString();
  const them = db.prepare("INSERT INTO viec (to_chuc_id, tieu_de, trang_thai, nhom, github_issue, tao_luc, cap_nhat_luc) VALUES ('tc', ?1, ?2, ?3, ?4, ?5, ?5)");
  const deXuat = Number(them.run('Soạn nháp thư mời', 'mo', 'claude_tu_lam', null, bay).lastInsertRowid);
  const daGiao = Number(them.run('Tóm tắt biên bản', 'mo', 'claude_tu_lam', null, bay).lastInsertRowid);
  them.run('Đã đẩy GitHub', 'mo', 'claude_tu_lam', 12, bay);
  them.run('Gọi điện', 'mo', 'anh_tu_lam', null, bay);
  them.run('Đã xong', 'xong', 'claude_tu_lam', null, bay);
  db.prepare("INSERT INTO luot_claude (to_chuc_id, viec_id, trang_thai, ma_bam, tao_luc, cap_nhat_luc) VALUES ('tc', ?1, 'xong', 'x', ?2, ?2)").run(daGiao, bay);
  const kq = await goi(env, '/api/tong-quan');
  assert.equal(kq.de_xuat_claude.tong, 1);
  assert.deepEqual(kq.de_xuat_claude.viec.map((v) => v.id), [deXuat]);
  assert.ok(kq.bo_cuc.thu_tu.includes('de-xuat-claude'));

  const sai = await goi(env, `/api/viec/${deXuat}`, { method: 'PATCH', body: JSON.stringify({ nhom: 'la' }) });
  assert.ok(sai.loi || sai.error);
  await goi(env, `/api/viec/${deXuat}`, { method: 'PATCH', body: JSON.stringify({ nhom: 'anh_tu_lam' }) });
  assert.equal((await goi(env, '/api/tong-quan')).de_xuat_claude.tong, 0);
});
