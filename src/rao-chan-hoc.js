// Rào chắn cho vòng học tập: chặn ứng viên lời dặn nguy hiểm TRƯỚC khi lưu thành đề xuất.
// Hàm thuần, không đụng CSDL hay AI. Người dùng vẫn là người duyệt cuối; rào này chỉ loại bớt thứ không bao giờ nên được đề xuất.

export const TOI_DA_KY_TU = 300;
export const HAN_MUC_MOI_NGAY = 5; // số ứng viên được nhận mỗi ngày cho một tổ chức
export const NGUONG_DO_TIN = 0.5; // độ tin dưới mức này thì không vào lời nhắc
export const DO_TIN_UNG_VIEN_MOI = 0.3; // ứng viên do AI đề xuất luôn mang độ tin này; độ tin AI tự khai bị bỏ, người duyệt là cổng cuối
export const VAI_TRO_AP_CHO_TO_CHUC = ['chu', 'quan_tri']; // vai trò được xác nhận lời dặn áp cho cả tổ chức
export const CHU_DE_CHO_PHEP = ['tach_viec', 'han_viec', 'du_an', 'nhom_viec', 'ten_viec', 'nguon_tin'];

// Chữ Cyrillic giống Latin: đổi sang Latin trước khi so khớp để không lách rào bằng "рassword".
const HOMOGLYPH = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i' };

// Chữ gốc đã làm sạch: NFKC (số và chữ toàn rộng về dạng thường), bỏ ký tự zero-width và điều khiển, đổi homoglyph.
export function lamSachGoc(chu) {
  return String(chu ?? '')
    .normalize('NFKC')
    .replace(/[\p{Cf}\p{Cc}]/gu, '')
    .replace(/[аеорсхуіАЕОРСХУІ]/g, (c) => HOMOGLYPH[c.toLowerCase()] || c);
}

// Bỏ dấu tiếng Việt, hạ chữ thường. Trả { a: các từ cách nhau một dấu cách, b: gỡ hết dấu phân cách [\s.\-_] }.
function dangSoSanh(chu) {
  const g = lamSachGoc(chu).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  return { a: g.replace(/[^a-z0-9]+/g, ' ').trim(), b: g.replace(/[\s.\-_]+/g, '') };
}

// Từ khóa (đã bỏ dấu) để đoán chủ đề khi ứng viên chưa gắn chủ đề: dùng cụm cụ thể, không dùng từ đơn như "tin", "việc".
// Không khớp cụm nào thì trả null và ứng viên bị chặn (ngoài danh sách).
const TU_KHOA_CHU_DE = {
  han_viec: /\b(co han|han chot|han nop|han viec|deadline|gio hen|ngay hen|ngay han)\b/,
  du_an: /\b(du an|thuoc du an|gan du an)\b/,
  nhom_viec: /\b(nhom [123]|nhom viec|phan nhom|claude tu lam|claude chuan bi)\b/,
  ten_viec: /\b(ten viec|tieu de viec|dat ten viec|viet ten viec)\b/,
  nguon_tin: /\b(tin (zalo|gmail|email|thu|nhom|chat)|tin gui tu|thu (gui )?tu|email tu|cuoc hop|ghi am|nhom chat|nguoi gui)\b/,
  tach_viec: /\b(tach viec|tao viec|them viec|huy viec|bo viec|giao viec|nhan loi|tin nhan (zalo|nhom))\b/,
};

export function doanChuDe(noiDung) {
  const c = dangSoSanh(noiDung).a;
  for (const [ma, re] of Object.entries(TU_KHOA_CHU_DE)) if (re.test(c)) return ma;
  return null;
}

