// Chế độ đồng bộ Google "tu-chia": mỗi việc chỉ vào một nơi (có giờ hoặc buổi thì Lịch, còn lại Tasks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl, d1 } from './csdl-thu.js';
import { dongBoViec, noiDong } from '../src/google.js';
import { chuanCauHinh } from '../src/google-nhan.js';

test('noiDong: tu-chia chia theo giờ hoặc buổi; chế độ cũ trả lại nguyên chế độ', () => {
  const ngay = '2026-11-05';
  assert.equal(noiDong({ han_ngay: ngay, gio_hen: '10:00' }, 'tu-chia'), 'lich');
  assert.equal(noiDong({ han_ngay: ngay, buoi: 'sang' }, 'tu-chia'), 'lich');
  assert.equal(noiDong({ han_ngay: ngay, buoi: 'chieu' }, 'tu-chia'), 'lich');
  assert.equal(noiDong({ han_ngay: ngay }, 'tu-chia'), 'tasks');
  assert.equal(noiDong({ han_ngay: ngay, buoi: 'ca-ngay' }, 'tu-chia'), 'tasks');
  assert.equal(noiDong({}, 'tu-chia'), 'tasks');
  assert.equal(noiDong({ gio_hen: '10:00' }, 'tu-chia'), 'tasks', 'có giờ mà không có ngày thì không đặt lịch được');
  assert.equal(noiDong({ han_ngay: ngay, nguon: 'lich' }, 'tu-chia'), 'lich');
  for (const cd of ['ca-hai', 'tasks', 'lich']) assert.equal(noiDong({ han_ngay: ngay, gio_hen: '10:00' }, cd), cd);
  assert.equal(chuanCauHinh({ che_do: 'tu-chia' }).che_do, 'tu-chia');
  assert.equal(chuanCauHinh({ che_do: 'la' }).che_do, 'ca-hai');
});

