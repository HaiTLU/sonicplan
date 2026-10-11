// Tính đèn cho từng phần của hệ thống, theo từng tổ chức.
// Hàm thuần, không gọi CSDL, để kiểm thử được.

import { TAC_VU } from './lich-chay.js';

// Hẹn giờ tự kiểm chạy mỗi giờ; quá 75 phút không thấy là có vấn đề.
const HEN_GIO_TRE_PHUT = 75;

export const KET_NOI = [
  { loai: 'thu', ten: 'Thư chuyển tiếp', chua_noi: 'Chưa có thư nào về, cài chuyển tiếp ở trang Kết nối' },
  { loai: 'zalo', ten: 'Tin Zalo', chua_noi: 'Chưa nối máy gửi Zalo' },
  { loai: 'tep', ten: 'Kho tệp', chua_noi: 'Chưa gắn kho tệp R2' },
  { loai: 'lich', ten: 'Lịch', chua_noi: 'Chưa tạo đường dẫn lịch' },
  { loai: 'ai', ten: 'AI tách việc', chua_noi: 'Chưa gắn Workers AI' },
  { loai: 'telegram', ten: 'Báo Telegram', chua_noi: 'Chưa nối Telegram' },
];

const DEN_KET_NOI = {
  dang_chay: { den: 'xanh', mo_ta: 'Đang chạy' },
  cho: { den: 'vang', mo_ta: 'Đang chờ' },
  loi: { den: 'do', mo_ta: 'Đang lỗi' },
  tat: { den: 'xam', mo_ta: 'Đã tắt' },
};

export function tinhTinhTrang({ tinHieuHeThong, ketNoi, lanChayCuoi, bayGio }) {
  const ketNoiTheoLoai = Object.fromEntries(ketNoi.map((k) => [k.loai, k]));
  const thanhPhan = [
    { ma: 'may-chu', ten: 'Máy chủ', den: 'xanh', mo_ta: 'Đang trả lời' },
    { ma: 'csdl', ten: 'Cơ sở dữ liệu', den: 'xanh', mo_ta: 'Đọc ghi được' },
    denHenGio(tinHieuHeThong.find((t) => t.nguon === 'hen-gio'), bayGio),
    ...KET_NOI.map((k) => {
      const dong = ketNoiTheoLoai[k.loai];
      const den = dong && DEN_KET_NOI[dong.trang_thai];
      if (den) return { ma: k.loai, ten: k.ten, den: den.den, mo_ta: dong.mo_ta || den.mo_ta, lan_cuoi: dong.cap_nhat_luc || null };
      return { ma: k.loai, ten: k.ten, den: 'xam', mo_ta: k.chua_noi };
    }),
  ];

  const lanCuoiTheoMa = Object.fromEntries(lanChayCuoi.map((l) => [l.tac_vu, l]));
  const tacVu = TAC_VU.map((t) => ({
    ma: t.ma,
    ten: t.ten,
    lich: t.lich,
    bat: t.bat,
    giai_doan: t.giai_doan,
    lan_cuoi: lanCuoiTheoMa[t.ma] || null,
  }));

  return { luc: new Date(bayGio).toISOString(), thanh_phan: thanhPhan, tac_vu: tacVu };
}

function denHenGio(tinHieu, bayGio) {
  const goc = { ma: 'hen-gio', ten: 'Hẹn giờ' };
  if (!tinHieu) return { ...goc, den: 'vang', mo_ta: 'Chưa chạy lần nào, chờ tới đầu giờ kế tiếp' };
  const phut = Math.floor((bayGio - Date.parse(tinHieu.lan_cuoi)) / 60000);
  if (phut > HEN_GIO_TRE_PHUT) return { ...goc, den: 'do', mo_ta: `Không chạy đã ${phut} phút`, lan_cuoi: tinHieu.lan_cuoi };
  return { ...goc, den: 'xanh', mo_ta: `Chạy ${phut} phút trước`, lan_cuoi: tinHieu.lan_cuoi };
}
