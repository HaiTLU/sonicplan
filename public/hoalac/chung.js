// Giao diện Viện Hòa Lạc: phần dùng chung, bản riêng (không nhập public/trang/chung.js) để không
// kéo theo mã của Zalo/Hộp tin/Trạm Claude/Luồng — đối tác ngoài chỉ thấy đúng bundle /hoalac.
const MUI_GIO = 'Asia/Ho_Chi_Minh';
export const fmt = {
  ngayDai: new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  ngayNgan: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
};

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

export function thay(el, ...con) {
  el.replaceChildren(...con.flat().filter((c) => c != null && c !== false));
}

// Dự án đang mở: mỗi dự án là một tổ chức phạm vi 'hoalac'. Gửi kèm mọi yêu cầu qua tiêu đề x-to-chuc;
// máy chủ chỉ nhận khi người dùng là thành viên dự án đó (src/phien.js), nên giá trị lưu ở trình duyệt
// không mở được dự án của người khác.
const KHOA_DU_AN = 'hoalac.du_an';
let duAnHienTai = '';

export function duAnDaLuu() {
  const tuUrl = new URLSearchParams(location.search).get('du-an');
  if (tuUrl) return tuUrl;
  try { return localStorage.getItem(KHOA_DU_AN) || ''; } catch { return ''; }
}

export function datDuAn(id) {
  duAnHienTai = id || '';
  try {
    if (duAnHienTai) localStorage.setItem(KHOA_DU_AN, duAnHienTai);
    else localStorage.removeItem(KHOA_DU_AN);
  } catch { /* trình duyệt chặn lưu: vẫn chạy, chỉ không nhớ lựa chọn */ }
}

export async function api(duongDan, tuyChon = {}) {
  const ph = await fetch(duongDan, {
    ...tuyChon,
    headers: {
      accept: 'application/json',
      ...(tuyChon.body ? { 'content-type': 'application/json' } : {}),
      ...(duAnHienTai ? { 'x-to-chuc': duAnHienTai } : {}),
    },
  });
  const duLieu = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(duLieu.loi || 'Không đọc được dữ liệu. Tải lại trang để thử lại.');
  return duLieu;
}

// Gửi biểu mẫu có tệp (multipart). Không đặt content-type để trình duyệt tự ghi ranh giới các phần.
export async function apiTep(duongDan, fd) {
  const ph = await fetch(duongDan, {
    method: 'POST',
    body: fd,
    headers: { accept: 'application/json', ...(duAnHienTai ? { 'x-to-chuc': duAnHienTai } : {}) },
  });
  const duLieu = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(duLieu.loi || (ph.status === 413 ? 'Tệp lớn quá (tối đa 50 MB).' : 'Không tải được tệp lên. Thử lại sau.'));
  return duLieu;
}

// Lấy tệp qua fetch (để gửi kèm x-to-chuc, thẻ <a href> không gửi được), trả Blob.
export async function layTep(duongDan) {
  const ph = await fetch(duongDan, { headers: duAnHienTai ? { 'x-to-chuc': duAnHienTai } : {} });
  if (!ph.ok) throw new Error((await ph.json().catch(() => ({}))).loi || 'Không lấy được tệp.');
  return ph.blob();
}

export function bao(noiDung, loiPhai = false) {
  const vung = document.getElementById('vung-bao');
  const el = h('div', { class: `bao${loiPhai ? ' loi' : ''}`, text: noiDung });
  vung.append(el);
  setTimeout(() => el.remove(), 5000);
}

export function khungLoi(e) {
  return h('div', { class: 'khung-loi' }, h('p', { text: String(e.message || e) }));
}
