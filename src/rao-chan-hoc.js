// Rào chắn cho vòng học tập: chặn ứng viên lời dặn nguy hiểm TRƯỚC khi lưu thành đề xuất.
// Hàm thuần, không đụng CSDL hay AI. Người dùng vẫn là người duyệt cuối; rào này chỉ loại bớt thứ không bao giờ nên được đề xuất.

import { chuanHoa } from './tien-ich.js';

export const TOI_DA_KY_TU = 300;
export const HAN_MUC_MOI_NGAY = 5; // số ứng viên được nhận mỗi ngày cho một tổ chức
export const NGUONG_DO_TIN = 0.5; // độ tin dưới mức này thì không vào lời nhắc
export const VAI_TRO_AP_CHO_TO_CHUC = ['chu', 'quan_tri']; // vai trò được xác nhận lời dặn áp cho cả tổ chức
export const CHU_DE_CHO_PHEP = ['tach_viec', 'han_viec', 'du_an', 'nhom_viec', 'ten_viec', 'nguon_tin'];

// Từ khóa (đã bỏ dấu) để đoán chủ đề khi ứng viên chưa gắn chủ đề. Không khớp từ nào thì coi là ngoài danh sách.
const TU_KHOA_CHU_DE = {
  han_viec: /\b(han|deadline|gio hen|ngay hen)\b/,
  du_an: /\bdu an\b/,
  nhom_viec: /\b(nhom [123]|nhom viec|phan nhom|claude tu lam|claude chuan bi)\b/,
  ten_viec: /\b(ten viec|tieu de|dat ten|viet ten)\b/,
  nguon_tin: /\b(zalo|thu|gmail|email|cuoc hop|ghi am|nhom chat|nguoi gui)\b/,
  tach_viec: /\b(viec|tin nhan|tin|tach|huy|giao viec|nhan loi)\b/,
};

export function doanChuDe(noiDung) {
  const c = chuanHoa(noiDung);
  for (const [ma, re] of Object.entries(TU_KHOA_CHU_DE)) if (re.test(c)) return ma;
  return null;
}

// Dữ liệu bí mật: kiểm trên chữ gốc (số, khóa) và chữ đã bỏ dấu (từ khóa tiếng Việt).
const MAT_KHAU_OTP = /\b(mat khau|password|passwd|passcode|pin|otp|ma xac (nhan|thuc)|ma bao mat|ma 2fa)\b/;
const GIAY_TO = /\b(cmnd|cccd|can cuoc|ho chieu|so tai khoan|so the|stk|cvv|cvc)\b/;
const SO_THE = /(?<![\d])(?:\d[ -]?){13,19}(?![\d])/; // 13-19 chữ số liền, có thể cách bằng dấu cách hoặc gạch
const SO_CCCD = /(?<![\d])\d{12}(?![\d])/; // CCCD 12 số
const KHOA_API = /(\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{12,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\b(api[ _-]?key|secret|token|bearer)\b\s*[:=]\s*\S{8,})/i;

// Nới quyền: lời dặn dạy AI bỏ bước người dùng phải làm.
const NOI_QUYEN = [
  /\b(duyet|phe duyet|xac nhan|dong y) thay\b/,
  /\btu (dong )?(duyet|phe duyet|xac nhan|dong y|quyet)\b/,
  /\bbo qua (buoc |viec |cac buoc )?(kiem tra|xac nhan|duyet|phe duyet|hoi)\b/,
  /\bkhong (can|phai) (xac nhan|duyet|hoi|kiem tra|phe duyet)\b/,
  /\bkhoi (xac nhan|duyet|hoi|kiem tra)\b/,
  /\bbo (buoc )?(xac nhan|duyet|kiem tra|phe duyet)\b/,
  /\btat (buoc )?(xac nhan|duyet|kiem tra)\b/,
  /\b(nang|them|mo rong|cap) quyen\b/,
  /\bquyen (admin|quan tri|chu)\b/,
];

const co = (re, chu) => re.test(chu);

// ungVien: { noi_dung, chu_de?, do_tin? (0-1, mặc định 1), pham_vi? ('ca_nhan' | 'to_chuc', mặc định 'ca_nhan'), nguoi_xac_nhan? ({ id, vai_tro }) }
// ctx: { soDaNhanHomNay? (mặc định 0), haMuc?, nguongTin?, chuDeChoPhep? }
// Trả { ok, lyDo }: ok true thì lyDo rỗng.
export function kiemUngVien(ungVien, ctx = {}) {
  const tu = (lyDo) => ({ ok: false, lyDo });
  const u = ungVien && typeof ungVien === 'object' ? ungVien : {};
  const chu = String(u.noi_dung ?? '').trim();
  if (!chu) return tu('Nội dung trống.');
  if (chu.length > TOI_DA_KY_TU) return tu(`Nội dung dài quá ${TOI_DA_KY_TU} ký tự.`);

  const khongDau = chuanHoa(chu);
  if (co(KHOA_API, chu)) return tu('Chứa khóa API hoặc mã truy cập.');
  if (co(MAT_KHAU_OTP, khongDau)) return tu('Nhắc tới mật khẩu hoặc mã OTP.');
  if (co(GIAY_TO, khongDau) || co(SO_CCCD, chu)) return tu('Chứa hoặc nhắc tới số giấy tờ (CCCD, hộ chiếu, tài khoản).');
  if (co(SO_THE, chu)) return tu('Chứa chuỗi số giống số thẻ.');
  if (NOI_QUYEN.some((re) => re.test(khongDau))) return tu('Nới quyền: dạy AI bỏ qua bước người dùng phải duyệt hoặc xác nhận.');

  const chuDe = u.chu_de ?? doanChuDe(chu);
  if (!(ctx.chuDeChoPhep || CHU_DE_CHO_PHEP).includes(chuDe)) return tu('Chủ đề ngoài danh sách cho phép.');

  const doTin = u.do_tin == null ? 1 : Number(u.do_tin);
  const nguong = ctx.nguongTin ?? NGUONG_DO_TIN;
  if (!Number.isFinite(doTin) || doTin < nguong) return tu(`Độ tin ${Number.isFinite(doTin) ? doTin : '?'} thấp hơn ngưỡng ${nguong}.`);

  if (u.pham_vi === 'to_chuc') {
    const ai = u.nguoi_xac_nhan;
    if (!ai || !ai.id || !VAI_TRO_AP_CHO_TO_CHUC.includes(ai.vai_tro)) return tu('Học từ một người rồi áp cho cả tổ chức cần người xác nhận có quyền.');
  } else if (u.pham_vi != null && u.pham_vi !== 'ca_nhan') return tu('Phạm vi áp dụng không hợp lệ.');

  if ((ctx.soDaNhanHomNay ?? 0) >= (ctx.haMuc ?? HAN_MUC_MOI_NGAY)) return tu('Vượt hạn mức ứng viên trong ngày.');
  return { ok: true, lyDo: '' };
}