function dung(cheDo) {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Thử', '2026-11-01T00:00:00Z')`);
  db.prepare(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('tc1', 'google_nhan', ?)`).run(JSON.stringify({ che_do: cheDo, bat: [] }));
  const them = (id, tieu, han, gio, buoi, o = {}) => db.prepare(
    `INSERT INTO viec (id, to_chuc_id, tieu_de, han_ngay, gio_hen, buoi, trang_thai, tao_luc, cap_nhat_luc, google_task_id, lich_event_id, can_dong_bo, google_task_xong, xong_luc)
     VALUES (?, 'tc1', ?, ?, ?, ?, ?, '2026-11-02T01:00:00Z', '2026-11-02T01:00:00Z', ?, ?, ?, ?, ?)`,
  ).run(id, tieu, han, gio, buoi, o.tt || 'mo', o.task ?? null, o.ev ?? null, o.cb ?? 0, o.tx ?? 0, o.xong ?? null);
  return { db, them, env: { CSDL: d1(db) } };
}

async function chay(env) {
  const goi = [];
  const that = globalThis.fetch;
  globalThis.fetch = async (url, tc) => {
    const u = String(url);
    const m = tc?.method || 'GET';
    goi.push(`${m} ${u.includes('/calendar/') ? 'LICH' : 'TASK'}${u.split('/').pop().startsWith('events') || u.endsWith('/tasks') ? '' : ' ' + u.split('/').pop()}`);
    if (m === 'POST') return Response.json({ id: `moi-${goi.length}` });
    if (m === 'DELETE') return new Response(null, { status: 204 });
    return Response.json({ items: [] });
  };
  try { await dongBoViec(env, 'tc1', 'tok'); } finally { globalThis.fetch = that; }
  return goi.filter((g) => !g.startsWith('GET'));
}

test('tu-chia: việc mới chỉ vào một nơi', async () => {
  const { db, them, env } = dung('tu-chia');
  them(1, 'Có giờ', '2026-11-05', '10:00', null);
  them(2, 'Buổi chiều', '2026-11-05', null, 'chieu');
  them(3, 'Chỉ ngày', '2026-11-05', null, null);
  them(4, 'Không ngày', null, null, null);
  await chay(env);
  const r = (id) => db.prepare('SELECT google_task_id t, lich_event_id e FROM viec WHERE id = ?').get(id);
  for (const id of [1, 2]) assert.ok(r(id).e && !r(id).t, `việc ${id} chỉ có sự kiện Lịch`);
  for (const id of [3, 4]) assert.ok(r(id).t && !r(id).e, `việc ${id} chỉ có Task`);
});

test('tu-chia: dọn bản thừa của cách cũ, Task việc đã xong giữ nguyên, không tạo lại', async () => {
  const { db, them, env } = dung('tu-chia');
  them(1, 'Có giờ, còn Task', '2026-11-05', '10:00', null, { task: 'T1', ev: 'E1' });
  them(2, 'Không giờ, còn sự kiện', '2026-11-05', null, null, { task: 'T2', ev: 'E2' });
  them(3, 'Có giờ đã xong', '2026-11-05', '10:00', null, { tt: 'xong', task: 'T3', ev: 'E3', tx: 1, xong: '2026-11-02T02:00:00Z' });
  const goi = await chay(env);
  const r = (id) => ({ ...db.prepare('SELECT google_task_id t, lich_event_id e, google_task_xong x FROM viec WHERE id = ?').get(id) });
  assert.deepEqual(r(1), { t: null, e: 'E1', x: 0 });
  assert.deepEqual(r(2), { t: 'T2', e: null, x: 0 });
  assert.equal(r(3).t, 'T3', 'Task việc đã xong không bị xóa');
  assert.ok(goi.includes('DELETE TASK T1') && goi.includes('DELETE LICH E2'));
  assert.ok(!goi.includes('DELETE TASK T3') && !goi.some((g) => g.startsWith('POST')), 'không tạo mới thứ gì');
  const lai = await chay(env); // lượt sau ổn định, Task của việc 1 không bị tạo lại
  assert.deepEqual(lai, []);
  assert.equal(r(1).t, null);
});

test('tu-chia: đổi qua lại giữa có giờ và không giờ thì chuyển nơi', async () => {
  const { db, them, env } = dung('tu-chia');
  them(1, 'Vừa thêm giờ', '2026-11-05', '14:00', null, { task: 'T1', cb: 1 });
  them(2, 'Vừa bỏ giờ', '2026-11-05', null, null, { ev: 'E2', cb: 1 });
  const goi = await chay(env);
  const r = (id) => db.prepare('SELECT google_task_id t, lich_event_id e FROM viec WHERE id = ?').get(id);
  assert.ok(r(1).e && !r(1).t);
  assert.ok(r(2).t && !r(2).e);
  assert.ok(goi.includes('DELETE TASK T1') && goi.includes('DELETE LICH E2'));
  assert.equal(goi.filter((g) => g.startsWith('POST')).length, 2);
});

test('chế độ cũ không đổi: ca-hai vẫn đẩy việc có giờ sang cả hai nơi', async () => {
  const { db, them, env } = dung('ca-hai');
  them(1, 'Có giờ', '2026-11-05', '10:00', null);
  const goi = await chay(env);
  const v = db.prepare('SELECT google_task_id t, lich_event_id e FROM viec WHERE id = 1').get();
  assert.ok(v.t && v.e);
  assert.equal(goi.filter((g) => g.startsWith('POST')).length, 2);
});

test('chế độ cũ không đổi: tasks không tạo sự kiện, lich không tạo Task', async () => {
  for (const [cd, coT, coE] of [['tasks', true, false], ['lich', false, true]]) {
    const { db, them, env } = dung(cd);
    them(1, 'Có giờ', '2026-11-05', '10:00', null);
    await chay(env);
    const v = db.prepare('SELECT google_task_id t, lich_event_id e FROM viec WHERE id = 1').get();
    assert.equal(!!v.t, coT, cd);
    assert.equal(!!v.e, coE, cd);
  }
});
