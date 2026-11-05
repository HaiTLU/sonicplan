// Lớp thay D1 trên node:sqlite: cùng giao diện prepare/bind/all/first/run/batch như env.CSDL của Worker.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';

const chuanGiaTri = (v) => (v === undefined ? null : v === true ? 1 : v === false ? 0 : v);
const laDoc = (cau) => /^\s*(SELECT|WITH|PRAGMA)\b/i.test(cau) || /\bRETURNING\b/i.test(cau);
const thuong = (r) => (r ? { ...r } : null);

export function moCsdl(duongDan, { migrations = null } = {}) {
  if (duongDan !== ':memory:') mkdirSync(dirname(duongDan), { recursive: true });
  const db = new DatabaseSync(duongDan);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  // WAL + NORMAL vẫn an toàn trước sự cố ứng dụng; chỉ có thể mất vài giao dịch cuối nếu máy mất điện đột ngột.
  // Bớt một lần fsync cho mỗi lần ghi, bộ nhớ đệm trang lớn hơn (mặc định chỉ ~2 MB), bảng tạm nằm trong RAM.
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = -65536');
  db.exec('PRAGMA temp_store = MEMORY');
  if (migrations) for (const f of readdirSync(migrations).sort()) db.exec(readFileSync(`${migrations}/${f}`, 'utf8'));
  db.exec('PRAGMA foreign_keys = ON');

  // Giữ câu lệnh đã biên dịch để lần sau không phân tích lại SQL (mỗi yêu cầu chạy hàng chục câu giống nhau).
  const dem = new Map();
  const lay = (cau) => {
    let tt = dem.get(cau);
    if (!tt) {
      if (dem.size >= 500) dem.delete(dem.keys().next().value);
      tt = db.prepare(cau);
      dem.set(cau, tt);
    }
    return tt;
  };
  const chay = (cau, ts) => {
    const tt = lay(cau);
    if (laDoc(cau)) return { results: tt.all(...ts).map(thuong), meta: { changes: 0 } };
    const kq = tt.run(...ts);
    return { results: [], meta: { changes: Number(kq.changes), last_row_id: Number(kq.lastInsertRowid) } };
  };

  const cauLenh = (cau, ts = []) => ({
    cau,
    ts,
    bind: (...moi) => cauLenh(cau, moi.map(chuanGiaTri)),
    all: async () => chay(cau, ts),
    first: async (cot) => {
      const r = thuong(lay(cau).get(...ts));
      return cot && r ? r[cot] : r;
    },
    run: async () => chay(cau, ts),
  });

  return {
    db,
    prepare: (cau) => cauLenh(cau),
    // Như D1: cả lô chạy trong một giao dịch, lỗi giữa chừng thì hoàn tác hết.
    batch: async (ds) => {
      db.exec('BEGIN');
      try {
        const ra = ds.map((x) => chay(x.cau, x.ts));
        db.exec('COMMIT');
        return ra;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    dong: () => db.close(),
  };
}
