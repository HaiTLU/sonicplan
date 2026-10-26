// Nhập dữ liệu khởi tạo cho qlda_thu_tuc (Viện Hòa Lạc, PR4) từ tệp kế hoạch dự án gốc (mảng T trong
// 261026_VienNghienCuu_KeHoachDuAn.html). Chỉ sinh ra tệp .sql để PM soát trước, không tự áp vào D1
// (production hay cục bộ) - đúng kế hoạch mục 6. Chạy: node scripts/nhap-hoalac.mjs --nguon <duong-dan-html>
// --to-chuc <id> --boi <email> [--ra out-hoalac.sql].
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';

// Cắt mảng const T=[...] khỏi tệp HTML gốc và nạp bằng vm (không phải JSON hợp lệ: khóa không có
// ngoặc kép, dùng nháy đơn) - tệp nguồn do PM cung cấp, không phải dữ liệu từ người lạ.
export function doucThuTuc(html) {
  const dauVao = 'const T=[';
  const i = html.indexOf(dauVao);
  if (i < 0) throw new Error('Không tìm thấy mảng T trong tệp nguồn.');
  const j = html.indexOf('\nconst DIFF=[', i);
  if (j < 0) throw new Error('Không tìm thấy điểm kết thúc mảng T (mốc const DIFF=[).');
  const chuoiMang = html.slice(i + 'const T='.length, j).replace(/;\s*$/, '');
  const ds = vm.runInNewContext(`(${chuoiMang})`, {});
  if (!Array.isArray(ds) || !ds.length) throw new Error('Mảng T rỗng hoặc sai dạng.');
  return ds;
}

const nhomHopLe = ['A', 'B', 'C', 'D', 'E'];

export function kiemThuTuc(ds) {
  const loi = [];
  const biet = new Set(ds.map((t) => t.id));
  for (const t of ds) {
    if (!t.id || !t.g || !t.name) loi.push(`Thiếu id/g/name: ${JSON.stringify(t)}`);
    if (!nhomHopLe.includes(t.g)) loi.push(`Nhóm không hợp lệ ở ${t.id}: ${t.g}`);
    for (const truoc of t.after || []) if (!biet.has(truoc)) loi.push(`${t.id} phụ thuộc ${truoc} nhưng ${truoc} không có trong mảng T.`);
  }
  return loi;
}

const sql = (s) => (s == null || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const vanBan = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`;

// toChuc, boi, luc do người gọi cung cấp (không tự đặt tên tổ chức hay người tạo).
export function sinhSql(ds, { toChuc, boi, luc }) {
  const dong = [`-- Sinh bởi scripts/nhap-hoalac.mjs lúc ${luc}. Soát kỹ trước khi áp (wrangler d1 execute --file=...).`];
  for (const t of ds) {
    dong.push(
      `INSERT INTO qlda_thu_tuc (to_chuc_id, ma_nguon, nhom, ten, don_vi_phu_trach, nguon, can_cu, diem_chua_ro, so_ngay, la_moc, ngay_co_dinh, tao_boi, tao_luc, cap_nhat_luc) VALUES `
      + `(${sql(toChuc)}, ${vanBan(t.id)}, ${vanBan(t.g)}, ${vanBan(t.name)}, ${vanBan(t.owner)}, ${vanBan(t.src)}, ${vanBan(t.basis)}, ${vanBan(t.unclear)}, `
      + `${t.dur ?? 'NULL'}, ${t.ms ? 1 : 0}, ${sql(t.fix)}, ${sql(boi)}, ${sql(luc)}, ${sql(luc)});`,
    );
  }
  for (const t of ds) {
    for (const truoc of t.after || []) {
      dong.push(
        `INSERT INTO qlda_thu_tuc_phu_thuoc (to_chuc_id, truoc_id, sau_id) SELECT ${sql(toChuc)}, `
        + `(SELECT id FROM qlda_thu_tuc WHERE to_chuc_id = ${sql(toChuc)} AND ma_nguon = ${vanBan(truoc)}), `
        + `(SELECT id FROM qlda_thu_tuc WHERE to_chuc_id = ${sql(toChuc)} AND ma_nguon = ${vanBan(t.id)});`,
      );
    }
  }
  return dong.join('\n') + '\n';
}

// Áp thử vào một CSDL node:sqlite tạm (đã có migrations) để chắc out.sql không lỗi cú pháp/ràng buộc
// trước khi đưa PM; không đụng tới D1 thật hay tệp CSDL cục bộ của máy chủ.
async function tuKiem(sqlText, toChuc) {
  const { dungCsdl } = await import('../test/csdl-thu.js');
  const db = dungCsdl();
  db.exec(`INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, tao_luc) VALUES (${sql(toChuc)}, 'Tự kiểm nhập liệu', 'hoalac', '2026-01-01')`);
  db.exec(sqlText);
  const soThuTuc = db.prepare('SELECT COUNT(*) AS n FROM qlda_thu_tuc WHERE to_chuc_id = ?').get(toChuc).n;
  const soPhuThuoc = db.prepare('SELECT COUNT(*) AS n FROM qlda_thu_tuc_phu_thuoc WHERE to_chuc_id = ?').get(toChuc).n;
  const theoNhom = db.prepare('SELECT nhom, COUNT(*) AS n FROM qlda_thu_tuc WHERE to_chuc_id = ? GROUP BY nhom ORDER BY nhom').all(toChuc);
  return { soThuTuc, soPhuThuoc, theoNhom };
}

async function main() {
  const doi = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) doi[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!doi['to-chuc']) throw new Error('Thiếu --to-chuc <id tổ chức>.');
  if (!doi.boi) throw new Error('Thiếu --boi <email người chạy nhập liệu>.');
  if (!doi.nguon) throw new Error('Thiếu --nguon <đường dẫn tệp HTML kế hoạch dự án gốc>.');
  const ra = doi.ra || 'out-hoalac.sql';

  const html = readFileSync(doi.nguon, 'utf8');
  const ds = doucThuTuc(html);
  const loi = kiemThuTuc(ds);
  if (loi.length) { console.error('Dữ liệu nguồn có lỗi, chưa sinh SQL:\n' + loi.join('\n')); process.exitCode = 1; return; }

  const luc = new Date().toISOString();
  const sqlText = sinhSql(ds, { toChuc: doi['to-chuc'], boi: doi.boi, luc });
  const kq = await tuKiem(sqlText, doi['to-chuc']);
  writeFileSync(ra, sqlText, 'utf8');
  console.log(`Đã sinh ${ra}: ${kq.soThuTuc} thủ tục, ${kq.soPhuThuoc} phụ thuộc, theo nhóm: ${kq.theoNhom.map((r) => `${r.nhom}=${r.n}`).join(', ')}.`);
  console.log('Tệp này CHƯA áp vào D1 nào (production hay cục bộ) - soát lại rồi tự áp bằng wrangler d1 execute.');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
