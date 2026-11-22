// Tab xem đã lưu của trang Việc: một tab là tổ hợp kiểu xem, bộ lọc dự án, bộ lọc phụ và cách sắp xếp.
// Danh sách lưu phía máy chủ (cai_dat, mỗi người một khóa) để máy tính và điện thoại dùng chung.
// Phần này không chạm DOM để kiểm thử được.
import { GIA_TRI_HOP_LE } from './tuy-chon-viec.js';

export const TRUONG_TAB = ['xem', 'duAn', 'nguon', 'han', 'gio', 'nang', 'claude', 'sapXep', 'chiSao'];
const MAC_DINH = { xem: 'du-an', duAn: 'tat-ca', nguon: 'tat-ca', han: 'tat-ca', gio: 'tat-ca', nang: 'tat-ca', claude: 'tat-ca', sapXep: 'tay', chiSao: false };

// Lấy tổ hợp hiện tại từ trạng thái trang Việc.
export function chupTab(v) {
  return Object.fromEntries(TRUONG_TAB.map((k) => [k, v[k] ?? MAC_DINH[k]]));
}

// Kiểm lại một tab đọc từ máy chủ: giá trị lạ thì về mặc định; bộ lọc dự án là 'tat-ca', 'khong' hoặc mã số.
export function chuanTab(t) {
  const ra = { id: String(t?.id || ''), ten: String(t?.ten || '').slice(0, 40) };
  for (const k of TRUONG_TAB) {
    if (k === 'chiSao') ra.chiSao = t?.chiSao === true;
    else if (k === 'duAn') ra.duAn = t?.duAn === 'khong' || /^\d+$/.test(String(t?.duAn ?? '')) ? String(t.duAn) : 'tat-ca';
    else ra[k] = GIA_TRI_HOP_LE[k].includes(t?.[k]) ? t[k] : MAC_DINH[k];
  }
  return ra;
}

// Áp một tab vào trạng thái trang Việc (đổi tại chỗ). Bộ lọc dự án là số thì đổi về số như các chip dự án.
export function apTab(v, t) {
  const c = chuanTab(t);
  for (const k of TRUONG_TAB) v[k] = k === 'duAn' && /^\d+$/.test(c.duAn) ? Number(c.duAn) : c[k];
  v.tab = 'mo';
  return v;
}

// Tab đang khớp với tổ hợp hiện tại (để tô sáng), so từng trường.
export function laTabHienTai(v, t) {
  const a = chupTab(v);
  const b = chuanTab(t);
  return TRUONG_TAB.every((k) => String(a[k]) === String(b[k]));
}

export function maTabMoi(ds) {
  let i = ds.length + 1;
  while (ds.some((t) => t.id === `t${i}`)) i += 1;
  return `t${i}`;
}
