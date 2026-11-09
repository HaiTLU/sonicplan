// Rút kinh nghiệm từ nhật ký hành động (migration 0049): tìm thói quen lặp của người dùng.
// Hàm phân tích là hàm thuần. Ứng viên lời dặn chỉ là ĐỀ XUẤT: đi qua rào chắn (rao-chan-hoc.js) và chờ người duyệt.

import { docHanhDong, ghiHanhDong } from './nhat-ky-hanh-dong.js';
import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { ngayVN } from './tien-ich.js';

export const KY_XET_NGAY = 14; // xét hành động trong ngần này ngày
export const MAU_TOI_THIEU = 5; // ít hơn thế thì chưa đủ để gọi là thói quen
export const TY_LE_TOI_THIEU = 0.5; // thói quen chiếm ít nhất nửa số kết cục của nhóm việc
export const NGAY_IM_LANG = 7; // việc AI tạo, mở, không ai đụng tới ngần này ngày
const KHOA_BAT_DAU = 'rut_kinh_nghiem_bat_dau';
export const KHOA_THOI_QUEN = 'thoi_quen';

const LOAI_DOI = ['nut_doi_mai', 'nut_doi_tuan', 'web_sua_han'];
const LOAI_BO = ['nut_bo', 'web_huy'];
const LOAI_XONG = ['nut_xong', 'web_xong'];
const LOAI_IM_LANG = ['im_lang'];
const KET_CUC = [...LOAI_DOI, ...LOAI_BO, ...LOAI_XONG, ...LOAI_IM_LANG];

const NHAN_NGUON = { zalo: 'tin Zalo', gmail: 'tin Gmail' };
const TEN_NGUON = { zalo: 'Zalo', gmail: 'Gmail', tay: 'tự nhập' };

// Nhóm theo nguồn của việc. Kết cục = một trong các hành động trên; mẫu = loại kết cục chiếm đủ tỷ lệ.
export function phanTichThoiQuen(hanhDong, { mauToiThieu = MAU_TOI_THIEU, tyLe = TY_LE_TOI_THIEU } = {}) {
  // Mỗi việc chỉ tính một kết cục (hành động mới nhất của việc đó), để "6/8 việc" đúng là số việc: một việc bị dời 5 lần không thành thói quen.
  const moiViec = new Map();
  const khongViec = [];
  for (const h of hanhDong) {
    if (!KET_CUC.includes(h.loai)) continue;
    if (h.viec_id == null) { khongViec.push(h); continue; }
    const c = moiViec.get(h.viec_id);
    if (!c || (h.id ?? 0) > (c.id ?? 0)) moiViec.set(h.viec_id, h);
  }
  const nhom = new Map();
  for (const h of [...moiViec.values(), ...khongViec]) {
    const nguon = h.boi_canh?.nguon_viec || 'khong_ro';
    const g = nhom.get(nguon) || { doi: 0, bo: 0, xong: 0, im_lang: 0, tong: 0 };
    g.tong++;
    if (LOAI_DOI.includes(h.loai)) g.doi++;
    else if (LOAI_BO.includes(h.loai)) g.bo++;
    else if (LOAI_XONG.includes(h.loai)) g.xong++;
    else g.im_lang++;
    nhom.set(nguon, g);
  }
  const ra = [];
  for (const [nguon, g] of nhom) {
    for (const [ma, so, nhan] of [['hay_doi', g.doi, 'hay bị dời hạn'], ['hay_bo', g.bo, 'hay bị bỏ'], ['im_lang', g.im_lang, 'thường không ai đụng tới']]) {
      if (so >= mauToiThieu && so / g.tong >= tyLe) ra.push({ ma, nguon, so_lan: so, tong: g.tong, ty_le: Math.round((so / g.tong) * 100) / 100, nhan: `Việc ${TEN_NGUON[nguon] || nguon} ${nhan}` });
    }
    if (g.xong >= mauToiThieu && g.xong / g.tong >= 0.7) ra.push({ ma: 'on_dinh', nguon, so_lan: g.xong, tong: g.tong, ty_le: Math.round((g.xong / g.tong) * 100) / 100, nhan: `Việc ${TEN_NGUON[nguon] || nguon} thường được làm xong, giữ cách tách hiện tại` });
  }
  return ra.sort((a, b) => b.so_lan - a.so_lan);
}

// Câu lời dặn đề xuất cho một thói quen; null nếu chưa có nguồn nhận diện được (không đoán). Câu viết để qua rào chắn chủ đề.
export function loiDanTuThoiQuen(t) {
  const n = NHAN_NGUON[t.nguon];
  if (!n) return null;
  if (t.ma === 'hay_doi') return `Việc tạo từ ${n} hay bị dời hạn: đặt hạn việc muộn hơn, hoặc để trống hạn khi tin không nói rõ ngày.`;
  if (t.ma === 'hay_bo') return `Việc tạo từ ${n} hay bị bỏ: chỉ tạo việc khi tin có người giao việc hoặc có hạn rõ.`;
  if (t.ma === 'im_lang') return `Việc tạo từ ${n} thường không ai đụng tới: chỉ tạo việc khi tin có hạn việc rõ hoặc người nhận lời.`;
  return null;
}

