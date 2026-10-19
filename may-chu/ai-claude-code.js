// Gọi Claude qua Claude Code gói Max (claude -p) cho mọi tác vụ AI của máy chủ trên Mac: không tốn tiền API, dùng chung hạn mức gói Max.
// Mỗi lần gọi chỉ là một lượt hỏi đáp: không MCP, không công cụ, không nạp cài đặt người dùng, không lưu phiên, chạy trong thư mục rỗng,
// nên Claude không có đường gửi gì ra ngoài. Lỗi (chưa đăng nhập, hết hạn mức gói, quá giờ) thì ném lỗi để chayAi quay về Workers AI.
// Không dùng --bare: cờ này bỏ đọc keychain nên mất đăng nhập Max.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function moAiClaudeCode({ claudeBin, model = 'claude-haiku-5-5', effort = 'medium', thuMuc, toiDaCungLuc = 2, hetGioMs = 180000, spawnHam = spawn }) {
  mkdirSync(thuMuc, { recursive: true });
  // Giới hạn số tiến trình claude chạy cùng lúc; lượt sau đợi lượt trước xong.
  let dangChay = 0;
  const hangCho = [];
  const xinLuot = () => (dangChay < toiDaCungLuc ? (dangChay++, Promise.resolve()) : new Promise((r) => hangCho.push(r)));
  const traLuot = () => { const r = hangCho.shift(); if (r) r(); else dangChay--; };

  function goi(he, hoi) {
    return new Promise((xong, loi) => {
      const doiSo = ['-p', '--strict-mcp-config', '--tools', '', '--setting-sources', 'local', '--disable-slash-commands', '--no-session-persistence',
        '--output-format', 'json', '--model', model, '--effort', effort, ...(he ? ['--system-prompt', he] : [])];
      const con = spawnHam(claudeBin, doiSo, {
        cwd: thuMuc,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${join(homedir(), '.local', 'bin')}:/opt/homebrew/bin:${process.env.PATH || '/usr/bin:/bin'}`, CLAUDECODE: '' },
      });
      let out = '';
      let err = '';
      let xongRoi = false;
      let gioHan = null;
      const ket = (f, v) => { if (!xongRoi) { xongRoi = true; clearTimeout(gioHan); f(v); } };
      gioHan = setTimeout(() => {
        con.kill('SIGTERM');
        setTimeout(() => con.kill('SIGKILL'), 5000).unref?.();
        ket(loi, new Error(`Claude Code trả lời quá ${Math.round(hetGioMs / 1000)} giây, đã dừng`));
      }, hetGioMs);
      con.stdout.on('data', (b) => { out += b; });
      con.stderr.on('data', (b) => { err += b; });
      con.on('error', (e) => ket(loi, new Error(`Không chạy được Claude Code: ${e.message}`)));
      con.on('close', (ma) => {
        let kq = null;
        try {
          const dong = out.trim().split('\n').filter(Boolean);
          kq = JSON.parse(dong[dong.length - 1]);
        } catch { /* không phải JSON */ }
        if (kq && typeof kq.result === 'string' && !kq.is_error) {
          // Một dòng nhật ký mỗi lần gọi để biết token thật: vào, ghi cache, đọc cache, ra, số giây.
          const u = kq.usage || {};
          console.log(`Token Claude Code ${model}: vào ${u.input_tokens ?? '?'}, ghi cache ${u.cache_creation_input_tokens ?? 0}, đọc cache ${u.cache_read_input_tokens ?? 0}, ra ${u.output_tokens ?? '?'}, ${Math.round((kq.duration_ms || 0) / 100) / 10} giây`);
          return ket(xong, kq.result);
        }
        ket(loi, new Error(kq?.result ? `Claude Code báo lỗi: ${String(kq.result).slice(0, 200)}` : `Claude Code dừng với mã ${ma}. ${(err.trim() || out.trim()).slice(-200)}`));
      });
      con.stdin.on('error', () => {}); // tiến trình chết sớm thì bỏ qua lỗi ghi stdin, lỗi thật báo ở 'close'
      con.stdin.end(hoi);
    });
  }

  return {
    ten: `Claude Code (${model}, ${effort})`,
    // messages: [{ role: 'system'|'user'|'assistant', content }]. Trả về chuỗi trả lời.
    async chay(messages) {
      const he = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const hoi = messages.filter((m) => m.role !== 'system');
      const noiDung = hoi.length === 1 ? String(hoi[0].content) : hoi.map((m) => `${m.role === 'assistant' ? 'Trợ lý' : 'Người dùng'}: ${m.content}`).join('\n\n');
      await xinLuot();
      try {
        return await goi(he, noiDung);
      } finally {
        traLuot();
      }
    },
  };
}
