// Kiểm máy chủ Node chạy Worker: lớp thay D1, R2, ASSETS, hẹn giờ và các rào an toàn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moCsdl } from '../may-chu/lop-d1.js';
import { moR2 } from '../may-chu/lop-r2.js';
import { moAi } from '../may-chu/lop-ai.js';
import { khopCron } from '../may-chu/lich.js';
import { taoMayChu } from '../may-chu/chay.js';

const csdlThu = () => moCsdl(':memory:', { migrations: 'migrations' });

test('D1: batch hoàn tác khi một lệnh lỗi, run trả last_row_id và changes', async () => {
  const c = csdlThu();
  c.db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT UNIQUE)');
  const r = await c.prepare('INSERT INTO t (v) VALUES (?1)').bind('a').run();
  assert.equal(r.meta.changes, 1);
  assert.equal(r.meta.last_row_id, 1);
  await assert.rejects(
    c.batch([c.prepare('INSERT INTO t (v) VALUES (?1)').bind('b'), c.prepare('INSERT INTO t (v) VALUES (?1)').bind('a')]),
    /UNIQUE/,
  );
  assert.equal((await c.prepare('SELECT COUNT(*) AS n FROM t').first()).n, 1);
  const ra = await c.prepare('INSERT INTO t (v) VALUES (?1) RETURNING id, v').bind('c').first();
  assert.deepEqual(ra, { id: 2, v: 'c' });
  assert.equal(await c.prepare('SELECT v FROM t WHERE id = ?1').bind(2).first('v'), 'c');
  assert.equal(await c.prepare('SELECT v FROM t WHERE id = ?1').bind(99).first(), null);
  const lo = await c.batch([c.prepare('SELECT v FROM t ORDER BY id'), c.prepare('UPDATE t SET v = ?1 WHERE id = ?2').bind('z', 1)]);
  assert.equal(lo[0].results.length, 2);
  assert.equal(lo[1].meta.changes, 1);
  c.dong();
});

test('D1: undefined thành null, boolean thành 0 hoặc 1, tham số ?N dùng lại nhiều lần', async () => {
  const c = csdlThu();
  c.db.exec('CREATE TABLE t (a, b)');
  await c.prepare('INSERT INTO t (a, b) VALUES (?1, ?2)').bind(undefined, true).run();
  const r = await c.prepare('SELECT a, b FROM t WHERE ?1 = ?1 OR b = ?2').bind(1, 1).first();
  assert.deepEqual(r, { a: null, b: 1 });
  c.dong();
});

test('R2: put, get, head, list có phân trang, delete mảng, chống khóa ra ngoài thư mục', async () => {
  const kho = moR2(await mkdtemp(join(tmpdir(), 'r2-')));
  await kho.put('a/1.json', JSON.stringify({ x: 1 }), { httpMetadata: { contentType: 'application/json' } });
  await kho.put('a/2.bin', new Uint8Array([1, 2, 3]));
  await kho.put('b/3.txt', new TextEncoder().encode('xin chào').buffer);
  const v = await kho.get('a/1.json');
  assert.deepEqual(await v.json(), { x: 1 });
  assert.equal(v.httpMetadata.contentType, 'application/json');
  assert.equal(new Uint8Array(await (await kho.get('a/2.bin')).arrayBuffer()).length, 3);
  assert.equal(await (await new Response((await kho.get('b/3.txt')).body)).text(), 'xin chào');
  assert.equal((await kho.head('a/2.bin')).size, 3);
  assert.equal(await kho.get('khong/co'), null);
  assert.equal(await kho.head('khong/co'), null);
  const trang1 = await kho.list({ prefix: 'a/', limit: 1 });
  assert.deepEqual(trang1.objects.map((o) => o.key), ['a/1.json']);
  assert.equal(trang1.truncated, true);
  const trang2 = await kho.list({ prefix: 'a/', limit: 1, cursor: trang1.cursor });
  assert.deepEqual(trang2.objects.map((o) => o.key), ['a/2.bin']);
  assert.equal(trang2.truncated, false);
  await kho.delete(['a/1.json', 'a/2.bin']);
  assert.deepEqual((await kho.list({ prefix: 'a/' })).objects, []);
  await assert.rejects(kho.put('../thoat', 'x'), /không hợp lệ/);
  await assert.rejects(kho.get('a/../../etc/passwd'), /không hợp lệ/);
  await kho.put('luong', new Response('dòng chảy').body);
  assert.equal(await (await kho.get('luong')).text(), 'dòng chảy');
});