// Ghi tín hiệu im lặng: việc AI tạo, còn mở, quá NGAY_IM_LANG ngày mà không có hành động hay sự kiện nào.
// Chỉ tính việc tạo sau lần chạy đầu tiên (trước đó chưa có nhật ký nên việc nào cũng trông như bị bỏ mặc).
export async function ghiTinHieuImLang(env, tc, bayGio = new Date().toISOString()) {
  let batDau = await docCaiDat(env, tc, KHOA_BAT_DAU);
  if (!batDau) { await ghiCaiDat(env, tc, KHOA_BAT_DAU, bayGio); batDau = bayGio; }
  const han = new Date(Date.parse(bayGio) - NGAY_IM_LANG * 86400000).toISOString();
  const { results } = await env.CSDL.prepare(
    `SELECT v.id FROM viec v WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'mo' AND COALESCE(v.nguon, 'tay') <> 'tay'
       AND v.tao_luc >= ?2 AND v.tao_luc <= ?3
       AND NOT EXISTS (SELECT 1 FROM nhat_ky_hanh_dong h WHERE h.to_chuc_id = v.to_chuc_id AND h.viec_id = v.id)
       AND NOT EXISTS (SELECT 1 FROM viec_su_kien e WHERE e.to_chuc_id = v.to_chuc_id AND e.viec_id = v.id AND e.luc > v.tao_luc
         AND e.loai NOT IN ('tao', 'nghi_trung'))
     LIMIT 200`,
  ).bind(tc, batDau, han).all();
  for (const r of results) await ghiHanhDong(env, tc, { nguon: 'he_thong', loai: 'im_lang', viecId: r.id, luc: bayGio });
  return results.length;
}

// Chạy hằng ngày: ghi im lặng, phân tích 14 ngày, lưu thẻ "thói quen". Ứng viên lời dặn do hàm gọi quyết định (themUngVienTuMau).
export async function rutKinhNghiem(env, tc, bayGio = new Date().toISOString()) {
  const soImLang = await ghiTinHieuImLang(env, tc, bayGio);
  const tu = new Date(Date.parse(bayGio) - KY_XET_NGAY * 86400000).toISOString();
  const hd = await docHanhDong(env, tc, tu);
  const thoiQuen = phanTichThoiQuen(hd);
  const loiDan = [...new Set(thoiQuen.map(loiDanTuThoiQuen).filter(Boolean))];
  await ghiCaiDat(env, tc, KHOA_THOI_QUEN, JSON.stringify({ ngay: ngayVN(bayGio), luc: bayGio, so_hanh_dong: hd.length, thoi_quen: thoiQuen }));
  return { so_hanh_dong: hd.length, so_im_lang: soImLang, thoi_quen: thoiQuen, loi_dan: loiDan };
}

export async function docThoiQuen(env, tc) {
  try { return JSON.parse((await docCaiDat(env, tc, KHOA_THOI_QUEN)) || 'null'); } catch { return null; }
}

// Đo hiệu quả lời dặn đã duyệt: so số việc AI tạo bị sửa hoặc hủy 14 ngày trước và 14 ngày sau lúc duyệt.
// Tính khi đọc, không lưu. Chỉ đo khi đã qua đủ 21 ngày (14 ngày kỳ sau cộng 7 ngày cửa sổ sửa) và mỗi bên có từ MAU_TOI_THIEU việc; chưa đủ thì ghi "chua_du".
// Lời dặn không giảm được lỗi chỉ được GỢI Ý gỡ; việc gỡ vẫn do người dùng quyết.
export async function doHieuQuaLoiDan(env, tc, bayGio = new Date().toISOString()) {
  let ds = [];
  try { ds = (JSON.parse((await docCaiDat(env, tc, 'goi_y_loi_dan')) || '{}').da_quyet || []).filter((q) => q.quyet === 'duyet').slice(-10); } catch { return []; }
  const ngay = 86400000;
  const ky = async (tu, toi) => env.CSDL.prepare(
    `SELECT COUNT(*) AS so_viec, COALESCE(SUM(CASE WHEN EXISTS (
       SELECT 1 FROM viec_su_kien e WHERE e.to_chuc_id=v.to_chuc_id AND e.viec_id=v.id
       AND e.loai IN ('huy','sua_ten','doi_du_an','doi_nhom','sua_han')
       AND COALESCE(e.noi_dung,'') NOT LIKE 'Gỡ vì%' AND e.luc >= v.tao_luc
       AND e.luc < strftime('%Y-%m-%dT%H:%M:%fZ', v.tao_luc, '+7 days')
     ) THEN 1 ELSE 0 END),0) AS da_sua
     FROM viec v WHERE v.to_chuc_id=?1 AND COALESCE(v.nguon,'tay')<>'tay' AND v.tao_luc>=?2 AND v.tao_luc<?3`,
  ).bind(tc, new Date(tu).toISOString(), new Date(toi).toISOString()).first();
  const ra = [];
  for (const q of ds) {
    const t = Date.parse(q.luc);
    if (!Number.isFinite(t)) continue;
    // Việc tạo ở ngày cuối của kỳ sau còn cần 7 ngày nữa mới biết có bị sửa không, nên chờ thêm 7 ngày.
    const dayDu = Date.parse(bayGio) - t >= (KY_XET_NGAY + 7) * ngay;
    const truoc = await ky(t - KY_XET_NGAY * ngay, t);
    const sau = dayDu ? await ky(t, t + KY_XET_NGAY * ngay) : null;
    let ket = 'chua_du';
    if (sau && truoc.so_viec >= MAU_TOI_THIEU && sau.so_viec >= MAU_TOI_THIEU) {
      ket = sau.da_sua / sau.so_viec < truoc.da_sua / truoc.so_viec ? 'giam' : 'khong_giam';
    }
    ra.push({ noi_dung: q.noi_dung, luc: q.luc, truoc, sau, ket_luan: ket, goi_y_go: ket === 'khong_giam' });
  }
  return ra;
}
