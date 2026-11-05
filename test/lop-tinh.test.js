import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moTinh } from '../may-chu/lop-tinh.js';

test('tệp tĩnh có ETag, gửi lại ETag thì trả 304 không kèm nội dung', async () => {
  const tinh = moTinh('public');
  const a = await tinh.fetch(new Request('http://x/kieu.css'));
  assert.equal(a.status, 200);
  const etag = a.headers.get('etag');
  assert.ok(etag);
  assert.ok((await a.text()).length > 1000);
  const b = await tinh.fetch(new Request('http://x/kieu.css', { headers: { 'if-none-match': etag } }));
  assert.equal(b.status, 304);
  assert.equal(await b.text(), '');
  const c = await tinh.fetch(new Request('http://x/kieu.css', { headers: { 'if-none-match': 'W/"khac"' } }));
  assert.equal(c.status, 200);
});

test('phông được giữ trong trình duyệt, trang SPA vẫn trả index.html', async () => {
  const tinh = moTinh('public');
  const f = await tinh.fetch(new Request('http://x/fonts/be-vietnam-pro-latin-400-normal.woff2'));
  assert.match(f.headers.get('cache-control'), /max-age=\d+/);
  const t = await tinh.fetch(new Request('http://x/tong-quan'));
  assert.equal(t.status, 200);
  assert.match(t.headers.get('content-type'), /text\/html/);
  assert.equal((await tinh.fetch(new Request('http://x/khong-co.js'))).status, 404);
});
