// Bộ nhớ lâu dài của tổ chức: người, dự án, quyết định, sự thật cần nhớ.
// AI chỉ thêm hoặc cập nhật (gộp theo loại và tiêu đề); người dùng sửa, ghim, xóa ở trang Ghi nhớ.

import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { chuanHoa } from './tien-ich.js';

export const LOAI_GHI_NHO = ['nguoi', 'du_an', 'quyet_dinh', 'su_that'];
export const TOI_DA_MOI_LUOT = 10;
const TOI_DA_DUA_VAO_AI = 30;

// Số thẻ, mật khẩu, mã OTP, số giấy tờ: không bao giờ được nhớ.
const SO_THE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
const TU_NHAY_CAM = /\b(mat khau|password|passcode|otp|ma xac (nhan|thuc)|so (cmnd|cccd|ho chieu|tai khoan|the))\b/;
export const nhayCam = (chu) => SO_THE.test(chu) || TU_NHAY_CAM.test(chuanHoa(chu));

// Làm sạch danh sách ghi nhớ do AI trả về: đúng loại, có chữ, bỏ mục nhạy cảm, tối đa 10 mục.
export function chuanHoaGhiNho(ds) {
  if (!Array.isArray(ds)) return [];
  const thay = new Set();
  const ra = [];
  for (const g of ds) {
    const loai = String(g?.loai || '').trim();
    const tieuDe = String(g?.tieu_de || '').trim().slice(0, 120);
    const noiDung = String(g?.noi_dung || '').trim().slice(0, 600);
    if (!LOAI_GHI_NHO.includes(loai) || !tieuDe || !noiDung) continue;
    if (nhayCam(`${tieuDe} ${noiDung}`)) continue;
    const khoa = `${loai}|${chuanHoa(tieuDe)}`;
    if (thay.has(khoa)) continue;
    thay.add(khoa);
    ra.push({ loai, tieu_de: tieuDe, noi_dung: noiDung });
    if (ra.length >= TOI_DA_MOI_LUOT) break;
  }
  return ra;
}

// Thêm mới hoặc cập nhật theo (loại, tiêu đề). Mục người dùng đã ghim hoặc sửa tay thì AI không ghi đè.
export async function luuGhiNho(env, toChucId, ds, { tinNhanId = null, doTinCay = 'cao' } = {}) {
  const bayGio = new Date().toISOString();
  let so = 0;
  for (const g of ds) {
    const kq = await env.CSDL.prepare(
      `INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, tin_nhan_id, nguon, do_tin_cay, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, 'ai', ?6, ?7, ?7)
       ON CONFLICT (to_chuc_id, loai, tieu_de) DO UPDATE SET
         noi_dung = excluded.noi_dung, tin_nhan_id = excluded.tin_nhan_id, cap_nhat_luc = excluded.cap_nhat_luc
         WHERE ghi_nho.ghim = 0 AND ghi_nho.nguon = 'ai' AND (excluded.do_tin_cay = 'cao' OR ghi_nho.do_tin_cay = 'thap')`,
    ).bind(toChucId, g.loai, g.tieu_de, g.noi_dung, tinNhanId, doTinCay, bayGio).run();
    so += kq.meta.changes || 0;
  }
  return so;
}

// Chọn ghi nhớ đưa cho AI: mục ghim, mục có tên xuất hiện trong lô tin, rồi mục mới cập nhật. Tối đa 30.
export async function ghiNhoChoAi(env, toChucId, vanBan) {
  const { results } = await env.CSDL.prepare(
    `SELECT loai, tieu_de, noi_dung, ghim FROM ghi_nho WHERE to_chuc_id = ?1 ORDER BY ghim DESC, cap_nhat_luc DESC LIMIT 300`,
  ).bind(toChucId).all();
  return chonGhiNho(results, vanBan);
}

export function chonGhiNho(ds, vanBan) {
  const chu = chuanHoa(vanBan);
  const diem = (g) => (g.ghim ? 2 : 0) + (chuanHoa(g.tieu_de).length >= 3 && chu.includes(chuanHoa(g.tieu_de)) ? 3 : 0);
  return ds
    .map((g, i) => ({ g, d: diem(g), i }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .slice(0, TOI_DA_DUA_VAO_AI)
    .map(({ g }) => `[${g.loai}] ${g.tieu_de}: ${g.noi_dung}`);
}

// Hồ sơ: vài dòng người dùng tự khai về mình (vai trò, dự án, người hay gặp, cách xưng hô, quy tắc riêng).
// Được đưa vào mọi lần AI chạy để hiểu ngữ cảnh. Trả chuỗi lỗi nếu không lưu được, null nếu xong.
export const TOI_DA_HO_SO = 2000;

export async function docHoSo(env, toChucId) {
  return (await docCaiDat(env, toChucId, 'ho_so')) || '';
}

export async function luuHoSo(env, toChucId, chu) {
  const sach = String(chu || '').trim().slice(0, TOI_DA_HO_SO);
  if (sach && nhayCam(sach)) return 'Hồ sơ có vẻ chứa mật khẩu, mã xác nhận hoặc số thẻ, số giấy tờ. Bỏ phần đó đi rồi lưu lại.';
  if (!sach) await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'ho_so'`).bind(toChucId).run();
  else await ghiCaiDat(env, toChucId, 'ho_so', sach);
  return null;
}
