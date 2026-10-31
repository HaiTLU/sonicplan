// Quyền của người dùng với dữ liệu cá nhân (Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, tham chiếu GDPR điều 15, 20):
// tải về toàn bộ dữ liệu của tổ chức ở dạng JSON đọc được bằng máy.
// Không xuất khóa, mã truy cập, mã băm: những thứ đó chỉ để hệ thống chạy, lộ ra thì nguy hiểm.

import { ngayVN } from './tien-ich.js';

// [bảng, câu hỏi]. Mọi câu hỏi lọc theo to_chuc_id = ?1.
export const BANG_XUAT = [
  ['thanh_vien', 'SELECT v.vai_tro, v.tao_luc, n.email, n.ten FROM thanh_vien v JOIN nguoi_dung n ON n.id = v.nguoi_dung_id WHERE v.to_chuc_id = ?1'],
  ['viec', 'SELECT * FROM viec WHERE to_chuc_id = ?1'],
  ['du_an', 'SELECT * FROM du_an WHERE to_chuc_id = ?1'],
  ['viec_su_kien', 'SELECT * FROM viec_su_kien WHERE to_chuc_id = ?1'],
  ['tin_nhan', 'SELECT * FROM tin_nhan WHERE to_chuc_id = ?1'],
  ['tep', 'SELECT * FROM tep WHERE to_chuc_id = ?1'],
  ['dashboard_de_xuat', 'SELECT * FROM dashboard_de_xuat WHERE to_chuc_id = ?1'],
  ['ghi_nho', 'SELECT * FROM ghi_nho WHERE to_chuc_id = ?1'],
  ['cau_hoi_ai', 'SELECT * FROM cau_hoi_ai WHERE to_chuc_id = ?1'],
  ['luot_claude', 'SELECT id, viec_id, lo_id, trang_thai, dan, ket_qua, cau_hoi, nhanh, pr, nhat_ky, danh_gia, tao_luc, cap_nhat_luc FROM luot_claude WHERE to_chuc_id = ?1'],
  ['prompt_claude', 'SELECT id, viec_id, viec_ids, noi_dung, model, dan, tao_luc FROM prompt_claude WHERE to_chuc_id = ?1'],
  ['nguon_chan', 'SELECT nguon, loai, gia_tri, nhan, tao_luc FROM nguon_chan WHERE to_chuc_id = ?1'],
  ['nhat_ky_truy_cap', 'SELECT email, hanh_dong, chi_tiet, luc FROM nhat_ky_truy_cap WHERE to_chuc_id = ?1 ORDER BY id DESC LIMIT 5000'],
  ['kho_da_luu', 'SELECT * FROM kho_da_luu WHERE to_chuc_id = ?1'],
  ['cai_dat', `SELECT khoa, gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa NOT LIKE 'tich_hop%' AND khoa NOT LIKE '%ma_noi%' AND khoa NOT LIKE '%bam%' AND khoa <> 'google_state'`],
  ['thong_bao', 'SELECT loai, tieu_de, noi_dung, viec_id, tao_luc, da_doc_luc FROM thong_bao WHERE to_chuc_id = ?1'],
  ['nhat_ky_chay', 'SELECT * FROM nhat_ky_chay WHERE to_chuc_id = ?1 ORDER BY id DESC LIMIT 2000'],
  // RAID của Viện Hòa Lạc (rủi ro, vấn đề, thay đổi, quyết định, bài học): phải có trong bản sao lưu trước khi
  // xoaToChuc() xóa 5 bảng này, không thì dữ liệu RAID mất hẳn, không khôi phục được trong 30 ngày như đã hứa.
  ['qlda_rui_ro', 'SELECT * FROM qlda_rui_ro WHERE to_chuc_id = ?1'],
  ['qlda_van_de', 'SELECT * FROM qlda_van_de WHERE to_chuc_id = ?1'],
  ['qlda_thay_doi', 'SELECT * FROM qlda_thay_doi WHERE to_chuc_id = ?1'],
  ['qlda_quyet_dinh', 'SELECT * FROM qlda_quyet_dinh WHERE to_chuc_id = ?1'],
  ['qlda_bai_hoc', 'SELECT * FROM qlda_bai_hoc WHERE to_chuc_id = ?1'],
  // Pháp lý/Hợp đồng/Các bên của Viện Hòa Lạc (PR4): cùng lý do, phải có trong bản sao lưu trước khi
  // xoaToChuc() xóa các bảng này.
  ['qlda_ben_lien_quan', 'SELECT * FROM qlda_ben_lien_quan WHERE to_chuc_id = ?1'],
  ['qlda_raci', 'SELECT * FROM qlda_raci WHERE to_chuc_id = ?1'],
  ['qlda_hop_dong', 'SELECT * FROM qlda_hop_dong WHERE to_chuc_id = ?1'],
  ['qlda_thu_tuc', 'SELECT * FROM qlda_thu_tuc WHERE to_chuc_id = ?1'],
  ['qlda_thu_tuc_phu_thuoc', 'SELECT * FROM qlda_thu_tuc_phu_thuoc WHERE to_chuc_id = ?1'],
  ['qlda_van_ban', 'SELECT * FROM qlda_van_ban WHERE to_chuc_id = ?1'],
  ['qlda_hop', 'SELECT * FROM qlda_hop WHERE to_chuc_id = ?1'],
  ['qlda_hop_viec', 'SELECT * FROM qlda_hop_viec WHERE to_chuc_id = ?1'],
  // Ngân sách & EVM của Viện Hòa Lạc (PR5): cùng lý do, phải có trong bản sao lưu trước khi
  // xoaToChuc() xóa các bảng này.
  ['qlda_ngan_sach_dong', 'SELECT * FROM qlda_ngan_sach_dong WHERE to_chuc_id = ?1'],
  ['qlda_giai_ngan', 'SELECT * FROM qlda_giai_ngan WHERE to_chuc_id = ?1'],
  ['qlda_evm', 'SELECT * FROM qlda_evm WHERE to_chuc_id = ?1'],
];

