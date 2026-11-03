// Hàm dùng chung: trả JSON, băm mã, giờ Việt Nam, so tiêu đề gần giống.

export function json(duLieu, trangThai = 200) {
  return new Response(JSON.stringify(duLieu), {
    status: trangThai,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

// Mọi lỗi API cùng một dạng: mã trạng thái và một câu tiếng Việt, không lộ chi tiết kỹ thuật.
export function loi(trangThai, thongBao) {
  return json({ loi: thongBao }, trangThai);
}

export async function bam(chuoi) {
  const so = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chuoi));
  return [...new Uint8Array(so)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Mã ngẫu nhiên dạng chữ thường và số, đủ dài để không đoán được.
export function maNgauNhien(doDai = 32) {
  const chu = 'abcdefghijkmnpqrstuvwxyz23456789';
  const so = crypto.getRandomValues(new Uint8Array(doDai));
  return [...so].map((b) => chu[b % chu.length]).join('');
}

// Việt Nam không đổi giờ theo mùa: luôn UTC+7.
const LECH_VN_MS = 7 * 3600 * 1000;

export function ngayVN(thoiDiem = new Date()) {
  return new Date(new Date(thoiDiem).getTime() + LECH_VN_MS).toISOString().slice(0, 10);
}

export function gioVN(thoiDiem = new Date()) {
  return new Date(new Date(thoiDiem).getTime() + LECH_VN_MS).getUTCHours();
}

// Ngày YYYY-MM-DD có thật trên lịch (loại 2026-11-31, 2026-02-30). Lịch Google từ chối ngày không có thật.
export function ngayCoThat(ngay) {
  if (typeof ngay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return false;
  const d = new Date(`${ngay}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ngay;
}

export function congNgay(ngay, soNgay) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

// Giờ hẹn VN (ngày + "HH:MM") sang thời điểm UTC.
export function sangUTC(ngay, gio) {
  return new Date(new Date(`${ngay}T${gio}:00Z`).getTime() - LECH_VN_MS);
}

// Buổi của việc chưa có giờ cụ thể: sáng 8-12h, chiều 13-17h. 'ca_ngay' hoặc rỗng là cả ngày.
export const BUOI = { sang: ['08:00', '12:00'], chieu: ['13:00', '17:00'] };
export const DS_BUOI = ['sang', 'chieu', 'ca_ngay'];
const PHUT_SU_KIEN = 30;

// Khung giờ của sự kiện lịch: { bat_dau, ket_thuc, sang_ngay_sau } hoặc null nếu là sự kiện cả ngày.
// Có giờ hẹn thì lấy giờ hẹn + 30 phút (ưu tiên hơn buổi); không thì theo buổi.
export function khungGio(viec) {
  if (viec.gio_hen) {
    const [g, p] = viec.gio_hen.split(':').map(Number);
    const tong = g * 60 + p + PHUT_SU_KIEN;
    const ket = `${String(Math.floor((tong % 1440) / 60)).padStart(2, '0')}:${String(tong % 60).padStart(2, '0')}`;
    return { bat_dau: viec.gio_hen, ket_thuc: ket, sang_ngay_sau: tong >= 1440 };
  }
  const b = BUOI[viec.buoi];
  return b ? { bat_dau: b[0], ket_thuc: b[1], sang_ngay_sau: false } : null;
}

// Bỏ dấu, chữ thường, chỉ giữ chữ và số: để so hai tiêu đề việc.
export function chuanHoa(chuoi) {
  return String(chuoi || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Độ giống nhau theo cặp ký tự (hệ số Dice), từ 0 tới 1.
export function doGiong(a, b) {
  const x = chuanHoa(a);
  const y = chuanHoa(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const cap = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const k = s.slice(i, i + 2);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  };
  const cx = cap(x);
  const cy = cap(y);
  let chung = 0;
  for (const [k, n] of cx) chung += Math.min(n, cy.get(k) || 0);
  return (2 * chung) / (x.length - 1 + y.length - 1);
}

export function cat(chuoi, toiDa) {
  const s = String(chuoi ?? '');
  return s.length > toiDa ? `${s.slice(0, toiDa - 1)}…` : s;
}
