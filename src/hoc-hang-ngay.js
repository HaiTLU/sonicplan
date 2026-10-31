import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { deXuatLoiDan } from './loi-dan-tuan.js';
import { ngayVN } from './tien-ich.js';
import { docLuong } from './luong.js';

export async function trangThaiHoc(env, tc, bayGio = new Date().toISOString()) {
  const den = Date.parse(bayGio);
  async function ky(tu, toi) {
    const r = await env.CSDL.prepare(
      `SELECT COUNT(*) AS so_viec, COALESCE(SUM(CASE WHEN EXISTS (
         SELECT 1 FROM viec_su_kien e WHERE e.to_chuc_id=v.to_chuc_id AND e.viec_id=v.id
         AND e.loai IN ('huy','sua_ten','doi_du_an','doi_nhom','sua_han')
         AND COALESCE(e.noi_dung,'') NOT LIKE 'Gỡ vì%' AND e.luc < ?3
       ) THEN 1 ELSE 0 END),0) AS da_sua
       FROM viec v WHERE v.to_chuc_id=?1 AND COALESCE(v.nguon,'tay')<>'tay'
         AND v.tao_luc>=?2 AND v.tao_luc<?3`,
    ).bind(tc, new Date(tu).toISOString(), new Date(toi).toISOString()).first();
    return { tu: new Date(tu).toISOString(), den: new Date(toi).toISOString(), ...r };
  }
  const ngay = 86400000;
  const gan = await ky(den - 7 * ngay, den);
  const truoc = await ky(den - 14 * ngay, den - 7 * ngay);
  const tra = await env.CSDL.prepare(`SELECT COUNT(*) AS n FROM cau_hoi_ai WHERE to_chuc_id=?1 AND trang_thai='xong' AND tra_loi_luc>=?2 AND tra_loi_luc<?3`)
    .bind(tc, new Date(den - 7 * ngay).toISOString(), bayGio).first();
  let lanCuoi = null;
  try { lanCuoi = JSON.parse(await docCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi')); } catch { /* chưa chạy */ }
  return { bat: (await docLuong(env, tc)).bat['hoc-hang-ngay'], lan_cuoi: lanCuoi, gan, truoc, so_tra_loi: tra.n,
    luu_y: 'Đây là số việc AI tạo đã bị sửa hoặc hủy trong từng kỳ, không phải tỷ lệ chính xác. Việc chưa sửa có thể chưa được xem; hai kỳ chưa chứng minh tác dụng của bài học.' };
}

// Khóa có hạn để cron chạy lại không gọi AI trùng; lỗi thì lần sau thử lại.
export async function hocHangNgay(env, tc, bayGio = new Date().toISOString(), deXuat = deXuatLoiDan) {
  const ngay = ngayVN(bayGio);
  let cu = null;
  try { cu = JSON.parse(await docCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi')); } catch { /* chưa có */ }
  if (cu?.ngay === ngay) return { bo_qua: true };
  const khoa = 'hoc_hang_ngay_khoa';
  const hetHan = new Date(Date.parse(bayGio) - 20 * 60000).toISOString();
  const k = await env.CSDL.prepare(
    `INSERT INTO cai_dat (to_chuc_id,khoa,gia_tri) VALUES (?1,?2,?3)
     ON CONFLICT(to_chuc_id,khoa) DO UPDATE SET gia_tri=excluded.gia_tri WHERE cai_dat.gia_tri < ?4`,
  ).bind(tc, khoa, bayGio, hetHan).run();
  if (!k.meta.changes) return { bo_qua: true };
  try {
    const moi = await docCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi');
    if (moi && JSON.parse(moi).ngay === ngay) return { bo_qua: true };
    const ds = await deXuat(env, tc, bayGio);
    const thongKe = await trangThaiHoc(env, tc, bayGio);
    const ketQua = { ngay, luc: bayGio, cho_duyet: ds.length, so_tra_loi: thongKe.so_tra_loi };
    await ghiCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi', JSON.stringify(ketQua));
    return ketQua;
  } finally {
    await env.CSDL.prepare('DELETE FROM cai_dat WHERE to_chuc_id=?1 AND khoa=?2 AND gia_tri=?3').bind(tc, khoa, bayGio).run();
  }
}
