// Hàm dùng chung: trả JSON, băm mã, giờ Việt Nam, so tiêu đề gần giống.

export function json(duLieu, trangThai = 200) {
  return new Response(JSON.stringify(duLieu), {
    status: trangThai,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
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

export function congNgay(ngay, soNgay) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

// Giờ hẹn VN (ngày + "HH:MM") sang thời điểm UTC.
export function sangUTC(ngay, gio) {
  return new Date(new Date(`${ngay}T${gio}:00Z`).getTime() - LECH_VN_MS);
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
