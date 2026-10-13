// Trạm Claude của Sonicplan: chạy nền trên máy Mac, nhận yêu cầu từ trang Claude, gọi Claude Code ngay trên máy
// (dùng tài khoản Claude đang đăng nhập trên máy này), gửi chữ Claude viết ra về trang theo từng đoạn,
// rồi tải tệp Claude tạo ra lên Sonicplan. Không mở cổng nào: trạm chỉ nối ra ngoài tới Sonicplan.
// Cài bằng lệnh ở trang Claude; cấu hình ở ~/.sonicplan-tram/cau-hinh.json; nhật ký ở ~/.sonicplan-tram/nhat-ky.log.
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { basename, dirname, extname, join, relative, sep } from 'node:path';

const PHIEN_BAN = '1.0.0';
const THU_MUC_CAI = join(homedir(), '.sonicplan-tram');
const TEP_PHIEN = join(THU_MUC_CAI, 'phien.json');
const TEP_TOI_DA = 25 * 1024 * 1024;
const TOI_DA_TEP_MOI = 30;
// Bước này Claude chỉ đọc, viết, sửa tệp và tìm trên web. Lệnh máy (Bash) chưa bật, vì chưa có nút xin phép trên trang.
const CONG_CU = ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Task', 'Skill'];
const LOI_DAN = [
  'Bạn đang làm việc qua trang Claude của Sonicplan. Thư mục hiện tại là thư mục riêng của phiên chat này.',
  'Lưu mọi tệp tạo ra trong thư mục hiện tại để người dùng tải về được. Tệp người dùng đính kèm nằm trong dinh-kem/.',
  'Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu. Không ai trả lời được câu hỏi giữa chừng:',
  'nếu thiếu thông tin quan trọng thì làm phần làm được và ghi rõ câu hỏi ở cuối câu trả lời.',
].join(' ');

const ghiLog = (...a) => console.log(new Date().toISOString(), ...a);
const ch = JSON.parse(readFileSync(join(THU_MUC_CAI, 'cau-hinh.json'), 'utf8'));
const CLAUDE = ch.claude || 'claude';
const THU_MUC_LAM = ch.thu_muc || join(homedir(), 'Sonicplan Claude');
let banClaude = '';
try { banClaude = execFileSync(CLAUDE, ['--version'], { encoding: 'utf8', timeout: 20000 }).trim(); } catch (e) { ghiLog('Không chạy được Claude Code:', e.message); }

let ws = null;
let daNhan = false;
let choMo = 2000;
let henNhip = null;
const hopGui = [];
const hang = [];
const dangChay = new Map();
let banDoPhien = {};
try { banDoPhien = JSON.parse(readFileSync(TEP_PHIEN, 'utf8')); } catch {}

function gui(tin) {
  if (ws && ws.readyState === 1 && daNhan) ws.send(JSON.stringify(tin));
  else hopGui.push(tin);
}

function noi() {
  daNhan = false;
  const url = `${ch.goc.replace(/^http/, 'ws')}/nhan/tram/ws?tc=${encodeURIComponent(ch.tc)}`;
  ws = new WebSocket(url);
  ws.onopen = () => {
    choMo = 2000;
    ws.send(JSON.stringify({ loai: 'chao', khoa: ch.khoa, may: hostname(), phien_ban: PHIEN_BAN, claude: banClaude, dang_lam: [...dangChay.values()].map((d) => d.luot) }));
    clearInterval(henNhip);
    henNhip = setInterval(() => { try { ws.send('ping'); } catch {} }, 30000);
  };
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    let tin;
    try { tin = JSON.parse(e.data); } catch { return; }
    if (tin.loai === 'da_nhan') {
      daNhan = true;
      ghiLog('Đã nối với Sonicplan');
      while (hopGui.length) ws.send(JSON.stringify(hopGui.shift()));
    } else if (tin.loai === 'luot') {
      hang.push(tin);
      chayHang();
    } else if (tin.loai === 'dung') {
      dung(tin.phien, tin.luot);
    } else if (tin.loai === 'het_han') {
      ghiLog('Sonicplan báo:', tin.ly_do);
      choMo = 10 * 60 * 1000;
    }
  };
  ws.onclose = () => {
    clearInterval(henNhip);
    daNhan = false;
    setTimeout(noi, choMo);
    // Sau khi bị báo hết hạn khóa thì giữ 10 phút; còn lại tăng dần tới 1 phút.
    if (choMo < 60000) choMo = Math.min(choMo * 2, 60000);
  };
  ws.onerror = () => {};
}

