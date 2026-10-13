// Trình đơn thao tác mở bằng chuột phải (hoặc nút ba chấm trên điện thoại).
// muc: [{ nhan, lam }, { nhan, nguy: true, lam }, { tieuDe: 'Đổi hạn' }, { nhan, con: [{ nhan, lam }] }, { node: Element }, { vach: true }]
// Đóng khi bấm ra ngoài, nhấn Esc, cuộn trang hoặc chọn xong một mục. Mũi tên lên xuống đổi mục, Enter chọn.

let dangMo = null;

export function dongTrinhDon() {
  if (!dangMo) return;
  const { el, truoc, thoat } = dangMo;
  dangMo = null;
  el.remove();
  document.removeEventListener('pointerdown', thoat.ngoai, true);
  document.removeEventListener('keydown', thoat.phim, true);
  window.removeEventListener('scroll', thoat.cuon, true);
  window.removeEventListener('resize', thoat.cuon);
  if (truoc && document.contains(truoc)) truoc.focus({ preventScroll: true });
}

function tao(ten, lop, chu) {
  const e = document.createElement(ten);
  if (lop) e.className = lop;
  if (chu != null) e.textContent = chu;
  return e;
}

export function moTrinhDon({ x, y, muc, nhan = 'Thao tác', goc }) {
  dongTrinhDon();
  const truoc = document.activeElement;
  const el = tao('div', 'trinh-don');
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', nhan);

  const them = (goc, ds) => {
    for (const m of ds) {
      if (!m) continue;
      if (m.vach) { goc.append(tao('div', 'td-vach')); continue; }
      if (m.tieuDe) { goc.append(tao('div', 'td-tieu-de', m.tieuDe)); continue; }
      if (m.node) { goc.append(m.node); continue; }
      const nut = tao('button', `td-muc${m.nguy ? ' nguy' : ''}${m.chon ? ' dang-chon' : ''}`, m.nhan);
      nut.type = 'button';
      nut.setAttribute('role', 'menuitem');
      if (m.tat) nut.disabled = true;
      if (m.con) {
        nut.setAttribute('aria-haspopup', 'true');
        nut.setAttribute('aria-expanded', 'false');
        nut.classList.add('co-con');
        const hop = tao('div', 'td-con');
        hop.hidden = true;
        them(hop, m.con);
        nut.addEventListener('click', () => {
          hop.hidden = !hop.hidden;
          nut.setAttribute('aria-expanded', String(!hop.hidden));
          chinhViTri();
        });
        goc.append(nut, hop);
      } else {
        nut.addEventListener('click', () => { dongTrinhDon(); m.lam?.(); });
        goc.append(nut);
      }
    }
  };
  them(el, muc);
  (goc || [...document.querySelectorAll('dialog[open]')].pop() || document.body).append(el);

  function chinhViTri() {
    const r = el.getBoundingClientRect();
    const trai = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
    const tren = Math.max(8, Math.min(y, window.innerHeight - r.height - 8));
    el.style.left = `${trai}px`;
    el.style.top = `${tren}px`;
    el.style.maxHeight = `${window.innerHeight - 16}px`;
  }
  chinhViTri();

  const thoat = {
    ngoai: (e) => { if (!el.contains(e.target)) dongTrinhDon(); },
    cuon: (e) => { if (!el.contains(e.target)) dongTrinhDon(); },
    phim: (e) => {
      if (e.key === 'Escape') { e.preventDefault(); dongTrinhDon(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const ds = [...el.querySelectorAll('button:not([disabled])')].filter((b) => !b.closest('[hidden]'));
      if (!ds.length) return;
      e.preventDefault();
      const i = ds.indexOf(document.activeElement);
      const den = e.key === 'Home' ? 0 : e.key === 'End' ? ds.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + ds.length) % ds.length;
      ds[den].focus();
    },
  };
  dangMo = { el, truoc, thoat };
  document.addEventListener('pointerdown', thoat.ngoai, true);
  document.addEventListener('keydown', thoat.phim, true);
  window.addEventListener('scroll', thoat.cuon, true);
  window.addEventListener('resize', thoat.cuon);
  el.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  return el;
}

// ---------------------------------------------------------------------------
// Chuột phải ở mọi nơi trên trang: không bao giờ hiện trình đơn của trình duyệt.
// Đối tượng nào muốn có trình đơn riêng thì gắn phần tử._td = () => ({ muc, nhan }) (có thể async).
// Nút và liên kết chưa có trình đơn riêng hiện thao tác chung của nút; chỗ trống hiện trình đơn chung (chung()).
// Ô nhập chữ giữ trình đơn của trình duyệt để dán, chép. Điện thoại: nhấn giữ 0,6 giây.
// ---------------------------------------------------------------------------
const O_NHAP = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable=""], [contenteditable="true"]';
const TUONG_TAC = 'a[href], button:not([disabled]), [role=tab], summary, .chip';

