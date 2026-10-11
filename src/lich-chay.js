// Danh sách tác vụ hẹn giờ và lịch chạy của từng tác vụ.
// Tác vụ "bat: false" là của giai đoạn sau: đã giữ chỗ nhưng chưa chạy, cũng không ghi nhật ký.

export const TAC_VU = [
  { ma: 'tu-kiem', ten: 'Tự kiểm hẹn giờ', lich: '0 * * * *', bat: true, giai_doan: 0 },
  { ma: 'kiem-gmail', ten: 'Kiểm Gmail', lich: '*/5 * * * *', bat: false, giai_doan: 1 },
  { ma: 'goi-y-viec', ten: 'Gợi ý việc mỗi giờ', lich: '0 * * * *', bat: false, giai_doan: 2 },
  { ma: 'canh-zalo', ten: 'Canh tín hiệu Zalo', lich: '0 * * * *', bat: false, giai_doan: 3 },
  { ma: 'don-cuoi-ngay', ten: 'Dọn việc cuối ngày', lich: '0 16 * * *', bat: false, giai_doan: 3 },
];

export function tacVuTheoLich(lich) {
  return TAC_VU.filter((t) => t.bat && t.lich === lich);
}

// Hẹn giờ trong wrangler.jsonc phải khớp đúng các lịch ở đây; kiểm thử dùng hàm này để so.
export function cacLich() {
  return [...new Set(TAC_VU.map((t) => t.lich))].sort();
}