function dung(phien, luot) {
  const i = hang.findIndex((t) => t.phien === phien);
  if (i >= 0) {
    const [t] = hang.splice(i, 1);
    gui({ loai: 'xong', phien, luot: t.luot, thanh_cong: false, da_dung: true, loi: 'Đã dừng trước khi chạy.' });
    return;
  }
  const d = dangChay.get(phien);
  if (!d || (luot && d.luot !== luot)) return;
  d.daDung = true;
  try { d.con.kill('SIGINT'); } catch {}
  setTimeout(() => { try { d.con.kill('SIGKILL'); } catch {} }, 4000);
}

let dangBan = false;
async function chayHang() {
  if (dangBan) return;
  dangBan = true;
  while (hang.length) {
    const t = hang.shift();
    try { await chayLuot(t); } catch (e) {
      ghiLog('Lượt lỗi', e);
      gui({ loai: 'xong', phien: t.phien, luot: t.luot, thanh_cong: false, loi: `Trạm gặp lỗi: ${e.message}` });
    }
  }
  dangBan = false;
}

const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const tenGon = (s, dai = 40) => boDau(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, dai) || 'Chung';

function thuMucPhien(t) {
  if (banDoPhien[t.phien] && existsSync(banDoPhien[t.phien])) return banDoPhien[t.phien];
  const ngay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const d = join(THU_MUC_LAM, tenGon(t.du_an?.ten || 'Chung', 60), 'Claude', `${ngay}_${tenGon(t.tieu_de)}_${t.phien.slice(0, 6)}`);
  banDoPhien[t.phien] = d;
  writeFileSync(TEP_PHIEN, JSON.stringify(banDoPhien, null, 1));
  return d;
}

function anhTep(goc) {
  const ra = new Map();
  const di = (d, sau) => {
    if (sau > 5 || ra.size > 3000) return;
    let ds = [];
    try { ds = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const m of ds) {
      if (m.name.startsWith('.') || (sau === 0 && (m.name === 'dinh-kem' || m.name === 'LichSu-chat.md'))) continue;
      const p = join(d, m.name);
      if (m.isDirectory()) di(p, sau + 1);
      else if (m.isFile()) { try { const st = statSync(p); ra.set(p, `${st.size}:${st.mtimeMs}`); } catch {} }
    }
  };
  di(goc, 0);
  return ra;
}

const KIEU = { '.md': 'text/markdown', '.txt': 'text/plain', '.json': 'application/json', '.csv': 'text/csv', '.html': 'text/html', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.zip': 'application/zip' };

async function taiDinhKem(t, thuMuc) {
  const ra = [];
  if (!t.dinh_kem?.length) return ra;
  const dk = join(thuMuc, 'dinh-kem');
  mkdirSync(dk, { recursive: true });
  for (const tep of t.dinh_kem) {
    const r = await fetch(`${ch.goc}/nhan/tram/tep?tc=${encodeURIComponent(ch.tc)}&khoa=${encodeURIComponent(tep.khoa)}`, { headers: { authorization: `Bearer ${ch.khoa}` } });
    if (!r.ok) { ghiLog('Không tải được tệp đính kèm', tep.ten, r.status); continue; }
    let ten = basename(tep.ten).replace(/[/\\]/g, '_') || 'tep';
    for (let i = 2; existsSync(join(dk, ten)); i++) ten = `${basename(tep.ten, extname(tep.ten))}-${i}${extname(tep.ten)}`;
    await writeFile(join(dk, ten), Buffer.from(await r.arrayBuffer()));
    ra.push(`dinh-kem/${ten}`);
  }
  return ra;
}

function moTaCongCu(ten, vao = {}) {
  const tep = (p) => (p ? basename(String(p)) : '');
  switch (ten) {
    case 'Read': return `Đọc ${tep(vao.file_path)}`;
    case 'Write': return `Tạo ${tep(vao.file_path)}`;
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return `Sửa ${tep(vao.file_path || vao.notebook_path)}`;
    case 'Glob': return `Tìm tệp ${vao.pattern || ''}`;
    case 'Grep': return `Tìm chữ "${String(vao.pattern || '').slice(0, 60)}"`;
    case 'WebSearch': return `Tìm trên web: ${String(vao.query || '').slice(0, 80)}`;
    case 'WebFetch': { try { return `Đọc trang ${new URL(vao.url).hostname}`; } catch { return 'Đọc một trang web'; } }
    case 'Bash': return `Chạy lệnh: ${String(vao.command || '').slice(0, 80)}`;
    case 'TodoWrite': return 'Lập danh sách việc cần làm';
    case 'Task': case 'Agent': return `Giao trợ lý con: ${String(vao.description || '').slice(0, 80)}`;
    case 'Skill': return `Dùng kỹ năng ${vao.skill || vao.name || ''}`;
    default: return ten;
  }
}

function chayClaude(t, thuMuc, loiNhac, coResume) {
  const doiSo = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--permission-mode', t.che_do === 'plan' ? 'plan' : 'acceptEdits', '--permission-prompts', 'none',
    '--append-system-prompt', LOI_DAN, '--allowedTools', ...CONG_CU];
  if (t.model) doiSo.push('--model', t.model);
  if (t.effort) doiSo.push('--effort', t.effort);
  if (coResume && t.claude_session) doiSo.push('--resume', t.claude_session);
  const con = spawn(CLAUDE, doiSo, { cwd: thuMuc, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CLAUDECODE: '' } });
  con.stdin.end(loiNhac);
  return con;
}

