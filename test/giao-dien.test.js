// Giao diện không có bộ chạy trình duyệt trong npm test, nên kiểm tĩnh phần dễ hỏng nhất khi tách tệp:
// mọi import tương đối phải trỏ tới tệp có thật và tên được nhập phải được tệp đó export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const GOC = resolve('public');
const tep = (thuMuc) => readdirSync(thuMuc, { withFileTypes: true }).flatMap((d) => (d.isDirectory() && d.name !== 'fonts' ? tep(join(thuMuc, d.name)) : /\.m?js$/.test(d.name) ? [join(thuMuc, d.name)] : []));

function dsExport(noiDung) {
  const ra = new Set();
  for (const m of noiDung.matchAll(/^export (?:async )?(?:function|const|let|var|class) (\w+)/gm)) ra.add(m[1]);
  for (const m of noiDung.matchAll(/^export \{([^}]+)\}/gm)) for (const n of m[1].split(',')) ra.add(n.trim().split(/\s+as\s+/).pop());
  return ra;
}

test('giao diện: import tương đối trỏ đúng tệp và đúng tên export', () => {
  const loi = [];
  for (const f of tep(GOC)) {
    const nd = readFileSync(f, 'utf8');
    for (const m of nd.matchAll(/^import (?:\{([^}]*)\} from )?'(\.{1,2}\/[^']+)';/gm)) {
      const dich = resolve(dirname(f), m[2]);
      if (!existsSync(dich)) { loi.push(`${f}: không có tệp ${m[2]}`); continue; }
      if (!m[1]) continue;
      const co = dsExport(readFileSync(dich, 'utf8'));
      for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!co.has(n)) loi.push(`${f}: ${m[2]} không export ${n}`);
    }
  }
  assert.deepEqual(loi, []);
});

test('giao diện: index.html nạp app.js và mọi mục trong public/trang được tải trước', () => {
  const html = readFileSync(join(GOC, 'index.html'), 'utf8');
  assert.match(html, /<script src="\/app\.js" type="module">/);
  for (const f of readdirSync(join(GOC, 'trang'))) assert.ok(html.includes(`href="/trang/${f}"`), `thiếu modulepreload cho trang/${f}`);
});
