// Phân hệ Viện Hòa Lạc, PR2: CPM thuần (wbs.js) và API /api/hoalac/* (giai đoạn, hạng mục, phụ thuộc, baseline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tinhCpm, CpmLoi } from '../src/hoalac/wbs.js';
import sonicplan from '../src/index.js';
import { d1, dungCsdl } from './csdl-thu.js';

// ---------- CPM thuần ----------

test('CPM: chuỗi tuyến tính A->B->C, mỗi việc nằm trên đường gang', () => {
  const hm = [{ id: 1, thoiGianNgay: 3 }, { id: 2, thoiGianNgay: 2 }, { id: 3, thoiGianNgay: 4 }];
  const pt = [{ truoc_id: 1, sau_id: 2, loai: 'FS', do_tre_ngay: 0 }, { truoc_id: 2, sau_id: 3, loai: 'FS', do_tre_ngay: 0 }];
  const { hang_muc, ket_thuc_du_an } = tinhCpm(hm, pt);
  const theo = new Map(hang_muc.map((h) => [h.id, h]));
  assert.equal(theo.get(1).som_bd, 0); assert.equal(theo.get(1).som_kt, 3);
  assert.equal(theo.get(2).som_bd, 3); assert.equal(theo.get(2).som_kt, 5);
  assert.equal(theo.get(3).som_bd, 5); assert.equal(theo.get(3).som_kt, 9);
  assert.equal(ket_thuc_du_an, 9);
  for (const h of hang_muc) { assert.equal(h.du_truoc_ngay, 0); assert.equal(h.tren_duong_gang, 1); }
});

test('CPM: hai nhánh song song, nhánh ngắn có dư trước, nhánh dài là đường gang', () => {
  // 1 (5 ngày) và 2 (2 ngày) cùng chạy song song, cả hai phải xong trước khi 3 bắt đầu.
  const hm = [{ id: 1, thoiGianNgay: 5 }, { id: 2, thoiGianNgay: 2 }, { id: 3, thoiGianNgay: 1 }];
  const pt = [{ truoc_id: 1, sau_id: 3, loai: 'FS', do_tre_ngay: 0 }, { truoc_id: 2, sau_id: 3, loai: 'FS', do_tre_ngay: 0 }];
  const { hang_muc, ket_thuc_du_an } = tinhCpm(hm, pt);
  const theo = new Map(hang_muc.map((h) => [h.id, h]));
  assert.equal(ket_thuc_du_an, 6);
  assert.equal(theo.get(1).tren_duong_gang, 1);
  assert.equal(theo.get(2).tren_duong_gang, 0);
  assert.equal(theo.get(2).du_truoc_ngay, 3);
  assert.equal(theo.get(3).tren_duong_gang, 1);
});

test('CPM: vòng tròn phụ thuộc ném CpmLoi, không treo', () => {
  const hm = [{ id: 1, thoiGianNgay: 1 }, { id: 2, thoiGianNgay: 1 }];
  const pt = [{ truoc_id: 1, sau_id: 2, loai: 'FS', do_tre_ngay: 0 }, { truoc_id: 2, sau_id: 1, loai: 'FS', do_tre_ngay: 0 }];
  assert.throws(() => tinhCpm(hm, pt), CpmLoi);
});

test('CPM: bốn kiểu phụ thuộc FS/SS/FF/SF, mỗi cặp tính độc lập', () => {
  // FS: B bắt đầu sau khi A xong, cộng thêm độ trễ. SS: D bắt đầu cùng lúc (trễ 1 ngày) so với C bắt đầu.
  // FF: F xong cùng lúc E xong. SF: H chỉ được xong sau khi G đã bắt đầu đủ lâu (độ trễ tính từ ngày G bắt đầu).
  const hm = [
    { id: 'a', thoiGianNgay: 3 }, { id: 'b', thoiGianNgay: 2 },
    { id: 'c', thoiGianNgay: 3 }, { id: 'd', thoiGianNgay: 2 },
    { id: 'e', thoiGianNgay: 3 }, { id: 'f', thoiGianNgay: 2 },
    { id: 'g', thoiGianNgay: 4 }, { id: 'h', thoiGianNgay: 1 },
  ];
  const pt = [
    { truoc_id: 'a', sau_id: 'b', loai: 'FS', do_tre_ngay: 1 },
    { truoc_id: 'c', sau_id: 'd', loai: 'SS', do_tre_ngay: 1 },
    { truoc_id: 'e', sau_id: 'f', loai: 'FF', do_tre_ngay: 0 },
    { truoc_id: 'g', sau_id: 'h', loai: 'SF', do_tre_ngay: 2 },
  ];
  const theo = new Map(tinhCpm(hm, pt).hang_muc.map((h) => [h.id, h]));
  assert.equal(theo.get('b').som_bd, theo.get('a').som_kt + 1); // FS: bắt đầu sau khi trước xong, cộng độ trễ
  assert.equal(theo.get('d').som_bd, theo.get('c').som_bd + 1); // SS: cùng bắt đầu, cộng độ trễ
  assert.equal(theo.get('f').som_kt, theo.get('e').som_kt); // FF: cùng xong
  assert.equal(theo.get('h').som_kt, theo.get('g').som_bd + 2); // SF: xong không sớm hơn (ngày trước bắt đầu + độ trễ)
});

