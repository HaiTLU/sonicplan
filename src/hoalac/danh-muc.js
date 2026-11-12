// Khu "Dự án": mỗi dự án là một tổ chức phạm vi 'hoalac'. Danh mục dựng ở máy chủ từ đúng các dự án
// người dùng là thành viên (phien.cac_to_chuc), không nhận danh sách do trình duyệt gửi lên.
// Thẻ mỗi dự án: % tiến độ, mốc tới, việc quá hạn, rủi ro cao, màu xanh/vàng/đỏ. Đối tác chỉ thấy
// tên dự án, vì số liệu tổng gồm cả hạng mục không gán cho họ.
import { json, loi, docThan } from '../tien-ich.js';
import { quenThanhVien } from '../phien.js';

export const LOAI_DU_AN = ['xay_dung', 'nghien_cuu'];
const DIEM_RUI_RO_CAO = 15;

const homNayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

// Màu thẻ: đỏ khi có việc quá hạn nằm trên đường găng, hoặc từ 3 rủi ro cao; vàng khi có quá hạn
// hoặc rủi ro cao; còn lại xanh.
export function mauThe({ qua_han, qua_han_gang, rui_ro_cao }) {
  if (qua_han_gang > 0 || rui_ro_cao >= 3) return 'do';
  if (qua_han > 0 || rui_ro_cao > 0) return 'vang';
  return 'xanh';
}

async function theDuAn(env, tc, homNay) {
  const [tienDo, quaHan, ruiRo, moc] = await Promise.all([
    // Tiến độ chung: bình quân tien_do_pt theo số ngày, chỉ tính hạng mục lá (không làm nhóm cho hạng mục khác).
    env.CSDL.prepare(
      `SELECT SUM(h.tien_do_pt * h.thoi_gian_ngay) AS tu, SUM(h.thoi_gian_ngay) AS mau FROM qlda_hang_muc h
       WHERE h.to_chuc_id = ?1 AND NOT EXISTS (SELECT 1 FROM qlda_hang_muc c WHERE c.to_chuc_id = ?1 AND c.nhom_id = h.id)`,
    ).bind(tc).first(),
    env.CSDL.prepare(
      `SELECT COUNT(*) AS so, SUM(tren_duong_gang) AS gang FROM qlda_hang_muc
       WHERE to_chuc_id = ?1 AND trang_thai <> 'xong' AND ngay_ket_thuc IS NOT NULL AND ngay_ket_thuc < ?2`,
    ).bind(tc, homNay).first(),
    env.CSDL.prepare(
      `SELECT COUNT(*) AS so FROM qlda_rui_ro WHERE to_chuc_id = ?1 AND trang_thai <> 'da_dong' AND xac_suat * tac_dong >= ?2`,
    ).bind(tc, DIEM_RUI_RO_CAO).first(),
    env.CSDL.prepare(
      `SELECT ten, ngay_ket_thuc AS ngay FROM qlda_hang_muc
       WHERE to_chuc_id = ?1 AND la_moc = 1 AND trang_thai <> 'xong' AND ngay_ket_thuc >= ?2
       UNION ALL
       SELECT ten, han AS ngay FROM qlda_san_pham_ban_giao
       WHERE to_chuc_id = ?1 AND trang_thai NOT IN ('da_giao', 'da_duyet') AND han >= ?2
       ORDER BY ngay LIMIT 3`,
    ).bind(tc, homNay).all(),
  ]);
  const so = {
    tien_do_pt: tienDo?.mau ? Math.round(tienDo.tu / tienDo.mau) : 0,
    qua_han: quaHan?.so || 0,
    qua_han_gang: quaHan?.gang || 0,
    rui_ro_cao: ruiRo?.so || 0,
    moc_toi: moc.results,
  };
  return { ...so, mau: mauThe(so) };
}

export async function xuLyDanhMuc(yeuCau, env, phien, p, m) {
  if (p !== '/api/hoalac/danh-muc') return null;

  if (m === 'GET') {
    const ids = (phien.cac_to_chuc || []).filter((t) => t.pham_vi_truy_cap === 'hoalac');
    if (!ids.length) return json({ du_an: [] });
    const { results: thongTin } = await env.CSDL.prepare(
      `SELECT id, ten, loai_du_an, phan_bat FROM to_chuc WHERE id IN (${ids.map((_, i) => `?${i + 1}`).join(',')})`,
    ).bind(...ids.map((t) => t.id)).all();
    const homNay = homNayVN();
    const duAn = [];
    for (const t of ids) {
      const tt = thongTin.find((x) => x.id === t.id);
      if (!tt) continue;
      const the = { id: t.id, ten: tt.ten, loai_du_an: tt.loai_du_an, phan_bat: tt.phan_bat, vai_tro: t.vai_tro };
      duAn.push(t.vai_tro === 'doi_tac' ? the : { ...the, ...(await theDuAn(env, t.id, homNay)) });
    }
    return json({ du_an: duAn });
  }

  if (m === 'POST') {
    // Chỉ chủ của dự án đang mở được tạo dự án mới; người tạo thành chủ của dự án mới.
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ dự án được tạo dự án mới.');
    const than = await docThan(yeuCau);
    const ten = String(than.ten || '').trim();
    if (!ten) return loi(400, 'Thiếu tên dự án.');
    const loai = than.loai_du_an || 'xay_dung';
    if (!LOAI_DU_AN.includes(loai)) return loi(400, 'Loại dự án chỉ nhận xay_dung hoặc nghien_cuu.');
    const id = `tc_${crypto.randomUUID()}`;
    const bayGio = new Date().toISOString();
    await env.CSDL.batch([
      env.CSDL.prepare(
        `INSERT INTO to_chuc (id, ten, pham_vi_truy_cap, loai_du_an, phan_bat, tao_luc) VALUES (?1, ?2, 'hoalac', ?3, ?4, ?5)`,
      ).bind(id, ten, loai, String(than.phan_bat || ''), bayGio),
      env.CSDL.prepare(
        `INSERT INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc) VALUES (?1, ?2, 'chu', ?3)`,
      ).bind(id, phien.nguoi_dung.id, bayGio),
    ]);
    quenThanhVien(phien.email);
    return json({ id }, 201);
  }
  return null;
}
