// Danh sách tác vụ hẹn giờ và lịch chạy của từng tác vụ (giờ UTC).
// Tác vụ "bat: false" đã giữ chỗ nhưng chưa chạy, cũng không ghi nhật ký.

export const TAC_VU = [
  { ma: 'tu-kiem', ten: 'Tự kiểm hẹn giờ', lich: '0 * * * *', bat: true, giai_doan: 0 },
  { ma: 'tach-viec', ten: 'Tách việc từ tin mới', lich: '*/5 * * * *', bat: true, giai_doan: 1 },
  { ma: 'bao-viec-moi', ten: 'Báo việc mới qua Telegram', lich: '0 * * * *', bat: true, giai_doan: 2 },
  { ma: 'canh-zalo', ten: 'Canh tín hiệu Zalo', lich: '0 * * * *', bat: true, giai_doan: 3 },
  { ma: 'ban-tin', ten: 'Bản tin 8h sáng và nhắc 17h', lich: '0 * * * *', bat: true, giai_doan: 2 },
  { ma: 'goi-y', ten: 'Gợi ý cho việc mới', lich: '0 * * * *', bat: true, giai_doan: 2 },
  { ma: 'bao-cao-tuan', ten: 'Báo cáo tuần', lich: '0 * * * *', bat: true, giai_doan: 3 },
  { ma: 'canh-viec', ten: 'Canh việc bị mất hàng loạt', lich: '0 * * * *', bat: true, giai_doan: 3 },
  { ma: 'don-cuoi-ngay', ten: 'Dời việc chưa xong sang mai', lich: '0 16 * * *', bat: true, giai_doan: 3 },
  { ma: 'sao-luu', ten: 'Sao lưu dữ liệu hằng đêm', lich: '0 16 * * *', bat: true, giai_doan: 3 },
];

export function tacVuTheoLich(lich) {
  return TAC_VU.filter((t) => t.bat && t.lich === lich);
}

// Hẹn giờ trong wrangler.jsonc phải khớp đúng các lịch ở đây; kiểm thử dùng hàm này để so.
export function cacLich() {
  return [...new Set(TAC_VU.map((t) => t.lich))].sort();
}