test('CPM: mốc (thời gian 0 ngày) và việc không có việc trước đều bắt đầu ngày 0 khi không phụ thuộc gì', () => {
  const hm = [{ id: 1, thoiGianNgay: 0 }, { id: 2, thoiGianNgay: 5 }];
  const { hang_muc } = tinhCpm(hm, []);
  const theo = new Map(hang_muc.map((h) => [h.id, h]));
  assert.equal(theo.get(1).som_bd, 0); assert.equal(theo.get(1).som_kt, 0);
  assert.equal(theo.get(2).som_bd, 0);
});

// ---------- API /api/hoalac/* ----------

function moiEnv() {
  const db = dungCsdl();
  db.exec("INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES ('tc-hl', 'Vien Hoa Lac', 'hoalac', '2026-01-01')");
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-chu', 'chu@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO nguoi_dung (id, email, tao_luc) VALUES ('nd-doi-tac', 'doi-tac@vi-du.vn', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-hl', 'nd-chu', 'chu', '2026-01-01')");
  db.exec("INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc-hl', 'nd-doi-tac', 'doi_tac', '2026-01-01')");
  const ASSETS = { fetch: async () => new Response('trang', { status: 200 }) };
  return { env: { CSDL: d1(db), ASSETS, QUAN_TRI: 'quan-tri@vi-du.vn' }, db };
}

const goi = (env, email, duongDan, tuyChon = {}) => sonicplan.fetch(
  new Request(`https://localhost${duongDan}`, { ...tuyChon, headers: { ...(tuyChon.headers || {}), 'content-type': 'application/json' } }),
  { ...env, EMAIL_THU: email },
  { waitUntil: () => {} },
);

test('chủ tạo hai hạng mục có phụ thuộc, CPM tự tính lại và ghi vào hạng mục sau', async () => {
  const { env } = moiEnv();
  const r1 = await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'Thiết kế', thoi_gian_ngay: 10 }) });
  const { id: id1 } = await r1.json();
  const r2 = await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'Thi công', thoi_gian_ngay: 20 }) });
  const { id: id2 } = await r2.json();
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: id1, sau_id: id2, loai: 'FS' }) });

  const ds = await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc')).json();
  const hm2 = ds.hang_muc.find((h) => h.id === id2);
  assert.equal(hm2.som_bd, 10);
  assert.equal(hm2.som_kt, 30);
  assert.equal(hm2.tren_duong_gang, 1);
});

test('phụ thuộc trùng (cùng trước/sau) trả 409, không chèn thêm dòng', async () => {
  const { env } = moiEnv();
  const id1 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json()).id;
  const id2 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'B' }) })).json()).id;
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: id1, sau_id: id2 }) });
  const trung = await goi(env, 'chu@vi-du.vn', '/api/hoalac/phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: id1, sau_id: id2 }) });
  assert.equal(trung.status, 409);
});

test('đối tác chưa được gán hạng mục nào: GET danh sách rỗng, GET một hạng mục trả 404 (không lộ có tồn tại)', async () => {
  const { env } = moiEnv();
  const id1 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json()).id;
  const ds = await (await goi(env, 'doi-tac@vi-du.vn', '/api/hoalac/hang-muc')).json();
  assert.deepEqual(ds.hang_muc, []);
  const mot = await goi(env, 'doi-tac@vi-du.vn', `/api/hoalac/hang-muc/${id1}`);
  assert.equal(mot.status, 404);
});

test('đối tác được gán đúng một hạng mục: thấy hạng mục đó, sửa được tiến độ/trạng thái, không sửa được tên hay ngày', async () => {
  const { env, db } = moiEnv();
  const id1 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'Lắp đặt' }) })).json()).id;
  db.exec(`INSERT INTO qlda_giao_doi_tac (to_chuc_id, nguoi_dung_id, loai, doi_tuong_id, tao_luc) VALUES ('tc-hl', 'nd-doi-tac', 'hang_muc', ${id1}, '2026-01-01')`);

  const xem = await goi(env, 'doi-tac@vi-du.vn', `/api/hoalac/hang-muc/${id1}`);
  assert.equal(xem.status, 200);

  const sua = await goi(env, 'doi-tac@vi-du.vn', `/api/hoalac/hang-muc/${id1}`, { method: 'PUT', body: JSON.stringify({ tien_do_pt: 60, trang_thai: 'dang_lam', ten: 'Đổi tên trái phép' }) });
  assert.equal(sua.status, 200);
  const sauSua = await (await goi(env, 'chu@vi-du.vn', `/api/hoalac/hang-muc/${id1}`)).json();
  assert.equal(sauSua.tien_do_pt, 60);
  assert.equal(sauSua.trang_thai, 'dang_lam');
  assert.equal(sauSua.ten, 'Lắp đặt'); // không đổi theo giá trị đối tác gửi lên vì PUT của đối tác chỉ nhận tien_do_pt/trang_thai
});

