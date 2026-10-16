import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { gomAnhTuLo, luuAnhDaiDien, luuAnhTuLo, phucVuAnh, anhCoSan } from '../src/anh-dai-dien.js';
import { dsHoiThoaiZalo, tinHoiThoaiZalo } from '../src/api.js';

const kho = () => {
  const m = new Map();
  return { m, put: async (k, v, o) => m.set(k, { v, o }), get: async (k) => (m.has(k) ? { body: m.get(k).v, httpMetadata: m.get(k).o.httpMetadata } : null) };
};
const AN = 'https://s120-ava-talk.zadn.vn/a/b/c.jpg';
const dungEnv = () => ({ CSDL: d1(dungCsdl()), TEP: kho() });
const nhaiFetch = (cho) => { const goc = globalThis.fetch; globalThis.fetch = cho; return () => { globalThis.fetch = goc; }; };
const anhGia = (loai = 'image/jpeg', byte = 4) => async () => new Response(new Uint8Array(byte).fill(7), { headers: { 'content-type': loai } });

test('gom ảnh từ lô tin: ảnh hội thoại và ảnh người gửi trong nhóm, bỏ tin mình và mã lạ', () => {
  const ds = gomAnhTuLo([
    { thread: 'Nhóm A', thread_id: '77', type: 'nhom', sender: 'Lan', sender_id: '5', thread_avatar: AN, sender_avatar: AN + '?l' },
    { thread: 'Nhóm A', thread_id: '77', type: 'nhom', sender: 'Tôi', sender_id: '9', thread_avatar: AN, sender_avatar: AN + '?t' },
    { thread: 'Minh', thread_id: '12', type: 'ca-nhan', sender: 'Minh', thread_avatar: AN + '?m' },
    { thread: 'X', thread_id: 'a/../b', type: 'ca-nhan', thread_avatar: AN },
    { thread: 'Y', type: 'ca-nhan', thread_avatar: AN },
  ]);
  assert.deepEqual(ds.map((a) => a.ma).sort(), ['ca-nhan:12', 'nguoi:5', 'nhom:77']);
});

test('lưu ảnh đại diện: tải về kho, lần sau cùng địa chỉ thì không tải lại, đổi địa chỉ thì tải lại', async () => {
  const env = dungEnv();
  let lan = 0;
  const tra = nhaiFetch(async (...a) => { lan++; return anhGia()(...a); });
  try {
    assert.equal(await luuAnhDaiDien(env, 't', { ma: 'ca-nhan:12', ten: 'Minh', url: AN }), 'moi');
    assert.equal(await luuAnhDaiDien(env, 't', { ma: 'ca-nhan:12', ten: 'Minh Đổi', url: AN }), 'co-san');
    assert.equal(lan, 1);
    assert.equal(env.CSDL && (await env.CSDL.prepare('SELECT ten FROM anh_dai_dien WHERE ma = ?1').bind('ca-nhan:12').first()).ten, 'Minh Đổi');
    assert.equal(await luuAnhDaiDien(env, 't', { ma: 'ca-nhan:12', ten: 'Minh', url: AN + '?moi' }), 'moi');
    assert.equal(lan, 2);
    const ph = await phucVuAnh(env, 't', 'ca-nhan:12');
    assert.equal(ph.status, 200);
    assert.equal(ph.headers.get('content-type'), 'image/jpeg');
    assert.equal((await phucVuAnh(env, 'tc-khac', 'ca-nhan:12')).status, 404); // tổ chức khác không xem được
  } finally { tra(); }
});

test('không tải địa chỉ ngoài Zalo, không nhận tệp không phải ảnh hoặc quá lớn; lỗi một ảnh không làm hỏng cả lô', async () => {
  const env = dungEnv();
  const goi = [];
  const tra = nhaiFetch(async (u, ...a) => { goi.push(String(u)); return String(u).includes('hong') ? anhGia('text/html')(u, ...a) : String(u).includes('lon') ? anhGia('image/png', 3 * 1024 * 1024)(u, ...a) : anhGia()(u, ...a); });
  try {
    await assert.rejects(luuAnhDaiDien(env, 't', { ma: 'nhom:1', url: 'https://evil.example.com/a.jpg' }), /không hợp lệ/);
    await assert.rejects(luuAnhDaiDien(env, 't', { ma: 'nhom:1', url: 'http://s120-ava-talk.zadn.vn/a.jpg' }), /không hợp lệ/);
    await assert.rejects(luuAnhDaiDien(env, 't', { ma: 'nhom:1', url: 'https://s1.zadn.vn/hong.jpg' }), /không trả về ảnh/);
    await assert.rejects(luuAnhDaiDien(env, 't', { ma: 'nhom:1', url: 'https://s1.zadn.vn/lon.png' }), /lớn quá/);
    assert.equal(goi.some((u) => u.includes('evil')), false);
    const moi = await luuAnhTuLo(env, 't', [
      { thread: 'A', thread_id: '1', type: 'nhom', thread_avatar: 'https://s1.zadn.vn/hong.jpg' },
      { thread: 'B', thread_id: '2', type: 'nhom', thread_avatar: 'https://s1.zadn.vn/tot.jpg' },
    ]);
    assert.equal(moi, 1);
  } finally { tra(); }
});

test('danh sách hội thoại và tin trong nhóm trả địa chỉ ảnh có số phiên bản; chưa có ảnh thì null', async () => {
  const env = dungEnv();
  const them = (ma, gui, nhom, tieu, hoi) => env.CSDL.prepare(`INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem, tao_luc, ma_hoi_thoai) VALUES ('t','zalo',?1,?2,?3,?4,'x','2026-10-16T01:00:00Z','2026-10-16T01:00:00Z',?5)`).bind(ma, gui, nhom, tieu, hoi).run();
  await them('1', 'Lan', 'Nhóm A', null, 'nhom:77');
  await them('2', 'Hùng', 'Nhóm A', null, 'nhom:77');
  await them('3', 'Minh', null, 'Minh', 'ca-nhan:12');
  const tra = nhaiFetch(anhGia());
  try {
    await luuAnhDaiDien(env, 't', { ma: 'nhom:77', ten: 'Nhóm A', url: AN });
    await luuAnhDaiDien(env, 't', { ma: 'nguoi:5', ten: 'Lan', url: AN + '?l' });
  } finally { tra(); }
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/'));
  const theo = Object.fromEntries(ds.map((x) => [x.khoa, x.anh]));
  assert.match(theo['nhom:77'], /^\/api\/anh\/nhom%3A77\?v=/);
  assert.equal(theo['ca-nhan:12'], null);
  const r = await (await tinHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/tin?khoa=nhom:77'))).json();
  assert.match(r.anh_hoi_thoai, /^\/api\/anh\/nhom%3A77/);
  assert.deepEqual(Object.keys(r.anh_nguoi), ['Lan']); // Hùng chưa có ảnh
  assert.equal((await anhCoSan(env, 't', 'nguoi')).length, 1);
});
