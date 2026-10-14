// Kiểm tra trợ năng tự động (WCAG 2.2 A, AA) bằng axe-core cho từng trang của Sonicplan.
// Chạy giao diện thật (public/) với API thật (src/api.js) trên cơ sở dữ liệu thử dựng từ migrations/,
// có sẵn tin, việc, dự án mẫu. Không chạm dữ liệu thật. Lỗi mức "serious" hoặc "critical" thì thoát mã 1.
//
// Trong CI: npm install --no-save playwright axe-core rồi npx playwright install chromium, sau đó
//   node scripts/kiem-tro-nang.mjs
// Trên máy không có mạng: PLAYWRIGHT_CORE=<đường dẫn playwright-core/index.mjs> CHROME=<chromium> AXE_JS=<axe.min.js>.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { d1, dungCsdl, r2 } from '../test/csdl-thu.js';
import { xuLyApi } from '../src/api.js';
import { luuTin } from '../src/hop-tin.js';

const GOC = path.resolve('public');
const TRANG = ['tong-quan', 'viec', 'hieu-suat', 'hop-tin', 'hop-tin/1', 'zalo', 'du-an', 'claude', 'tep', 'ghi-nho', 'ket-noi', 'luong', 'nhat-ky', 'du-lieu'];
const THE_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MUC_CHAN = new Set(['serious', 'critical']);
const loiApi = new Set();

async function dungDuLieu() {
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc_thu', 'Tổ chức thử', '2026-10-01T00:00:00Z')`);
  db.exec(`INSERT INTO nguoi_dung (id, email, ten, tao_luc) VALUES ('nd_thu', 'ban@vi-du.vn', 'Người Thử', '2026-10-01T00:00:00Z')`);
  db.exec(`INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES ('tc_thu', 'nd_thu', 'chu', '2026-10-01T00:00:00Z')`);
  const env = { CSDL: d1(db), TEP: r2(), PHIEN_BAN: 'kiem-thu' };
  const bayGio = Date.now();
  const luc = (phut) => new Date(bayGio - phut * 60000).toISOString();
  await luuTin(env, 'tc_thu', { nguon: 'gmail', ma_goc: 'm1', nguoi_gui: 'Phòng Đào tạo <daotao@vi-du.vn>', tieu_de: 'Lịch họp tuần sau', noi_dung: 'Mời anh dự họp thứ Năm lúc 9 giờ.', thoi_diem: luc(30) });
  await luuTin(env, 'tc_thu', { nguon: 'zalo', ma_goc: 'z1', nhom: 'Nhóm dự án', nguoi_gui: 'Lan', noi_dung: 'Gửi báo cáo trước thứ Sáu nhé.', thoi_diem: luc(60) });
  await luuTin(env, 'tc_thu', { nguon: 'zalo', ma_goc: 'z2', tieu_de: 'Minh', nguoi_gui: 'Minh', noi_dung: 'Chiều nay gọi em nhé.', thoi_diem: luc(90) });
  db.exec(`INSERT INTO du_an (to_chuc_id, ten, tao_luc) VALUES ('tc_thu', 'Khóa học mùa thu', '2026-10-01T00:00:00Z')`);
  db.exec(`INSERT INTO viec (to_chuc_id, tieu_de, han_ngay, trang_thai, du_an_id, tin_nhan_id, tao_luc, cap_nhat_luc) VALUES
    ('tc_thu', 'Gửi báo cáo tuần', date('now'), 'mo', 1, 2, '${luc(50)}', '${luc(50)}'),
    ('tc_thu', 'Chuẩn bị họp thứ Năm', date('now', '+2 days'), 'mo', NULL, 1, '${luc(20)}', '${luc(20)}'),
    ('tc_thu', 'Gọi lại cho Minh', NULL, 'xong', NULL, 3, '${luc(80)}', '${luc(10)}')`);
  return env;
}

