// Cơ sở dữ liệu thử: lược đồ dựng từ migrations/ trên node:sqlite, bọc thành dạng env.CSDL (D1) tối thiểu.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function dungCsdl() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').sort()) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  db.exec('PRAGMA foreign_keys = OFF');
  return db;
}

const thuong = (r) => (r ? { ...r } : null);

export function d1(db) {
  const cauLenh = (cau, ts = []) => ({
    bind: (...moi) => cauLenh(cau, moi),
    all: async () => ({ results: db.prepare(cau).all(...ts).map(thuong) }),
    first: async () => thuong(db.prepare(cau).get(...ts)),
    run: async () => {
      if (/\bRETURNING\b/i.test(cau)) return { meta: { changes: db.prepare(cau).all(...ts).length } };
      const kq = db.prepare(cau).run(...ts);
      return { meta: { changes: Number(kq.changes), last_row_id: Number(kq.lastInsertRowid) } };
    },
    // Dùng trong batch(): D1 thật trả cả results và meta cho mọi câu lệnh trong batch, không chỉ SELECT.
    _trongBatch: async () => {
      if (/\bRETURNING\b/i.test(cau)) {
        const rows = db.prepare(cau).all(...ts).map(thuong);
        return { results: rows, meta: { changes: rows.length } };
      }
      if (/^\s*select/i.test(cau)) {
        return { results: db.prepare(cau).all(...ts).map(thuong), meta: { changes: 0 } };
      }
      const kq = db.prepare(cau).run(...ts);
      return { results: [], meta: { changes: Number(kq.changes), last_row_id: Number(kq.lastInsertRowid) } };
    },
  });
  return {
    prepare: (cau) => cauLenh(cau),
    // D1 chạy batch như một giao dịch; mỗi câu lệnh trả cả results và meta như D1 thật.
    batch: async (ds) => {
      db.exec('BEGIN');
      try {
        const ra = [];
        for (const x of ds) ra.push(await x._trongBatch());
        db.exec('COMMIT');
        return ra;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

// Kho R2 giả trong bộ nhớ.
export function r2() {
  const kho = new Map();
  return {
    kho,
    put: async (k, v) => { kho.set(k, typeof v === 'string' ? v : String(v)); },
    head: async (k) => (kho.has(k) ? { key: k } : null),
    get: async (k) => (kho.has(k) ? { json: async () => JSON.parse(kho.get(k)), text: async () => kho.get(k) } : null),
    delete: async (k) => { for (const x of [].concat(k)) kho.delete(x); },
    list: async ({ prefix = '' } = {}) => ({ objects: [...kho.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  };
}
