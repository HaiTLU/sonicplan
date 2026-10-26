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

export async function api(duongDan, tuyChon = {}) {
  const ph = await fetch(duongDan, {
    ...tuyChon,
    headers: { accept: 'application/json', ...(tuyChon.body ? { 'content-type': 'application/json' } : {}) },
  });
  const duLieu = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(duLieu.loi || 'Không đọc được dữ liệu. Tải lại trang để thử lại.');
  return duLieu;
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
