// Việc: thêm việc (có chống trùng), tách việc từ tin bằng AI.

import { NHOM_THEO_SO, tachViec } from './ai.js';
import { chonBaiHoc } from './chon-bai-hoc.js';
import { ghiChuKeHoach } from './ai.js';
import { docHoSo, ghiNhoChoAi, luuGhiNho, nhayCam } from './ghi-nho.js';
import { laHetHanMucNgay } from './han-muc-ai.js';
import { ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { docLuong } from './luong.js';
import { baoSuKien, dangViecMoi, docTichHop } from './tich-hop.js';
import { boSungHan, ngayChoGio } from './ngay-viet.js';
import { cat, chuanHoa, doGiong, ngayVN } from './tien-ich.js';
import { chonDuAn, docDuAn, ghiSuKien } from './du-an.js';
import { moTaViec, taoThongBao } from './thong-bao.js';
import { TOI_DA_MOI_LUOT as TOI_DA_HOI, taoCauHoi, taoCauHoiThem } from './hoi-y-kien.js';

// Tiêu đề giống từ 80% với một việc đang mở trong 60 ngày (hoặc vừa xong 3 ngày) thì coi là trùng.
export const NGUONG_TRUNG = 0.8;

// Khóa cuộc trò chuyện của một tin: Zalo theo mã hội thoại (tin cũ theo nhóm hoặc tên chat, giống Hộp tin),
// thư và nguồn khác theo người gửi. Mỗi lượt AI chỉ đọc tin của một cuộc trò chuyện để không lẫn "anh" của người này với người kia.
export const KHOA_HOI_THOAI = `CASE WHEN nguon = 'zalo' THEN COALESCE(NULLIF(ma_hoi_thoai, ''),
    CASE WHEN COALESCE(nhom, '') <> '' THEN 'nhom~' || nhom ELSE 'ca-nhan~' || COALESCE(NULLIF(tieu_de, ''), NULLIF(nguoi_gui, ''), '') END)
  ELSE nguon || '~' || COALESCE(NULLIF(nguoi_gui, ''), CAST(id AS TEXT)) END`;

// Vài tin đã xử lý của cùng cuộc trò chuyện (gồm cả tin mình gửi), trong 3 ngày, để AI hiểu câu trả lời ngắn như "ok", "đồng ý".
export async function tinTruocChoLo(env, toChucId, tin, khoa) {
  const ids = tin.map((t) => t.id).filter(Boolean);
  if (!ids.length || !khoa) return [];
  const { results } = await env.CSDL.prepare(
    `SELECT nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem FROM tin_nhan
     WHERE to_chuc_id = ?1 AND da_tach = 1 AND an = 0 AND id < ?2 AND tao_luc >= ?3 AND (${KHOA_HOI_THOAI}) = ?4 ORDER BY id DESC LIMIT 8`,
  ).bind(toChucId, Math.min(...ids), new Date(Date.now() - 3 * 86400000).toISOString(), khoa).all();
  return results.reverse().map((t) => `[${t.thoi_diem?.slice(0, 16) || ''}${t.nhom ? ` nhóm "${t.nhom}"` : ''} từ ${t.nguoi_gui || 'không rõ'}] ${t.tieu_de ? `${t.tieu_de}: ` : ''}${String(t.noi_dung || '').replace(/\s+/g, ' ').slice(0, 300)}`);
}

// Việc đủ rõ để làm: tên có từ 3 chữ, hoặc 2 chữ kèm hạn hoặc ghi chú. Tên một chữ hay mơ hồ ("Hơi", "Vote") không phải việc.
export function laViecRo(v) {
  const chu = String(v?.tieu_de || '').trim().split(/\s+/).filter(Boolean).length;
  const ghiChu = String(v?.ghi_chu || '').trim().length;
  return chu >= 3 || (chu === 2 && Boolean(v?.han_ngay || ghiChu >= 20));
}

// Tin sinh ra việc. AI hay bỏ trống tin_so khi lô có nhiều tin, làm việc mất liên kết với tin gốc và bị gắn nhãn "Tự thêm".
// Thứ tự: tin_so hợp lệ, lô chỉ có một tin, rồi tin trùng nhiều từ nhất với tên việc (có từ 80% từ của tên việc, nhiều tin cùng đủ thì lấy tin ngắn nhất).
export function timTinNguon(viec, tin) {
  const theoSo = viec?.tin_so && tin[viec.tin_so - 1];
  if (theoSo) return theoSo;
  if (tin.length === 1) return tin[0];
  const tu = (chu) => new Set(chuanHoa(chu).split(' ').filter((w) => w.length >= 2));
  const cua = tu(viec?.tieu_de);
  if (cua.size < 2) return null;
  let tot = null;
  let dai = Infinity;
  for (const t of tin) {
    const trongTin = tu(`${t.nhom || ''} ${t.tieu_de || ''} ${String(t.noi_dung || '').slice(0, 2000)}`);
    let chung = 0;
    for (const w of cua) if (trongTin.has(w)) chung++;
    // Phải có gần đủ từ của tên việc; nhiều tin cùng đủ thì lấy tin ngắn nhất (thư dài chứa mọi từ thông dụng).
    if (chung >= 2 && chung / cua.size >= 0.8 && trongTin.size < dai) { tot = t; dai = trongTin.size; }
  }
  return tot;
}

// Cả lô cùng một nguồn (toàn Zalo hay toàn thư) thì việc không rõ tin gốc vẫn mang nhãn nguồn đó, không rơi về "Tự thêm".
function nguonChung(tin) {
  const ds = [...new Set(tin.map((t) => t.nguon).filter(Boolean))];
  return ds.length === 1 ? { nguon: ds[0] } : null;
}

// Việc đời thường vụn vặt (ăn uống, mua nước, quà, chuyện lớp): AI hay lỡ tạo dù đã dặn, nên chặn thêm bằng code.
// Việc có hạn thuộc dự án hoặc ưu tiên cao thì giữ lại, vì đó là việc người dùng chủ động đặt ra.
const TU_VAN = /\b(an trua|an toi|an sang|di an|bua an|com trua|uong nuoc|tra sua|tra thach|tra dao|ca phe|cafe|mua nuoc|mua tra|mua do an|banh ngot|hoa qua|nhan hoa|ra nhan|tang qua|nuoc ngot|tra da|chai nuoc)\b/;
// Việc chung của nhóm (sự kiện, kinh phí, đầu mối, hưởng ứng) không phải chuyện vặt dù có trà sữa hoặc hoa trong tên.
const VIEC_CHUNG = /\b(su kien|kinh phi|ngan sach|du toan|dau moi|hung ung|le ky niem|le khai|khai truong|khanh thanh|hoi nghi|hoi thao|workshop|ban to chuc)\b/;
export function laViecVanVat(v) {
  const ten = chuanHoa(v?.tieu_de);
  if (!TU_VAN.test(ten)) return false;
  if (VIEC_CHUNG.test(`${ten} ${chuanHoa(v?.ghi_chu)}`)) return false;
  return v?.uu_tien !== 'cao' && !v?.du_an;
}

// Cùng một cuộc trò chuyện (cùng nhóm Zalo hoặc cùng người gửi) thì hạ ngưỡng: "Gửi báo giá cho chị Lan" và
// "Gửi chị Lan bản báo giá" (giống 0,77) là một việc; "Gửi hợp đồng cho chị Lan" (0,62) vẫn là việc khác.
export const NGUONG_TRUNG_CUNG_NGUON = 0.65;

// cacViec: [{ id, tieu_de, nguon_khoa? }]. cungNguon: khóa nguồn của tin đang xét (nhóm hoặc người gửi). Lấy việc giống nhất.
export function timTrung(tieuDe, cacViec, cungNguon = null) {
  let tot = null;
  let diemTot = 0;
  for (const v of cacViec) {
    const diem = doGiong(v.tieu_de, tieuDe);
    const nguong = cungNguon && v.nguon_khoa === cungNguon ? NGUONG_TRUNG_CUNG_NGUON : NGUONG_TRUNG;
    if (diem >= nguong && diem > diemTot) { tot = v; diemTot = diem; }
  }
  return tot;
}

// Việc trùng mà tin mới có hạn hoặc giờ khác: trả { han_ngay, gio_hen } mới, không đổi gì thì null.
// Chỉ nhận ngày không lùi về quá khứ để AI đọc nhầm ngày cũ trong tin không kéo việc về trước.
export function doiHanKhiTrung(cu, moi, homNay = ngayVN()) {
  const han = moi.han_ngay && moi.han_ngay >= homNay ? moi.han_ngay : cu.han_ngay || null;
  const gio = moi.gio_hen || cu.gio_hen || null;
  if (han === (cu.han_ngay || null) && gio === (cu.gio_hen || null)) return null;
  return { han_ngay: han || (gio ? ngayChoGio(gio) : null), gio_hen: gio };
}

export async function themViec(env, toChucId, viec, { tinNhanId = null, boQuaTrung = false, duAnId = null, nguon = null } = {}) {
  // Có giờ mà chưa có ngày thì không để rơi vào "Chưa có hạn": hôm nay, hoặc mai nếu giờ đã qua.
  if (viec.gio_hen && !viec.han_ngay) viec = { ...viec, han_ngay: ngayChoGio(viec.gio_hen) };
  if (!boQuaTrung) {
    // So với việc đang mở trong 60 ngày và việc vừa xong 3 ngày, để tin nhắc lại việc cũ hoặc việc vừa làm không tạo việc mới.
    const { results } = await env.CSDL.prepare(
      `SELECT v.id, v.tieu_de, v.han_ngay, v.gio_hen, v.trang_thai, COALESCE(NULLIF(t.nhom, ''), NULLIF(t.tieu_de, ''), t.nguoi_gui) AS nguon_khoa
       FROM viec v LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id
       WHERE v.to_chuc_id = ?1 AND ((v.trang_thai = 'mo' AND v.tao_luc >= ?2) OR (v.trang_thai = 'xong' AND v.xong_luc >= ?3))`,
    ).bind(toChucId, new Date(Date.now() - 60 * 86400000).toISOString(), new Date(Date.now() - 3 * 86400000).toISOString()).all();
    const tinGoc = tinNhanId
      ? await env.CSDL.prepare(`SELECT COALESCE(NULLIF(nhom, ''), NULLIF(tieu_de, ''), nguoi_gui) AS k FROM tin_nhan WHERE id = ?1 AND to_chuc_id = ?2`).bind(tinNhanId, toChucId).first()
      : null;
    const trung = timTrung(viec.tieu_de, results, tinGoc?.k || null);
    if (trung?.trang_thai === 'xong') return { id: trung.id, trung: true };
    if (trung) {
      // Tin sau đổi hạn hoặc giờ ("dời sang thứ 6", "chuyển 15h") thì cập nhật việc cũ, không để hạn mới bị bỏ.
      const doi = doiHanKhiTrung(trung, viec);
      if (doi) {
        await env.CSDL.prepare('UPDATE viec SET han_ngay = ?1, gio_hen = ?2, can_dong_bo = 1, cap_nhat_luc = ?3 WHERE id = ?4 AND to_chuc_id = ?5')
          .bind(doi.han_ngay, doi.gio_hen, new Date().toISOString(), trung.id, toChucId).run();
        await env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id = ?1').bind(trung.id).run();
        await ghiSuKien(env, toChucId, trung.id, 'doi_han', `Tin mới đổi hạn: ${doi.han_ngay}${doi.gio_hen ? ` ${doi.gio_hen}` : ''}`, tinNhanId).catch(() => {});
      }
      return { id: trung.id, trung: true, doi_han: Boolean(doi) };
    }
  }
  const bayGio = new Date().toISOString();
  const dong = await env.CSDL.prepare(
    `INSERT INTO viec (to_chuc_id, tieu_de, ghi_chu, han_ngay, gio_hen, trang_thai, tin_nhan_id, tao_luc, cap_nhat_luc, nhom, uu_tien, du_an_id, nguon)
     VALUES (?1, ?2, ?3, ?4, ?5, 'mo', ?6, ?7, ?7, ?8, ?9, ?10, ?11) RETURNING id`,
  ).bind(toChucId, viec.tieu_de, viec.ghi_chu || null, viec.han_ngay || null, viec.gio_hen || null, tinNhanId, bayGio, NHOM_THEO_SO[viec.nhom] || null, viec.uu_tien || null, duAnId, nguon || 'tay').first();
  await ghiSuKien(env, toChucId, dong.id, 'tao', viec.tieu_de, tinNhanId).catch(() => {});
  await baoSuKien(env, toChucId, dangViecMoi({ ...viec, id: dong.id }));
  return { id: dong.id, trung: false };
}

// Ghi tiến độ vào ghi chú việc: người gửi, tiêu đề thư và tên các tệp đính kèm đã lưu. Không tự đóng việc.
export async function ghiLienKet(env, toChucId, lienKet, tin, viecMoIds) {
  let so = 0;
  const ngay = ngayVN().slice(5).split('-').reverse().join('/');
  for (const k of lienKet || []) {
    const t = k.tin_so && tin[k.tin_so - 1];
    if (!viecMoIds.has(k.viec_id) || !t) continue;
    const { results: teps } = t.id
      ? await env.CSDL.prepare('SELECT ten FROM tep WHERE to_chuc_id = ?1 AND tin_nhan_id = ?2 ORDER BY id LIMIT 10').bind(toChucId, t.id).all()
      : { results: [] };
    const nguon = ({ gmail: 'Thư', zalo: 'Zalo', hop: 'Biên bản họp' })[t.nguon] || 'Tin';
    const dong = `[Tiến độ ${ngay}] ${k.tien_do}${k.xong ? ' (có vẻ đã đủ, anh xem rồi đóng việc)' : ''} - ${nguon} của ${t.nguoi_gui || 'không rõ'}${t.tieu_de ? `, tiêu đề "${cat(t.tieu_de, 80)}"` : ''}${teps.length ? `; tệp: ${teps.map((x) => x.ten).join(', ')}` : ''}.`;
    const hien = await env.CSDL.prepare('SELECT ghi_chu FROM viec WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai = \'mo\'').bind(k.viec_id, toChucId).first();
    if (!hien || String(hien.ghi_chu || '').includes(dong)) continue;
    await env.CSDL.prepare('UPDATE viec SET ghi_chu = ?1, cap_nhat_luc = ?2 WHERE id = ?3 AND to_chuc_id = ?4')
      .bind(cat([hien.ghi_chu, dong].filter(Boolean).join('\n'), 4000), new Date().toISOString(), k.viec_id, toChucId).run();
    await ghiSuKien(env, toChucId, k.viec_id, 'tien_do', `${nguon} của ${t.nguoi_gui || 'không rõ'}: ${k.tien_do}${teps.length ? ` (tệp: ${teps.map((x) => x.ten).join(', ')})` : ''}`, t.id || null).catch(() => {});
    so++;
  }
  return so;
}

// Các lần người dùng sửa hoặc hủy việc do AI tách trong 30 ngày qua, viết thành dòng ngắn để AI học lần tách sau (tối đa 10 dòng).
const TEN_SUA = { huy: 'Hủy việc', sua_ten: 'Sửa tên việc', doi_du_an: 'Đổi dự án', doi_nhom: 'Đổi nhóm', sua_han: 'Sửa hạn' };
export async function docViecDaSua(env, toChucId, toiDa = 10, tinHienTai = null) {
  const { results } = await env.CSDL.prepare(
    `SELECT e.loai, e.noi_dung, e.ly_do, e.luc, v.tieu_de, t.noi_dung AS tin,
       t.nguon, t.nhom, t.nguoi_gui, t.ma_hoi_thoai FROM viec_su_kien e
     JOIN viec v ON v.id = e.viec_id AND v.to_chuc_id = e.to_chuc_id LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id AND t.to_chuc_id = e.to_chuc_id
     WHERE e.to_chuc_id = ?1 AND e.luc >= ?2 AND e.loai IN ('huy', 'sua_ten', 'doi_du_an', 'doi_nhom', 'sua_han')
       AND COALESCE(v.nguon, 'tay') <> 'tay' AND COALESCE(e.noi_dung, '') NOT LIKE 'Gỡ vì%' ORDER BY e.id DESC LIMIT ?3`,
  ).bind(toChucId, new Date(Date.now() - 30 * 86400000).toISOString(), tinHienTai ? 300 : toiDa).all();
  // Cả lựa chọn "giữ/thêm" và "bỏ" đều là phản hồi; im lặng không phải đồng ý.
  const { results: traLoi } = await env.CSDL.prepare(
    `SELECT q.loai, q.cau_hoi, q.tra_loi, q.tra_loi_luc AS luc,
       COALESCE(t.noi_dung, q.tin_trich) AS tin, t.nguon, t.nhom, t.nguoi_gui, t.ma_hoi_thoai
     FROM cau_hoi_ai q LEFT JOIN viec v ON v.id = q.viec_id AND v.to_chuc_id = q.to_chuc_id
     LEFT JOIN tin_nhan t ON t.id = COALESCE(q.tin_nhan_id, v.tin_nhan_id) AND t.to_chuc_id = q.to_chuc_id
     WHERE q.to_chuc_id = ?1 AND q.trang_thai = 'xong' AND q.tra_loi IS NOT NULL AND q.tra_loi_luc >= ?2
     ORDER BY q.tra_loi_luc DESC, q.id DESC LIMIT ?3`,
  ).bind(toChucId, new Date(Date.now() - 30 * 86400000).toISOString(), tinHienTai ? 300 : toiDa).all();
  const tatCa = [...results, ...traLoi].sort((a, b) => String(b.luc).localeCompare(String(a.luc)));
  const ds = tinHienTai ? chonBaiHoc(tatCa, tinHienTai, toiDa) : tatCa.slice(0, toiDa);
  return ds.map((r) => {
    const [chinh, lyDoCu] = String(r.noi_dung || '').split(' | lý do: ');
    const lyDo = [r.ly_do || lyDoCu].filter((x) => x && !nhayCam(x))[0]; // cột ly_do (từ 0044) ưu tiên; sự kiện cũ còn lý do trong nội dung
    const tin = r.tin ? ` (tin gốc: "${cat(String(r.tin).replace(/\s+/g, ' '), 100)}")` : '';
    const chiTiet = r.loai === 'huy' ? `"${cat(chinh || r.tieu_de, 80)}"` : `${cat(chinh, 120)}`;
    const phamVi = JSON.stringify({ nguon: r.nguon, nhom: r.nhom, nguoi_gui: r.nguoi_gui, ma_hoi_thoai: r.ma_hoi_thoai });
    if (r.tra_loi != null) return `- Anh đã chọn: ${JSON.stringify({ cau_hoi: r.cau_hoi, tra_loi: r.tra_loi })}${tin}; phạm vi: ${phamVi}`;
    return `- ${TEN_SUA[r.loai]}: ${chiTiet}${lyDo ? `, lý do: ${cat(lyDo, 100)}` : ''}${tin}; phạm vi: ${phamVi}`;
  });
}

// Tin Zalo chỉ vài chữ không số, không "@" ("ok", "dạ", "được", "haha"): không thể là việc. Cả lô toàn tin loại này thì khỏi gọi AI.
export function laTinVun(t) {
  if (t?.nguon !== 'zalo' || t.tieu_de) return false;
  const chu = String(t.noi_dung || '').trim();
  if (/[\d@]/.test(chu)) return false;
  return (chu.match(/\p{L}/gu) || []).length <= 5;
}

// Lõi xử lý một lô tin: AI đọc cùng ghi nhớ, tạo việc, lưu ghi nhớ. Dùng cho tin trong hộp tin và cho tin nhắn trực tiếp.
// tin: [{ id (hoặc null), nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem }]. Trả { soViec, viec: [{ id, tieu_de, han_ngay, gio_hen, trung }] }.
async function chayLoTin(env, toChucId, tin, bayGio, khoa = null) {
  const ten = await env.CSDL.prepare(
    `SELECT n.ten FROM thanh_vien v JOIN nguoi_dung n ON n.id = v.nguoi_dung_id WHERE v.to_chuc_id = ?1 AND v.vai_tro = 'chu' LIMIT 1`,
  ).bind(toChucId).first();

  // Việc vừa xong 3 ngày qua (việc đang mở nằm ở viecMo bên dưới), đưa cho AI để khỏi trích lại việc đã có.
  const { results: daCoDong } = await env.CSDL.prepare(
    `SELECT tieu_de, han_ngay, trang_thai FROM viec
     WHERE to_chuc_id = ?1 AND trang_thai = 'xong' AND xong_luc >= ?2 ORDER BY id DESC LIMIT 30`,
  ).bind(toChucId, new Date(Date.now() - 3 * 86400000).toISOString()).all();
  const daCo = daCoDong.map((v) => `${v.trang_thai === 'xong' ? '[đã xong] ' : ''}${v.tieu_de}${v.han_ngay ? ` (hạn ${v.han_ngay})` : ''}`);

  const { results: viecMo } = await env.CSDL.prepare(
    `SELECT id, tieu_de, han_ngay FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' ORDER BY id DESC LIMIT 60`,
  ).bind(toChucId).all();

  const duAn = await docDuAn(env, toChucId).catch(() => []);
  const ghiNho = await ghiNhoChoAi(env, toChucId, tin.map((t) => `${t.nguoi_gui || ''} ${t.nhom || ''} ${t.tieu_de || ''} ${t.noi_dung || ''}`).join(' '));

  let ketQua;
  const tuyChon = {};
  try {
    const ngoai = await docTichHop(env, toChucId, 'ai');
    tuyChon.ngoai = ngoai;
    tuyChon.hoSo = await docHoSo(env, toChucId);
    tuyChon.tinTruoc = await tinTruocChoLo(env, toChucId, tin, khoa).catch(() => []);
    ketQua = await tachViec(env, tin.map((t, i) => ({ ...t, so: i + 1 })), ngayVN(), ten?.ten, Object.assign(tuyChon, {
      daCo,
      viecMo,
      duAn,
      ghiNho,
      daSua: await docViecDaSua(env, toChucId, 10, tin).catch(() => []),
      baoLoi: (thongBao) => ghiTinHieu(env, toChucId, 'ai', `Dịch vụ AI ngoài lỗi, đã dùng AI có sẵn: ${thongBao}`),
    }));
  } catch (e) {
    // Lỗi AI: trả tin về hàng chờ để lượt sau thử lại; tin đã nằm chờ quá 6 giờ thì bỏ qua.
    // Riêng hết hạn mức ngày thì chờ tới lúc đặt lại (có thể hơn 6 giờ) là chuyện bình thường: giữ mọi tin, không bỏ tin nào.
    if (tin.some((t) => t.id)) await env.CSDL.prepare(
      `UPDATE tin_nhan SET da_tach = CASE WHEN ?3 = 0 AND tao_luc < ?2 THEN 3 ELSE 0 END
       WHERE to_chuc_id = ?1 AND da_tach = 2`,
    ).bind(toChucId, new Date(Date.now() - 6 * 3600000).toISOString(), laHetHanMucNgay(e) ? 1 : 0).run();
    throw e;
  }

  let soViec = 0;
  let soCauHoi = 0;
  const viecRa = [];
  // Lớp kiểm tra bằng code: ngày giờ viết trong tiêu đề, ghi chú hoặc tin gốc luôn được đọc, kể cả khi AI bỏ sót.
  const viecDay = ketQua.viec.map((x) => {
    const g = timTinNguon(x, tin);
    return { ...boSungHan(x, g?.noi_dung || '', g?.thoi_diem || bayGio), nguon_tin: g };
  });
  for (const v of viecDay.filter((x) => (laViecRo(x) || String(x?.tieu_de || '').trim().split(/\s+/).length >= 2 && x.han_ngay) && !laViecVanVat(x)).slice(0, 10)) {
    const nguon = v.nguon_tin;
    const keHoach = ghiChuKeHoach(v);
    const ghiChu = [v.ghi_chu, keHoach].filter(Boolean).join('\n\n') || null;
    const duAnId = chonDuAn(duAn, v.du_an, `${v.tieu_de} ${nguon?.nhom || ''} ${nguon?.nguoi_gui || ''} ${nguon?.tieu_de || ''} ${String(nguon?.noi_dung || '').slice(0, 300)}`);
    const r = await themViec(env, toChucId, { ...v, ghi_chu: ghiChu }, { tinNhanId: nguon ? nguon.id : null, duAnId, nguon: (nguon || nguonChung(tin))?.nguon || null });
    if (!r.trung) soViec++;
    // AI chưa chắc một chi tiết: ghi ô hỏi để gửi Telegram. Lỗi ở đây không được làm hỏng việc đã tạo.
    if (!r.trung && v.chua_chac && soCauHoi < TOI_DA_HOI) {
      try {
        const boiCanh = nguon?.nguon === 'telegram' ? 'Telegram' : nguon?.nhom || nguon?.tieu_de || nguon?.nguoi_gui || '';
        if (await taoCauHoi(env, toChucId, { viecId: r.id, chuaChac: v.chua_chac, tenDuAn: duAn.map((d) => d.ten), boiCanh, tinTrich: nguon?.noi_dung })) soCauHoi++;
      } catch (e) {
        console.error('Tạo ô hỏi ý kiến lỗi', e);
      }
    }
    // Thông báo trên web cho việc đến từ người khác. Tin bạn tự gõ qua Telegram thì không báo lại chính bạn.
    if (nguon && nguon.nguon !== 'telegram' && (!r.trung || r.doi_han)) {
      await taoThongBao(env, toChucId, r.trung
        ? { loai: 'doi_han', tieu_de: `Đổi hạn: ${v.tieu_de}`, noi_dung: moTaViec(v, nguon), duong_dan: `#viec/${r.id}`, viec_id: r.id }
        : { loai: 'viec_moi', tieu_de: `Việc mới: ${v.tieu_de}`, noi_dung: moTaViec(v, nguon), duong_dan: `#viec/${r.id}`, viec_id: r.id });
    }
    viecRa.push({ id: r.id, tieu_de: v.tieu_de, han_ngay: v.han_ngay || null, gio_hen: v.gio_hen || null, trung: r.trung });
  }
  // Việc AI phân vân: không tự tạo, hỏi anh trên Telegram. Chỉ với tin trong hộp tin (tin Telegram là anh tự nhắn nên không phân vân).
  const daTao = new Set(viecRa.map((x) => chuanHoa(x.tieu_de)));
  for (const p of ketQua.phan_van || []) {
    if (soCauHoi >= TOI_DA_HOI || daTao.has(chuanHoa(p.tieu_de))) continue;
    try {
      const g = timTinNguon(p, tin);
      if (!g?.id || g.nguon === 'telegram') continue;
      const dx = boSungHan(p, g.noi_dung || '', g.thoi_diem || bayGio);
      const boiCanh = g.nhom || g.tieu_de || g.nguoi_gui || '';
      const duAnId = chonDuAn(duAn, null, `${p.tieu_de} ${g.nhom || ''} ${g.nguoi_gui || ''} ${g.tieu_de || ''} ${String(g.noi_dung || '').slice(0, 300)}`);
      const deXuat = { tieu_de: dx.tieu_de, han_ngay: dx.han_ngay || null, gio_hen: dx.gio_hen || null, ghi_chu: p.ghi_chu || null, nhom: null, uu_tien: 'thap', du_an_id: duAnId, nguon: g.nguon || null };
      if (await taoCauHoiThem(env, toChucId, { tinNhanId: g.id, deXuat, boiCanh, tinTrich: g.noi_dung })) soCauHoi++;
    } catch (e) {
      console.error('Tạo ô thêm việc lỗi', e);
    }
  }
  // Thư trả lời việc đang chờ: ghi tiến độ và tệp đính kèm vào việc đó, không tạo việc trùng.
  let soLienKet = 0;
  try {
    soLienKet = await ghiLienKet(env, toChucId, ketQua.lien_ket, tin, new Set(viecMo.map((v) => v.id)));
  } catch (e) {
    console.error('Liên kết việc lỗi', e);
  }
  // Ghi nhớ và phân tích: lỗi ở đây không được làm hỏng việc đã tạo.
  try {
    await luuGhiNho(env, toChucId, ketQua.ghi_nho, { tinNhanId: tin[0]?.id ?? null, doTinCay: tuyChon.duPhong ? 'thap' : 'cao' });
    if (ketQua.phan_tich) await ghiCaiDat(env, toChucId, 'phan_tich_cuoi', JSON.stringify({ luc: bayGio, noi_dung: ketQua.phan_tich }));
  } catch (e) {
    console.error('Lưu ghi nhớ lỗi', e);
  }
  return { soViec, soLienKet, soCauHoi, viec: viecRa, soAi: ketQua.viec.length, duPhong: Boolean(tuyChon.duPhong) };
}

// Mỗi lượt xử lý tối đa SO_HOI_THOAI_MOI_LUOT cuộc trò chuyện, mỗi cuộc tối đa 20 tin chưa tách, cũ nhất trước.
// Tin được đánh dấu "đang xử lý" để hai lượt chạy cùng lúc không làm trùng; lượt kia lấy cuộc kế tiếp.
export const SO_HOI_THOAI_MOI_LUOT = 6;

export async function tachViecChoToChuc(env, toChucId) {
  if (!(await docLuong(env, toChucId)).bat['tach-viec']) return { so_tin: 0, so_viec: 0 };
  const tong = { so_tin: 0, so_viec: 0, so_ai: 0, so_lien_ket: 0, so_trung: 0, du_phong: false, so_hoi_thoai: 0 };
  for (let i = 0; i < SO_HOI_THOAI_MOI_LUOT; i++) {
    const dau = await env.CSDL.prepare(
      `SELECT ${KHOA_HOI_THOAI} AS khoa FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 0 ORDER BY id LIMIT 1`,
    ).bind(toChucId).first();
    if (!dau) break;
    const bayGio = new Date().toISOString();
    const { results: tin } = await env.CSDL.prepare(
      `UPDATE tin_nhan SET da_tach = 2, tach_luc = ?2
       WHERE id IN (SELECT id FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 0 AND (${KHOA_HOI_THOAI}) = ?3 ORDER BY id LIMIT 20)
       RETURNING id, nguon, nguoi_gui, nhom, ma_hoi_thoai, tieu_de, noi_dung, thoi_diem`,
    ).bind(toChucId, bayGio, dau.khoa).all();
    if (!tin.length) continue; // lượt chạy song song vừa nhận cuộc này
    tin.sort((a, b) => a.id - b.id);

    if (tin.every(laTinVun)) {
      await env.CSDL.prepare(
        `UPDATE tin_nhan SET da_tach = 1 WHERE to_chuc_id = ?1 AND da_tach = 2 AND id IN (${tin.map((_, j) => `?${j + 2}`).join(',')})`,
      ).bind(toChucId, ...tin.map((t) => t.id)).run();
      tong.so_tin += tin.length;
      tong.so_bo_qua = (tong.so_bo_qua || 0) + tin.length;
      continue;
    }

    const { soViec, soLienKet, soCauHoi, viec, soAi, duPhong } = await chayLoTin(env, toChucId, tin, bayGio, dau.khoa);
    await env.CSDL.prepare(
      `UPDATE tin_nhan SET da_tach = 1 WHERE to_chuc_id = ?1 AND da_tach = 2 AND id IN (${tin.map((_, j) => `?${j + 2}`).join(',')})`,
    ).bind(toChucId, ...tin.map((t) => t.id)).run();
    tong.so_tin += tin.length;
    tong.so_viec += soViec;
    tong.so_ai += soAi;
    tong.so_lien_ket += soLienKet;
    tong.so_cau_hoi = (tong.so_cau_hoi || 0) + soCauHoi;
    tong.so_trung += viec.filter((v) => v.trung).length;
    tong.du_phong ||= duPhong;
    tong.so_hoi_thoai++;
  }
  if (tong.so_cau_hoi) await guiCauHoiTelegram(env, toChucId);
  return tong;
}

// Gửi các ô hỏi ý kiến đang chờ. Nạp telegram.js lúc dùng vì telegram.js cũng gọi ngược vào file này.
async function guiCauHoiTelegram(env, toChucId) {
  try {
    await (await import('./telegram.js')).guiCauHoiMoi(env, toChucId);
  } catch (e) {
    console.error('Gửi ô hỏi ý kiến lỗi', e);
  }
}

// Tin nhắn trực tiếp (Telegram, dịch vụ ngoài): đi qua cùng lõi AI như tin Zalo nhưng không nằm trong hộp tin.
// Trả { tat: true } nếu người dùng đã tắt khâu tách việc, hoặc { viec: [...] } (rỗng nếu AI không thấy việc nào).
export async function xuLyVanBanTrucTiep(env, toChucId, { nguon, nguoi_gui: nguoiGui, noi_dung: noiDung }) {
  if (!(await docLuong(env, toChucId)).bat['tach-viec']) return { tat: true };
  const bayGio = new Date().toISOString();
  const tin = [{ id: null, nguon, nguoi_gui: nguoiGui || 'Tôi', nhom: null, tieu_de: null, noi_dung: String(noiDung || '').slice(0, 3000), thoi_diem: bayGio }];
  const { viec, soCauHoi } = await chayLoTin(env, toChucId, tin, bayGio);
  // Tin từ Telegram thì phần Telegram tự gửi ô hỏi sau khi trả lời kết quả, để đúng thứ tự.
  if (soCauHoi && nguon !== 'telegram') await guiCauHoiTelegram(env, toChucId);
  return { viec, co_cau_hoi: soCauHoi > 0 };
}
