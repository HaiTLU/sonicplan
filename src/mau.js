// Bảng màu dùng chung với Google Lịch: mã '1'..'11' chính là colorId của sự kiện Lịch.
export const MAU_HOP_LE = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

// Trả về mã màu hợp lệ, null (bỏ màu), hoặc undefined (sai).
export function chuanMau(v) {
  if (v === null || v === '' || v === undefined) return null;
  const s = String(v);
  return MAU_HOP_LE.includes(s) ? s : undefined;
}
