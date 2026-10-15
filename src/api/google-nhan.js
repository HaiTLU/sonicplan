// API giao diện: Nhãn Gmail (cấu hình và xem trước).
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { LOAI_NHAN, chuanCauHinh, ganNhan } from '../google-nhan.js';
import { docCaiDat, ghiCaiDat } from '../hop-tin.js';
import { json, ngayVN } from '../tien-ich.js';

// ---- Nhãn Google ----

// Xem trước: lấy vài việc thật (việc mở gần hạn, một việc đã xong) và cho thấy tiêu đề, ghi chú sẽ ra sao bên Google.
async function xemTruocNhan(env, tc, ch) {
  const cot = `SELECT v.tieu_de, v.ghi_chu, v.han_ngay, v.trang_thai, v.nguon, t.nguon AS tin_nguon, t.nguoi_gui AS tin_nguoi_gui, t.nhom AS tin_nhom,
      d.ten AS du_an_ten, COALESCE(v.mau, d.mau) AS mau FROM viec v LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id LEFT JOIN du_an d ON d.id = v.du_an_id`;
  const mo = (await env.CSDL.prepare(`${cot} WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'mo' ORDER BY v.han_ngay IS NULL, v.han_ngay LIMIT 3`).bind(tc).all()).results;
  const xong = (await env.CSDL.prepare(`${cot} WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'xong' ORDER BY v.xong_luc DESC LIMIT 1`).bind(tc).all()).results;
  const hn = ngayVN();
  return { mau: [...mo, ...xong].map((v) => ({ goc: v.tieu_de, trang_thai: v.trang_thai, ...ganNhan(v, ch, hn) })) };
}

export async function xuLyGoogleNhan(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;

  if (p === '/api/google-nhan' && m === 'GET') return json({ cau_hinh: chuanCauHinh(await docCaiDat(env, tc, 'google_nhan')), loai: LOAI_NHAN });
  if (p === '/api/google-nhan' && m === 'PUT') {
    const ch = chuanCauHinh((await yeuCau.json().catch(() => ({}))).cau_hinh);
    await ghiCaiDat(env, tc, 'google_nhan', JSON.stringify(ch));
    return json({ cau_hinh: ch });
  }
  if (p === '/api/google-nhan/xem-truoc' && m === 'POST') return json(await xemTruocNhan(env, tc, chuanCauHinh((await yeuCau.json().catch(() => ({}))).cau_hinh)));

  return null;
}