test('AI: thiếu khóa thì không có AI; có khóa thì gọi REST và bóc result', async () => {
  assert.equal(moAi({}), undefined);
  let da;
  const ai = moAi({
    taiKhoan: 'tk1', token: 'tok', fetchHam: async (url, tuyChon) => {
      da = { url, auth: tuyChon.headers.authorization, body: JSON.parse(tuyChon.body) };
      return new Response(JSON.stringify({ success: true, result: { response: 'xin chào' } }), { status: 200 });
    },
  });
  assert.deepEqual(await ai.run('@cf/meta/x', { messages: [] }), { response: 'xin chào' });
  assert.equal(da.url, 'https://api.cloudflare.com/client/v4/accounts/tk1/ai/run/@cf/meta/x');
  assert.equal(da.auth, 'Bearer tok');
  const hong = moAi({ taiKhoan: 'tk1', token: 'tok', fetchHam: async () => new Response(JSON.stringify({ success: false, errors: [{ message: 'sai' }] }), { status: 400 }) });
  await assert.rejects(hong.run('m', {}), /Workers AI lỗi 400/);
});

test('Hẹn giờ: khớp đúng ba lịch của Sonicplan theo giờ UTC', () => {
  const luc = (h, m) => new Date(Date.UTC(2026, 9, 13, h, m));
  assert.equal(khopCron('*/5 * * * *', luc(7, 35)), true);
  assert.equal(khopCron('*/5 * * * *', luc(7, 36)), false);
  assert.equal(khopCron('0 * * * *', luc(9, 0)), true);
  assert.equal(khopCron('0 * * * *', luc(9, 1)), false);
  assert.equal(khopCron('0 16 * * *', luc(16, 0)), true);
  assert.equal(khopCron('0 16 * * *', luc(15, 0)), false);
  assert.equal(khopCron('1,2 * * * *', luc(3, 2)), true);
  assert.equal(khopCron('lỗi', luc(3, 2)), false);
});

test('Rào an toàn: EMAIL_THU không được đặt cùng PUBLIC_ORIGIN', () => {
  assert.throws(() => taoMayChu({ DB_FILE: ':memory:', EMAIL_THU: 'a@b.c', PUBLIC_ORIGIN: 'https://plan.example.com' }), /EMAIL_THU/);
});

test('Máy chủ: sức khỏe, giao diện, API Tổng quan, tệp R2 đi hết đường của Worker', async () => {
  const thuMuc = await mkdtemp(join(tmpdir(), 'mc-'));
  const probe = csdlThu();
  const email = (await probe.prepare('SELECT email FROM nguoi_dung LIMIT 1').first()).email;
  probe.dong();
  const m = taoMayChu({ DU_LIEU: thuMuc, DB_FILE: ':memory:', MIGRATIONS: 'migrations', EMAIL_THU: email, HEN_GIO: '0' });
  await new Promise((xong) => m.maychu.listen(0, '127.0.0.1', xong));
  const goc = `http://127.0.0.1:${m.maychu.address().port}`;
  try {
    let r = await fetch(`${goc}/api/suc-khoe`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });

    r = await fetch(`${goc}/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(r.headers.get('cache-control'), /no-cache/);

    r = await fetch(`${goc}/app.js`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /javascript/);

    r = await fetch(`${goc}/api/tong-quan`);
    assert.equal(r.status, 200);
    const tq = await r.json();
    assert.ok(tq.so_lieu, 'có số liệu tổng quan');
    assert.equal(tq.nhip.tin.length, 24);

    await m.env.TEP.put('thu/1.txt', 'có tệp', { httpMetadata: { contentType: 'text/plain' } });
    assert.equal(await (await m.env.TEP.get('thu/1.txt')).text(), 'có tệp');
  } finally {
    await m.dong();
  }
});

test('Máy chủ: không có EMAIL_THU và không có vé Access thì từ chối, không lộ dữ liệu', async () => {
  const m = taoMayChu({ DB_FILE: ':memory:', MIGRATIONS: 'migrations', HEN_GIO: '0', EMAIL_THU: '' });
  await new Promise((xong) => m.maychu.listen(0, '127.0.0.1', xong));
  const goc = `http://127.0.0.1:${m.maychu.address().port}`;
  try {
    const r = await fetch(`${goc}/api/tong-quan`);
    assert.ok([401, 403, 500].includes(r.status), `trạng thái ${r.status}`);
    assert.notEqual(r.status, 200);
  } finally {
    await m.dong();
  }
});

test('Máy chủ: khởi động tự áp migration còn thiếu (mã mới, cơ sở dữ liệu cũ)', async () => {
  const { chayMigration } = await import('../may-chu/migrate.js');
  const tep = join(await mkdtemp(join(tmpdir(), 'sp-mig-')), 'cu.sqlite');
  const cu = moCsdl(tep);
  chayMigration(cu.db, 'migrations');
  cu.db.exec("ALTER TABLE viec DROP COLUMN so_lan_doi; DELETE FROM _migrations WHERE ten = '0026_viec_so_lan_doi.sql'");
  cu.db.close();
  const m = taoMayChu({ DB_FILE: tep, HEN_GIO: '0', EMAIL_THU: '' });
  try {
    const cot = m.env.CSDL.db.prepare('PRAGMA table_info(viec)').all().map((c) => c.name);
    assert.ok(cot.includes('so_lan_doi'));
  } finally {
    await m.dong();
  }
});
