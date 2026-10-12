// Đọc ngày và giờ viết bằng tiếng Việt trong tiêu đề hoặc nội dung tin: "13/10", "ngày 13 tháng 10", "mai", "thứ 3 tuần sau",
// "18h15", "6 giờ chiều"... Chạy bằng code, không phụ thuộc AI, để việc có ngày giờ không bao giờ rơi vào "Chưa có hạn".

import { chuanHoa, congNgay, ngayVN } from './tien-ich.js';

const THU = { hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

const homDo = (ngay) => new Date(`${ngay}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật
const hopLe = (nam, thang, ngay) => {
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  return thang >= 1 && thang <= 12 && d.getUTCMonth() === thang - 1 && d.getUTCDate() === ngay;
};
const dinhDang = (nam, thang, ngay) => `${nam}-${String(thang).padStart(2, '0')}-${String(ngay).padStart(2, '0')}`;

// Ngày cụ thể ghi trong chữ (dd/mm, dd-mm, dd/mm/yyyy, "ngày 13 tháng 10"); chưa ghi năm thì lấy lần tới gần nhất.
function ngayTuyetDoi(t, homNay) {
  const [namNay] = homNay.split('-').map(Number);
  // Dấu / luôn là ngày tháng; dấu - và . dễ nhầm ("2-3 bên", "1.5 giờ") nên cần có năm hoặc chữ ngày, hạn, trước... đứng trước.
  let m = t.match(/(?:^|[^\d])(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?(?![\d:])/)
    || t.match(/(?:ngay|han|truoc|den|vao|toi|het)\s+(\d{1,2})\s*[.\-]\s*(\d{1,2})(?:\s*[.\-]\s*(\d{2,4}))?(?![\d:])/)
    || t.match(/(?:^|[^\d])(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})(?!\d)/);
  // "13-10" (ngày lớn hơn tháng) chỉ có thể là ngày; "2-3" tăng dần thường là khoảng số lượng nên bỏ qua.
  if (!m) {
    const g = t.match(/(?:^|[^\d.\-])(\d{1,2})\s*[.\-]\s*(\d{1,2})(?![\d:.\-])/);
    if (g && Number(g[1]) > Number(g[2])) m = g;
  }
  let khop = m && { ngay: Number(m[1]), thang: Number(m[2]), nam: m[3] };
  if (!khop) {
    m = t.match(/(?:^|\s)(?:ngay\s+)?(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+(?:nam\s+)?(\d{4}))?/);
    khop = m && { ngay: Number(m[1]), thang: Number(m[2]), nam: m[3] };
  }
  if (!khop) return null;
  let nam = khop.nam ? (khop.nam.length === 2 ? 2000 + Number(khop.nam) : Number(khop.nam)) : namNay;
  if (!hopLe(nam, khop.thang, khop.ngay)) return null;
  let kq = dinhDang(nam, khop.thang, khop.ngay);
  if (!khop.nam && kq < congNgay(homNay, -60)) { nam += 1; if (hopLe(nam, khop.thang, khop.ngay)) kq = dinhDang(nam, khop.thang, khop.ngay); }
  return kq;
}

function ngayTuongDoi(t, homNay) {
  if (/\bngay kia\b|\bmot\b/.test(t)) return congNgay(homNay, 2);
  if (/\b(ngay mai|sang mai|chieu mai|toi mai|mai)\b/.test(t)) return congNgay(homNay, 1);
  if (/\b(hom nay|sang nay|chieu nay|toi nay|trua nay|dem nay)\b/.test(t)) return homNay;
  const th = t.match(/\b(?:thu|t)\s*(hai|ba|tu|bay|nam|sau|[2-7])\b(?:\s+(tuan\s+(?:sau|toi|nay)))?/) || t.match(/\bchu nhat\b()(?:\s+(tuan\s+(?:sau|toi|nay)))?/);
  if (th) {
    const muc = t.includes('chu nhat') && !th[1] ? 0 : THU[th[1]];
    if (muc === undefined) return null;
    const dang = homDo(homNay);
    const toiThu = (muc - dang + 7) % 7; // 0 nếu trùng hôm nay
    const tuan = th[2] || '';
    if (/tuan (sau|toi)/.test(tuan)) {
      const dauTuanSau = congNgay(homNay, 8 - (dang === 0 ? 7 : dang)); // thứ Hai tuần sau
      return congNgay(dauTuanSau, muc === 0 ? 6 : muc - 1);
    }
    return congNgay(homNay, toiThu === 0 ? 7 : toiThu);
  }
  return null;
}

// Giờ hẹn "HH:MM": 18:15, 18h15, 18h, 6 giờ chiều, 6h30 tối, 14 giờ.
export function gioTuChu(chu) {
  const t = chuanHoa(chu).replace(/ gio /g, ' h ').replace(/(\d)\s*gio\b/g, '$1h');
  let m = String(chu).match(/(?:^|[^\d])([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?!\d)/);
  let g;
  let p;
  if (m) { g = Number(m[1]); p = Number(m[2]); } else {
    m = t.match(/(?:^|\s)([01]?\d|2[0-3])\s*h(?:\s*([0-5]\d)(?!\d))?(?:\s+(sang|trua|chieu|toi|dem))?/);
    if (!m) return null;
    g = Number(m[1]); p = m[2] ? Number(m[2]) : 0;
    if (m[3] && g < 12 && (m[3] === 'chieu' || m[3] === 'toi' || m[3] === 'dem') && g !== 0) g += 12;
    if (m[3] === 'trua' && g < 11) g += 12;
  }
  return `${String(g).padStart(2, '0')}:${String(p).padStart(2, '0')}`;
}

// Trả { han_ngay, gio_hen } đọc được từ chữ (null nếu không thấy). mocGui: thời điểm gửi tin (để hiểu "mai", "thứ 3").
export function docNgayGio(chu, mocGui = new Date()) {
  const homNay = ngayVN(mocGui);
  const t = ` ${chuanHoa(chu)} `;
  const tho = ` ${String(chu).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')} `;
  const han = ngayTuyetDoi(tho, homNay) ?? ngayTuyetDoi(t, homNay) ?? ngayTuongDoi(t, homNay);
  return { han_ngay: han, gio_hen: gioTuChu(chu) };
}

// Việc có giờ mà không có ngày: hôm nay, hoặc ngày mai nếu giờ đó đã qua (theo giờ Việt Nam lúc gửi).
export function ngayChoGio(gio, mocGui = new Date()) {
  const homNay = ngayVN(mocGui);
  const bay = new Date(new Date(mocGui).getTime() + 7 * 3600 * 1000);
  const phutNay = bay.getUTCHours() * 60 + bay.getUTCMinutes();
  const [g, p] = gio.split(':').map(Number);
  return g * 60 + p > phutNay ? homNay : congNgay(homNay, 1);
}

// Điền hạn và giờ còn thiếu của một việc từ tiêu đề, ghi chú và tin gốc. Ngày ghi rõ dạng dd/mm trong tiêu đề thắng ngày AI đoán.
export function boSungHan(viec, nguonChu = '', mocGui = new Date()) {
  const ra = { ...viec };
  const trongTieuDe = docNgayGio(viec.tieu_de || '', mocGui);
  const coDdMm = /\d{1,2}\s*[/.-]\s*\d{1,2}|\d{1,2}\s+thang\s+\d{1,2}/i.test(chuanHoa(viec.tieu_de || '').replace(/\s+/g, ' ')) || /\d{1,2}\s*[/.-]\s*\d{1,2}/.test(viec.tieu_de || '');
  if (coDdMm && trongTieuDe.han_ngay) ra.han_ngay = trongTieuDe.han_ngay;
  // Chỉ đọc tiêu đề và tin gốc ngắn (chat). Thư dài và ghi chú AI nhắc nhiều ngày khác nhau nên dễ đọc nhầm.
  for (const chu of [viec.tieu_de, String(nguonChu || '').length <= 300 ? nguonChu : '']) {
    if (!chu || (ra.han_ngay && ra.gio_hen)) continue;
    const d = docNgayGio(chu, mocGui);
    if (!ra.han_ngay && d.han_ngay) ra.han_ngay = d.han_ngay;
    if (!ra.gio_hen && d.gio_hen) ra.gio_hen = d.gio_hen;
  }
  if (ra.gio_hen && !ra.han_ngay) ra.han_ngay = ngayChoGio(ra.gio_hen, mocGui);
  return ra;
}
