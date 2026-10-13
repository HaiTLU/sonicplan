// Ảnh đại diện dự án: ảnh tải lên, hoặc biểu tượng chọn sẵn, hoặc chữ cái đầu của tên, trên nền màu của dự án.
import { hexMau } from './mau.js';

export const ICON_DU_AN = ['📁', '📣', '🎓', '🤖', '📊', '💼', '🧪', '🏗️', '🌐', '📝', '🎯', '💡', '🛒', '✈️', '🎬', '⚙️', '📚', '🤝', '🏢', '❤️'];

const chuDau = (ten) => (String(ten || '?').trim().match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();

// kich: 'nho' (22px), 'vua' (36px), 'lon' (56px). d cần có id, ten, mau, icon, anh_khoa (hoặc du_an_icon, du_an_anh khi lấy từ việc).
export function anhDuAn(h, d, kich = 'vua') {
  const mau = hexMau(d.mau ?? d.du_an_mau);
  const anh = d.anh_khoa ?? d.du_an_anh;
  const bieuTuong = d.icon ?? d.du_an_icon;
  const el = h('span', { class: `anh-da ${kich}${anh ? ' co-anh' : ''}`, 'aria-hidden': 'true', ...(mau ? { style: `--mau:${mau}` } : {}) });
  if (anh) {
    const img = h('img', { alt: '', loading: 'lazy', decoding: 'async', src: `/api/du-an/${d.id ?? d.du_an_id}/anh?v=${encodeURIComponent(anh)}` });
    img.addEventListener('error', () => { img.remove(); el.classList.remove('co-anh'); el.append(bieuTuong || chuDau(d.ten ?? d.du_an_ten)); });
    el.append(img);
  } else el.append(bieuTuong || chuDau(d.ten ?? d.du_an_ten));
  return el;
}

// Hàng chọn biểu tượng. chon(icon | null).
export function oChonIcon(h, hienTai, chon, { nhan = 'Biểu tượng' } = {}) {
  const ds = h('div', { class: 'chon-icon', role: 'radiogroup', 'aria-label': nhan });
  const ve = (bt) => ds.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.bt || '') === (bt || ''))));
  ds.append(h('button', { type: 'button', class: 'o-icon khong', role: 'radio', title: 'Chữ cái đầu của tên', 'aria-label': 'Dùng chữ cái đầu', dataset: { bt: '' }, onclick: () => { ve(null); chon(null); } }, 'Aa'));
  for (const bt of ICON_DU_AN) ds.append(h('button', { type: 'button', class: 'o-icon', role: 'radio', 'aria-label': `Biểu tượng ${bt}`, dataset: { bt }, onclick: () => { ve(bt); chon(bt); } }, bt));
  ve(hienTai || null);
  return ds;
}

// Thu ảnh về vuông 256px (cắt giữa) rồi nén tới khi nhỏ hơn 250 KB.
export async function thuNhoAnh(tep) {
  if (!/^image\/(jpeg|png|webp|gif|heic|avif)$/.test(tep.type) && !tep.type.startsWith('image/')) throw new Error('Hãy chọn một tệp ảnh.');
  const bm = await createImageBitmap(tep).catch(() => { throw new Error('Không đọc được ảnh này, thử ảnh JPG hoặc PNG.'); });
  const canh = Math.min(bm.width, bm.height);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  cv.getContext('2d').drawImage(bm, (bm.width - canh) / 2, (bm.height - canh) / 2, canh, canh, 0, 0, 256, 256);
  bm.close?.();
  for (const chatLuong of [0.9, 0.8, 0.65, 0.5]) {
    const blob = await new Promise((xong) => cv.toBlob(xong, 'image/webp', chatLuong));
    const b = blob && blob.type === 'image/webp' ? blob : await new Promise((xong) => cv.toBlob(xong, 'image/jpeg', chatLuong));
    if (b && b.size <= 250 * 1024) return b;
  }
  throw new Error('Ảnh vẫn lớn sau khi thu nhỏ, hãy chọn ảnh khác.');
}

export async function taiAnhLen(id, tep) {
  const blob = await thuNhoAnh(tep);
  const ph = await fetch(`/api/du-an/${id}/anh`, { method: 'PUT', headers: { 'content-type': blob.type, accept: 'application/json' }, body: blob });
  const kq = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(kq.loi || 'Không tải được ảnh lên.');
  return kq;
}

export async function boAnh(id) {
  const ph = await fetch(`/api/du-an/${id}/anh`, { method: 'DELETE', headers: { accept: 'application/json' } });
  if (!ph.ok) throw new Error('Không gỡ được ảnh.');
}

// Mở hộp chọn ảnh, tải lên cho dự án d. Gọi xong() khi thành công.
export function chonVaTaiAnh(d, { bao, xong }) {
  const o = document.createElement('input');
  o.type = 'file'; o.accept = 'image/*';
  o.addEventListener('change', async () => {
    const tep = o.files?.[0];
    if (!tep) return;
    try { bao('Đang tải ảnh lên…'); await taiAnhLen(d.id, tep); bao('Đã đổi ảnh đại diện.'); xong(); } catch (e) { bao(e.message, { loi: true }); }
  });
  o.click();
}
