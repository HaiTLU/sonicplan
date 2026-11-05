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
  // Trả { etag, doc } mà chưa đọc nội dung: nếu trình duyệt đã có bản y hệt (If-None-Match khớp ETag
  // từ kích thước + thời điểm sửa) thì trả 304, khỏi đọc đĩa và khỏi gửi lại cả trăm KB mã và kiểu dáng.
  const moTep = async (d) => {
    try {
      const tt = await stat(d);
      if (!tt.isFile()) return null;
      return { etag: `W/"${tt.size.toString(16)}-${Math.floor(tt.mtimeMs).toString(16)}"`, doc: () => readFile(d) };
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
      let tep = await moTep(d);
      let duoi = extname(d);
      if (!tep && !duoi) {
        tep = await moTep(resolve(goc, 'index.html'));
        duoi = '.html';
      }
      if (!tep) return new Response('Không tìm thấy', { status: 404 });
      const dau = { 'content-type': KIEU[duoi] || 'application/octet-stream', etag: tep.etag, ...tieuDe };
      // Phông và ảnh ít đổi: giữ trong trình duyệt. Mã, kiểu dáng, trang: src/index.js đặt no-cache (luôn hỏi lại, nay trả 304 nhanh).
      if (/^\.(woff2?|ttf|png|jpe?g|webp|ico|svg)$/.test(duoi)) dau['cache-control'] = duoi.startsWith('.woff') ? 'public, max-age=2592000' : 'public, max-age=86400';
      const chuaDoi = (yeuCau.headers.get('if-none-match') || '').split(',').some((e) => e.trim() === tep.etag);
      if (chuaDoi) return new Response(null, { status: 304, headers: dau });
      return new Response(yeuCau.method === 'HEAD' ? null : await tep.doc(), { headers: dau });
    },
  };
}
