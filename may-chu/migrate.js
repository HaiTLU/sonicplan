// Áp các tệp trong migrations/ lên SQLite của máy chủ riêng, mỗi tệp đúng một lần (ghi tên vào bảng _migrations).
// Lần đầu trên cơ sở dữ liệu nạp từ D1 (đã có sẵn mọi cột hiện tại): chạy `node may-chu/migrate.js --co-san` MỘT LẦN
// để đánh dấu các tệp hiện có là đã áp. Chưa đánh dấu mà có dữ liệu thì dừng, không chạy lại migration cũ.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function chayMigration(db, thuMuc, { coSan = false } = {}) {
  const tep = readdirSync(thuMuc).filter((f) => f.endsWith('.sql')).sort();
  const coBang = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'").get();
  const coDuLieu = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'to_chuc'").get();
  if (!coBang && coDuLieu && !coSan) throw new Error('Cơ sở dữ liệu đã có bảng nhưng chưa đánh dấu migration. Chạy một lần: node may-chu/migrate.js --co-san');
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (ten TEXT PRIMARY KEY, luc TEXT NOT NULL)');
  const luu = db.prepare('INSERT OR IGNORE INTO _migrations (ten, luc) VALUES (?, ?)');
  if (coSan) {
    for (const f of tep) luu.run(f, new Date().toISOString());
    return { da_ap: [], danh_dau: tep };
  }
  const daAp = new Set(db.prepare('SELECT ten FROM _migrations').all().map((r) => r.ten));
  const moi = [];
  for (const f of tep) {
    if (daAp.has(f)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(resolve(thuMuc, f), 'utf8'));
      luu.run(f, new Date().toISOString());
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${f} lỗi: ${e.message}`);
    }
    moi.push(f);
  }
  return { da_ap: moi, danh_dau: [] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const duongDan = process.env.DB_FILE || resolve(GOC, process.env.DU_LIEU || 'du-lieu', 'sonicplan.sqlite');
  const db = new DatabaseSync(duongDan);
  db.exec('PRAGMA busy_timeout = 5000');
  const kq = chayMigration(db, resolve(GOC, 'migrations'), { coSan: process.argv.includes('--co-san') });
  db.close();
  console.log(kq.danh_dau.length ? `Đã đánh dấu ${kq.danh_dau.length} migration là đã áp.` : kq.da_ap.length ? `Đã áp: ${kq.da_ap.join(', ')}` : 'Không có migration mới.');
}
