// Giao diện Sonicplan, Chuyển mục và điều hướng.
import { veDuAn } from '../du-an.js';
import { veHieuSuat } from '../hieu-suat.js';
import { veTram } from '../tram.js';
import { TEN_MUC, TEN_TAB, api, bao, fmt, h, icon, khungLoi, kichThuoc, luc, meo, nhomCua, oChep, thay, trang, xuong } from './chung.js';
import { veGhiNho } from './ghi-nho.js';
import { veDaChan, veHopTin } from './hop-tin.js';
import { veKetNoi } from './ket-noi.js';
import { chayNgay, veNhatKy } from './nhat-ky.js';
import { veTep } from './tep.js';
import { veDashboard } from './dashboard.js';
import { itChuyenDong, veTongQuan } from './tong-quan.js';
import { driveDuAn, moNganViec, mucTrinhDonDuAn, veViec } from './viec.js';
import { veZalo } from './zalo.js';

// =====================================================================
// Chuyển mục
// =====================================================================
async function veLuongTrang(goc) {
  const { veLuong } = await import('/luong.js');
  await veLuong(goc, { h, icon, api, bao, thay, khungLoi, xuong, luc, chayNgay });
}
function veDuAnTrang(goc, thamSo) {
  return veDuAn(goc, thamSo, { h, icon, api, bao, thay, khungLoi, xuong, mucDuAn: mucTrinhDonDuAn, driveDuAn, themViec: (d) => moNganViec(null, { du_an_id: d.id }) });
}
// Trang "Dữ liệu của bạn": nói rõ hệ thống lưu gì, ai xem, giữ bao lâu; nút tải toàn bộ dữ liệu.
function veDuLieu(goc) {
  const laChu = trang.toi?.to_chuc?.vai_tro === 'chu';
  const muc = (tieuDe, ...con) => h('section', { class: 'bang' }, h('h2', { text: tieuDe }), ...con);
  thay(goc, h('div', { class: 'trang-du-lieu vao' },
    muc('Sonicplan lưu gì',
      h('ul', {},
        h('li', { text: 'Tin Zalo và thư bạn cho phép chuyển về, tệp đính kèm của các tin đó.' }),
        h('li', { text: 'Việc, dự án, ghi nhớ, hồ sơ bạn tự nhập hoặc AI tách ra từ tin.' }),
        h('li', { text: 'Kết quả các lần giao việc cho Claude Code.' }),
        h('li', { text: 'Khóa kết nối (Google, GitHub, AI, Telegram) được mã hóa trước khi lưu, không ai đọc lại được từ giao diện.' }),
      )),
    muc('Ai xem được',
      h('p', { text: 'Chỉ thành viên tổ chức của bạn, sau khi đăng nhập. Mỗi tổ chức có dữ liệu riêng, hệ thống luôn lọc theo tổ chức trước khi đọc.' }),
      h('p', { text: 'Khi AI đọc tin để tách việc, nội dung tin được gửi tới dịch vụ AI chọn ở trang Kết nối (mặc định là Workers AI của Cloudflare). Khi giao việc cho Claude Code, nội dung việc được gửi tới kho GitHub bạn đã nối.' })),
    muc('Giữ bao lâu',
      h('p', { text: 'Dữ liệu được giữ đến khi bạn xóa. Mỗi đêm hệ thống sao lưu việc, dự án, ghi nhớ, danh sách tệp, kết quả Claude và tin 90 ngày gần nhất vào kho tệp, mỗi tổ chức một thư mục riêng.' }),
      h('p', { text: 'Tin của nhóm hoặc người gửi bạn đánh dấu spam vẫn được lưu để bỏ chặn được, nhưng không hiện và không đưa cho AI. Nhật ký truy cập giữ 1 năm.' })),
    muc('Quyền của bạn',
      h('p', { text: 'Bạn được tải về toàn bộ dữ liệu của tổ chức ở dạng JSON để xem hoặc chuyển sang nơi khác. Khóa và mã truy cập không nằm trong tệp tải về.' }),
      laChu
        ? h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: '/api/du-lieu/xuat', download: '' }, icon('tai'), h('span', { text: 'Tải toàn bộ dữ liệu' })))
        : h('p', { class: 'mo-ta', text: 'Chỉ chủ tổ chức tải được toàn bộ dữ liệu.' }),
      h('p', { class: 'mo-ta', text: 'Muốn sửa hoặc xóa từng mục: sửa, xóa ngay trên trang đó.' })),
    laChu ? muc('Ai đã xem, tải dữ liệu', khungTruyCap) : null,
    laChu ? muc('Xóa toàn bộ tổ chức', khungXoa) : null,
  ));
  if (laChu) {
    napTruyCap();
    veNutXoa();
  }
}

