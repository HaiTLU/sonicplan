import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const GOC_CHO_PHEP = ['memory/projects', 'memory/context/bai-hoc'];
const MAX_TEP = 300;
const MAX_BYTES = 128 * 1024;
const MAX_TONG = 4 * 1024 * 1024;

// Bộ đọc không nhận đường dẫn từ request, không ghi kho, không gọi AI.
// Route gọi doc phải kiểm tra quyền chủ tổ chức trước khi trả dữ liệu.
export function moSecondBrain({ thuMuc, toChucId, lamMoiMs = 60_000 } = {}) {
  let cache = null;
  let thuLuc = 0;
  let dangDoc = null;
  let ketQua = null;
  const hopLe = typeof thuMuc === 'string' && thuMuc.trim()
    && typeof toChucId === 'string' && toChucId.trim();

  async function quet() {
    const docLuc = new Date().toISOString();
    try {
      const goc = await fs.realpath(thuMuc);
      const ds = [];
      let tong = 0;
      let daXet = 0;
      // Kiểm từng thành phần, không theo cả symlink trỏ vào trong kho.
      async function duongDanAnToan(tuongDoi) {
        let hienTai = goc;
        for (const phan of tuongDoi.split('/')) {
          hienTai = path.join(hienTai, phan);
          if ((await fs.lstat(hienTai)).isSymbolicLink()) throw new Error('symlink');
        }
        const that = await fs.realpath(hienTai);
        if (!that.startsWith(goc + path.sep)) throw new Error('outside');
        return that;
      }
      async function duyet(tuongDoi, sau = 0) {
        if (sau > 8 || ds.length >= MAX_TEP || tong >= MAX_TONG || daXet >= 2000) return;
        const ten = await duongDanAnToan(tuongDoi);
        const muc = (await fs.readdir(ten, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of muc) {
          if (++daXet > 2000 || ds.length >= MAX_TEP || tong >= MAX_TONG) break;
          if (entry.isSymbolicLink()) continue;
          const rel = `${tuongDoi}/${entry.name}`;
          if (entry.isDirectory()) { await duyet(rel, sau + 1); continue; }
          if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
          const file = await duongDanAnToan(rel);
          const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
          try {
            const stat = await handle.stat();
            // O_NOFOLLOW chỉ bảo vệ thành phần cuối. Kiểm lại sau open,
            // so inode để bắt việc tráo thư mục bằng symlink giữa check/open.
            const kiemLai = await duongDanAnToan(rel);
            const statHienTai = await fs.stat(kiemLai);
            if (kiemLai !== file || stat.dev !== statHienTai.dev || stat.ino !== statHienTai.ino) throw new Error('changed');
            if (!stat.isFile() || stat.size > MAX_BYTES || tong + stat.size > MAX_TONG) continue;
            // Read with a bound even if a file grows after stat.
            const buf = Buffer.alloc(MAX_BYTES + 1);
            const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
            if (bytesRead > MAX_BYTES) continue;
            const noiDung = buf.subarray(0, bytesRead).toString('utf8');
            tong += bytesRead;
            ds.push({ duong_dan: rel, tieu_de: noiDung.match(/^#\s+(.+)$/m)?.[1]?.trim() || entry.name.replace(/\.md$/i, ''), noi_dung: noiDung, phien_ban: createHash('sha256').update(buf.subarray(0, bytesRead)).digest('hex'), cap_nhat_luc: stat.mtime.toISOString(), doc_luc: docLuc });
          } finally { await handle.close(); }
        }
      }
      for (const rel of GOC_CHO_PHEP) await duyet(rel);
      ds.sort((a, b) => b.cap_nhat_luc.localeCompare(a.cap_nhat_luc));
      cache = { trang_thai: 'ok', doc_luc: docLuc, ds };
      ketQua = cache;
    } catch {
      ketQua = { trang_thai: 'stale', doc_luc: cache?.doc_luc || null, ds: cache?.ds || [], loi: 'Không đọc được nguồn second-brain. Dữ liệu giữ ở lần đọc thành công gần nhất.' };
    }
    return ketQua;
  }

  return {
    async doc(tc) {
      if (!hopLe || String(tc) !== toChucId) return { trang_thai: 'unconfigured', doc_luc: null, ds: [] };
      if (dangDoc) return structuredClone(await dangDoc);
      if (ketQua && Date.now() - thuLuc < lamMoiMs) return structuredClone(ketQua);
      thuLuc = Date.now();
      dangDoc = quet();
      try { return structuredClone(await dangDoc); } finally { dangDoc = null; }
    },
  };
}
