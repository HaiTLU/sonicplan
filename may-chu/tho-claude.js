// Thợ Claude trên máy chủ riêng: lấy việc nhóm Claude (và lượt "Giao Claude" bấm tay) từ hàng đợi, chạy Claude Code
// trong bản sao ThangLong_KB, đẩy kết quả lên nhánh sonicplan/luot-N và mở PR và tự gộp. Tệp về Drive nhờ thư mục ThangLong_KB trên Drive tự kéo main.
// Logic hàng đợi và lời nhắc ở src/tho-claude.js. Mỗi lượt chạy trong một git worktree riêng nên hai lượt chạy song song không đụng nhau.
import { execFile, spawn } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { hoanTatLuot } from '../src/claude-code.js';
import { hoiAi, locTepTheoLuong } from '../src/luong-thu.js';
import { taoNhapGmail } from '../src/google.js';
import { GOC_DU_AN, goiYThuMuc, laDuAnChung, tenThuMuc } from '../src/kb.js';
import { nhayCam } from '../src/ghi-nho.js';
import { khoangNgay, dungChiSoMd, dungMauRaSoatMd, layMauRaSoat, loiNhacRaSoat, tinhChatLuongTachViec } from '../src/danh-gia-tach-viec.js';
import { taoThongBao } from '../src/thong-bao.js';
import { chonModelChoViec, chonViecTuDong, docGhiNhoMd, dungGhiNhoMd, hopNhatGhiNho, demLoiTuDongGanDay, demTuDongHomNay, docCauHinhTho, dungLichSuMd, dungNguCanhMd, docDinhKem, timDinhKem, TOI_DA_DINH_KEM, layGhiNhoSonicplan, TOI_DA_DINH_KEM_GOP, layLichSuLuot, layTinNguCanh, loiNhacTho, taoLuotMay, thuMucLamViec } from '../src/tho-claude.js';

// PATH cho Claude Code. python3 phải là bản có python-docx và openpyxl (bản cài từ python.org, thường ở /usr/local/bin hoặc /Library/Frameworks):
// dịch vụ chạy dưới launchd nên PATH rất ngắn, rơi về python3 3.9 của hệ thống thì không tạo được Word và Excel (lượt 16/10 chỉ ra được tệp .md).
export function duongDanChoClaude(cfg = {}, goc = process.env.PATH) {
  const python = [];
  if (cfg.PYTHON_BIN) python.push(dirname(cfg.PYTHON_BIN));
  try {
    const phienBan = readdirSync('/Library/Frameworks/Python.framework/Versions').filter((v) => /^\d/.test(v));
    phienBan.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const v of phienBan) python.push(`/Library/Frameworks/Python.framework/Versions/${v}/bin`);
  } catch { /* máy không cài Python từ python.org */ }
  const dau = [join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', ...python];
  return [...new Set([...dau, ...String(goc || '/usr/bin:/bin').split(':').filter(Boolean)])].join(':');
}

const TOI_DA_PHUT = 30;
const CONG_CU = ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Task', 'Skill', 'Bash(python3:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)'];
// Kết quả việc chỉ đẩy thư mục làm việc. memory/ đã chuyển sang kho second-brain (18/10/2026), không đẩy lên ThangLong_KB nữa.
const THU_MUC_DUOC_DAY = (thuMucLam) => [thuMucLam];

const chay = (lenh, doiSo, tuyChon = {}) => new Promise((xong, loi) => {
  execFile(lenh, doiSo, { maxBuffer: 20 * 1024 * 1024, timeout: 120000, ...tuyChon }, (e, out, err) => (e ? loi(Object.assign(e, { stderr: String(err || '').slice(0, 400) })) : xong(String(out))));
});