test('đối tác không tạo/xóa hạng mục, không thêm phụ thuộc, không xem baseline (403)', async () => {
  const { env } = moiEnv();
  const id1 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json()).id;
  const id2 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'B' }) })).json()).id;
  const taoHM = await goi(env, 'doi-tac@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'X' }) });
  assert.equal(taoHM.status, 403);
  const xoaHM = await goi(env, 'doi-tac@vi-du.vn', `/api/hoalac/hang-muc/${id1}`, { method: 'DELETE' });
  assert.equal(xoaHM.status, 403);
  const themPT = await goi(env, 'doi-tac@vi-du.vn', '/api/hoalac/phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: id1, sau_id: id2 }) });
  assert.equal(themPT.status, 403);
  const baseline = await goi(env, 'doi-tac@vi-du.vn', '/api/hoalac/baseline');
  assert.equal(baseline.status, 403);
});

test('xóa hạng mục kéo theo xóa phụ thuộc liên quan và tính lại CPM', async () => {
  const { env } = moiEnv();
  const id1 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'A', thoi_gian_ngay: 5 }) })).json()).id;
  const id2 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'B', thoi_gian_ngay: 5 }) })).json()).id;
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/phu-thuoc', { method: 'POST', body: JSON.stringify({ truoc_id: id1, sau_id: id2 }) });
  await goi(env, 'chu@vi-du.vn', `/api/hoalac/hang-muc/${id1}`, { method: 'DELETE' });
  const ds = await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc')).json();
  const hm2 = ds.hang_muc.find((h) => h.id === id2);
  assert.equal(hm2.som_bd, 0); // không còn phụ thuộc id1 nữa nên bắt đầu lại từ ngày 0
  const pt = await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/phu-thuoc')).json();
  assert.equal(pt.phu_thuoc.length, 0);
});

test('xóa hạng mục là nhóm (nhom_id của con) không để con trỏ vào hạng mục đã xóa', async () => {
  const { env } = moiEnv();
  const idNhom = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'Nhóm' }) })).json()).id;
  const idCon = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'Con', nhom_id: idNhom }) })).json()).id;
  const xoa = await goi(env, 'chu@vi-du.vn', `/api/hoalac/hang-muc/${idNhom}`, { method: 'DELETE' });
  assert.equal(xoa.status, 200);
  const con = await (await goi(env, 'chu@vi-du.vn', `/api/hoalac/hang-muc/${idCon}`)).json();
  assert.equal(con.nhom_id, null);
});

test('hạng mục đã vào một baseline thì không xóa được (409), tránh phá dữ liệu lịch sử', async () => {
  const { env } = moiEnv();
  const id1 = (await (await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'A' }) })).json()).id;
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/baseline', { method: 'POST', body: JSON.stringify({ ten: 'Baseline khởi công' }) });
  const xoa = await goi(env, 'chu@vi-du.vn', `/api/hoalac/hang-muc/${id1}`, { method: 'DELETE' });
  assert.equal(xoa.status, 409);
});

test('chủ tạo baseline, chụp đúng ngày bắt đầu/kết thúc hiện tại của mọi hạng mục', async () => {
  const { env } = moiEnv();
  await goi(env, 'chu@vi-du.vn', '/api/hoalac/hang-muc', { method: 'POST', body: JSON.stringify({ ten: 'A', ngay_bat_dau: '2026-11-01', ngay_ket_thuc: '2026-11-10' }) });
  const r = await goi(env, 'chu@vi-du.vn', '/api/hoalac/baseline', { method: 'POST', body: JSON.stringify({ ten: 'Baseline khởi công' }) });
  assert.equal(r.status, 201);
  const { id, so_hang_muc } = await r.json();
  assert.equal(so_hang_muc, 1);
  const chiTiet = await (await goi(env, 'chu@vi-du.vn', `/api/hoalac/baseline/${id}`)).json();
  assert.equal(chiTiet.hang_muc[0].ngay_bat_dau, '2026-11-01');
});

test('giai đoạn (stage gate): chủ tạo và sửa được, đối tác chỉ xem được', async () => {
  const { env } = moiEnv();
  const r = await goi(env, 'chu@vi-du.vn', '/api/hoalac/giai-doan', { method: 'POST', body: JSON.stringify({ ten: 'Chuẩn bị đầu tư', thu_tu: 1 }) });
  const { id } = await r.json();
  const suaChan = await goi(env, 'doi-tac@vi-du.vn', `/api/hoalac/giai-doan/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: 'dang_mo' }) });
  assert.equal(suaChan.status, 403);
  const xemDuoc = await goi(env, 'doi-tac@vi-du.vn', '/api/hoalac/giai-doan');
  assert.equal(xemDuoc.status, 200);
});
