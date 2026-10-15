// Thợ Claude trên máy chủ riêng: lấy việc nhóm Claude (và lượt "Giao Claude" bấm tay) từ hàng đợi, chạy Claude Code
// trong bản sao ThangLong_KB, đẩy kết quả lên nhánh sonicplan/luot-N và mở PR, xếp tệp vào hộp thư cho tác vụ chép sang Drive.
// Logic hàng đợi và lời nhắc ở src/tho-claude.js. Mỗi lượt chạy trong một git worktree riêng nên hai lượt chạy song song không đụng nhau.
import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { hoanTatLuot } from '../src/claude-code.js';
import { GOC_DU_AN, goiYThuMuc } from '../src/kb.js';
import { chonViecTuDong, demLoiTuDongGanDay, demTuDongHomNay, docCauHinhTho, dungLichSuMd, dungNguCanhMd, layDinhKem, layGhiNhoSonicplan, layLichSuLuot, layTinNguCanh, loiNhacTho, taoLuotMay, thuMucLamViec } from '../src/tho-claude.js';

const TOI_DA_PHUT = 30;
const CONG_CU = ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Task', 'Skill', 'Bash(python3:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)'];
const THU_MUC_DUOC_DAY = (thuMucLam) => [thuMucLam, 'memory'];

const chay = (lenh, doiSo, tuyChon = {}) => new Promise((xong, loi) => {
  execFile(lenh, doiSo, { maxBuffer: 20 * 1024 * 1024, timeout: 120000, ...tuyChon }, (e, out, err) => (e ? loi(Object.assign(e, { stderr: String(err || '').slice(0, 400) })) : xong(String(out))));
});