export async function xuatDuLieu(env, tc, luc = new Date().toISOString()) {
  const kq = await env.CSDL.batch(BANG_XUAT.map(([, cau]) => env.CSDL.prepare(cau).bind(tc)));
  const ra = { phien_ban: 1, to_chuc_id: tc, xuat_luc: luc, ghi_chu: 'Dữ liệu Sonicplan của tổ chức. Khóa và mã truy cập không được xuất.' };
  BANG_XUAT.forEach(([ten], i) => { ra[ten] = kq[i].results; });
  return ra;
}

// ---- Nhật ký truy cập: ai đã xem, tải dữ liệu ----

export const TEN_HANH_DONG = { mo_trang: 'Mở trang', xuat_du_lieu: 'Tải toàn bộ dữ liệu', tai_tep: 'Tải tệp' };

// mo_trang chỉ ghi lần đầu mỗi người mỗi ngày để nhật ký không phình.
export async function ghiTruyCap(env, tc, email, hanhDong, chiTiet = null, bayGio = new Date()) {
  const luc = bayGio.toISOString();
  const ngay = ngayVN(bayGio);
  const motLanNgay = hanhDong === 'mo_trang';
  await env.CSDL.prepare(
    `INSERT INTO nhat_ky_truy_cap (to_chuc_id, email, hanh_dong, chi_tiet, ngay, luc)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
     WHERE ?7 = 0 OR NOT EXISTS (SELECT 1 FROM nhat_ky_truy_cap WHERE to_chuc_id = ?1 AND email = ?2 AND hanh_dong = ?3 AND ngay = ?5)`,
  ).bind(tc, String(email || '').toLowerCase(), hanhDong, chiTiet ? String(chiTiet).slice(0, 200) : null, ngay, luc, motLanNgay ? 1 : 0).run();
}

export async function dsTruyCap(env, tc, gioiHan = 100) {
  const { results } = await env.CSDL.prepare('SELECT email, hanh_dong, chi_tiet, luc FROM nhat_ky_truy_cap WHERE to_chuc_id = ?1 ORDER BY id DESC LIMIT ?2').bind(tc, gioiHan).all();
  return results.map((r) => ({ ...r, ten_hanh_dong: TEN_HANH_DONG[r.hanh_dong] || r.hanh_dong }));
}