export function moThoClaude(env, cfg = {}) {
  const nha = resolve(cfg.THO_DIR || join(homedir(), '.sonicplan-tho'));
  const kbDir = resolve(cfg.KB_DIR || join(nha, 'ThangLong_KB'));
  const lamDir = join(nha, 'lam');
  const claudeBin = cfg.CLAUDE_BIN || join(homedir(), '.local', 'bin', 'claude');
  const kbRepo = cfg.KB_REPO || 'HaiTLU/ThangLong_KB';
  const kbNguon = cfg.KB_REMOTE || `https://github.com/${kbRepo}.git`; // thử nghiệm đặt đường dẫn kho cục bộ
  // Kho second-brain: nơi ghi nhớ Sonicplan được xuất (memory/projects/Sonicplan_GhiNho.md), đẩy thẳng main, chỉ thư mục memory/.
  const sbDir = resolve(cfg.SB_DIR || join(nha, 'second-brain'));
  const sbRepo = cfg.SB_REPO || 'HaiTLU/second-brain';
  const sbNguon = cfg.SB_REMOTE || `https://github.com/${sbRepo}.git`;
  const khongMoPr = cfg.THO_KHONG_PR === '1';
  const dangChay = new Map(); // luot id -> { tc, tien_trinh }
  let hen = null;
  let dangVong = false;
  let dung = false;
  const git = (doiSo, cwd = kbDir, tuyChon = {}) => chay('git', doiSo, { cwd, ...tuyChon });
  // Các thao tác đổi kho gốc (clone, fetch, thêm hoặc gỡ worktree) chạy lần lượt: hai lượt cùng bắt đầu thì lượt sau đợi lượt trước.
  let hangKb = Promise.resolve();
  const lanLuot = (f) => { const ra = hangKb.then(f, f); hangKb = ra.catch(() => {}); return ra; };

  async function chuanBiKb(dir = kbDir, nguon = kbNguon) {
    await mkdir(nha, { recursive: true });
    if (!existsSync(join(dir, '.git'))) await chay('git', ['clone', '--quiet', nguon, dir], { timeout: 600000 });
    await git(['config', 'user.name', 'Sonicplan'], dir);
    await git(['config', 'user.email', 'sonicplan@users.noreply.github.com'], dir);
    await git(['fetch', '--quiet', 'origin', 'main'], dir, { timeout: 300000 });
    await git(['worktree', 'prune'], dir);
  }

  async function lietKeThuMucKb() {
    try {
      if (!existsSync(join(kbDir, '.git'))) return [];
      const ds = await readdir(join(kbDir, GOC_DU_AN), { withFileTypes: true });
      return ds.filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('[')).map((d) => d.name).sort();
    } catch { return []; }
  }

  async function thongTinKb() {
    const co = existsSync(join(kbDir, '.git'));
    let ban = null;
    if (co) { try { ban = (await git(['log', '-1', '--format=%h %cr', 'origin/main'])).trim(); } catch { /* chưa fetch */ } }
    return { thu_muc: kbDir, da_clone: co, ban_moi_nhat: ban };
  }

  async function viecCuaLuot(luot) {
    const { results } = await env.CSDL.prepare(
      `SELECT v.id, v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.nhom, v.du_an_id, v.tin_nhan_id FROM viec v
       WHERE v.to_chuc_id = ?1 AND v.id IN (SELECT viec_id FROM luot_claude WHERE id = ?2 OR lo_id = ?2) ORDER BY v.id`,
    ).bind(luot.to_chuc_id, luot.id).all();
    return results;
  }

  async function thuMucKbCuaDuAn(duAn) {
    if (!duAn) return null;
    if (duAn.kb_thu_muc) return duAn.kb_thu_muc;
    // Khớp tên với thư mục có sẵn; không khớp mà là dự án thật thì tạo thư mục mới 01_Projects/<Tên> (PM đổi được ở thẻ Kết nối); nhóm chung (Khác, Cá nhân) dùng _INBOX.
    const goiY = goiYThuMuc(duAn.ten, await lietKeThuMucKb());
    const dich = goiY ? `${GOC_DU_AN}/${goiY}` : laDuAnChung(duAn.ten) ? null : `${GOC_DU_AN}/${tenThuMuc(duAn.ten, 40)}`;
    if (!dich) return null;
    await env.CSDL.prepare('UPDATE du_an SET kb_thu_muc = ?1, kb_duyet = 0 WHERE id = ?2 AND kb_thu_muc IS NULL').bind(dich, duAn.id).run();
    return dich;
  }

  // Chạy Claude Code, trả { ok, chu, chi_phi, so_luot } hoặc ném lỗi.
  function chayClaude(cwd, loiNhac, cauHinh, luotId) {
    return new Promise((xong, loi) => {
      const doiSo = ['-p', '--output-format', 'json', '--model', cauHinh.model, '--effort', cauHinh.effort, '--permission-mode', 'acceptEdits', '--permission-prompts', 'none', '--strict-mcp-config', '--allowedTools', ...CONG_CU];
      // --strict-mcp-config: không nạp máy chủ MCP nào (kể cả Gmail, Slack...), nên Claude không có công cụ gửi gì ra ngoài. PM dặn 16/10/2026: không tự gửi thư.
      const con = spawn(claudeBin, doiSo, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PATH: duongDanChoClaude(cfg), CLAUDECODE: '' } });
      dangChay.get(luotId).tien_trinh = con;
      let out = '';
      let err = '';
      const gioHan = setTimeout(() => { con.kill('SIGTERM'); setTimeout(() => con.kill('SIGKILL'), 5000); loi(new Error(`Claude làm quá ${TOI_DA_PHUT} phút, đã dừng.`)); }, TOI_DA_PHUT * 60000);
      con.stdout.on('data', (b) => { out += b; });
      con.stderr.on('data', (b) => { err += b; });
      con.on('error', (e) => { clearTimeout(gioHan); loi(new Error(`Không chạy được Claude Code: ${e.message}`)); });
      con.on('close', (ma) => {
        clearTimeout(gioHan);
        let kq = null;
        try {
          const dong = out.trim().split('\n').filter(Boolean);
          const j = JSON.parse(dong[dong.length - 1]);
          kq = Array.isArray(j) ? j.findLast?.((x) => x.type === 'result') : j;
        } catch { /* không phải JSON */ }
        if (kq && typeof kq.result === 'string' && !kq.is_error) return xong({ chu: kq.result, chi_phi: kq.total_cost_usd, so_luot: kq.num_turns });
        loi(new Error(kq?.result ? `Claude báo lỗi: ${String(kq.result).slice(0, 300)}` : `Claude dừng với mã ${ma}. ${err.trim().slice(-300) || out.trim().slice(-300)}`));
      });
      con.stdin.end(loiNhac);
    });
  }

  // Commit các đường dẫn đã chọn trong worktree w, đẩy lên nhánh, mở PR và tự gộp khi kiểm tra tự động xong không lỗi (quy tắc kho KB).
  // Không có thay đổi thì không làm gì. Lỗi mạng hay quyền chỉ ghi log, không làm hỏng việc gọi. Trả { pr, nhanhUrl }.
  // thang: đẩy thẳng main (không PR), dùng cho kho second-brain; bị từ chối vì main đã đổi thì nạp main mới, rebase rồi đẩy lại.
  async function dayLenKb(w, nhanh, duongDan, { tieuDe, than, nhan, thang = false }) {
    let pr = null;
    let nhanhUrl = null;
    let daGop = false;
    try {
      await git(['add', '-A', '--', ...duongDan], w);
      if (!(await git(['diff', '--cached', '--name-only'], w)).trim()) return { pr, nhanhUrl, daGop };
      await git(['commit', '-q', '-m', `${tieuDe}\n\n${than}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`], w);
      if (thang) {
        for (let lan = 1; ; lan++) {
          try { await git(['push', '-q', 'origin', `${nhanh}:main`], w, { timeout: 300000 }); break; } catch (e) {
            if (lan >= 3) throw e;
            await git(['fetch', '-q', 'origin', 'main'], w, { timeout: 300000 });
            await git(['rebase', 'origin/main'], w, { timeout: 300000 });
          }
        }
        return { pr, nhanhUrl, daGop: true };
      }
      await git(['push', '-q', '--force', 'origin', `${nhanh}:${nhanh}`], w, { timeout: 300000 });
      nhanhUrl = khongMoPr ? null : `https://github.com/${kbRepo}/tree/${nhanh}`;
      if (khongMoPr) return { pr, nhanhUrl, daGop };
      try {
        const moPr = (await chay('gh', ['pr', 'create', '--repo', kbRepo, '--base', 'main', '--head', nhanh, '--title', tieuDe, '--body', `Tự động từ Sonicplan.\n\n${than}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`], { cwd: w, timeout: 120000 })).trim();
        pr = moPr.split('\n').find((d) => /^https:\/\/github\.com\//.test(d)) || null;
        for (let i = 0; pr && i < 12; i++) {
          const t = await chay('gh', ['pr', 'checks', pr, '--json', 'state'], { cwd: w }).catch((e) => e.stdout || '[]');
          const ds = (() => { try { return JSON.parse(t); } catch { return []; } })();
          if (ds.some((x) => ['FAILURE', 'ERROR'].includes(x.state))) break;
          if (!ds.some((x) => ['PENDING', 'QUEUED', 'IN_PROGRESS'].includes(x.state))) { daGop = await chay('gh', ['pr', 'merge', pr, '--squash'], { cwd: w }).then(() => true, (e) => { console.error('Chưa gộp được PR', pr, e.stderr); return false; }); break; }
          await new Promise((x) => setTimeout(x, 10000));
        }
      } catch (e) { console.error(`Không mở được PR cho ${nhan}`, e.stderr || e.message); }
    } catch (e) { console.error(`Không đẩy được ${nhan} lên GitHub`, e.stderr || e.message); }
    return { pr, nhanhUrl, daGop };
  }

  // Ghi nhớ trong Sonicplan (người, dự án, quyết định, sự thật) xuất sang memory/projects/Sonicplan_GhiNho.md của kho second-brain để Claude đọc ở mọi phiên.
  // Chỉ tạo PR khi nội dung đổi so với bản đang có trên main. Trả { so_ghi_nho, doi, pr }.
  async function dongBoGhiNho() {
    const { results: dsTc } = await env.CSDL.prepare('SELECT id FROM to_chuc').all();
    let tong = 0;
    let doi = false;
    let prCuoi = null;
    const nhan = { nhap: 0 };
    let daDungTep = false;
    for (const { id: tc } of dsTc) {
      const doc = async () => (await env.CSDL.prepare('SELECT loai, tieu_de, noi_dung, ghim, nguon FROM ghi_nho WHERE to_chuc_id = ?1 ORDER BY loai, ghim DESC, tieu_de').bind(tc).all()).results;
      let results = await doc();
      // second-brain là kho của một tổ chức và chỉ có một tệp Sonicplan_GhiNho.md: tổ chức đầu tiên có ghi nhớ giữ tệp, tổ chức khác (và tổ chức chưa có ghi nhớ nào, chưa đồng bộ lần nào) bỏ qua để khỏi nhập nhầm.
      const coGoc = Boolean((await env.CSDL.prepare(`SELECT 1 AS x FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'ghi_nho_kb_goc'`).bind(tc).first()));
      if (daDungTep || (!results.length && !coGoc)) continue;
      daDungTep = true;
      const bayGio = new Date();
      const nhanh = `sonicplan/ghi-nho-${new Date(bayGio.getTime() + 7 * 3600000).toISOString().slice(2, 16).replace(/[-:T]/g, '')}`;
      const w = join(lamDir, `ghi-nho-${tc}`.slice(0, 60));
      await lanLuot(async () => { await chuanBiKb(sbDir, sbNguon); await rm(w, { recursive: true, force: true }); await mkdir(lamDir, { recursive: true }); await git(['worktree', 'add', '-B', nhanh, w, 'origin/main'], sbDir); });
      try {
        const tep = join(w, 'memory', 'projects', 'Sonicplan_GhiNho.md');
        const cu = existsSync(tep) ? await readFile(tep, 'utf8') : '';
        const bo = (x) => x.replace(/^Tự sinh lúc.*$/m, '');
        // Chiều KB về Sonicplan: điều PM hay Claude thêm hoặc sửa trong file trên main (hợp nhất ba bên với bản xuất lần trước đã khớp).
        const goc = await env.CSDL.prepare(`SELECT gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'ghi_nho_kb_goc'`).bind(tc).first();
        let banGoc = null;
        try { banGoc = goc ? JSON.parse(goc.gia_tri) : null; } catch { banGoc = null; }
        if (cu) {
          const hn = hopNhatGhiNho({ ours: results, theirs: docGhiNhoMd(cu), base: banGoc });
          const bayGioIso = new Date().toISOString();
          for (const g of hn.them) {
            if (nhayCam(`${g.tieu_de} ${g.noi_dung}`)) continue; // số thẻ, mật khẩu, mã OTP, số giấy tờ: không bao giờ nhớ
            await env.CSDL.prepare(`INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, nguon, ghim, da_duyet, tao_luc, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, 'tay', ?5, 1, ?6, ?6) ON CONFLICT (to_chuc_id, loai, tieu_de) DO NOTHING`)
              .bind(tc, g.loai, g.tieu_de.slice(0, 120), g.noi_dung.slice(0, 600), g.ghim, bayGioIso).run();
          }
          for (const g of hn.sua) {
            if (nhayCam(`${g.tieu_de} ${g.noi_dung}`)) continue;
            await env.CSDL.prepare(`UPDATE ghi_nho SET noi_dung = ?1, ghim = ?2, nguon = 'tay', cap_nhat_luc = ?3 WHERE to_chuc_id = ?4 AND loai = ?5 AND lower(tieu_de) = lower(?6)`)
              .bind(g.noi_dung.slice(0, 600), g.ghim, bayGioIso, tc, g.loai, g.tieu_de).run();
          }
          if (hn.them.length || hn.sua.length) { results = await doc(); console.log(`Ghi nhớ từ KB: thêm ${hn.them.length}, sửa ${hn.sua.length}, xung đột ${hn.xung_dot.length} (Sonicplan thắng)`); }
          nhan.nhap += [...hn.them, ...hn.sua].filter((g) => !nhayCam(`${g.tieu_de} ${g.noi_dung}`)).length;
        }
        if (!results.length) continue;
        tong += results.length;
        const moi = dungGhiNhoMd(results, bayGio);
        // Khớp rồi thì lưu bản gốc cho lần hợp nhất sau.
        const luuGoc = (ds) => env.CSDL.prepare(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, 'ghi_nho_kb_goc', ?2) ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`).bind(tc, JSON.stringify(ds.map((g) => ({ loai: g.loai, tieu_de: g.tieu_de, noi_dung: g.noi_dung, ghim: g.ghim })))).run();
        if (bo(cu) === bo(moi)) { await luuGoc(results); continue; }
        await mkdir(join(w, 'memory', 'projects'), { recursive: true });
        await writeFile(tep, moi);
        doi = true;
        const kq = await dayLenKb(w, nhanh, ['memory/projects/Sonicplan_GhiNho.md'], { thang: true, tieuDe: 'Sonicplan: cập nhật ghi nhớ trong memory/', than: `- ${results.length} ghi nhớ từ trang Ghi nhớ của Sonicplan (tự sinh, sửa ở Sonicplan hoặc trực tiếp trong file này, hệ thống hợp nhất mỗi đêm)`, nhan: 'ghi nhớ' });
        prCuoi = kq.pr || prCuoi;
      } finally {
        await lanLuot(async () => { await git(['worktree', 'remove', '--force', w], sbDir).catch(() => {}); await git(['branch', '-D', nhanh], sbDir).catch(() => {}); }).catch(() => {});
      }
    }
    await env.CSDL.prepare(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('', 'ghi_nho_kb_luc', ?1) ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`).bind(new Date().toISOString()).run().catch(() => {});
    return { so_ghi_nho: tong, doi, pr: prCuoi, nhap_tu_kb: nhan.nhap };
  }

  // Rà mẫu hằng tuần: Claude chấm lại 30 tin mẫu của 7 ngày qua, báo cáo vào _INBOX/Sonicplan/DanhGia_TachViec/ của KB (PR tự gộp), báo PM bằng thông báo đẩy.
  // Kết quả chỉ là đề xuất: PM duyệt thì mới sửa lời nhắc tách việc.
  async function raSoatTachViec() {
    const { results: dsTc } = await env.CSDL.prepare('SELECT id FROM to_chuc').all();
    const ra = [];
    for (const { id: tc } of dsTc) {
      const cauHinh = await docCauHinhTho(env, tc);
      const khoang = khoangNgay(7);
      const mau = await layMauRaSoat(env, tc, khoang);
      if (!mau.length) { ra.push({ tc, bo_qua: 'không có tin nào trong 7 ngày qua' }); continue; }
      const chiSo = await tinhChatLuongTachViec(env, tc, khoangNgay(30));
      const ngay = new Date(Date.now() + 7 * 3600000).toISOString().slice(2, 10).replace(/-/g, '');
      const thuMucLam = `_INBOX/Sonicplan/DanhGia_TachViec/${ngay}_RaSoatTuan`;
      const nhanh = `sonicplan/ra-soat-${ngay}-${Date.now().toString(36).slice(-4)}`;
      const w = join(lamDir, `ra-soat-${tc}`.slice(0, 60));
      const khoa = `ra-soat-${tc}`;
      dangChay.set(khoa, { tc, tien_trinh: null, xong: Promise.resolve() });
      try {
        await lanLuot(async () => { await chuanBiKb(); await rm(w, { recursive: true, force: true }); await mkdir(lamDir, { recursive: true }); await git(['worktree', 'add', '-B', nhanh, w, 'origin/main']); });
        const goc = join(w, thuMucLam);
        await mkdir(goc, { recursive: true });
        await writeFile(join(goc, 'mau-tin.md'), dungMauRaSoatMd(mau, khoang));
        await writeFile(join(goc, 'chi-so.md'), dungChiSoMd(chiSo));
        const kq = await chayClaude(w, loiNhacRaSoat({ thuMucLam }), cauHinh, khoa);
        await writeFile(join(goc, 'BAO-CAO.md'), `# Rà soát AI tách việc, tuần ${ngay}\n\n${kq.chu}\n`);
        const { pr, nhanhUrl } = await dayLenKb(w, nhanh, [thuMucLam], { tieuDe: `Sonicplan: rà soát AI tách việc tuần ${ngay}`, than: `- ${mau.length} tin mẫu, báo cáo ở ${thuMucLam}/BAO-CAO.md (đề xuất, PM duyệt mới sửa lời nhắc)`, nhan: 'báo cáo rà soát' });
        await env.CSDL.prepare(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, 'ra_soat_tach_viec', ?2) ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`).bind(tc, JSON.stringify({ luc: new Date().toISOString(), tep: `${thuMucLam}/BAO-CAO.md`, pr, so_mau: mau.length })).run();
        await taoThongBao(env, tc, { loai: 'claude', tieu_de: 'Báo cáo rà soát AI tách việc tuần này đã sẵn sàng', noi_dung: `Claude chấm ${mau.length} tin mẫu và đề xuất 3 sửa. Xem ở ThangLong_KB: ${thuMucLam}/BAO-CAO.md`, duong_dan: '#hieu-suat' });
        ra.push({ tc, so_mau: mau.length, pr, nhanh_url: nhanhUrl, tep: `${thuMucLam}/BAO-CAO.md` });
      } catch (e) {
        console.error('Rà soát tách việc lỗi', e.message);
        ra.push({ tc, loi: String(e.message).slice(0, 300) });
      } finally {
        dangChay.delete(khoa);
        await lanLuot(async () => { await git(['worktree', 'remove', '--force', w]).catch(() => {}); await git(['branch', '-D', nhanh]).catch(() => {}); }).catch(() => {});
      }
    }
    return ra;
  }

  // Thứ Hai từ 8h giờ Việt Nam, mỗi tuần một lần (đánh dấu theo tuần), khi thợ còn rảnh.
  async function raSoatHangTuan() {
    const vn = new Date(Date.now() + 7 * 3600000);
    if (vn.getUTCDay() !== 1 || vn.getUTCHours() < 8 || dangChay.size >= 2) return;
    const tuan = new Date(vn.getTime() - 3 * 86400000).toISOString().slice(0, 10); // ngày thứ Hai mở đầu tuần: đủ để phân biệt tuần
    const da = (await env.CSDL.prepare(`SELECT gia_tri FROM cai_dat WHERE to_chuc_id = '' AND khoa = 'ra_soat_tuan'`).first())?.gia_tri;
    if (da === vn.toISOString().slice(0, 10) || da === tuan) return;
    await env.CSDL.prepare(`INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES ('', 'ra_soat_tuan', ?1) ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`).bind(vn.toISOString().slice(0, 10)).run();
    raSoatTachViec().catch((e) => console.error('Rà soát tuần lỗi', e.message));
  }

  // Claude ghi ket-qua/nhap-email*.json thì tạo bản nháp trong Gmail (không gửi). Trả đoạn chữ thêm vào câu trả lời, rỗng nếu không có nháp.
  async function taoNhapTuKetQua(tc, goc, tinGoc) {
    const ds = (await readdir(join(goc, 'ket-qua')).catch(() => [])).filter((t) => /^nhap-email.*\.json$/i.test(t)).sort().slice(0, 5);
    const dong = [];
    for (const t of ds) {
      let x;
      try { x = JSON.parse(await readFile(join(goc, 'ket-qua', t), 'utf8')); } catch { dong.push(`- ${t}: không đọc được JSON, chưa tạo nháp.`); continue; }
      const r = await taoNhapGmail(env, tc, x, { tinGoc }).catch((e) => ({ ok: false, ly_do: String(e.message).slice(0, 120) }));
      dong.push(r.ok ? `- ${t}: đã tạo bản nháp trong Gmail (mục Thư nháp)${r.trong_luong_thu ? ', nằm trong đúng luồng thư gốc' : ''}. Chưa gửi: bạn tự xem và bấm gửi.` : `- ${t}: chưa tạo được nháp: ${r.ly_do}`);
    }
    return dong.length ? `Nháp Gmail:\n${dong.join('\n')}` : '';
  }

  async function lamMotLuot(luot) {
    const viecList = await viecCuaLuot(luot);
    if (!viecList.length) throw new Error('Không còn việc nào của lượt này.');
    const cauHinh = await docCauHinhTho(env, luot.to_chuc_id);
    const duAn = viecList[0].du_an_id ? await env.CSDL.prepare('SELECT id, ten, kb_thu_muc FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(viecList[0].du_an_id, luot.to_chuc_id).first() : null;
    const kbThuMuc = await thuMucKbCuaDuAn(duAn);
    const thuMucLam = thuMucLamViec(kbThuMuc, duAn?.ten, viecList[0]);
    const nhanh = `sonicplan/luot-${luot.id}`;
    const w = join(lamDir, `luot-${luot.id}`);
    await lanLuot(async () => {
      await chuanBiKb();
      await rm(w, { recursive: true, force: true });
      await mkdir(lamDir, { recursive: true });
      await git(['worktree', 'add', '-B', nhanh, w, 'origin/main']);
    });
    try {
      const goc = join(w, thuMucLam);
      await mkdir(join(goc, 'ket-qua'), { recursive: true });
      await mkdir(join(goc, 'dinh-kem'), { recursive: true });
      // Ngữ cảnh của TỪNG việc trong lượt (giao cả dự án thì mọi việc, không chỉ việc đầu), tệp của mọi việc cộng tệp người dùng tự thêm, trừ tệp đã bỏ chọn.
      const tins = [];
      for (const v of viecList) tins.push(await layTinNguCanh(env, luot.to_chuc_id, v));
      const tin = tins[0];
      let tuyTep = null;
      try { tuyTep = luot.tep_tuy ? JSON.parse(luot.tep_tuy) : null; } catch { /* bỏ qua */ }
      let tepRows = await timDinhKem(env, luot.to_chuc_id, [...new Set(tins.flatMap((t) => t.quanh.map((x) => x.id)))], { ...(tuyTep || {}), gioiHan: 100 });
      // PM phụ trách Đào tạo ngắn hạn: lượt chưa qua khung giao (tự động) bỏ tệp của luồng Kết nối doanh nghiệp. Khung giao đã cho PM tự chọn thì giữ đúng lựa chọn.
      if (!tuyTep?.da_chon) tepRows = await locTepTheoLuong(env, luot.to_chuc_id, tepRows, hoiAi(env, luot.to_chuc_id));
      const dinhKem = await docDinhKem(env, tepRows.slice(0, viecList.length > 1 ? TOI_DA_DINH_KEM_GOP : TOI_DA_DINH_KEM));
      for (const t of dinhKem) if (t.byte) await writeFile(join(goc, 'dinh-kem', `${t.ten.replace(/[\\/:*?"<>|\0]/g, '_').slice(0, 120)}`), t.byte);
      const ghiNho = await layGhiNhoSonicplan(env, luot.to_chuc_id, duAn?.ten);
      await writeFile(join(goc, 'NGU-CANH.md'), dungNguCanhMd({ viecList, duAn, tin, tins, ghiNho, dinhKem }));
      await writeFile(join(goc, 'LICH-SU.md'), dungLichSuMd((await layLichSuLuot(env, luot.to_chuc_id, viecList[0])).filter((l) => l.id !== luot.id)));
      const truoc = luot.tiep_luot ? (await env.CSDL.prepare('SELECT ket_qua FROM luot_claude WHERE id = ?1 AND to_chuc_id = ?2').bind(luot.tiep_luot, luot.to_chuc_id).first())?.ket_qua : null;
      const soLanLam = (await env.CSDL.prepare("SELECT COUNT(*) AS n FROM luot_claude WHERE to_chuc_id = ?1 AND viec_id = ?2 AND danh_gia = 'lam_lai'").bind(luot.to_chuc_id, viecList[0].id).first())?.n || 0;
      const loiNhac = loiNhacTho({ viecList, duAn, thuMucLam, dan: luot.dan, truoc, soLanLam });
      await env.CSDL.prepare('UPDATE luot_claude SET thu_muc_lam = ?1 WHERE id = ?2 OR lo_id = ?2').bind(thuMucLam, luot.id).run();

      const mo = chonModelChoViec(viecList, cauHinh);
      const kq = await chayClaude(w, loiNhac, { ...cauHinh, model: mo.model, effort: mo.effort }, luot.id);
      kq.model = mo.model;
      const ghiChuNhap = await taoNhapTuKetQua(luot.to_chuc_id, goc, tin.goc);
      if (ghiChuNhap) kq.chu = `${kq.chu}\n\n${ghiChuNhap}`;
      await writeFile(join(goc, 'CAU-TRA-LOI.md'), `# Câu trả lời của Claude (lượt ${luot.id})\n\nModel: ${kq.model}${mo.theo_loai ? ' (chọn theo loại việc)' : ''}\n\n${kq.chu}\n`);

      // Đẩy kết quả: chỉ thư mục làm việc, các thay đổi khác của Claude (kể cả memory/) bị bỏ.
      const { pr, nhanhUrl, daGop } = await dayLenKb(w, nhanh, THU_MUC_DUOC_DAY(thuMucLam), {
        tieuDe: `Sonicplan lượt ${luot.id}: ${viecList[0].tieu_de.slice(0, 60)}`,
        than: `- Thư mục làm việc: ${thuMucLam}\n- Việc: ${viecList.map((v) => `v${v.id}`).join(', ')}`,
        nhan: `lượt ${luot.id}`,
      });

      // Tệp nằm trong thư mục dự án của KB; thư mục ThangLong_KB trên Drive tự kéo main nên tệp về Drive khi PR đã gộp (PM chọn 17/10/2026, thay cho bước chép sang "Sonicplan Claude").
      // drive_duong_dan chỉ ghi khi PR đã gộp: giao diện dựa vào đó để báo "đã về Drive" hay "chờ gộp PR".
      await env.CSDL.prepare('UPDATE luot_claude SET drive_duong_dan = ?1, ket_thuc_luc = ?2 WHERE id = ?3 OR lo_id = ?3').bind(daGop ? thuMucLam : null, new Date().toISOString(), luot.id).run();

      await hoanTatLuot(env, { id: luot.id, to_chuc_id: luot.to_chuc_id, viec_id: luot.viec_id, tieu_de: viecList[0].tieu_de }, { trang_thai: 'xong', ket_qua: kq.chu.slice(0, 20000), nhanh: nhanhUrl, pr });
    } finally {
      await lanLuot(async () => {
        await git(['worktree', 'remove', '--force', w]).catch(() => {});
        await git(['branch', '-D', nhanh]).catch(() => {});
      }).catch(() => {});
    }
  }

  async function batDauLuot(luot) {
    const r = await env.CSDL.prepare(`UPDATE luot_claude SET trang_thai = 'dang_lam', bat_dau_luc = ?1, cap_nhat_luc = ?1 WHERE id = ?2 AND trang_thai = 'cho'`).bind(new Date().toISOString(), luot.id).run();
    if (!r.meta.changes) return;
    await env.CSDL.prepare(`UPDATE luot_claude SET trang_thai = 'dang_lam', cap_nhat_luc = ?1 WHERE lo_id = ?2`).bind(new Date().toISOString(), luot.id).run();
    const xong = lamMotLuot(luot)
      .catch(async (e) => {
        console.error('Thợ Claude lỗi lượt', luot.id, e.message);
        const tieuDe = (await env.CSDL.prepare('SELECT tieu_de FROM viec WHERE id = ?1').bind(luot.viec_id).first())?.tieu_de || 'việc';
        await hoanTatLuot(env, { id: luot.id, to_chuc_id: luot.to_chuc_id, viec_id: luot.viec_id, tieu_de: tieuDe }, { trang_thai: 'loi', ket_qua: String(e.message).slice(0, 1500) }).catch((e2) => console.error('Không ghi được lỗi lượt', e2));
      })
      .finally(() => { dangChay.delete(luot.id); });
    dangChay.set(luot.id, { tc: luot.to_chuc_id, tien_trinh: null, xong });
  }

  // Mỗi ngày sau 23h giờ Việt Nam (và chưa đồng bộ trong ngày) xuất ghi nhớ sang second-brain. Lỗi chỉ ghi log, ngày mai thử lại.
  async function ghiNhoHangNgay() {
    const vn = new Date(Date.now() + 7 * 3600000);
    if (vn.getUTCHours() < 23) return;
    const ngay = vn.toISOString().slice(0, 10);
    const luc = (await env.CSDL.prepare(`SELECT gia_tri FROM cai_dat WHERE to_chuc_id = '' AND khoa = 'ghi_nho_kb_luc'`).first())?.gia_tri;
    if (luc && new Date(Date.parse(luc) + 7 * 3600000).toISOString().slice(0, 10) === ngay) return;
    try { await dongBoGhiNho(); } catch (e) { console.error('Đồng bộ ghi nhớ sang second-brain lỗi', e.message); }
  }

  async function vong() {
    if (dangVong || dung) return;
    dangVong = true;
    try {
      await ghiNhoHangNgay();
      await raSoatHangTuan();
      const { results: dsTc } = await env.CSDL.prepare('SELECT id FROM to_chuc').all();
      for (const { id: tc } of dsTc) {
        const cauHinh = await docCauHinhTho(env, tc);
        if (!cauHinh.bat) continue;
        const dangCua = [...dangChay.values()].filter((x) => x.tc === tc).length;
        let ranh = cauHinh.song_song - dangCua;
        if (ranh <= 0) continue;
        const { results: cho } = await env.CSDL.prepare(`SELECT id, to_chuc_id, viec_id, dan, tiep_luot, tep_tuy FROM luot_claude WHERE to_chuc_id = ?1 AND noi_chay = 'may' AND trang_thai = 'cho' AND lo_id IS NULL ORDER BY id LIMIT ?2`).bind(tc, ranh).all();
        for (const l of cho) { await batDauLuot(l); ranh--; }
        if (ranh <= 0) continue;
        if ((await demLoiTuDongGanDay(env, tc)) >= 2) continue; // cầu dao: 2 lượt tự chạy lỗi trong 2 giờ qua
        const daChay = await demTuDongHomNay(env, tc, new Date());
        const conLai = Math.min(ranh, cauHinh.toi_da_ngay - daChay);
        if (conLai <= 0) continue;
        for (const v of await chonViecTuDong(env, tc, conLai, { loc: cauHinh.loc_dau_vao })) {
          const id = await taoLuotMay(env, tc, v, { tuDong: true });
          await batDauLuot({ id, to_chuc_id: tc, viec_id: v.id, dan: null, tiep_luot: null });
        }
      }
    } catch (e) {
      console.error('Vòng thợ Claude lỗi', e.message);
    } finally {
      dangVong = false;
    }
  }

  return {
    // Máy khởi động lại giữa chừng (triển khai bản mới, mất điện) thì lượt đang làm bị bỏ dở: xếp lại hàng đợi, tối đa 2 lần; quá thì báo lỗi.
    async bat(tick = 60000) {
      const bayGio = new Date().toISOString();
      await env.CSDL.prepare(`UPDATE luot_claude SET trang_thai = 'cho', bo_do = bo_do + 1, cap_nhat_luc = ?1 WHERE noi_chay = 'may' AND trang_thai = 'dang_lam' AND bo_do < 2`).bind(bayGio).run().catch(() => {});
      await env.CSDL.prepare(`UPDATE luot_claude SET trang_thai = 'loi', ket_qua = 'Máy chủ khởi động lại giữa chừng nhiều lần, lượt này bị bỏ dở. Giao lại.', cap_nhat_luc = ?1 WHERE noi_chay = 'may' AND trang_thai = 'dang_lam'`).bind(bayGio).run().catch(() => {});
      await env.CSDL.prepare(`UPDATE luot_claude SET trang_thai = 'cho' WHERE noi_chay = 'may' AND lo_id IS NOT NULL AND trang_thai = 'dang_lam' AND lo_id IN (SELECT id FROM luot_claude WHERE trang_thai = 'cho')`).run().catch(() => {});
      hen = setInterval(vong, tick);
      setTimeout(vong, 5000);
    },
    chayNgay: () => { vong(); },
    raSoatTachViec,
    dongBoGhiNho: () => lanLuot(async () => {}).then(() => dongBoGhiNho()),
    vongMotLan: vong,
    doiXong: async () => { while (dangChay.size) await Promise.allSettled([...dangChay.values()].map((x) => x.xong)); },
    dong: async () => {
      dung = true;
      clearInterval(hen);
      for (const x of dangChay.values()) x.tien_trinh?.kill('SIGTERM');
    },
    lietKeThuMucKb,
    thongTinKb,
  };
}
