// Máy chủ Node chạy nguyên Worker Sonicplan ngoài Cloudflare: D1 thành SQLite, R2 thành thư mục, ASSETS thành public/.
// Chạy: node may-chu/chay.js   (cấu hình qua biến môi trường hoặc tệp may-chu/.env, xem may-chu/README.md)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import worker from '../src/index.js';
import { moCsdl } from './lop-d1.js';
import { chayMigration } from './migrate.js';
import { moR2 } from './lop-r2.js';
import { moTinh } from './lop-tinh.js';
import { moAi } from './lop-ai.js';
import { moAiClaudeCode } from './ai-claude-code.js';
import { moKhoaFpt } from './khoa-fpt.js';
import { moLuaChonAi } from './lua-chon-ai.js';
import { batHenGio } from './lich.js';
import { moTram } from './lop-tram.js';
import { moThoClaude } from './tho-claude.js';
import { batTay, boc } from './lop-ws.js';
import { xacDinhPhien } from '../src/phien.js';
import { taoThongBao } from '../src/thong-bao.js';

const GOC = resolve(fileURLToPath(import.meta.url), '../..');
const TOI_DA_THAN = 30 * 1024 * 1024;

export function docEnv(duongDan) {
  const ra = {};
  if (!existsSync(duongDan)) return ra;
  for (const dong of readFileSync(duongDan, 'utf8').split('\n')) {
    const m = dong.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) ra[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return ra;
}

// Đọc vars trong wrangler.jsonc làm giá trị mặc định (bỏ chú thích // ngoài chuỗi).
export function docBienWrangler(duongDan) {
  let chu = '';
  try {
    chu = readFileSync(duongDan, 'utf8');
  } catch {
    return {};
  }
  let ra = '';
  let trongChuoi = false;
  for (let i = 0; i < chu.length; i++) {
    const c = chu[i];
    if (trongChuoi) {
      ra += c;
      if (c === '\\') ra += chu[++i];
      else if (c === '"') trongChuoi = false;
    } else if (c === '"') {
      trongChuoi = true;
      ra += c;
    } else if (c === '/' && chu[i + 1] === '/') {
      while (i < chu.length && chu[i] !== '\n') i++;
      ra += '\n';
    } else {
      ra += c;
    }
  }
  try {
    return JSON.parse(ra.replace(/,(\s*[}\]])/g, '$1')).vars || {};
  } catch {
    return {};
  }
}

const laVongLap = (a = '') => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(a);