export function moThoClaude(env, cfg = {}) {
  const nha = resolve(cfg.THO_DIR || join(homedir(), '.sonicplan-tho'));
  const kbDir = resolve(cfg.KB_DIR || join(nha, 'ThangLong_KB'));
  const lamDir = join(nha, 'lam');
  const driveCho = resolve(cfg.DRIVE_CHO || join(nha, 'drive-cho'));
  const claudeBin = cfg.CLAUDE_BIN || join(homedir(), '.local', 'bin', 'claude');
  const kbRepo = cfg.KB_REPO || 'HaiTLU/ThangLong_KB';
  const kbNguon = cfg.KB_REMOTE || `https://github.com/${kbRepo}.git`; // thử nghiệm đặt đường dẫn kho cục bộ
  const khongMoPr = cfg.THO_KHONG_PR === '1';
  const dangChay = new Map(); // luot id -> { tc, tien_trinh }
  let hen = null;
  let dangVong = false;
  let dung = false;
  const git = (doiSo, cwd = kbDir, tuyChon = {}) => chay('git', doiSo, { cwd, ...tuyChon });

  async function chuanBiKb() {
    await mkdir(nha, { recursive: true });
    if (!existsSync(join(kbDir, '.git'))) await chay('git', ['clone', '--quiet', kbNguon, kbDir], { timeout: 600000 });
    await git(['config', 'user.name', 'Sonicplan']);
    await git(['config', 'user.email', 'sonicplan@users.noreply.github.com']);
    await git(['fetch', '--quiet', 'origin', 'main'], kbDir, { timeout: 300000 });
    await git(['worktree', 'prune']);
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
    const goiY = goiYThuMuc(duAn.ten, await lietKeThuMucKb());
    if (!goiY) return null;
    await env.CSDL.prepare('UPDATE du_an SET kb_thu_muc = ?1, kb_duyet = 0 WHERE id = ?2 AND kb_thu_muc IS NULL').bind(`${GOC_DU_AN}/${goiY}`, duAn.id).run();
    return `${GOC_DU_AN}/${goiY}`;
  }

  // Chạy Claude Code, trả { ok, chu, chi_phi, so_luot } hoặc ném lỗi.
  function chayClaude(cwd, loiNhac, cauHinh, luotId) {
    return new Promise((xong, loi) => {
      const doiSo = ['-p', '--output-format', 'json', '--model', cauHinh.model, '--effort', cauHinh.effort, '--permission-mode', 'acceptEdits', '--permission-prompts', 'none', '--allowedTools', ...CONG_CU];
      const con = spawn(claudeBin, doiSo, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PATH: `${join(homedir(), '.local', 'bin')}:/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}`, CLAUDECODE: '' } });
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

  async function lamMotLuot(luot) {
    const viecList = await viecCuaLuot(luot);
    if (!viecList.length) throw new Error('Không còn việc nào của lượt này.');
    const cauHinh = await docCauHinhTho(env, luot.to_chuc_id);
    const duAn = viecList[0].du_an_id ? await env.CSDL.prepare('SELECT id, ten, kb_thu_muc FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(viecList[0].du_an_id, luot.to_chuc_id).first() : null;
    const kbThuMuc = await thuMucKbCuaDuAn(duAn);
    const thuMucLam = thuMucLamViec(kbThuMuc, duAn?.ten, viecList[0]);
    const nhanh = `sonicplan/luot-${luot.id}`;
    const w = join(lamDir, `luot-${luot.id}`);
    await chuanBiKb();
    await rm(w, { recursive: true, force: true });
    await mkdir(lamDir, { recursive: true });
    await git(['worktree', 'add', '-B', nhanh, w, 'origin/main']);
    try {
      const goc = join(w, thuMucLam);
      await mkdir(join(goc, 'ket-qua'), { recursive: true });
      await mkdir(join(goc, 'dinh-kem'), { recursive: true });
      const tin = await layTinNguCanh(env, luot.to_chuc_id, viecList[0]);
      const dinhKem = await layDinhKem(env, luot.to_chuc_id, tin.quanh.map((t) => t.id));
      for (const t of dinhKem) if (t.byte) await writeFile(join(goc, 'dinh-kem', `${t.ten.replace(/[\\/:*?"<>|\0]/g, '_').slice(0, 120)}`), t.byte);
      const ghiNho = await layGhiNhoSonicplan(env, luot.to_chuc_id, duAn?.ten);
      await writeFile(join(goc, 'NGU-CANH.md'), dungNguCanhMd({ viecList, duAn, tin, ghiNho, dinhKem }));
      await writeFile(join(goc, 'LICH-SU.md'), dungLichSuMd((await layLichSuLuot(env, luot.to_chuc_id, viecList[0])).filter((l) => l.id !== luot.id)));
      const truoc = luot.tiep_luot ? (await env.CSDL.prepare('SELECT ket_qua FROM luot_claude WHERE id = ?1 AND to_chuc_id = ?2').bind(luot.tiep_luot, luot.to_chuc_id).first())?.ket_qua : null;
      const loiNhac = loiNhacTho({ viecList, duAn, thuMucLam, dan: luot.dan, truoc });
      await env.CSDL.prepare('UPDATE luot_claude SET thu_muc_lam = ?1 WHERE id = ?2 OR lo_id = ?2').bind(thuMucLam, luot.id).run();

      const kq = await chayClaude(w, loiNhac, cauHinh, luot.id);
      await writeFile(join(goc, 'CAU-TRA-LOI.md'), `# Câu trả lời của Claude (lượt ${luot.id})\n\n${kq.chu}\n`);

      // Đẩy kết quả: chỉ thư mục làm việc và memory/, các thay đổi khác của Claude bị bỏ.
      let pr = null;
      let nhanhUrl = null;
      try {
        await git(['add', '-A', '--', ...THU_MUC_DUOC_DAY(thuMucLam)], w);
        const thayDoi = (await git(['diff', '--cached', '--name-only'], w)).trim();
        if (thayDoi) {
          await git(['commit', '-q', '-m', `Sonicplan lượt ${luot.id}: ${viecList[0].tieu_de.slice(0, 60)}\n\n- Thư mục làm việc: ${thuMucLam}\n- Việc: ${viecList.map((v) => `v${v.id}`).join(', ')}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`], w);
          await git(['push', '-q', '--force', 'origin', `${nhanh}:${nhanh}`], w, { timeout: 300000 });
          nhanhUrl = khongMoPr ? null : `https://github.com/${kbRepo}/tree/${nhanh}`;
          if (!khongMoPr) try {
            const moPr = (await chay('gh', ['pr', 'create', '--repo', kbRepo, '--base', 'main', '--head', nhanh, '--title', `Sonicplan lượt ${luot.id}: ${viecList[0].tieu_de.slice(0, 60)}`, '--body', `Kết quả Claude tự làm từ Sonicplan.\n\nThư mục: ${thuMucLam}\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`], { cwd: w, timeout: 120000 })).trim();
            pr = moPr.split('\n').find((d) => /^https:\/\/github\.com\//.test(d)) || null;
            if (pr) {
              // Theo quy tắc kho: tự gộp khi kiểm tra tự động xong không lỗi. Chưa xong hay lỗi thì để PR mở cho PM.
              for (let i = 0; i < 12; i++) {
                const t = await chay('gh', ['pr', 'checks', pr, '--json', 'state'], { cwd: w }).catch((e) => e.stdout || '[]');
                const ds = (() => { try { return JSON.parse(t); } catch { return []; } })();
                if (ds.some((x) => ['FAILURE', 'ERROR'].includes(x.state))) break;
                if (!ds.some((x) => ['PENDING', 'QUEUED', 'IN_PROGRESS'].includes(x.state))) { await chay('gh', ['pr', 'merge', pr, '--squash'], { cwd: w }).catch((e) => console.error('Chưa gộp được PR', pr, e.stderr)); break; }
                await new Promise((x) => setTimeout(x, 10000));
              }
            }
          } catch (e) { console.error('Không mở được PR cho lượt', luot.id, e.stderr || e.message); }
        }
      } catch (e) { console.error('Không đẩy được kết quả lên GitHub cho lượt', luot.id, e.stderr || e.message); }

      // Tệp cho Drive: tác vụ bash riêng (có quyền Drive) chép từ hộp thư này, vì tiến trình node không với tới Drive.
      const driveDich = `Sonicplan Claude/${(duAn?.ten || 'Chưa xếp dự án').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)}/${basename(thuMucLam)}`;
      const hop = join(driveCho, `luot-${luot.id}`);
      await rm(hop, { recursive: true, force: true });
      await mkdir(join(hop, 'noi-dung'), { recursive: true });
      await cp(join(goc, 'ket-qua'), join(hop, 'noi-dung', 'ket-qua'), { recursive: true });
      await cp(join(goc, 'CAU-TRA-LOI.md'), join(hop, 'noi-dung', 'CAU-TRA-LOI.md'));
      await writeFile(join(hop, 'dich.txt'), driveDich);
      await env.CSDL.prepare('UPDATE luot_claude SET drive_duong_dan = ?1, ket_thuc_luc = ?2 WHERE id = ?3 OR lo_id = ?3').bind(driveDich, new Date().toISOString(), luot.id).run();

      await hoanTatLuot(env, { id: luot.id, to_chuc_id: luot.to_chuc_id, viec_id: luot.viec_id, tieu_de: viecList[0].tieu_de }, { trang_thai: 'xong', ket_qua: kq.chu.slice(0, 20000), nhanh: nhanhUrl, pr });
    } finally {
      await git(['worktree', 'remove', '--force', w]).catch(() => {});
      await git(['branch', '-D', nhanh]).catch(() => {});
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

  async function vong() {
    if (dangVong || dung) return;
    dangVong = true;
    try {
      const { results: dsTc } = await env.CSDL.prepare('SELECT id FROM to_chuc').all();
      for (const { id: tc } of dsTc) {
        const cauHinh = await docCauHinhTho(env, tc);
        if (!cauHinh.bat) continue;
        const dangCua = [...dangChay.values()].filter((x) => x.tc === tc).length;
        let ranh = cauHinh.song_song - dangCua;
        if (ranh <= 0) continue;
        const { results: cho } = await env.CSDL.prepare(`SELECT id, to_chuc_id, viec_id, dan, tiep_luot FROM luot_claude WHERE to_chuc_id = ?1 AND noi_chay = 'may' AND trang_thai = 'cho' AND lo_id IS NULL ORDER BY id LIMIT ?2`).bind(tc, ranh).all();
        for (const l of cho) { await batDauLuot(l); ranh--; }
        if (ranh <= 0) continue;
        if ((await demLoiTuDongGanDay(env, tc)) >= 2) continue; // cầu dao: 2 lượt tự chạy lỗi trong 2 giờ qua
        const daChay = await demTuDongHomNay(env, tc, new Date());
        const conLai = Math.min(ranh, cauHinh.toi_da_ngay - daChay);
        if (conLai <= 0) continue;
        for (const v of await chonViecTuDong(env, tc, conLai)) {
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
    // Máy khởi động lại giữa chừng thì lượt đang làm bị bỏ dở: báo lỗi để PM giao lại, rồi mới chạy vòng đầu.
    async bat(tick = 60000) {
      await env.CSDL.prepare(`UPDATE luot_claude SET trang_thai = 'loi', ket_qua = 'Máy chủ khởi động lại giữa chừng, lượt này bị bỏ dở. Giao lại.', cap_nhat_luc = ?1 WHERE noi_chay = 'may' AND trang_thai = 'dang_lam'`).bind(new Date().toISOString()).run().catch(() => {});
      hen = setInterval(vong, tick);
      setTimeout(vong, 5000);
    },
    chayNgay: () => { vong(); },
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
