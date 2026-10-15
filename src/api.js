// API cho giao diện. Mọi hàm nhận phien (người dùng và tổ chức đã xác định) và chỉ đọc ghi
// dữ liệu của phien.to_chuc.id. Tệp này chỉ chuyển yêu cầu tới đúng nhóm trong src/api/.

import { xuLyTaiKhoan } from './api/tai-khoan.js';
import { xuLyTongQuan } from './api/tong-quan.js';
import { xuLyTin } from './api/tin.js';
import { xuLyViec } from './api/viec.js';
import { xuLyDuAn } from './api/du-an.js';
import { xuLyLuong } from './api/luong.js';
import { xuLyGhiNho } from './api/ghi-nho.js';
import { xuLyGoogleNhan } from './api/google-nhan.js';
import { xuLyTep } from './api/tep.js';
import { xuLyKetNoi } from './api/ket-noi.js';
import { xuLyApiThongBao } from './thong-bao.js';
import { xuLyHieuSuat } from './hieu-suat.js';
import { xuLyGame } from './game.js';
import { loi } from './tien-ich.js';

// Giữ đường dẫn cũ cho nơi khác đang nhập từ đây.
export { kiemViec, sapXepViec } from './api/viec.js';
export { dsHoiThoaiZalo, chuyenTinSangHoiThoai, tinHoiThoaiZalo } from './api/tin.js';
export { KHOI_TONG_QUAN, chuanBoCuc } from './api/tong-quan.js';

export async function xuLyApi(yeuCau, env, phien, url) {
  const p = url.pathname;

  const taiKhoan = await xuLyTaiKhoan(yeuCau, env, phien, url);
  if (taiKhoan) return taiKhoan;
  if (p === '/api/thong-bao' || p.startsWith('/api/thong-bao/')) return xuLyApiThongBao(yeuCau, env, phien, url);
  if (p.startsWith('/api/hieu-suat')) return xuLyHieuSuat(yeuCau, env, phien.to_chuc.id, p);
  if (p === '/api/game' || p.startsWith('/api/game/')) return xuLyGame(yeuCau, env, phien.to_chuc.id, p);

  for (const nhom of [xuLyTongQuan, xuLyTin, xuLyViec, xuLyDuAn, xuLyLuong, xuLyGhiNho, xuLyGoogleNhan, xuLyTep, xuLyKetNoi]) {
    const kq = await nhom(yeuCau, env, phien, url);
    if (kq) return kq;
  }

  return loi(404, 'Không có chức năng này.');
}
