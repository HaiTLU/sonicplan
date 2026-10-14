import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { dsHoiThoaiZalo, tinHoiThoaiZalo } from '../src/api.js';
import { chuyenTinZalo } from '../src/nhan-zalo.js';
import { vaMa } from '../may-chu/zalo-listener/va-hoi-thoai.mjs';

function csdlGia() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE tin_nhan (id INTEGER PRIMARY KEY AUTOINCREMENT, to_chuc_id TEXT, nguon TEXT, ma_goc TEXT, nguoi_gui TEXT, nhom TEXT, tieu_de TEXT, noi_dung TEXT, thoi_diem TEXT, da_xem INTEGER DEFAULT 0, an INTEGER DEFAULT 0, ma_hoi_thoai TEXT);
    CREATE TABLE tep (id INTEGER PRIMARY KEY, to_chuc_id TEXT, tin_nhan_id INTEGER, ten TEXT, loai TEXT, kich_thuoc INTEGER, drive_id TEXT);
    CREATE TABLE kho_da_luu (to_chuc_id TEXT, loai TEXT, ma TEXT, drive_id TEXT);`);
  const chay = (sql, tham) => ({ q: db.prepare(sql.replace(/\?(\d+)/g, '?')), th: [...sql.matchAll(/\?(\d+)/g)].map((m) => tham[m[1] - 1]) });
  return { db, CSDL: { prepare: (sql) => ({ bind: (...tham) => {
    const { q, th } = chay(sql, tham);
    return { all: async () => ({ results: q.all(...th) }), first: async () => q.get(...th) ?? null, run: async () => ({ meta: { changes: Number(q.run(...th).changes) } }) };
  } }) } };
}
const them = (env, t) => env.db.prepare(`INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem, ma_hoi_thoai) VALUES ('t','zalo',?,?,?,?,?,?,?)`).run(t.ma, t.gui, t.nhom ?? null, t.tieu_de ?? null, t.nd, t.luc, t.hoi ?? null);

test('tin mình gửi đi và tin người kia cùng mã hội thoại nằm chung một mục, theo thứ tự thời gian', async () => {
  const env = csdlGia();
  them(env, { ma: '1', gui: 'Linh Doan', tieu_de: 'Linh Doan', nd: 'Chào anh', luc: '2026-10-14T02:47:00Z', hoi: 'ca-nhan:555' });
  them(env, { ma: '2', gui: 'Tôi', tieu_de: 'Nam Hai', nd: 'Chào em', luc: '2026-10-14T02:50:00Z', hoi: 'ca-nhan:555' });
  them(env, { ma: '3', gui: 'Tôi', tieu_de: 'Linh Doan', nd: 'Gửi em tài liệu', luc: '2026-10-14T02:55:00Z', hoi: 'ca-nhan:555' });
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/hoi-thoai'));
  assert.equal(ds.length, 1);
  assert.equal(ds[0].ten, 'Linh Doan'); // tên lấy từ tin của người kia, không phải tên mình
  assert.equal(ds[0].n, 3);
  assert.equal(ds[0].khoa, 'ca-nhan:555');
  const r = await tinHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/tin?khoa=ca-nhan:555'));
  assert.deepEqual((await r.json()).tin.map((x) => x.noi_dung), ['Chào anh', 'Chào em', 'Gửi em tài liệu']);
});

test('tin cũ chưa có mã hội thoại vẫn gom theo tên và mở được bằng địa chỉ cũ', async () => {
  const env = csdlGia();
  them(env, { ma: '1', gui: 'Minh', tieu_de: 'Minh', nd: 'a', luc: '2026-10-14T01:00:00Z' });
  them(env, { ma: '2', gui: 'Tôi', nhom: 'Phòng A', nd: 'b', luc: '2026-10-14T01:05:00Z' });
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/'));
  assert.deepEqual(ds.map((x) => x.khoa).sort(), ['ca-nhan~Minh', 'nhom~Phòng A']);
  const r = await tinHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/tin?loai=ca-nhan&ten=Minh'));
  assert.equal((await r.json()).tin.length, 1);
});

test('tên đổi trên Zalo thì mục hiện tên mới nhất của người kia', async () => {
  const env = csdlGia();
  them(env, { ma: '1', gui: 'An', tieu_de: 'An', nd: 'a', luc: '2026-10-14T01:00:00Z', hoi: 'ca-nhan:9' });
  them(env, { ma: '2', gui: 'An Nguyễn', tieu_de: 'An Nguyễn', nd: 'b', luc: '2026-10-14T02:00:00Z', hoi: 'ca-nhan:9' });
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/'));
  assert.equal(ds[0].ten, 'An Nguyễn');
});

test('máy Mac gửi thread_id thì lưu thành mã hội thoại có loại; thiếu thì để trống', () => {
  assert.equal(chuyenTinZalo({ id: 1, thread: 'Minh', thread_id: '123', type: 'ca-nhan', sender: 'Tôi', time: '2026-10-14T01:00:00Z', text: 'x' }).ma_hoi_thoai, 'ca-nhan:123');
  assert.equal(chuyenTinZalo({ id: 2, thread: 'Nhóm', thread_id: '77', type: 'nhom', sender: 'A', time: '2026-10-14T01:00:00Z', text: 'x' }).ma_hoi_thoai, 'nhom:77');
  assert.equal(chuyenTinZalo({ id: 3, thread: 'Minh', type: 'ca-nhan', sender: 'Minh', time: '2026-10-14T01:00:00Z', text: 'x' }).ma_hoi_thoai, null);
});

test('vá chương trình Zalo: thêm thread_id và tên người nhận, chạy lại không đổi, mã lạ thì từ chối', () => {
  const goc = `async function threadName(api, msg) {\n  if (msg.type !== ThreadType.Group) return msg.data.dName || msg.threadId;\n}\nbuffer.push({\n    id,\n    thread,\n    type: key === "group" ? "nhom" : "ca-nhan",\n  });\n  setInterval(async () => { await flush({ heartbeat: true }); saveSession(api); }, FLUSH_MIN * 60_000);\n`;
  const a = vaMa(goc);
  assert.ok(a.doi);
  assert.match(a.ma, /thread_id: msg\.threadId,/);
  assert.match(a.ma, /return tenNguoiDoiDien\(api, msg\);/);
  assert.match(a.ma, /setInterval\(\(\) => \{ if \(buffer\.length\) guiLo\(\); \}, 30_000\);/);
  assert.equal(vaMa(a.ma).doi, false);
  // bản đã vá lần trước (chỉ có mã hội thoại) vẫn được vá thêm phần gửi nhanh
  const cu = a.ma.replace(/\n  \/\/ Gửi tin gần như ngay[\s\S]*?30_000\);/, '\n  setInterval(async () => { await flush({ heartbeat: true }); saveSession(api); }, FLUSH_MIN * 60_000);');
  assert.ok(vaMa(cu).doi);
  assert.throws(() => vaMa('console.log(1)'), /Không nhận ra/);
});

test('Google báo Client Secret sai: thông báo tiếng Việt chỉ đúng chỗ sửa', async () => {
  const { doiMa } = await import('../src/google.js');
  const goc = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'invalid_client', error_description: 'The provided client secret is invalid.' }), { status: 401 });
  try {
    await assert.rejects(doiMa({ client_id: 'a', client_secret: 'b' }, { grant_type: 'refresh_token', refresh_token: 'x' }), /Nhập lại khóa Google/);
  } finally { globalThis.fetch = goc; }
});

test('tin cũ mình gửi dưới tên mình: xếp vào cuộc trò chuyện duy nhất quanh đó, mơ hồ thì để nguyên', async () => {
  const { xepTinGuiDiVaoHoiThoai } = await import('../src/nhan-zalo.js');
  const env = csdlGia();
  them(env, { ma: '1', gui: 'Linh', tieu_de: 'Linh', nd: 'Chào', luc: '2026-10-14T02:00:00Z', hoi: 'ca-nhan:1' });
  them(env, { ma: '2', gui: 'Tôi', tieu_de: 'Nam Hai', nd: 'Dạ em', luc: '2026-10-14T02:05:00Z' }); // chỉ có Linh quanh đó
  them(env, { ma: '3', gui: 'Minh', tieu_de: 'Minh', nd: 'Anh ơi', luc: '2026-10-14T05:00:00Z' });
  them(env, { ma: '4', gui: 'Vy', tieu_de: 'Vy', nd: 'Anh ơi', luc: '2026-10-14T05:01:00Z' });
  them(env, { ma: '5', gui: 'Tôi', tieu_de: 'Nam Hai', nd: 'Ok', luc: '2026-10-14T05:02:00Z' }); // hai người quanh đó
  assert.equal(await xepTinGuiDiVaoHoiThoai(env, 't'), 1);
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/'));
  const linh = ds.find((x) => x.ten === 'Linh');
  assert.equal(linh.n, 2);
  assert.ok(ds.some((x) => x.ten === 'Nam Hai' && x.n === 1));
});

test('chuyển tay tin mình gửi sang đúng người: chỉ đụng tin chưa có mã, không đụng nhóm hay tin đã xếp', async () => {
  const { chuyenTinSangHoiThoai } = await import('../src/api.js');
  const env = csdlGia();
  them(env, { ma: '1', gui: 'Linh Doan', tieu_de: 'Linh Doan', nd: 'Chào anh', luc: '2026-10-14T02:47:00Z', hoi: 'ca-nhan:555' });
  them(env, { ma: '2', gui: 'Tôi', tieu_de: 'Nam Hai', nd: 'gửi file', luc: '2026-10-14T05:00:00Z' });
  them(env, { ma: '3', gui: 'Tôi', tieu_de: 'Nam Hai', nd: 'đã xếp', luc: '2026-10-14T05:01:00Z', hoi: 'ca-nhan:999' });
  them(env, { ma: '4', gui: 'Tôi', nhom: 'Phòng A', nd: 'nhóm', luc: '2026-10-14T05:02:00Z' });
  const r = await chuyenTinSangHoiThoai(env, 't', { ids: [2, 3, 4], khoa_dich: 'ca-nhan:555' });
  assert.equal((await r.json()).da_chuyen, 1);
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/'));
  assert.equal(ds.find((x) => x.khoa === 'ca-nhan:555').n, 2);
  assert.equal((await chuyenTinSangHoiThoai(env, 't', { ids: [2], khoa_dich: 'nhom~X' })).status, 400);
  assert.equal((await chuyenTinSangHoiThoai(env, 't', { ids: [], khoa_dich: 'ca-nhan:555' })).status, 400);
  assert.equal((await chuyenTinSangHoiThoai(env, 't', { ids: [2], khoa_dich: 'ca-nhan:000' })).status, 404);
});

test('khung tin đang mở lấy được tin mới hơn bằng sau_id, không lặp tin cũ', async () => {
  const env = csdlGia();
  them(env, { ma: '1', gui: 'Dũng', tieu_de: 'Dũng', nd: 'a', luc: '2026-10-14T09:00:00Z', hoi: 'ca-nhan:7' });
  them(env, { ma: '2', gui: 'Tôi', tieu_de: 'Dũng', nd: 'alo', luc: '2026-10-14T09:39:00Z', hoi: 'ca-nhan:7' });
  them(env, { ma: '3', gui: 'Dũng', tieu_de: 'Dũng', nd: 'hello', luc: '2026-10-14T09:40:00Z', hoi: 'ca-nhan:7' });
  const r = await tinHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/tin?khoa=ca-nhan:7&sau_id=1'));
  assert.deepEqual((await r.json()).tin.map((x) => x.noi_dung), ['alo', 'hello']);
  const rong = await tinHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/tin?khoa=ca-nhan:7&sau_id=3'));
  assert.equal((await rong.json()).tin.length, 0);
});

test('tin cũ chưa có mã cùng tên nhóm với một cuộc đã có mã thì nhập chung một mục', async () => {
  const env = csdlGia();
  them(env, { ma: 'a', gui: 'Ha', nhom: 'NCS_K5_TLU\\T', nd: 'cũ', luc: '2026-10-14T08:00:00Z' });
  them(env, { ma: 'b', gui: 'Trang', nhom: 'NCS_K5_TLU\\T', nd: 'mới', luc: '2026-10-14T08:30:00Z', hoi: 'nhom:99' });
  them(env, { ma: 'c', gui: 'X', nhom: 'Nhóm khác', nd: 'cũ', luc: '2026-10-14T08:00:00Z' });
  const { ds } = await dsHoiThoaiZalo(env, 't', new URL('http://x/api/zalo/hoi-thoai'));
  assert.equal(ds.filter((x) => x.ten === 'NCS_K5_TLU\\T').length, 1);
  assert.equal(ds.find((x) => x.ten === 'NCS_K5_TLU\\T').n, 2);
  assert.ok(ds.some((x) => x.ten === 'Nhóm khác'));
});
