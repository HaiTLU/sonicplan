// Nhắc việc hằng ngày cho khu Dự án (các tổ chức phạm vi 'hoalac'): mốc trong 7 ngày tới, việc quá hạn,
// (việc tạm dừng không tính là quá hạn), thủ tục pháp lý đang chờ hoặc vướng, sản phẩm bàn giao sắp đến hạn hoặc đã quá hạn,
// đợt thanh toán sắp đến hạn, quá hạn hoặc đủ điều kiện mà chưa đề nghị (tên đợt đi qua cheSoTien).
// Dự án không có nhóm Telegram riêng, nên tin gửi vào nhóm của tổ chức chính (phạm vi 'chung')
// mà chủ dự án cũng là chủ. Không ghi số tiền trong tin.

import { baoToChuc } from '../telegram.js';
import { congNgay, gioVN, ngayVN } from '../tien-ich.js';
import { canhBaoThanhToan } from './thanh-toan.js';
import { cheSoTien } from './de-xuat.js';

const GIO_GUI = 8; // giờ Việt Nam
const TOI_DA_DONG = 5;
const ngayNgan = (ngay) => (ngay ? `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}` : 'chưa có ngày');

function khoi(tieuDe, ds, dong) {
  if (!ds.length) return '';
  const them = ds.length > TOI_DA_DONG ? `\n  và ${ds.length - TOI_DA_DONG} mục khác` : '';
  return `${tieuDe} (${ds.length}):\n${ds.slice(0, TOI_DA_DONG).map(dong).join('\n')}${them}`;
}

// Soạn phần nhắc của một dự án; trả '' khi không có gì cần nhắc.
export async function soanNhacDuAn(env, toChucId, homNay) {
  const sau7 = congNgay(homNay, 7);
  const tat = async (cau, ...ts) => (await env.CSDL.prepare(cau).bind(toChucId, ...ts).all()).results;
  const moc = await tat(
    `SELECT ten, COALESCE(ngay_ket_thuc, ngay_bat_dau) AS ngay_ket_thuc FROM qlda_hang_muc WHERE to_chuc_id = ?1 AND la_moc = 1
     AND trang_thai <> 'xong' AND COALESCE(ngay_ket_thuc, ngay_bat_dau) BETWEEN ?2 AND ?3 ORDER BY 2, id`, homNay, sau7);
  const quaHan = await tat(
    `SELECT ten, ngay_ket_thuc, phu_trach FROM qlda_hang_muc WHERE to_chuc_id = ?1 AND trang_thai NOT IN ('xong', 'tam_dung')
     AND ngay_ket_thuc IS NOT NULL AND ngay_ket_thuc < ?2 ORDER BY ngay_ket_thuc, id`, homNay);
  const thuTuc = await tat(
    `SELECT ten, trang_thai FROM qlda_thu_tuc WHERE to_chuc_id = ?1 AND trang_thai IN ('wait', 'block') ORDER BY CASE trang_thai WHEN 'block' THEN 0 ELSE 1 END, id`);
  const banGiao = await tat(
    `SELECT ten, han FROM qlda_san_pham_ban_giao WHERE to_chuc_id = ?1 AND trang_thai = 'chua_giao'
     AND han IS NOT NULL AND han <= ?2 ORDER BY han, id`, sau7);

  // Lệch giá trị hợp đồng chỉ báo trên trang vì phải nêu số tiền.
  const LY_DO = { qua_han: 'đã quá hạn', sap_den_han: 'sắp đến hạn', du_dieu_kien: 'đủ điều kiện, chưa đề nghị' };
  const thanhToan = (await canhBaoThanhToan(env, toChucId, homNay)).filter((c) => LY_DO[c.loai]);

  return [
    khoi('Mốc trong 7 ngày tới', moc, (m) => `- ${m.ten} (${ngayNgan(m.ngay_ket_thuc)})`),
    khoi('Việc quá hạn', quaHan, (v) => `- ${v.ten} (hạn ${ngayNgan(v.ngay_ket_thuc)}${v.phu_trach ? `, ${v.phu_trach}` : ''})`),
    khoi('Thủ tục đang chờ hoặc vướng', thuTuc, (t) => `- ${t.ten} (${t.trang_thai === 'block' ? 'vướng' : 'đang chờ'})`),
    khoi('Bàn giao sắp đến hạn hoặc quá hạn', banGiao, (b) => `- ${b.ten} (hạn ${ngayNgan(b.han)}${b.han < homNay ? ', đã quá' : ''})`),
    khoi('Đợt thanh toán', thanhToan, (c) => `- ${cheSoTien(c.ten)} - HĐ ${cheSoTien(c.ten_hop_dong)} (${LY_DO[c.loai]}${c.han ? `, hạn ${ngayNgan(c.han)}` : ''})`),
  ].filter(Boolean).join('\n\n');
}