async function chayLuot(t) {
  const batDau = Date.now();
  const thuMuc = thuMucPhien(t);
  mkdirSync(thuMuc, { recursive: true });
  const dinhKem = await taiDinhKem(t, thuMuc);
  const loiNhac = (t.noi_dung || 'Xem các tệp đính kèm.') + (dinhKem.length ? `\n\nTệp đính kèm (đã lưu trong thư mục làm việc):\n${dinhKem.map((d) => `- ${d}`).join('\n')}` : '');
  const truoc = anhTep(thuMuc);
  ghiLog('Bắt đầu lượt', t.phien, t.luot);

  const ketQua = await new Promise((xong) => {
    const chayMot = (coResume) => {
      const con = chayClaude(t, thuMuc, loiNhac, coResume);
      const d = { luot: t.luot, con, daDung: dangChay.get(t.phien)?.daDung || false };
      dangChay.set(t.phien, d);
      let dem = '';
      let loiRa = '';
      let sid = null;
      let kq = null;
      let lo = [];
      let henGui = null;
      const day = () => { henGui = null; if (lo.length) { gui({ loai: 'su_kien', phien: t.phien, luot: t.luot, ds: lo }); lo = []; } };
      const them = (sk, ngay) => { lo.push(sk); if (ngay) day(); else if (!henGui) henGui = setTimeout(day, 200); };
      con.stdout.on('data', (phan) => {
        dem += phan;
        let i;
        while ((i = dem.indexOf('\n')) >= 0) {
          const dong = dem.slice(0, i);
          dem = dem.slice(i + 1);
          if (!dong.trim()) continue;
          let m;
          try { m = JSON.parse(dong); } catch { continue; }
          if (m.type === 'system' && m.subtype === 'init') sid = m.session_id;
          else if (m.type === 'stream_event') {
            const e = m.event || {};
            if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) them({ loai: 'chu_dang', them: e.delta.text });
            else if (e.type === 'content_block_start' && e.content_block?.type === 'thinking') them({ loai: 'suy_nghi' });
            else if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') them({ loai: 'cong_cu_dang', ten: e.content_block.name });
          } else if (m.type === 'assistant' && !m.parent_tool_use_id) {
            for (const k of m.message?.content || []) {
              if (k.type === 'text' && k.text?.trim()) them({ loai: 'chu', noi_dung: k.text }, true);
              else if (k.type === 'tool_use') them({ loai: 'cong_cu', id: k.id, ten: k.name, mo_ta: moTaCongCu(k.name, k.input), chi_tiet: JSON.stringify(k.input || {}).slice(0, 1500) }, true);
            }
          } else if (m.type === 'user' && !m.parent_tool_use_id) {
            for (const k of m.message?.content || []) {
              if (k.type !== 'tool_result') continue;
              const chu = typeof k.content === 'string' ? k.content : (k.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n');
              them({ loai: 'ket_qua_cong_cu', id: k.tool_use_id, loi: Boolean(k.is_error), tom_tat: String(chu || '').slice(0, 600) }, true);
            }
          } else if (m.type === 'result') {
            kq = m;
            sid = m.session_id || sid;
          }
        }
      });
      con.stderr.on('data', (p) => { loiRa = (loiRa + p).slice(-4000); });
      con.on('error', (e) => { loiRa += `\n${e.message}`; });
      con.on('close', (ma) => {
        clearTimeout(henGui);
        day();
        // Phiên cũ không còn trên máy (cài lại máy, đổi máy): chạy lại như phiên mới.
        if (coResume && !kq && /no conversation found|session.*not found/i.test(loiRa) && !d.daDung) return chayMot(false);
        xong({ ma, kq, sid, loiRa, daDung: d.daDung });
      });
    };
    chayMot(Boolean(t.claude_session));
  });
  dangChay.delete(t.phien);

  // Tệp mới hoặc vừa sửa: tải lên Sonicplan để hiện thành thẻ trong khung chat.
  const sau = anhTep(thuMuc);
  const moi = [...sau.entries()].filter(([p, dau]) => truoc.get(p) !== dau).map(([p]) => p).slice(0, TOI_DA_TEP_MOI);
  const suKienTep = [];
  for (const p of moi) {
    try {
      const st = statSync(p);
      if (st.size > TEP_TOI_DA) { suKienTep.push({ loai: 'he_thong', noi_dung: `Tệp ${relative(thuMuc, p)} lớn quá 25 MB nên chỉ nằm trên máy Mac: ${p}` }); continue; }
      const ten = relative(thuMuc, p).split(sep).join('/');
      const r = await fetch(`${ch.goc}/nhan/tram/tep?tc=${encodeURIComponent(ch.tc)}&phien=${encodeURIComponent(t.phien)}&ten=${encodeURIComponent(ten)}`, {
        method: 'POST', headers: { authorization: `Bearer ${ch.khoa}`, 'content-type': KIEU[extname(p).toLowerCase()] || 'application/octet-stream' }, body: await readFile(p),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.khoa) suKienTep.push({ loai: 'tep', ten, khoa: j.khoa, kich_thuoc: st.size, loai_tep: j.loai });
    } catch (e) { ghiLog('Tải tệp lên lỗi', p, e.message); }
  }
  if (suKienTep.length) gui({ loai: 'su_kien', phien: t.phien, luot: t.luot, ds: suKienTep });

  const { kq, sid, loiRa, daDung, ma } = ketQua;
  const thanhCong = Boolean(kq && kq.subtype === 'success' && !kq.is_error) && !daDung;
  const loi = daDung ? 'Đã dừng theo yêu cầu.' : thanhCong ? null : (kq?.result || kq?.errors?.join?.('\n') || loiRa.trim().split('\n').slice(-6).join('\n') || `Claude Code thoát với mã ${ma}.`);
  // Lịch sử chat ghi kèm trong thư mục phiên.
  try {
    const gio = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
    appendFileSync(join(thuMuc, 'LichSu-chat.md'), `\n## ${gio}\n\n**Bạn:** ${t.noi_dung || ''}${dinhKem.length ? `\n\nĐính kèm: ${dinhKem.join(', ')}` : ''}\n\n**Claude:** ${kq?.result || loi || ''}\n${moi.length ? `\nTệp: ${moi.map((p) => relative(thuMuc, p)).join(', ')}\n` : ''}`);
  } catch {}
  gui({ loai: 'xong', phien: t.phien, luot: t.luot, claude_session: sid, thanh_cong: thanhCong, da_dung: daDung, loi, thoi_gian_ms: Date.now() - batDau, chi_phi: kq?.total_cost_usd || null, thu_muc: thuMuc });
  ghiLog('Xong lượt', t.phien, t.luot, thanhCong ? 'đạt' : `lỗi: ${String(loi).slice(0, 200)}`);
}

mkdirSync(THU_MUC_LAM, { recursive: true });
ghiLog(`Trạm Claude ${PHIEN_BAN} khởi động, ${banClaude || 'chưa thấy Claude Code'}, thư mục ${THU_MUC_LAM}`);
noi();