// Nhật ký truy cập: lần đầu mở trang mỗi ngày, mỗi lần tải dữ liệu, tải tệp.
const khungTruyCap = h('div', { class: 'truy-cap' });
async function napTruyCap() {
  thay(khungTruyCap, xuong(14, '60%'));
  try {
    const { ds } = await api('/api/du-lieu/truy-cap');
    if (!ds.length) { thay(khungTruyCap, h('p', { class: 'mo-ta', text: 'Chưa có lượt nào.' })); return; }
    thay(khungTruyCap,
      h('p', { class: 'mo-ta', text: 'Ghi lần đầu mở trang mỗi ngày, mỗi lần tải toàn bộ dữ liệu và mỗi lần tải tệp. Không ghi địa chỉ IP.' }),
      h('div', { class: 'cuon-bang', tabindex: '0', role: 'region', 'aria-label': 'Nhật ký truy cập' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Lúc' }), h('th', { scope: 'col', text: 'Ai' }), h('th', { scope: 'col', text: 'Làm gì' }))),
        h('tbody', {}, ...ds.map((r) => h('tr', {},
          h('td', {}, h('time', { datetime: r.luc, text: fmt.ngayGio.format(new Date(r.luc)) })),
          h('td', { text: r.email }),
          h('td', { text: r.chi_tiet ? `${r.ten_hanh_dong}: ${r.chi_tiet}` : r.ten_hanh_dong }),
        ))),
      )),
    );
  } catch (e) {
    thay(khungTruyCap, khungLoi(e, napTruyCap));
  }
}

// Xóa cả tổ chức: hỏi lần 1 bằng hộp xác nhận, lần 2 bắt gõ lại tên tổ chức. Máy chủ sao lưu trước khi xóa.
const khungXoa = h('div', { class: 'xoa-to-chuc' });
function veNutXoa() {
  const ten = trang.toi?.to_chuc?.ten || '';
  thay(khungXoa,
    h('p', { text: 'Xóa hết việc, tin, tệp, dự án, ghi nhớ, kết nối và thành viên của tổ chức. Trước khi xóa, hệ thống tự sao lưu toàn bộ vào kho tệp; bản sao và tệp được giữ 30 ngày để khôi phục khi bấm nhầm, sau đó tự xóa hẳn.' }),
    h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-nguy', type: 'button', onclick: () => {
      if (!confirm(`Xóa toàn bộ tổ chức "${ten}"?\n\nMọi người trong tổ chức sẽ mất quyền vào và mọi dữ liệu bị xóa. Bản sao lưu giữ 30 ngày.`)) return;
      const oTen = h('input', { type: 'text', autocomplete: 'off', 'aria-describedby': 'goi-y-xoa' });
      const nutXoa = h('button', { class: 'nut nut-nguy', type: 'submit', disabled: '' }, 'Xóa vĩnh viễn');
      oTen.addEventListener('input', () => { nutXoa.disabled = oTen.value.trim() !== ten.trim(); });
      thay(khungXoa,
        h('form', { class: 'form-xoa', onsubmit: async (ev) => {
          ev.preventDefault();
          nutXoa.disabled = true;
          nutXoa.textContent = 'Đang sao lưu rồi xóa…';
          try {
            const kq = await api('/api/to-chuc/xoa', { method: 'POST', body: JSON.stringify({ ten_xac_nhan: oTen.value }) });
            thay(khungXoa, h('p', { role: 'status', text: `Đã xóa tổ chức (${kq.so_viec} việc, ${kq.so_tin} tin, ${kq.so_tep} tệp). Bản sao lưu giữ ${kq.giu_ngay} ngày. Trang sẽ tải lại.` }));
            setTimeout(() => location.reload(), 4000);
          } catch (e) {
            bao(e.message, { loi: true });
            nutXoa.textContent = 'Xóa vĩnh viễn';
            nutXoa.disabled = false;
          }
        } },
          h('label', { class: 'truong' }, h('span', { id: 'goi-y-xoa', text: `Lần xác nhận thứ hai: gõ đúng tên tổ chức "${ten}"` }), oTen),
          h('div', { class: 'hang-nut' }, nutXoa, h('button', { class: 'nut nut-phu', type: 'button', onclick: veNutXoa }, 'Thôi, không xóa')),
        ),
      );
      oTen.focus();
    } }, icon('xoa'), h('span', { text: 'Xóa toàn bộ tổ chức' }))),
  );
}

