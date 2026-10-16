import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { chuanTepTuy, docDinhKem, dsDinhKemTuDong, dungNguCanhMd, layDinhKem, layTinNguCanh, taoLuotMay, timDinhKem } from '../src/tho-claude.js';

const kho = () => {
  const m = new Map();
  return { m, put: async (k, v) => m.set(k, v), get: async (k) => (m.has(k) ? { body: m.get(k), arrayBuffer: async () => m.get(k) } : null) };
};

function dung() {
  const db = dungCsdl();
  const env = { CSDL: d1(db), TEP: kho() };
  db.prepare(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Tổ chức', '2026-10-01T00:00:00Z')`).run();
  const tin = (id, hoi, nd, luc) => db.prepare(`INSERT INTO tin_nhan (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES (?1, 'tc1', 'zalo', ?2, 'An', 'Nhóm', ?3, ?4, ?4, ?5)`).run(id, `g${id}`, nd, luc, hoi);
  const viec = (id, ten, tinId) => db.prepare(`INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, nhom, du_an_id, tin_nhan_id, tao_luc, cap_nhat_luc) VALUES (?1, 'tc1', ?2, 'mo', 'claude_chuan_bi', NULL, ?3, '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`).run(id, ten, tinId);
  const tep = (id, tinId, ten, nguon = 'zalo', byte = 'DATA') => {
    const khoa = `k/${id}`;
    env.TEP.m.set(khoa, new TextEncoder().encode(byte));
    db.prepare(`INSERT INTO tep (id, to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, nguon, tao_luc) VALUES (?1, 'tc1', ?2, ?3, 'application/pdf', ?4, ?5, ?6, '2026-10-10T00:00:00Z')`).run(id, tinId, ten, byte.length, khoa, nguon);
  };
  return { db, env, tin, viec, tep };
}

test('giao nhiều việc một lượt: tin gốc, cuộc trò chuyện và tệp của TỪNG việc đều vào ngữ cảnh, không chỉ việc đầu', async () => {
  const { env, tin, viec, tep } = dung();
  tin(1, 'nhom:A', 'Gửi em báo giá Marcom', '2026-10-10T01:00:00Z');
  tin(2, 'nhom:B', 'Nhờ anh xem kịch bản ba tập', '2026-10-10T02:00:00Z');
  viec(10, 'Làm báo giá Marcom', 1);
  viec(11, 'Xem kịch bản', 2);
  tep(100, 1, 'bao-gia.pdf');
  tep(101, 2, 'kich-ban.pdf');
  const dsViec = [{ id: 10, tieu_de: 'Làm báo giá Marcom', tin_nhan_id: 1 }, { id: 11, tieu_de: 'Xem kịch bản', tin_nhan_id: 2 }];
  const tins = [await layTinNguCanh(env, 'tc1', dsViec[0]), await layTinNguCanh(env, 'tc1', dsViec[1])];
  const dk = await layDinhKem(env, 'tc1', [...new Set(tins.flatMap((t) => t.quanh.map((x) => x.id)))]);
  assert.deepEqual(dk.map((t) => t.ten), ['bao-gia.pdf', 'kich-ban.pdf']);
  const md = dungNguCanhMd({ viecList: dsViec, duAn: null, tin: tins[0], tins, ghiNho: [], dinhKem: dk });
  assert.match(md, /Gửi em báo giá Marcom/);
  assert.match(md, /Nhờ anh xem kịch bản ba tập/); // tin gốc của việc thứ hai
  assert.match(md, /Tin gốc sinh ra việc "Xem kịch bản" \(v11\)/);
  assert.match(md, /- bao-gia\.pdf/);
  assert.match(md, /- kich-ban\.pdf/);
});

test('một việc: ngữ cảnh giữ dạng cũ', async () => {
  const { env, tin } = dung();
  tin(1, 'nhom:A', 'Gửi em báo giá', '2026-10-10T01:00:00Z');
  const t = await layTinNguCanh(env, 'tc1', { id: 10, tin_nhan_id: 1 });
  const md = dungNguCanhMd({ viecList: [{ id: 10, tieu_de: 'Việc', nhom: 'claude_chuan_bi' }], duAn: null, tin: t, ghiNho: [], dinhKem: [] });
  assert.match(md, /## Tin gốc sinh ra việc\n/);
});

test('bỏ chọn tệp tự tìm, thêm tệp của mình; tệp của tổ chức khác hoặc không phải tệp giao Claude thì không nhận', async () => {
  const { env, tin, tep } = dung();
  tin(1, 'nhom:A', 'x', '2026-10-10T01:00:00Z');
  tep(100, 1, 'a.pdf');
  tep(101, 1, 'b.pdf');
  tep(200, null, 'them.docx', 'giao-claude', 'THEM');
  tep(201, null, 'rac.txt', 'zalo', 'RAC'); // không phải tệp giao Claude: không được thêm bằng id
  env.CSDL.prepare(`INSERT INTO tep (id, to_chuc_id, ten, kich_thuoc, r2_khoa, nguon, tao_luc) VALUES (300, 'tc-khac', 'khac.pdf', 4, 'k/300', 'giao-claude', '2026-10-10T00:00:00Z')`).run();
  env.TEP.m.set('k/300', new TextEncoder().encode('KHAC'));
  const rows = await timDinhKem(env, 'tc1', [1], { bo: [101], them: [200, 201, 300, 200] });
  assert.deepEqual(rows.map((r) => r.ten), ['a.pdf', 'them.docx']);
  const dk = await docDinhKem(env, rows);
  assert.equal(new TextDecoder().decode(dk[1].byte), 'THEM');
});

test('danh sách tệp tự tìm cho khung giao: mỗi tệp một lần, kèm việc của nó', async () => {
  const { env, tin, tep } = dung();
  tin(1, 'nhom:A', 'x', '2026-10-10T01:00:00Z');
  tin(2, 'nhom:A', 'y', '2026-10-10T01:05:00Z'); // cùng cuộc trò chuyện: hai việc cùng thấy tệp này
  tep(100, 1, 'a.pdf');
  const ds = await dsDinhKemTuDong(env, 'tc1', [{ id: 10, tin_nhan_id: 1 }, { id: 11, tin_nhan_id: 2 }]);
  assert.equal(ds.length, 1);
  assert.deepEqual({ id: ds[0].id, viec_id: ds[0].viec_id }, { id: 100, viec_id: 10 });
});

test('lựa chọn tệp lưu theo lượt, chuẩn hóa dữ liệu lạ', async () => {
  assert.equal(chuanTepTuy(null), null);
  assert.equal(chuanTepTuy({ them: [], bo: [] }), null);
  assert.deepEqual(chuanTepTuy({ them: [1, '2', 'x', -3, 1.5, 1], bo: 'abc' }), { them: [1, 2], bo: [] });
  const { db, env, viec } = dung();
  viec(10, 'V', null);
  const id = await taoLuotMay(env, 'tc1', { id: 10 }, { tepTuy: { them: [5], bo: [7] } });
  assert.deepEqual(JSON.parse(db.prepare('SELECT tep_tuy FROM luot_claude WHERE id = ?').get(id).tep_tuy), { them: [5], bo: [7] });
  const id2 = await taoLuotMay(env, 'tc1', { id: 10 }, {});
  assert.equal(db.prepare('SELECT tep_tuy FROM luot_claude WHERE id = ?').get(id2).tep_tuy, null);
});