function moMayChu(env) {
  const phien = { email: 'ban@vi-du.vn', nguoi_dung: { id: 'nd_thu', ten: 'Người Thử' }, to_chuc: { id: 'tc_thu', ten: 'Tổ chức thử', goi: 'dung_thu', vai_tro: 'chu' }, cac_to_chuc: [{ id: 'tc_thu', ten: 'Tổ chức thử' }] };
  const KIEU = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  return http.createServer(async (rq, rs) => {
    const url = new URL(rq.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      try {
        const kq = await xuLyApi(new Request(url, { method: rq.method }), env, phien, url);
        if (kq.status >= 500) loiApi.add(`${rq.method} ${url.pathname} ${kq.status}`);
        rs.writeHead(kq.status, Object.fromEntries(kq.headers));
        rs.end(Buffer.from(await kq.arrayBuffer()));
      } catch (e) {
        loiApi.add(`${rq.method} ${url.pathname}: ${e.message}`);
        rs.writeHead(500, { 'content-type': 'application/json' });
        rs.end(JSON.stringify({ loi: String(e.message || e) }));
      }
      return;
    }
    let p = path.join(GOC, path.normalize(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!p.startsWith(GOC) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(GOC, 'index.html');
    rs.writeHead(200, { 'content-type': KIEU[path.extname(p)] || 'application/octet-stream' });
    rs.end(fs.readFileSync(p));
  });
}

async function napPlaywright() {
  if (process.env.PLAYWRIGHT_CORE) return import(process.env.PLAYWRIGHT_CORE);
  return import('playwright');
}

function maAxe() {
  if (process.env.AXE_JS) return fs.readFileSync(process.env.AXE_JS, 'utf8');
  return fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
}

const env = await dungDuLieu();
const may = moMayChu(env);
await new Promise((ok) => may.listen(0, '127.0.0.1', ok));
const goc = `http://127.0.0.1:${may.address().port}`;
const { chromium } = await napPlaywright();
const trinhDuyet = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const axe = maAxe();
let soLoi = 0;
const loiTrang = [];

for (const cheDo of ['light', 'dark']) {
  for (const [rong, cao] of [[1280, 900], [390, 844]]) {
    const ctx = await trinhDuyet.newContext({ viewport: { width: rong, height: cao }, colorScheme: cheDo, reducedMotion: 'reduce' });
    const tab = await ctx.newPage();
    tab.on('pageerror', (e) => loiTrang.push(`${cheDo} ${rong}px: ${e.message}`));
    for (const t of TRANG) {
      await tab.goto(`${goc}/#${t}`, { waitUntil: 'networkidle' });
      await tab.waitForTimeout(600);
      if (process.env.CHUP) await tab.screenshot({ path: `${process.env.CHUP}/${cheDo}-${rong}-${t.replace('/', '-')}.png`, fullPage: false });
      await tab.addScriptTag({ content: axe });
      const kq = await tab.evaluate((the) => window.axe.run(document, { runOnly: { type: 'tag', values: the }, resultTypes: ['violations'] }), THE_WCAG);
      for (const v of kq.violations) {
        const chan = MUC_CHAN.has(v.impact);
        if (chan) soLoi++;
        console.log(`${chan ? 'LỖI' : 'nhắc'} [${cheDo} ${rong}px #${t}] ${v.id} (${v.impact}): ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) console.log(`    ${n.target.join(' ')}  ${n.failureSummary?.split('\n')[1]?.trim() || ''}`);
      }
    }
    await ctx.close();
  }
}

await trinhDuyet.close();
may.close();
if (loiTrang.length) {
  console.log(`\nLỗi JavaScript trên trang (${loiTrang.length}):`);
  for (const l of [...new Set(loiTrang)]) console.log(`  ${l}`);
}
if (loiApi.size) console.log(`\nAPI thử trả lỗi (chỉ nhắc): ${[...loiApi].join('; ')}`);
console.log(soLoi ? `\n${soLoi} lỗi trợ năng mức nghiêm trọng.` : '\nKhông có lỗi trợ năng mức nghiêm trọng (WCAG 2.2 A, AA).');
process.exit(soLoi || loiTrang.length ? 1 : 0);
