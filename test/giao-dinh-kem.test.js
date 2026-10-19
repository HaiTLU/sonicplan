import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { chuanTepTuy, dsDinhKemTuDong, layTinNguCanh, timDinhKem } from '../src/tho-claude.js';

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

test('lựa chọn tệp: chuẩn hóa dữ liệu lạ', async () => {
  assert.equal(chuanTepTuy(null), null);
  assert.equal(chuanTepTuy({ them: [], bo: [] }), null);
  assert.deepEqual(chuanTepTuy({ them: [1, '2', 'x', -3, 1.5, 1], bo: 'abc' }), { them: [1, 2], bo: [] });
});
