// Kéo thả thẻ việc giữa các cột. Chuột: kéo là đi. Cảm ứng: chạm giữ nửa giây rồi kéo (để vuốt cuộn trang vẫn bình thường).
// Dùng Pointer Events thay cho HTML5 drag vì cái đó không chạy trên điện thoại.

const GIU_MS = 380;
const NGUONG_PX = 6;

// vung: phần tử chứa các cột. khiTha({ id, tuCot, denCot, ids }) chạy khi thả vào một cột nhận được; ids là thứ tự mới của cột đích.
export function batKeoTha(vung, { khiTha, nhanDuoc = () => true }) {
  let ban = null;

  const bo = () => {
    if (!ban) return;
    clearTimeout(ban.hen);
    cancelAnimationFrame(ban.khung);
    ban.bong?.remove();
    ban.cho?.remove();
    ban.the?.classList.remove('dang-keo');
    document.body.classList.remove('dang-keo-tha');
    document.removeEventListener('pointermove', dichuyen);
    document.removeEventListener('pointerup', tha);
    document.removeEventListener('pointercancel', huy);
    document.removeEventListener('keydown', phim);
    document.removeEventListener('touchmove', chanCuon);
    vung.querySelectorAll('.dich-tha').forEach((c) => c.classList.remove('dich-tha'));
    ban = null;
  };

  const chanCuon = (e) => { if (ban?.dang && e.cancelable) e.preventDefault(); };

  function batDau() {
    const { the } = ban;
    const hcn = the.getBoundingClientRect();
    const bong = the.cloneNode(true);
    bong.classList.add('bong-keo');
    Object.assign(bong.style, { width: `${hcn.width}px`, left: `${hcn.left}px`, top: `${hcn.top}px` });
    document.body.append(bong);
    ban.bong = bong;
    ban.lechX = ban.x - hcn.left;
    ban.lechY = ban.y - hcn.top;
    ban.cho = document.createElement('li');
    ban.cho.className = 'cho-tha';
    ban.cho.style.height = `${Math.min(hcn.height, 90)}px`;
    the.classList.add('dang-keo');
    document.body.classList.add('dang-keo-tha');
    ban.dang = true;
    navigator.vibrate?.(15);
    capNhat();
  }

  function cotDuoi() {
    const el = document.elementFromPoint(ban.x, ban.y);
    const cot = el?.closest('[data-cot]');
    return cot && vung.contains(cot) && nhanDuoc(cot.dataset.cot, ban.the) ? cot : null;
  }

  function capNhat() {
    if (!ban?.dang) return;
    ban.bong.style.transform = `translate(${ban.x - ban.lechX - parseFloat(ban.bong.style.left)}px, ${ban.y - ban.lechY - parseFloat(ban.bong.style.top)}px) rotate(1.5deg)`;
    const cot = cotDuoi();
    vung.querySelectorAll('.dich-tha').forEach((c) => c !== cot && c.classList.remove('dich-tha'));
    if (!cot) { ban.cho.remove(); ban.cot = null; return; }
    cot.classList.add('dich-tha');
    ban.cot = cot;
    let ul = cot.querySelector('ul');
    if (!ul) {
      ul = document.createElement('ul');
      cot.querySelector('.cot-trong')?.replaceWith(ul);
      if (!ul.isConnected) cot.append(ul);
    }
    const cacThe = [...ul.querySelectorAll(':scope > .the-viec:not(.dang-keo)')];
    const sau = cacThe.find((t) => { const r = t.getBoundingClientRect(); return ban.y < r.top + r.height / 2; });
    if (sau) { if (ban.cho.nextSibling !== sau || ban.cho.parentNode !== ul) ul.insertBefore(ban.cho, sau); } else if (ban.cho.parentNode !== ul || ban.cho.nextSibling) ul.append(ban.cho);
  }

  // Cuộn trang khi kéo sát mép trên hoặc dưới.
  function tuCuon() {
    if (!ban?.dang) return;
    const bien = 70;
    const buoc = ban.y < bien ? -14 : ban.y > innerHeight - bien ? 14 : 0;
    if (buoc) { window.scrollBy(0, buoc); capNhat(); }
    ban.khung = requestAnimationFrame(tuCuon);
  }

  function dichuyen(e) {
    if (!ban || e.pointerId !== ban.pointerId) return;
    ban.x = e.clientX;
    ban.y = e.clientY;
    if (!ban.dang) {
      if (Math.hypot(ban.x - ban.x0, ban.y - ban.y0) < NGUONG_PX) return;
      if (ban.camUng) { bo(); return; } // vuốt trước khi giữ đủ lâu: là cuộn trang
      batDau();
      ban.khung = requestAnimationFrame(tuCuon);
    }
    capNhat();
  }

  async function tha(e) {
    if (!ban || e.pointerId !== ban.pointerId) return;
    if (!ban.dang) { bo(); return; }
    const { the, cot, cho } = ban;
    const tuCot = the.closest('[data-cot]')?.dataset.cot;
    let ids = null;
    if (cot && cho.parentNode) {
      cho.replaceWith(the);
      ids = [...cot.querySelectorAll(':scope > ul > .the-viec')].map((t) => Number(t.dataset.id));
    }
    const id = Number(the.dataset.id);
    const denCot = cot?.dataset.cot;
    bo();
    // Chặn cú bấm theo sau khi thả, kẻo mở ngăn sửa việc.
    const chan = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', chan, { capture: true });
    setTimeout(() => window.removeEventListener('click', chan, { capture: true }), 80);
    if (ids && denCot) await khiTha({ id, tuCot, denCot, ids });
  }

  function huy() { bo(); }
  function phim(e) { if (e.key === 'Escape') bo(); }

  vung.addEventListener('pointerdown', (e) => {
    if (ban || e.button > 0) return;
    const the = e.target.closest('.the-viec');
    if (!the || !the.dataset.id || e.target.closest('input, a, select, textarea')) return;
    if (!vung.contains(the) || !the.closest('[data-cot]')) return;
    ban = { the, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, camUng: e.pointerType !== 'mouse', dang: false };
    if (ban.camUng) ban.hen = setTimeout(() => { if (ban && !ban.dang) { ban.camUng = false; batDau(); ban.khung = requestAnimationFrame(tuCuon); } }, GIU_MS);
    document.addEventListener('pointermove', dichuyen);
    document.addEventListener('pointerup', tha);
    document.addEventListener('pointercancel', huy);
    document.addEventListener('keydown', phim);
    document.addEventListener('touchmove', chanCuon, { passive: false });
  });
  vung.addEventListener('contextmenu', (e) => { if (ban?.dang || e.target.closest('.the-viec')?.matches('.dang-keo')) e.preventDefault(); });
  vung.addEventListener('dragstart', (e) => e.preventDefault());
}
