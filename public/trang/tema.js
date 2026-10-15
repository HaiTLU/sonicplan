// Giao diện Sonicplan, nút đổi sáng tối: lần đầu theo cài đặt của máy, bấm là chọn hẳn một chủ đề và nhớ lại (sp.tema).
const KHOA = 'sp.tema';
const MAU = { dark: '#020a14', light: '#fbfbfd' };
const theoMay = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export const temaHienTai = () => document.documentElement.dataset.theme || theoMay();

export function apDungTema(t, { luu = true } = {}) {
  document.documentElement.dataset.theme = t;
  if (luu) { try { localStorage.setItem(KHOA, t); } catch { /* không lưu được thì chỉ đổi lần này */ } }
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.setAttribute('content', MAU[t]); m.removeAttribute('media'); });
  const nut = document.getElementById('nut-tema');
  if (nut) {
    nut.querySelector('use')?.setAttribute('href', t === 'dark' ? '#i-mat-troi' : '#i-mat-trang');
    nut.setAttribute('aria-pressed', String(t === 'dark'));
    const ten = t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    nut.title = ten;
    nut.setAttribute('aria-label', ten);
  }
}

export function batNutTema() {
  const nut = document.getElementById('nut-tema');
  if (!nut) return;
  apDungTema(temaHienTai(), { luu: false });
  nut.addEventListener('click', () => apDungTema(temaHienTai() === 'dark' ? 'light' : 'dark'));
}
