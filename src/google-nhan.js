// Nhãn gắn vào tiêu đề hoặc ghi chú của Google Tasks và Lịch, lấy từ dữ liệu Sonicplan: [Xong], [Hôm nay], [Zalo]...
// Cấu hình lưu một lần cho cả tổ chức. Phần này là hàm thuần để kiểm thử.

import { congNgay } from './tien-ich.js';

export const LOAI_NHAN = [
  { ma: 'xong', ten: 'Xong', vi_du: 'Xong' },
  { ma: 'han', ten: 'Hạn (Quá hạn, Hôm nay, Ngày mai)', vi_du: 'Hôm nay' },
  { ma: 'nguon', ten: 'Nguồn (Zalo, Gmail, Telegram, Tự thêm)', vi_du: 'Zalo' },
  { ma: 'du_an', ten: 'Tên dự án', vi_du: 'Dự án' },
  { ma: 'nguoi', ten: 'Người hoặc nhóm gửi', vi_du: 'Người gửi' },
];
export const CHE_DO = ['ca-hai', 'tasks', 'lich'];
const MA_NHAN = LOAI_NHAN.map((l) => l.ma);
const TEN_NGUON = { zalo: 'Zalo', gmail: 'Gmail', telegram: 'Telegram', api: 'Dịch vụ ngoài', tay: 'Tự thêm' };
const MAU_XONG = '8'; // xám (Graphite) trong bảng màu Lịch

export const MAC_DINH = { che_do: 'ca-hai', cho: 'tieu_de', bat: [] };

// Nhận chuỗi JSON hoặc đối tượng, trả về cấu hình hợp lệ: bat là danh sách loại nhãn theo thứ tự hiện.
export function chuanCauHinh(vao) {
  let o = vao;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = {}; } }
  if (!o || typeof o !== 'object') o = {};
  const bat = [...new Set((Array.isArray(o.bat) ? o.bat : []).map(String).filter((m) => MA_NHAN.includes(m)))];
  return { che_do: CHE_DO.includes(o.che_do) ? o.che_do : MAC_DINH.che_do, cho: o.cho === 'ghi_chu' ? 'ghi_chu' : 'tieu_de', bat };
}

const sach = (s) => String(s || '').replace(/[[\]]/g, '').trim();

// Việc cần: tieu_de, ghi_chu, han_ngay, trang_thai, nguon, tin_nguon, tin_nguoi_gui, tin_nhom, du_an_ten.
export function nhanCuaViec(v, ch, homNay) {
  const ra = [];
  for (const ma of ch.bat) {
    if (ma === 'xong' && v.trang_thai === 'xong') ra.push('Xong');
    if (ma === 'han' && v.trang_thai === 'mo' && v.han_ngay) {
      if (v.han_ngay < homNay) ra.push('Quá hạn');
      else if (v.han_ngay === homNay) ra.push('Hôm nay');
      else if (v.han_ngay === congNgay(homNay, 1)) ra.push('Ngày mai');
    }
    if (ma === 'nguon') ra.push(TEN_NGUON[v.nguon || v.tin_nguon || 'tay'] || 'Tự thêm');
    if (ma === 'du_an' && v.du_an_ten) ra.push(sach(v.du_an_ten));
    if (ma === 'nguoi') {
      const ai = sach(v.tin_nhom || String(v.tin_nguoi_gui || '').split('<')[0]);
      if (ai) ra.push(ai);
    }
  }
  return ra.filter(Boolean);
}

// Trả về tiêu đề, ghi chú và màu để đẩy sang Google. Việc xong thì Lịch đổi màu xám khi bật nhãn Xong.
export function ganNhan(v, ch, homNay) {
  const nhan = nhanCuaViec(v, ch, homNay).map((x) => `[${x}]`).join(' ');
  let tieuDe = v.tieu_de;
  let ghiChu = v.ghi_chu || null;
  if (nhan) {
    if (ch.cho === 'ghi_chu') ghiChu = ghiChu ? `${nhan}\n${ghiChu}` : nhan;
    else tieuDe = `${nhan} ${tieuDe}`;
  }
  const xamHoa = ch.bat.includes('xong') && v.trang_thai === 'xong';
  return { tieu_de: tieuDe, ghi_chu: ghiChu, mau: xamHoa ? MAU_XONG : v.mau || null, nhan };
}

// Dấu vết nội dung đã đẩy, để so với lần sau.
export const dauVet = (g) => JSON.stringify([g.tieu_de, g.ghi_chu, g.mau]);

// Tách phần nhãn ở đầu tiêu đề khi đọc ngược từ Google, để không thành tên việc mới.
export function boNhanDau(tieuDe) {
  return String(tieuDe || '').replace(/^(\s*\[[^\]]{1,60}\])+\s*/, '').trim();
}
