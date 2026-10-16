// Giao diện Sonicplan, Phần dùng chung: định dạng ngày giờ, dựng phần tử, gọi API, khung giải thích, trạng thái chung.
import { moMuc } from './dieu-huong.js';
import { docTuyChonViec } from './tuy-chon-viec.js';

const MUI_GIO = 'Asia/Ho_Chi_Minh';
export const fmt = {
  gioPhut: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: MUI_GIO }),
  ngayGio: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: MUI_GIO }),
  ngayDai: new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: MUI_GIO }),
  ngayNgan: new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }),
  ngayISO: new Intl.DateTimeFormat('en-CA', { timeZone: MUI_GIO }),
  gioSo: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: MUI_GIO }),
  so: new Intl.NumberFormat('vi-VN'),
};
export const homNay = () => fmt.ngayISO.format(new Date());
export const congNgay = (ngay, n) => {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const ngayHienThi = (ngay) => fmt.ngayNgan.format(new Date(`${ngay}T00:00:00Z`));
export function luc(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const phut = Math.round((Date.now() - d) / 60000);
  if (phut < 1) return 'vừa xong';
  if (phut < 60) return `${phut} phút`;
  if (fmt.ngayISO.format(d) === homNay()) return fmt.gioPhut.format(d);
  return fmt.ngayGio.format(d);
}
export function kichThuoc(b) {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${fmt.so.format(Math.round(b / 102.4) / 10)} KB`;
  return `${fmt.so.format(Math.round(b / 104857.6) / 10)} MB`;
}

// ---------- Dựng phần tử ----------
export function h(the, thuocTinh = {}, ...con) {
  const el = document.createElement(the);
  for (const [k, v] of Object.entries(thuocTinh || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of con.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const NS = 'http://www.w3.org/2000/svg';
export function s(the, thuocTinh = {}, ...con) {
  const el = document.createElementNS(NS, the);
  for (const [k, v] of Object.entries(thuocTinh)) if (v != null) el.setAttribute(k, v);
  for (const c of con.flat()) if (c) el.append(c);
  return el;
}
export function icon(ten) {
  const el = s('svg', { 'aria-hidden': 'true' });
  el.append(s('use', { href: `#i-${ten}` }));
  return el;
}

// ---------- Gọi API ----------
export async function api(duongDan, tuyChon = {}) {
  const ph = await fetch(duongDan, {
    ...tuyChon,
    headers: { accept: 'application/json', ...(tuyChon.body && !(tuyChon.body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
  });
  const duLieu = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(duLieu.loi || 'Không đọc được dữ liệu. Tải lại trang để thử lại.');
  return duLieu;
}

export function bao(noiDung, { loi = false, hanhDong } = {}) {
  const el = h('div', { class: `bao${loi ? ' loi' : ''}` }, h('span', { text: noiDung }));
  if (hanhDong) el.append(h('button', { type: 'button', text: hanhDong.nhan, onclick: () => { hanhDong.lam(); el.remove(); } }));
  document.getElementById('vung-bao').append(el);
  setTimeout(() => el.remove(), hanhDong ? 6000 : 3500);
}

export function khungLoi(e, thuLai) {
  return h('div', { class: 'bao-loi-trang', role: 'alert' }, h('span', { text: e.message }), h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Thử lại', onclick: thuLai }));
}

// ---------- Khung giải thích khi rê chuột ----------
// Phần tử có data-meo hiện khung giải thích khi rê chuột, chạm hoặc dùng phím Tab tới. Một khung dùng chung cho cả trang.
const khungMeo = h('div', { class: 'meo', role: 'tooltip', id: 'meo', hidden: true });
document.body.append(khungMeo);
let meoDangChi = null;
function hienMeo(el) {
  if (meoDangChi === el) return;
  meoDangChi = el;
  khungMeo.textContent = el.dataset.meo;
  khungMeo.hidden = false;
  const r = el.getBoundingClientRect();
  const k = khungMeo.getBoundingClientRect();
  const trai = Math.min(Math.max(8, r.left + r.width / 2 - k.width / 2), window.innerWidth - k.width - 8);
  const duoi = r.bottom + 8 + k.height < window.innerHeight;
  khungMeo.style.left = `${trai}px`;
  khungMeo.style.top = `${duoi ? r.bottom + 8 : Math.max(8, r.top - k.height - 8)}px`;
}
function anMeo() {
  meoDangChi = null;
  khungMeo.hidden = true;
}
document.addEventListener('pointerover', (e) => { const el = e.target.closest?.('[data-meo]'); if (el) hienMeo(el); else if (meoDangChi) anMeo(); });
document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-meo]'); if (el) hienMeo(el); else if (meoDangChi) anMeo(); });
document.addEventListener('focusout', anMeo);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && meoDangChi) anMeo(); });
window.addEventListener('scroll', anMeo, { passive: true, capture: true });
window.addEventListener('hashchange', anMeo);
export const meo = (chu) => ({ 'data-meo': chu, 'aria-describedby': 'meo' });

// Liên kết sang một trang kèm bộ lọc: đặt trạng thái lọc rồi đổi địa chỉ; đang ở đúng trang thì vẽ lại.
function denMuc(hash, dat) {
  return (e) => {
    dat?.();
    if (location.hash === `#${hash}`) { e.preventDefault(); moMuc(); }
  };
}
export const lienKet = (hash, dat, them = {}, ...con) => h('a', { href: `#${hash}`, onclick: denMuc(hash, dat), ...them }, ...con);
export const locTin = (loc, gio = null) => () => { trang.tin.loc = loc; trang.tin.gio = gio; trang.tin.chon = null; };
export const locViec = (tab) => () => { trang.viec.tab = tab; trang.viec.xem = 'han'; trang.viec.duAn = 'tat-ca'; };

export function xuong(cao, rong = '100%') {
  return h('div', { class: 'xuong', style: `height:${cao}px;width:${rong}` });
}

export async function chep(van, nut) {
  try {
    await navigator.clipboard.writeText(van);
    bao('Đã chép.');
    if (nut) nut.setAttribute('aria-label', 'Đã chép');
  } catch {
    bao('Trình duyệt chặn chép, hãy bôi đen rồi chép tay.', { loi: true });
  }
}
export function oChep(van, { lo = false } = {}) {
  const nut = h('button', { class: 'nut-icon', type: 'button', 'aria-label': 'Chép', onclick: () => chep(van, nut) }, icon('chep'));
  return h('div', { class: `o-chep${lo ? ' lo' : ''}` }, h('code', { translate: 'no', text: van }), nut);
}

// ---------- Trạng thái chung ----------
// Thay con của một phần tử, bỏ qua giá trị rỗng (null, false) để không hiện chữ "null".
export function thay(el, ...con) {
  el.replaceChildren(...con.flat().filter((c) => c != null && c !== false));
}

// Tên nhóm Zalo thường đã bắt đầu bằng "Nhóm", tránh hiện "Nhóm Nhóm ...".
export function tenNhom(ten) {
  return /^nh[oó]m\s/i.test(ten) ? ten : `Nhóm ${ten}`;
}

export const trang = { toi: null, zalo: { loc: 'tat-ca', q: '' }, tin: { loc: 'tat-ca', gio: null, q: '', chon: null, ds: [] }, viec: { tab: 'mo', duAn: 'tat-ca', ...docTuyChonViec() }, tep: { q: '' }, nho: { loai: 'tat-ca', q: '' } };
export const TEN_MUC = { 'tong-quan': 'Tổng quan', 'hop-tin': 'Hộp tin', zalo: 'Zalo', viec: 'Việc', 'hieu-suat': 'Hiệu suất', 'du-an': 'Dự án', claude: 'Claude', 'ghi-nho': 'Ghi nhớ', tep: 'Tệp', luong: 'Luồng', 'ket-noi': 'Kết nối', 'nhat-ky': 'Nhật ký chạy', 'du-lieu': 'Dữ liệu của bạn', 'da-chan': 'Đã chặn' };
// Bốn mục chính, mỗi mục gom vài trang con (kế hoạch chuẩn quốc tế 13/10/2026, giai đoạn 3).
// Đường dẫn cũ (#viec, #zalo...) giữ nguyên để liên kết đã lưu vẫn mở được.
export const NHOM = [
  { ma: 'hom-nay', ten: 'Hôm nay', con: ['tong-quan', 'viec', 'hieu-suat'] },
  { ma: 'hop-tin', ten: 'Hộp tin', con: ['hop-tin', 'zalo', 'da-chan'] },
  { ma: 'du-an', ten: 'Dự án', con: ['du-an', 'claude', 'tep', 'ghi-nho'] },
  { ma: 'cai-dat', ten: 'Cài đặt', con: ['ket-noi', 'luong', 'nhat-ky', 'du-lieu'] },
];
export const TEN_TAB = { 'hop-tin': 'Tất cả tin', 'du-an': 'Dự án', 'nhat-ky': 'Nhật ký' };
export const nhomCua = (muc) => NHOM.find((n) => n.con.includes(muc)) || NHOM[0];
export const KET_QUA = { xong: 'Xong', loi: 'Lỗi', dang_chay: 'Đang chạy' };
export const ICON_TP = { hop: 'ghi-am', 'may-chu': 'he-thong', csdl: 'kho', 'hen-gio': 'dong-ho', thu: 'thu', zalo: 'zalo', tep: 'tep', lich: 'lich', ai: 'ai', telegram: 'telegram' };
export const TEN_DEN = { xanh: 'ổn', vang: 'đang chờ', do: 'lỗi', xam: 'chưa dùng' };

// Chỉ lấy hai số đếm, không tải cả Tổng quan: giữ lượt đọc cơ sở dữ liệu thấp khi để trang mở cả ngày.
export function lamMoiDem() {
  return api('/api/dem').then((k) => capNhatDem(k.tin_chua_xem, k.viec_mo)).catch(() => {});
}

export function capNhatDem(soTin, soViec) {
  const dat = (id, n) => {
    const el = document.getElementById(id);
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = !n;
  };
  if (soTin != null) dat('dem-tin', soTin);
  if (soViec != null) dat('dem-viec', soViec);
}


// Biến thay đổi được và dùng ở nhiều mục: một đối tượng chung để mục nào cũng đọc ghi được.
export const S = {
  boCucTQ: null,
  duAnDs: [],
  napLaiViec: () => {},
  cotThu: new Set(),
  locNhatKy: 'tat-ca',
  chuong: null,
};
