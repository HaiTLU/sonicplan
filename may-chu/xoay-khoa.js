// Xoay khóa mã hóa: mã hóa lại mọi giá trị "v1." trong cai_dat bằng khóa mới.
// Cách dùng (dừng máy chủ trước, sao lưu cơ sở dữ liệu trước):
//   KHOA_MA_HOA_CU=<khóa cũ> KHOA_MA_HOA=<khóa mới> DB_FILE=<đường dẫn> node may-chu/xoay-khoa.js
// Khóa là 32 byte viết dạng base64. Xong thì đặt KHOA_MA_HOA mới vào may-chu/.env và gỡ KHOA_MA_HOA_CU.
import { DatabaseSync } from 'node:sqlite';
import { giaiMa, maHoa } from '../src/ma-hoa.js';

export async function xoayKhoa(db, khoaCu, khoaMoi) {
  const dong = db.prepare("SELECT to_chuc_id, khoa, gia_tri FROM cai_dat WHERE gia_tri LIKE 'v1.%'").all();
  const moi = [];
  for (const d of dong) {
    // Giải mã hết trước khi ghi: một giá trị hỏng thì dừng, chưa đổi gì.
    let duLieu;
    try { duLieu = await giaiMa(d.gia_tri, khoaCu); } catch (e) { throw new Error(`Không giải mã được ${d.to_chuc_id || '(hệ thống)'}/${d.khoa} bằng khóa cũ: ${e.message}`); }
    moi.push({ ...d, gia_tri: await maHoa(duLieu, khoaMoi) });
  }
  db.exec('BEGIN');
  try {
    const cau = db.prepare('UPDATE cai_dat SET gia_tri = ?1 WHERE to_chuc_id = ?2 AND khoa = ?3');
    for (const d of moi) cau.run(d.gia_tri, d.to_chuc_id, d.khoa);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return moi.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { KHOA_MA_HOA_CU: cu, KHOA_MA_HOA: moi, DB_FILE: tep } = process.env;
  if (!cu || !moi || !tep) { console.error('Thiếu KHOA_MA_HOA_CU, KHOA_MA_HOA hoặc DB_FILE.'); process.exit(1); }
  if (cu === moi) { console.error('Khóa mới trùng khóa cũ.'); process.exit(1); }
  const db = new DatabaseSync(tep);
  console.log(`Đã mã hóa lại ${await xoayKhoa(db, cu, moi)} giá trị bằng khóa mới.`);
}
