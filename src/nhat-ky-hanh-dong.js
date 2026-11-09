// Nhật ký hành động: ghi lựa chọn của người dùng để rút kinh nghiệm (xem src/rut-kinh-nghiem.js).
// Ghi lỗi không bao giờ làm hỏng thao tác chính của người dùng: mọi hàm ghi nuốt lỗi.

export const NGUON_HANH_DONG = ['telegram', 'web', 'he_thong'];
const TOI_DA_CHU = 200;

const cat = (v) => (v == null || v === '' ? null : String(v).slice(0, TOI_DA_CHU));

// Bối cảnh ngắn của việc: chỉ mã và nhãn, không có tiêu đề hay nội dung tin gốc.
export async function boiCanhViec(env, tc, viecId, bayGio = new Date().toISOString()) {
  if (!viecId) return null;
  const v = await env.CSDL.prepare('SELECT nguon, du_an_id, nhom, uu_tien, tao_luc, han_ngay, so_lan_doi FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(viecId, tc).first();
  if (!v) return null;
  const gio = new Date(Date.parse(bayGio) + 7 * 3600000); // giờ Việt Nam
  return {
    nguon_viec: v.nguon || 'tay', du_an_id: v.du_an_id ?? null, nhom: v.nhom ?? null, uu_tien: v.uu_tien ?? null,
    gio: gio.getUTCHours(), thu: gio.getUTCDay(), so_lan_doi: v.so_lan_doi || 0,
    tuoi_gio: v.tao_luc ? Math.max(0, Math.round((Date.parse(bayGio) - Date.parse(v.tao_luc)) / 3600000)) : null,
  };
}

// nguon: telegram | web | he_thong. truoc/sau: giá trị trước và sau (ngày, nhóm, trạng thái...).
export async function ghiHanhDong(env, tc, { nguon, loai, viecId = null, truoc = null, sau = null, boiCanh, lyDo = null, luc = new Date().toISOString() }) {
  try {
    if (!NGUON_HANH_DONG.includes(nguon) || !loai) return false;
    const bc = boiCanh === undefined ? await boiCanhViec(env, tc, viecId, luc) : boiCanh;
    await env.CSDL.prepare(
      'INSERT INTO nhat_ky_hanh_dong (to_chuc_id, nguon, loai, viec_id, truoc, sau, boi_canh, ly_do, luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
    ).bind(tc, nguon, String(loai).slice(0, 40), viecId, cat(truoc), cat(sau), bc ? JSON.stringify(bc) : null, cat(lyDo), luc).run();
    return true;
  } catch (e) {
    console.error('Ghi nhật ký hành động lỗi', e);
    return false;
  }
}

// Đọc các hành động trong khoảng [tu, den) của một tổ chức, mới nhất trước. boi_canh đã giải mã.
export async function docHanhDong(env, tc, tu, den = '9999', toiDa = 5000) {
  const { results } = await env.CSDL.prepare(
    'SELECT id, nguon, loai, viec_id, truoc, sau, boi_canh, ly_do, luc FROM nhat_ky_hanh_dong WHERE to_chuc_id = ?1 AND luc >= ?2 AND luc < ?3 ORDER BY id DESC LIMIT ?4',
  ).bind(tc, tu, den, toiDa).all();
  return results.map((r) => { let bc = null; try { bc = r.boi_canh ? JSON.parse(r.boi_canh) : null; } catch { /* bỏ qua */ } return { ...r, boi_canh: bc }; });
}