function nhanNut(el) {
  return (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}

export function caiNguCanh({ chung, bo = '' }) {
  const tim = (goc) => {
    for (let n = goc; n && n !== document; n = n.parentElement) if (n._td) return { el: n, kieu: 'td' };
    const nut = goc.closest?.(TUONG_TAC);
    return nut ? { el: nut, kieu: 'nut' } : { el: null, kieu: 'chung' };
  };
  const mo = async (goc, x, y) => {
    const r = tim(goc);
    let muc = [];
    let nhan = 'Trình đơn của trang';
    if (r.kieu === 'td') {
      const kq = await r.el._td();
      if (kq?.muc) { muc = kq.muc; nhan = kq.nhan || nhan; } else if (Array.isArray(kq)) muc = kq;
    } else if (r.kieu === 'nut') {
      const ten = nhanNut(r.el);
      nhan = ten ? `Thao tác: ${ten}` : 'Thao tác';
      muc.push({ nhan: ten ? `Bấm "${ten}"` : 'Bấm nút này', lam: () => r.el.click() });
      if (r.el.matches('a[href]')) {
        const href = r.el.href;
        muc.push({ nhan: 'Mở trong thẻ mới', lam: () => window.open(href, '_blank', 'noopener') });
        muc.push({ nhan: 'Sao chép liên kết', lam: () => navigator.clipboard?.writeText(href) });
      }
      muc.push({ vach: true }, ...chung());
    } else {
      muc = chung();
    }
    if (!muc.length) return;
    moTrinhDon({ x, y, muc, nhan });
  };

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest?.('.trinh-don') || e.target.closest?.(O_NHAP)) { if (e.target.closest?.('.trinh-don')) e.preventDefault(); return; }
    e.preventDefault();
    if (document.body.classList.contains('dang-keo-tha')) return;
    clearTimeout(hen);
    let { clientX: x, clientY: y } = e;
    if (!x && !y) { const r = e.target.getBoundingClientRect(); x = r.left + 24; y = r.top + 24; } // phím Menu, Shift+F10
    mo(e.target, x, y);
  });

  // Nhấn giữ trên màn hình cảm ứng. Vùng bo (cột việc kéo thả) dùng nút ba chấm để khỏi vướng thao tác kéo.
  let hen = null;
  let diem = null;
  let vuaGiu = false;
  const huy = () => { clearTimeout(hen); hen = null; };
  document.addEventListener('pointerdown', (e) => {
    huy();
    if (e.pointerType !== 'touch' || e.target.closest?.(`.trinh-don, ${O_NHAP}${bo ? `, ${bo}` : ''}`)) return;
    diem = { x: e.clientX, y: e.clientY };
    const goc = e.target;
    hen = setTimeout(() => {
      hen = null;
      vuaGiu = true;
      setTimeout(() => { vuaGiu = false; }, 900);
      mo(goc, diem.x + 6, diem.y + 6);
    }, 600);
  }, { passive: true });
  document.addEventListener('pointermove', (e) => { if (hen && diem && Math.hypot(e.clientX - diem.x, e.clientY - diem.y) > 10) huy(); }, { passive: true });
  for (const ten of ['pointerup', 'pointercancel']) document.addEventListener(ten, huy, { passive: true });
  window.addEventListener('scroll', huy, { passive: true, capture: true });
  // Nhấc tay sau khi nhấn giữ không được bấm nhầm vào thứ nằm dưới.
  document.addEventListener('click', (e) => { if (vuaGiu) { vuaGiu = false; e.preventDefault(); e.stopPropagation(); } }, true);
}