export function taoMayChu(cauHinh = {}) {
  const cfg = { ...docBienWrangler(resolve(GOC, 'wrangler.jsonc')), ...docEnv(resolve(GOC, 'may-chu/.env')), ...process.env, ...cauHinh };
  const congKhai = cfg.PUBLIC_ORIGIN ? new URL(cfg.PUBLIC_ORIGIN).origin : '';
  if (cfg.EMAIL_THU && congKhai) {
    throw new Error('EMAIL_THU (bỏ qua đăng nhập) không được đặt cùng PUBLIC_ORIGIN. Gỡ EMAIL_THU khỏi bản chạy thật.');
  }

  const thuMucDuLieu = resolve(GOC, cfg.DU_LIEU || 'du-lieu');
  const csdl = moCsdl(cfg.DB_FILE || resolve(thuMucDuLieu, 'sonicplan.sqlite'), cfg.MIGRATIONS ? { migrations: cfg.MIGRATIONS } : {});
  // Mã mới mà cơ sở dữ liệu chưa áp migration (kéo mã bằng git pull, máy khởi động lại...) thì lỗi "no such column".
  // Nên mỗi lần khởi động tự áp migration còn thiếu. Lỗi thì dừng hẳn: chạy tiếp với schema lệch chỉ sinh lỗi rải rác và dữ liệu sai.
  if (!cfg.MIGRATIONS) {
    try {
      const kq = chayMigration(csdl.db, resolve(GOC, 'migrations'));
      if (kq.da_ap.length) console.log(`Đã áp migration: ${kq.da_ap.join(', ')}`);
    } catch (e) {
      console.error('Áp migration lúc khởi động lỗi, dừng máy chủ.', e.message);
      throw e;
    }
  }
  // Tác vụ đang chạy mà tiến trình bị tắt giữa chừng thì dòng nhật ký kẹt ở "dang_chay" mãi: đóng lại thành lỗi.
  try {
    const luc = new Date().toISOString();
    const dong = csdl.db.prepare(`UPDATE nhat_ky_chay SET trang_thai = 'loi', ket_thuc = ?1, ghi_chu = 'Bị ngắt giữa chừng (máy chủ khởi động lại)' WHERE trang_thai = 'dang_chay'`).run(luc);
    if (dong.changes) console.log(`Đã đóng ${dong.changes} dòng nhật ký tác vụ bị ngắt giữa chừng`);
  } catch (e) {
    console.error('Dọn nhật ký tác vụ lỗi', e.message);
  }
  const env = {
    CSDL: csdl,
    MAY_RIENG: '1',
    TEP: moR2(cfg.TEP_DIR || resolve(thuMucDuLieu, 'tep')),
    ASSETS: moTinh(resolve(GOC, 'public')),
    ...Object.fromEntries(
      ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'EMAIL_DOMAIN', 'QUAN_TRI', 'AI_MODEL', 'KHOA_MA_HOA', 'KHOA_MA_HOA_CU', 'EMAIL_THU', 'THU_MA', 'PHIEN_BAN']
        .filter((k) => cfg[k] !== undefined && cfg[k] !== '')
        .map((k) => [k, cfg[k]]),
    ),
  };
  // Phòng chat của trang Claude: chạy ngay trong tiến trình này, lưu ở du-lieu/tram/.
  const tram = moTram(resolve(thuMucDuLieu, 'tram'), { baoNguoi: (tc, tb) => taoThongBao(env, tc, { loai: 'claude', ...tb }) });
  env.TRAM_NOI_BO = tram;
  // Thợ Claude: Claude Code tự làm việc nhóm Claude trong bản sao ThangLong_KB. THO_CLAUDE=0 để tắt hẳn; vòng chạy chỉ bắt đầu cùng hẹn giờ.
  if (cfg.THO_CLAUDE !== '0') env.THO_CLAUDE = moThoClaude(env, cfg);
  const ai = moAi({ taiKhoan: cfg.CF_ACCOUNT_ID, token: cfg.CF_AI_TOKEN });
  if (ai) env.AI = ai;
  // AI qua Claude Code gói Max, đứng trước Workers AI. Mặc định bật khi có lệnh claude; AI_CLAUDE_CODE=0 để tắt.
  const claudeBin = cfg.CLAUDE_BIN || join(homedir(), '.local', 'bin', 'claude');
  if (cfg.AI_CLAUDE_CODE !== '0' && existsSync(claudeBin)) {
    env.CLAUDE_CODE_AI = moAiClaudeCode({
      claudeBin,
      model: cfg.AI_CLAUDE_CODE_MODEL || 'claude-haiku-5-5',
      effort: cfg.AI_CLAUDE_CODE_EFFORT || 'medium',
      thuMuc: join(tmpdir(), 'sonicplan-ai-claude-code'), // thư mục rỗng, ngoài mọi kho: không nạp CLAUDE.md hay cài đặt dự án nào
    });
  }

  // FPT AI Marketplace: khóa nhập ở trang Kết nối (lưu mã hóa, du-lieu/khoa-fpt.enc) hoặc đặt ở biến môi trường FPT_AI_API_KEY. Chọn dùng Claude hay FPT ở trang Kết nối; mặc định theo AI_NHA_CUNG_CAP (claude hoặc fpt, mặc định claude).
  env.LUA_CHON_AI = moLuaChonAi(resolve(thuMucDuLieu, 'nha-cung-cap-ai.json'), cfg.AI_NHA_CUNG_CAP === 'fpt' ? 'fpt' : 'claude');
  env.KHOA_FPT = moKhoaFpt({ tep: resolve(thuMucDuLieu, 'khoa-fpt.enc'), cfg, env });
  Object.defineProperty(env, 'FPT_AI', { get: () => env.KHOA_FPT.lay(), enumerable: true });
  env.KHOA_FPT.khoiDong.then(() => { if (!env.FPT_AI && env.LUA_CHON_AI.doc().chung === 'fpt') console.error('Đang chọn FPT AI nhưng chưa có khóa FPT, tạm dùng Claude'); });

  const dangCho = new Set();
  const ctx = {
    waitUntil: (p) => {
      const q = Promise.resolve(p).catch((e) => console.error('waitUntil lỗi', e)).finally(() => dangCho.delete(q));
      dangCho.add(q);
    },
    passThroughOnException: () => {},
  };

  const maychu = createServer(async (req, res) => {
    try {
      if (cfg.EMAIL_THU && !laVongLap(req.socket.remoteAddress)) {
        res.writeHead(403).end('Chế độ thử chỉ nhận yêu cầu từ chính máy này.');
        return;
      }
      if (Number(req.headers['content-length'] || 0) > TOI_DA_THAN) {
        res.writeHead(413).end('Tệp quá lớn.');
        return;
      }
      const goc = congKhai || `http://${req.headers.host || 'localhost'}`;
      const coThan = !['GET', 'HEAD'].includes(req.method);
      const yeuCau = new Request(new URL(req.url, goc), {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => k !== 'host' && k !== 'content-length' || false)),
        body: coThan ? Readable.toWeb(req) : undefined,
        duplex: coThan ? 'half' : undefined,
      });
      const ra = await worker.fetch(yeuCau, env, ctx);
      const dau = {};
      for (const [k, v] of ra.headers) if (k !== 'set-cookie') dau[k] = v;
      const cookie = ra.headers.getSetCookie?.() || [];
      if (cookie.length) dau['set-cookie'] = cookie;
      res.writeHead(ra.status, dau);
      if (!ra.body || req.method === 'HEAD') res.end();
      else Readable.fromWeb(ra.body).on('error', () => res.destroy()).pipe(res);
    } catch (e) {
      console.error('Máy chủ lỗi', req.url, e);
      if (!res.headersSent) res.writeHead(500).end('Lỗi máy chủ.');
      else res.destroy();
    }
  });

  // WebSocket của trang Claude: trình duyệt ở /api/tram/ws (qua đăng nhập), trạm ở /nhan/tram/ws (kiểm mã trong tin đầu).
  maychu.on('upgrade', async (req, socket) => {
    try {
      if (cfg.EMAIL_THU && !laVongLap(req.socket.remoteAddress)) return socket.destroy();
      const goc = congKhai || `http://${req.headers.host || 'localhost'}`;
      const url = new URL(req.url, goc);
      let tc = null;
      let vaiTro = null;
      if (url.pathname === '/api/tram/ws') {
        const nguon = req.headers.origin;
        if (nguon && nguon !== new URL(goc).origin) return socket.destroy();
        const phien = await xacDinhPhien(new Request(url, { headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => k !== 'host')) }), env);
        if (!phien.duoc) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
        tc = phien.to_chuc.id;
        vaiTro = 'nguoi';
      } else if (url.pathname === '/nhan/tram/ws') {
        tc = url.searchParams.get('tc') || '';
        if (!/^[\w-]{1,64}$/.test(tc)) return socket.destroy();
        vaiTro = 'tram';
      } else return socket.destroy();
      if (!batTay(req, socket)) return socket.destroy();
      const ws = boc(socket, {
        khiTin: (w, chu) => tram.phong(tc).nhanTin(w, chu).catch((e) => console.error('Trạm Claude lỗi', e)),
        khiDong: (w) => tram.bo(tc, w),
      });
      tram.them(tc, ws, { vai_tro: vaiTro, xac_thuc: false });
    } catch (e) {
      console.error('WebSocket lỗi', e);
      socket.destroy();
    }
  });

  let dungHen = () => {};
  return {
    maychu,
    env,
    ctx,
    cfg,
    batHenGio: () => { dungHen = batHenGio(worker, env, ctx); env.THO_CLAUDE?.bat(); },
    dong: async () => {
      dungHen();
      await env.THO_CLAUDE?.dong();
      tram.dong();
      await new Promise((xong) => maychu.close(xong));
      await Promise.allSettled([...dangCho]);
      csdl.dong();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const m = taoMayChu();
  const cong = Number(m.cfg.PORT || 8787);
  const may = m.cfg.HOST || '127.0.0.1';
  m.maychu.listen(cong, may, () => {
    console.log(`Sonicplan chạy ở ${may}:${cong}${m.cfg.PUBLIC_ORIGIN ? ` (địa chỉ công khai ${m.cfg.PUBLIC_ORIGIN})` : ''}${m.env.CLAUDE_CODE_AI ? `, AI: ${m.env.CLAUDE_CODE_AI.ten}${m.env.FPT_AI ? `, có ${m.env.FPT_AI.ten} (đang chọn: ${m.env.LUA_CHON_AI.doc().chung})` : ''}${m.env.AI ? ', dự phòng Workers AI' : ''}` : m.env.AI ? ', có AI' : ', không có AI'}`);
    if (m.cfg.HEN_GIO !== '0') m.batHenGio();
  });
  for (const tin of ['SIGINT', 'SIGTERM']) process.on(tin, () => m.dong().finally(() => process.exit(0)));
}
