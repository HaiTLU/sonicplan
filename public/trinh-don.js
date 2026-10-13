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

export function moTrinhDon({ x, y, muc, nhan = 'Thao tác' }) {
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
  document.body.append(el);

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
