// Lớp thay env.ASSETS: phục vụ thư mục public/. Đường dẫn không có đuôi tệp thì trả index.html (ứng dụng một trang).
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const KIEU = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

// Tiêu đề bảo mật: Cloudflare đọc public/_headers khi phát trang, máy chủ Node phải tự thêm cùng bộ đó (gồm cả Content-Security-Policy).
const TIEU_DE_AN_TOAN = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security', 'cross-origin-opener-policy'];
export function docTieuDeAnToan(noiDung) {
  const ra = {};
  let trongKhoiChung = false;
  for (const dong of String(noiDung).split('\n')) {
    if (/^\S/.test(dong) && !dong.startsWith('#')) trongKhoiChung = dong.trim() === '/*';
    else if (trongKhoiChung) {
      const m = dong.match(/^\s+([\w-]+):\s*(.+)$/);
      if (m && TIEU_DE_AN_TOAN.includes(m[1].toLowerCase())) ra[m[1].toLowerCase()] = m[2].trim();
    }
  }
  return ra;
}

export function moTinh(thuMuc) {
  const goc = resolve(thuMuc);
  let tieuDe = {};
  try { tieuDe = docTieuDeAnToan(readFileSync(resolve(goc, '_headers'), 'utf8')); } catch { /* không có _headers thì thôi */ }
  const docTep = async (d) => {
    try {
      if (!(await stat(d)).isFile()) return null;
      return await readFile(d);
    } catch {
      return null;
    }
  };
  return {
    fetch: async (yeuCau) => {
      let ten;
      try {
        ten = decodeURIComponent(new URL(yeuCau.url).pathname);
      } catch {
        return new Response('Địa chỉ không hợp lệ', { status: 400 });
      }
      if (ten.endsWith('/')) ten += 'index.html';
      const d = resolve(goc, `.${ten}`);
      if (d !== goc && !d.startsWith(goc + sep)) return new Response('Không tìm thấy', { status: 404 });
      let noiDung = await docTep(d);
      let duoi = extname(d);
      if (!noiDung && !duoi) {
        noiDung = await docTep(resolve(goc, 'index.html'));
        duoi = '.html';
      }
      if (!noiDung) return new Response('Không tìm thấy', { status: 404 });
      return new Response(yeuCau.method === 'HEAD' ? null : noiDung, { headers: { 'content-type': KIEU[duoi] || 'application/octet-stream', ...tieuDe } });
    },
  };
}