// Nơi nhận tin nhắc của một dự án: với mỗi chủ dự án, một tổ chức chính (phạm vi 'chung') mà người đó là chủ
// và MỌI thành viên của tổ chức đó đều thuộc dự án. Nhóm Telegram của tổ chức có người ngoài dự án thì không
// nhận, để không lộ dữ liệu dự án. Mỗi chủ chỉ một nơi nhận (mã nhỏ nhất) để không nhận trùng tin.
export async function noiNhan(env, toChucId) {
  const { results } = await env.CSDL.prepare(
    `SELECT MIN(t.id) AS id FROM thanh_vien tv
     JOIN thanh_vien tv2 ON tv2.nguoi_dung_id = tv.nguoi_dung_id AND tv2.vai_tro = 'chu'
     JOIN to_chuc t ON t.id = tv2.to_chuc_id AND t.pham_vi_truy_cap = 'chung'
     WHERE tv.to_chuc_id = ?1 AND tv.vai_tro = 'chu'
       AND NOT EXISTS (SELECT 1 FROM thanh_vien ng WHERE ng.to_chuc_id = t.id
         AND ng.nguoi_dung_id NOT IN (SELECT nguoi_dung_id FROM thanh_vien WHERE to_chuc_id = ?1 AND vai_tro <> 'doi_tac'))
     GROUP BY tv.nguoi_dung_id`,
  ).bind(toChucId).all();
  return [...new Set(results.map((r) => r.id))];
}

export async function nhacDuAn(env, bayGio, { ep = false } = {}) {
  if (!ep && gioVN(bayGio) !== GIO_GUI) return { bo_qua: true };
  const homNay = ngayVN(bayGio);
  const { results: duAn } = await env.CSDL.prepare(
    `SELECT id, ten FROM to_chuc WHERE pham_vi_truy_cap = 'hoalac' ORDER BY ten`,
  ).all();

  // Gom phần nhắc của mọi dự án theo nơi nhận, mỗi nơi nhận một tin.
  const theoNoiNhan = new Map();
  for (const da of duAn) {
    const phan = await soanNhacDuAn(env, da.id, homNay);
    if (!phan) continue;
    for (const nn of await noiNhan(env, da.id)) {
      if (!theoNoiNhan.has(nn)) theoNoiNhan.set(nn, []);
      theoNoiNhan.get(nn).push(`[${da.ten}]\n${phan}`);
    }
  }

  let daGui = 0;
  const loi = [];
  for (const [nn, cacPhan] of theoNoiNhan) {
    const tin = `Nhắc việc dự án ngày ${ngayNgan(homNay)}\n\n${cacPhan.join('\n\n')}`;
    // Một nơi nhận lỗi không làm mất tin của các nơi còn lại.
    try {
      if (await baoToChuc(env, nn, tin)) daGui++;
    } catch (e) { loi.push(`${nn}: ${String(e.message).slice(0, 100)}`); }
  }
  if (loi.length) throw new Error(`Nhắc dự án: gửi ${daGui}/${theoNoiNhan.size}, lỗi ${loi.join('; ')}`);
  return { so_muc: daGui, ghi_chu: `${duAn.length} dự án, gửi ${daGui}/${theoNoiNhan.size} nơi nhận` };
}
