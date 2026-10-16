import test from 'node:test';
import assert from 'node:assert/strict';
import { d1, dungCsdl } from './csdl-thu.js';
import { ketThucGui, layLenhGui, taiTepGui, taoLenhGui, trangThaiGui } from '../src/zalo-gui.js';

const kho = () => {
  const m = new Map();
  return { m, put: async (k, v, o) => m.set(k, { v, o }), get: async (k) => (m.has(k) ? { body: m.get(k).v, httpMetadata: m.get(k).o.httpMetadata } : null) };
};
const dung = () => { const db = dungCsdl(); return { db, env: { CSDL: d1(db), TEP: kho() } }; };
const chu = { to_chuc: { id: 't', vai_tro: 'chu' } };
const yeuCau = (truong, tep = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(truong)) f.set(k, v);
  for (const t of tep) f.append('tep', new File([t.nd || 'x'], t.ten, { type: t.loai || 'application/pdf' }));
  return new Request('http://x/api/zalo/gui', { method: 'POST', body: f });
};
const doc = async (ph) => ({ ma: ph.status, ...(await ph.json()) });

test('chỉ chủ tổ chức gửi được; mã hội thoại phải đúng dạng; phải có chữ hoặc tệp; giới hạn độ dài và số tệp', async () => {
  const { env } = dung();
  assert.equal((await doc(await taoLenhGui(env, 't', { to_chuc: { id: 't', vai_tro: 'thanh_vien' } }, yeuCau({ khoa: 'nhom:1', noi_dung: 'a' })))).ma, 403);
  assert.equal((await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom~Tên cũ', noi_dung: 'a' })))).ma, 400);
  assert.equal((await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: "ca-nhan:1'; DROP", noi_dung: 'a' })))).ma, 400);
  assert.equal((await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom:1', noi_dung: '   ' })))).ma, 400);
  assert.equal((await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom:1', noi_dung: 'x'.repeat(2001) })))).ma, 400);
  assert.equal((await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom:1', noi_dung: 'a' }, Array.from({ length: 6 }, (_, i) => ({ ten: `f${i}.pdf` })))))).ma, 400);
});

test('tạo lệnh, máy Mac lấy một lần, tải tệp khi đang gửi, báo xong; lệnh khác tổ chức không lấy được', async () => {
  const { env, db } = dung();
  const r = await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom:77', noi_dung: 'Chào cả nhà 😀' }, [{ ten: 'bao-cao.pdf', nd: 'PDFDATA' }])));
  assert.ok(r.id);
  assert.deepEqual(await (await layLenhGui(env, 'tc-khac')).json(), {});
  const l = await (await layLenhGui(env, 't')).json();
  assert.equal(l.id, r.id);
  assert.equal(l.thread_id, '77');
  assert.equal(l.type, 'nhom');
  assert.equal(l.text, 'Chào cả nhà 😀');
  assert.equal(l.files.length, 1);
  assert.deepEqual(await (await layLenhGui(env, 't')).json(), {}); // lấy rồi thì không giao lại: tránh gửi hai lần
  const tai = await taiTepGui(env, 't', new URL(`http://x/?lenh=${l.id}&id=${l.files[0].id}`));
  assert.equal(await tai.text(), 'PDFDATA');
  assert.equal((await taiTepGui(env, 't', new URL(`http://x/?lenh=${l.id}&id=9999`))).status, 404);
  assert.equal((await taiTepGui(env, 'tc-khac', new URL(`http://x/?lenh=${l.id}&id=${l.files[0].id}`))).status, 404);
  assert.equal((await (await ketThucGui(env, 't', { id: l.id, ok: true })).json()).ok, true);
  assert.equal((await (await ketThucGui(env, 't', { id: l.id, ok: false, loi: 'x' })).json()).ok, false); // đã xong thì không đổi
  assert.equal(db.prepare('SELECT trang_thai FROM zalo_gui WHERE id = ?').get(r.id).trang_thai, 'xong');
  assert.equal((await taiTepGui(env, 't', new URL(`http://x/?lenh=${l.id}&id=${l.files[0].id}`))).status, 404); // hết gửi thì không tải được nữa
});

test('lệnh chờ quá 3 phút thì bỏ, không gửi muộn; lệnh đã lấy mà im lặng thì báo không rõ đã gửi chưa', async () => {
  const { env, db } = dung();
  const a = (await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'ca-nhan:5', noi_dung: 'cũ' })))).id;
  db.prepare(`UPDATE zalo_gui SET tao_luc = ? WHERE id = ?`).run(new Date(Date.now() - 4 * 60_000).toISOString(), a);
  assert.deepEqual(await (await layLenhGui(env, 't')).json(), {});
  assert.equal(db.prepare('SELECT trang_thai FROM zalo_gui WHERE id = ?').get(a).trang_thai, 'loi');
  const b = (await doc(await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'ca-nhan:5', noi_dung: 'mới' })))).id;
  await layLenhGui(env, 't');
  db.prepare(`UPDATE zalo_gui SET cap_nhat_luc = ? WHERE id = ?`).run(new Date(Date.now() - 4 * 60_000).toISOString(), b);
  const ds = (await (await trangThaiGui(env, 't', new URL('http://x/?khoa=ca-nhan:5'))).json()).ds;
  const dongB = ds.find((x) => x.id === b);
  assert.equal(dongB.trang_thai, 'loi');
  assert.match(dongB.loi, /xem tin đã gửi chưa/);
});

test('gửi dồn dập quá 20 lần trong 10 phút thì từ chối', async () => {
  const { env } = dung();
  for (let i = 0; i < 20; i++) assert.equal((await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom:1', noi_dung: `t${i}` }))).status, 200);
  assert.equal((await taoLenhGui(env, 't', chu, yeuCau({ khoa: 'nhom:1', noi_dung: 'một tin nữa' }))).status, 429);
});
