// Giao diện Sonicplan, Bảng lệnh (Ctrl K).
import { h, icon, thay, trang } from './chung.js';
import { moMuc } from './dieu-huong.js';
import { moNganViec } from './viec.js';

// ---------- Bảng lệnh (Ctrl K) ----------
const bangLenh = document.getElementById('bang-lenh');
const oLenh = document.getElementById('o-lenh');
const dsLenh = document.getElementById('ds-lenh');
const LENH = [
  { nhan: 'Tổng quan', icon: 'tong-quan', lam: () => (location.hash = 'tong-quan'), goi: 'G T' },
  { nhan: 'Hộp tin', icon: 'hop-tin', lam: () => (location.hash = 'hop-tin'), goi: 'G H' },
  { nhan: 'Zalo', icon: 'zalo', lam: () => (location.hash = 'zalo'), goi: 'G Z' },
  { nhan: 'Việc', icon: 'viec', lam: () => (location.hash = 'viec'), goi: 'G V' },
  { nhan: 'Hiệu suất, quá tải, độ nặng việc', icon: 'tong-quan', lam: () => (location.hash = 'hieu-suat') },
  { nhan: 'Dự án và lịch sử', icon: 'du-an', lam: () => (location.hash = 'du-an') },
  { nhan: 'Claude (giao việc, chat như Claude Code)', icon: 'ai', lam: () => (location.hash = 'claude'), goi: 'G C' },
  { nhan: 'Ghi nhớ', icon: 'ghi-nho', lam: () => (location.hash = 'ghi-nho') },
  { nhan: 'Tệp', icon: 'tep', lam: () => (location.hash = 'tep') },
  { nhan: 'Luồng (sơ đồ, chỉnh giờ)', icon: 'lap', lam: () => (location.hash = 'luong') },
  { nhan: 'Kết nối', icon: 'ket-noi', lam: () => (location.hash = 'ket-noi') },
  { nhan: 'Nhật ký chạy', icon: 'nhat-ky', lam: () => (location.hash = 'nhat-ky') },
  { nhan: 'Dữ liệu của bạn (tải về, chính sách)', icon: 'tai', lam: () => (location.hash = 'du-lieu') },
  { nhan: 'Thêm việc mới', icon: 'cong', lam: () => moNganViec(null), goi: 'N' },
  { nhan: 'Tin chưa xem', icon: 'hop-tin', lam: () => { trang.tin.loc = 'chua-xem'; location.hash = 'hop-tin'; moMuc(); } },
  { nhan: 'Việc đã xong', icon: 'viec', lam: () => { trang.viec.tab = 'xong'; location.hash = 'viec'; moMuc(); } },
];
let chonLenh = 0;
function veLenh() {
  const q = oLenh.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const khop = LENH.filter((l) => l.nhan.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').includes(q));
  const ds = q ? [...khop, { nhan: `Tìm tin có "${oLenh.value.trim()}"`, icon: 'tim', lam: () => { trang.tin.q = oLenh.value.trim(); trang.tin.loc = 'tat-ca'; location.hash = 'hop-tin'; moMuc(); } }] : khop;
  chonLenh = Math.min(chonLenh, ds.length - 1);
  thay(dsLenh, ...ds.map((l, i) => {
    const li = h('li', { role: 'option', id: `lenh-${i}`, 'aria-selected': String(i === chonLenh) }, icon(l.icon), l.nhan, l.goi ? h('small', { text: l.goi }) : null);
    li.addEventListener('click', () => { bangLenh.close(); l.lam(); });
    li.addEventListener('pointermove', () => { if (chonLenh !== i) { chonLenh = i; veLenh(); } });
    return li;
  }));
  oLenh.setAttribute('aria-activedescendant', `lenh-${chonLenh}`);
  dsLenh._ds = ds;
}
export function moBangLenh() {
  oLenh.value = '';
  chonLenh = 0;
  veLenh();
  bangLenh.showModal();
  oLenh.focus();
}
oLenh.addEventListener('input', () => { chonLenh = 0; veLenh(); });
oLenh.addEventListener('keydown', (e) => {
  const ds = dsLenh._ds || [];
  if (e.key === 'ArrowDown') { e.preventDefault(); chonLenh = (chonLenh + 1) % ds.length; veLenh(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); chonLenh = (chonLenh - 1 + ds.length) % ds.length; veLenh(); }
  else if (e.key === 'Enter') { e.preventDefault(); const l = ds[chonLenh]; bangLenh.close(); l?.lam(); }
});
bangLenh.addEventListener('click', (e) => { if (e.target === bangLenh) bangLenh.close(); });
document.getElementById('mo-bang-lenh').addEventListener('click', moBangLenh);
document.getElementById('mo-bang-lenh-2').addEventListener('click', moBangLenh);

let phimTruoc = '';
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (bangLenh.open) bangLenh.close();
    else moBangLenh();
    return;
  }
  if (e.target.closest('input, textarea, select, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (phimTruoc === 'g') {
    const dich = { t: 'tong-quan', h: 'hop-tin', v: 'viec', c: 'claude' }[k];
    if (dich) location.hash = dich;
    phimTruoc = '';
    return;
  }
  if (k === 'g') { phimTruoc = 'g'; setTimeout(() => { phimTruoc = ''; }, 900); return; }
  if (k === 'n') { e.preventDefault(); moNganViec(null); }
});

// Viền sáng theo con trỏ trên các bảng.
document.addEventListener('pointermove', (e) => {
  const b = e.target.closest?.('.bang');
  if (!b) return;
  const r = b.getBoundingClientRect();
  b.style.setProperty('--mx', `${e.clientX - r.left}px`);
  b.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });
