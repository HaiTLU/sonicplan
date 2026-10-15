// Giao diện Sonicplan: một trang, chuyển mục theo dấu #, đọc ghi dữ liệu qua /api.
// Mỗi mục nằm trong public/trang/; tệp này nạp chúng theo thứ tự rồi khởi động.

import { batChuong } from './thong-bao.js';
import { caiNguCanh } from './trinh-don.js';
import { S, api, bao, fmt, h, icon, lamMoiDem, luc, trang } from './trang/chung.js';
import { moDuongDan, moMuc } from './trang/dieu-huong.js';
import { mucChung } from './trang/viec.js';
import './trang/chung.js';
import './trang/tong-quan.js';
import './trang/hop-tin.js';
import './trang/viec.js';
import './trang/tep.js';
import './trang/ghi-nho.js';
import './trang/zalo.js';
import './trang/ket-noi.js';
import './trang/nhat-ky.js';
import './trang/dieu-huong.js';
import './trang/bang-lenh.js';

// ---------- Khởi động ----------
caiNguCanh({ chung: mucChung, bo: '.cot-viec' });

async function batDau() {
  const ngay = fmt.ngayDai.format(new Date());
  document.getElementById('ngay-hom-nay').textContent = ngay.charAt(0).toUpperCase() + ngay.slice(1);
  try {
    trang.toi = await api('/api/toi');
    const the = document.getElementById('nguoi-dung');
    const ten = trang.toi.nguoi_dung?.ten || trang.toi.email;
    the.querySelector('.anh-dai-dien').textContent = ten.split(' ').pop().charAt(0).toUpperCase();
    the.querySelector('strong').textContent = ten;
    the.querySelector('small').textContent = trang.toi.to_chuc.ten === ten ? trang.toi.email : trang.toi.to_chuc.ten;
  } catch (e) {
    bao(e.message, { loi: true });
  }
  window.addEventListener('hashchange', moMuc);
  moMuc();
  S.chuong = batChuong({ h, icon, api, bao, luc, moDuongDan });
  // Làm mới số đếm mỗi 2 phút khi trang đang mở.
  setInterval(() => {
    if (document.hidden) return;
    lamMoiDem();
  }, 120000);
}

batDau();

// Máy yếu (ít nhân hoặc ít RAM) thì bỏ hiệu ứng chạy liên tục; đăng ký bộ nhớ đệm để mở nhanh khi cài vào màn hình chính.
try {
  if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2) document.documentElement.classList.add('may-yeu');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
} catch { /* bỏ qua */ }

// ---------- Tự cập nhật: trang mở lâu ngày vẫn lên bản mới ----------
// Hỏi máy chủ mã phiên bản mỗi 2 phút và khi quay lại thẻ. Khác mã thì hiện thanh báo, và tự tải lại khi không có ngăn nào đang mở.
let banDau = null;
let thanhBanMoi = null;
async function kiemBanMoi() {
  try {
    const { ban } = await api('/api/phien-ban');
    if (!ban) return;
    if (banDau === null) { banDau = ban; return; }
    if (ban === banDau) return;
    if (!document.querySelector('dialog[open]') && document.hidden) { location.reload(); return; }
    if (!thanhBanMoi) {
      thanhBanMoi = h('div', { class: 'thanh-ban-moi', role: 'status' }, h('span', { text: 'Sonicplan có bản mới.' }), h('button', { class: 'nut nut-chinh nut-nho', type: 'button', text: 'Tải lại', onclick: () => location.reload() }));
      document.body.append(thanhBanMoi);
    }
  } catch { /* mất mạng: thử lại lần sau */ }
}
kiemBanMoi();
setInterval(kiemBanMoi, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) kiemBanMoi(); });