// Dữ liệu bí mật: kiểm trên chữ gốc đã làm sạch (số, khóa), chữ đã bỏ dấu (từ khóa tiếng Việt) và bản gỡ dấu phân cách.
const MAT_KHAU_OTP = /\b(mat khau|pass word|password|passwd|passcode|pin|otp|mk|pwd|cvv|cvc|ma xac (nhan|thuc)|ma bao mat|ma 2fa|the tin dung|credit card|o t p|m k|p w d|c v v)\b/;
const MAT_KHAU_GOP = /(matkhau|password|passwd|passcode|thetindung|creditcard|maxacnhan|maxacthuc|mabaomat)/;
const GIAY_TO = /\b(cmnd|cccd|can cuoc|ho chieu|so tai khoan|so the|stk|cvv|cvc)\b/;
const GIAY_TO_GOP = /(cccd|cmnd|hochieu|sotaikhoan|cancuoc)/;
const SO_THE = /(?<!\d)(?:\d[ .\-_]?){13,19}(?!\d)/; // 13-19 chữ số, giữa hai chữ số có tối đa một dấu cách, chấm, gạch
const SO_CCCD = /(?<!\d)(?:\d[ .\-_]?){11}\d(?!\d)/; // CCCD 12 số, có thể cách bằng dấu cách, chấm, gạch
const KHOA_API = /(\b(sk|pk|rk)[-_][A-Za-z0-9_-]{8,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAIza[0-9A-Za-z_-]{20,}|\bAKIA[0-9A-Z]{12,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|\bbearer\s+[A-Za-z0-9._~+\/=-]{8,}|\bauthorization\s*[:=]|\b[0-9a-f]{32,}\b|\b(api[ _-]?key|secret|token|bearer)\b\s*[:=]\s*\S{8,})/i;

// Nới quyền: lời dặn dạy AI bỏ bước người dùng phải làm, hoặc tự làm việc ra ngoài (gửi, chuyển, xóa, trả lời, thanh toán).
const HANH_DONG_NGOAI = '((?<!nguoi )gui|chuyen|xoa|tra loi|phan hoi|thanh toan|tra tien|dat hang)';
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
  /\b(dung|khong|khoi|dung co)( can)? hoi( lai)?\b/, // "đừng hỏi lại", "thì không hỏi lại"
  /\bkhong (can )?(bao|thong bao|nhac|xin phep)\b/,
  /\bcu (tao|lam|gui|xoa|chuyen|tra loi|thanh toan|them)\b/, // "cứ tạo việc luôn"
  /\bchuyen (tien|khoan)\b/,
  new RegExp(`\\btu dong (\\w+ ){0,3}${HANH_DONG_NGOAI}\\b`),
  new RegExp(`\\b(tu dong|khong can|dung hoi|khong hoi|khong bao)\\b.{0,40}\\b${HANH_DONG_NGOAI}\\b`),
  new RegExp(`\\b${HANH_DONG_NGOAI}\\b.{0,40}\\b(tu dong|khong can|dung hoi|khong hoi|khong bao)\\b`),
];

// Dùng chung cho mọi chỗ lưu chữ người dùng/AI: có bí mật (khóa, mật khẩu, OTP, số thẻ, số giấy tờ) thì true.
export function coBiMat(chu) {
  return lyDoBiMat(chu) !== '';
}

function lyDoBiMat(chu) {
  const goc = lamSachGoc(chu);
  const { a, b } = dangSoSanh(chu);
  if (KHOA_API.test(goc)) return 'Chứa khóa API hoặc mã truy cập.';
  if (MAT_KHAU_OTP.test(a) || MAT_KHAU_GOP.test(b)) return 'Nhắc tới mật khẩu hoặc mã OTP.';
  if (SO_THE.test(goc)) return 'Chứa chuỗi số giống số thẻ.';
  if (GIAY_TO.test(a) || GIAY_TO_GOP.test(b) || SO_CCCD.test(goc)) return 'Chứa hoặc nhắc tới số giấy tờ (CCCD, hộ chiếu, tài khoản).';
  return '';
}

// ungVien: { noi_dung, chu_de?, do_tin? (số 0-1, thiếu thì 0), pham_vi? ('ca_nhan' | 'to_chuc', mặc định 'ca_nhan'), nguoi_xac_nhan? ({ id, vai_tro }) }
// ctx: { soDaNhanHomNay? (mặc định 0), haMuc?, nguongTin?, chuDeChoPhep? }
// Trả { ok, lyDo }: ok true thì lyDo rỗng.
export function kiemUngVien(ungVien, ctx = {}) {
  const tu = (lyDo) => ({ ok: false, lyDo });
  const u = ungVien && typeof ungVien === 'object' ? ungVien : {};
  const chu = String(u.noi_dung ?? '').trim();
  if (!chu) return tu('Nội dung trống.');
  if (chu.length > TOI_DA_KY_TU) return tu(`Nội dung dài quá ${TOI_DA_KY_TU} ký tự.`);

  const bi = lyDoBiMat(chu);
  if (bi) return tu(bi);
  const khongDau = dangSoSanh(chu).a;
  if (NOI_QUYEN.some((re) => re.test(khongDau))) return tu('Nới quyền: dạy AI bỏ qua bước người dùng phải duyệt hoặc xác nhận.');

  const chuDe = u.chu_de ?? doanChuDe(chu);
  if (!(ctx.chuDeChoPhep || CHU_DE_CHO_PHEP).includes(chuDe)) return tu('Chủ đề ngoài danh sách cho phép.');

  // Độ tin phải là số 0..1; thiếu thì 0. null, true, chuỗi, 5 đều không qua.
  const doTin = u.do_tin == null ? 0 : u.do_tin;
  const nguong = ctx.nguongTin ?? NGUONG_DO_TIN;
  if (typeof doTin !== 'number' || !Number.isFinite(doTin) || doTin < 0 || doTin > 1) return tu('Độ tin không hợp lệ (phải là số từ 0 đến 1).');
  if (doTin < nguong) return tu(`Độ tin ${doTin} thấp hơn ngưỡng ${nguong}.`);

  if (u.pham_vi === 'to_chuc') {
    const ai = u.nguoi_xac_nhan;
    if (!ai || !ai.id || !VAI_TRO_AP_CHO_TO_CHUC.includes(ai.vai_tro)) return tu('Học từ một người rồi áp cho cả tổ chức cần người xác nhận có quyền.');
  } else if (u.pham_vi != null && u.pham_vi !== 'ca_nhan') return tu('Phạm vi áp dụng không hợp lệ.');

  if ((ctx.soDaNhanHomNay ?? 0) >= (ctx.haMuc ?? HAN_MUC_MOI_NGAY)) return tu('Vượt hạn mức ứng viên trong ngày.');
  return { ok: true, lyDo: '' };
}
