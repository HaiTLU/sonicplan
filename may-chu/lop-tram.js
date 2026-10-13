// Phòng chat của trang Claude khi Sonicplan chạy trên máy chủ Node: thay Durable Object bằng đối tượng trong tiến trình.
// Dữ liệu mỗi phòng ghi ra một tệp JSON trong thư mục dữ liệu (ghi gộp, chậm nhất 1 giây sau thay đổi).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PhongTram } from '../src/tram-claude.js';

function khoTep(duongDan) {
  let du = new Map();
  try { du = new Map(Object.entries(JSON.parse(readFileSync(duongDan, 'utf8')))); } catch {}
  let hen = null;
  const ghi = () => {
    hen = null;
    const tam = `${duongDan}.tam`;
    writeFileSync(tam, JSON.stringify(Object.fromEntries(du)));
    renameSync(tam, duongDan);
  };
  const doi = () => { if (!hen) hen = setTimeout(ghi, 1000); };
  return {
    async get(k) { return du.has(k) ? structuredClone(du.get(k)) : undefined; },
    async put(k, v) { du.set(k, structuredClone(v)); doi(); },
    async delete(k) { const co = du.delete(k); doi(); return co; },
    async list({ prefix = '', reverse = false, limit } = {}) {
      let khoa = [...du.keys()].filter((k) => k.startsWith(prefix)).sort();
      if (reverse) khoa.reverse();
      if (limit) khoa = khoa.slice(0, limit);
      return new Map(khoa.map((k) => [k, structuredClone(du.get(k))]));
    },
    xa() { if (hen) { clearTimeout(hen); ghi(); } },
  };
}

export function moTram(thuMuc) {
  mkdirSync(thuMuc, { recursive: true });
  const cacPhong = new Map();
  const phong = (tc) => {
    if (!cacPhong.has(tc)) {
      const ketNoi = new Set();
      const kho = khoTep(resolve(thuMuc, `${String(tc).replace(/[^\w-]/g, '_')}.json`));
      const p = new PhongTram({
        kho,
        cacKetNoi: (vaiTro) => [...ketNoi].filter((ws) => ws._gan?.vai_tro === vaiTro),
        docGan: (ws) => ws._gan || null,
        ganVao: (ws, d) => { ws._gan = d; },
      });
      p._ketNoi = ketNoi;
      p._kho = kho;
      cacPhong.set(tc, p);
    }
    return cacPhong.get(tc);
  };
  return {
    phong,
    // Gắn một WebSocket (đã bắt tay) vào phòng của tổ chức với vai trò 'nguoi' hoặc 'tram'.
    them(tc, ws, gan) {
      const p = phong(tc);
      ws._gan = gan;
      p._ketNoi.add(ws);
      return p;
    },
    bo(tc, ws) {
      const p = cacPhong.get(tc);
      if (!p) return;
      p._ketNoi.delete(ws);
      return p.dongKetNoi(ws);
    },
    // Tắt máy chủ: ghi dữ liệu còn chờ và đóng mọi WebSocket để server.close() không phải chờ.
    dong() { for (const p of cacPhong.values()) { p._kho.xa(); for (const ws of p._ketNoi) { try { ws.close(1001, 'may chu tat'); } catch {} } } },
    coThuMuc: () => existsSync(thuMuc),
  };
}