const VE = { 'tong-quan': (goc) => new URLSearchParams(location.search).get('tongquan') === 'cu' ? veTongQuan(goc) : veDashboard(goc), 'hop-tin': veHopTin, zalo: veZalo, viec: veViec, 'hieu-suat': (goc) => veHieuSuat(goc, { h, icon, api, bao, thay, khungLoi, xuong }), 'du-an': veDuAnTrang, claude: (goc, thamSo) => veTram(goc, { h, icon, api, bao, thay, meo, oChep, kichThuoc, luc, laChu: trang.toi?.to_chuc?.vai_tro === 'chu' }, thamSo), 'ghi-nho': veGhiNho, tep: veTep, luong: veLuongTrang, 'ket-noi': veKetNoi, 'nhat-ky': veNhatKy, 'du-lieu': veDuLieu, 'da-chan': veDaChan };
let mucTruoc = null;

// Mở một chỗ trong trang theo đường dẫn của thông báo. "#viec/<mã>" thì sang trang Việc và mở luôn ngăn việc đó.
export async function moDuongDan(duongDan) {
  const [ma, so] = String(duongDan || '').replace(/^#/, '').split('/');
  if (ma === 'viec' && /^\d+$/.test(so || '')) {
    if (location.hash !== '#viec') location.hash = 'viec';
    try {
      const { viec } = await api(`/api/viec/${so}`);
      moNganViec(viec);
    } catch (e) { bao(e.message, { loi: true }); }
    return;
  }
  const dich = String(duongDan || 'viec').replace(/^#/, '');
  if (location.hash === `#${dich}`) moMuc();
  else location.hash = dich;
}

export async function moMuc() {
  const [ma, thamSo] = (location.hash.slice(1) || 'tong-quan').split('/');
  if (ma === 'viec' && /^\d+$/.test(thamSo || '')) {
    history.replaceState(null, '', '#viec');
    moDuongDan(`#viec/${thamSo}`);
  }
  const muc = VE[ma] ? ma : 'viec';
  document.querySelectorAll('[data-trang]').forEach((sec) => { sec.hidden = sec.dataset.trang !== muc; });
  const nhom = nhomCua(muc);
  document.querySelectorAll('[data-nhom]').forEach((a) => {
    if (a.dataset.nhom === nhom.ma) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const tabCon = document.getElementById('tab-con');
  thay(tabCon, ...nhom.con.map((c) => h('a', { href: `#${c}`, ...(c === muc ? { 'aria-current': 'page' } : {}), text: TEN_TAB[c] || TEN_MUC[c] })));
  tabCon.hidden = nhom.con.length < 2;
  const tieuDe = document.getElementById('tieu-de-trang');
  tieuDe.textContent = TEN_MUC[muc];
  document.title = `${TEN_MUC[muc]} - Sonicplan`;
  const goc = document.querySelector(`[data-trang="${muc}"]`);
  if (mucTruoc && mucTruoc !== muc) tieuDe.focus({ preventScroll: true });
  mucTruoc = muc;
  // Vào lại trang đã xem: giữ ảnh chụp trang cũ phủ lên cho tới khi trang mới vẽ xong, không để khung xương nhấp nháy.
  const kl = dungAnhCu(goc, muc);
  try {
    await VE[muc](goc, thamSo);
    mucDaVe.add(muc);
  } catch (e) {
    thay(goc, khungLoi(e, moMuc));
  }
  if (kl) boAnhCu(kl, goc);
}

const mucDaVe = new Set();
let anhCuDangPhu = null;
function boAnhCuNgay() {
  if (!anhCuDangPhu) return;
  anhCuDangPhu.kl.remove();
  anhCuDangPhu.goc.classList.remove('giu-cu');
  anhCuDangPhu = null;
}
function dungAnhCu(goc, muc) {
  boAnhCuNgay();
  if (!mucDaVe.has(muc) || !goc.firstElementChild || goc.querySelector('.xuong')) return null;
  const cha = goc.offsetParent || goc.parentElement;
  const kl = goc.cloneNode(true);
  kl.removeAttribute('hidden');
  kl.removeAttribute('data-trang');
  kl.setAttribute('aria-hidden', 'true');
  kl.inert = true;
  kl.classList.add('anh-cu');
  Object.assign(kl.style, { top: `${goc.offsetTop}px`, left: `${goc.offsetLeft}px`, width: `${goc.offsetWidth}px`, minHeight: `${goc.offsetHeight}px` });
  cha.append(kl);
  goc.classList.add('giu-cu');
  anhCuDangPhu = { kl, goc };
  return kl;
}
// Đợi khung xương biến mất (tối đa 1,8 giây) rồi mờ ảnh cũ đi.
async function boAnhCu(kl, goc) {
  const han = Date.now() + 1800;
  while (goc.querySelector('.xuong') && Date.now() < han && anhCuDangPhu?.kl === kl) await new Promise((r) => setTimeout(r, 40));
  if (anhCuDangPhu?.kl !== kl) return;
  if (itChuyenDong()) { boAnhCuNgay(); return; }
  kl.classList.add('mo-di');
  setTimeout(() => { if (anhCuDangPhu?.kl === kl) boAnhCuNgay(); }, 200);
}
