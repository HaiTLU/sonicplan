// Giao diện Sonicplan: một trang, chuyển mục theo dấu #, đọc ghi dữ liệu qua /api.

import { CHU_TRANG_THAI, dungKhoiClaude, veKhoiClaude } from './claude.js';
import { veDuAn } from './du-an.js';
import { dongHieuSuat, veHieuSuat } from './hieu-suat.js';
import { batKeoTha } from './keo-tha.js';
import { hexMau, mauViec, oChonMau } from './mau.js';
import { dongTrinhDon, moTrinhDon } from './trinh-don.js';
import { mienCuaUrl, nhanTep, phanTichTin, tachLienKet, trichTin } from './zalo-tin.js';

const MUI_GIO = 'Asia/Ho_Chi_Minh';
const fmt = {
  gioPhut: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: MUI_GIO }),
  ngayGio: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: MUI_GIO }),
  ngayDai: new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: MUI_GIO }),
  ngayNgan: new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' }),
  ngayISO: new Intl.DateTimeFormat('en-CA', { timeZone: MUI_GIO }),
  gioSo: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: MUI_GIO }),
  so: new Intl.NumberFormat('vi-VN'),
};
const homNay = () => fmt.ngayISO.format(new Date());
const congNgay = (ngay, n) => {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ngayHienThi = (ngay) => fmt.ngayNgan.format(new Date(`${ngay}T00:00:00Z`));
function luc(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const phut = Math.round((Date.now() - d) / 60000);
  if (phut < 1) return 'vừa xong';
  if (phut < 60) return `${phut} phút`;
  if (fmt.ngayISO.format(d) === homNay()) return fmt.gioPhut.format(d);
  return fmt.ngayGio.format(d);
}
function kichThuoc(b) {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${fmt.so.format(Math.round(b / 102.4) / 10)} KB`;
  return `${fmt.so.format(Math.round(b / 104857.6) / 10)} MB`;
}

// ---------- Dựng phần tử ----------
function h(the, thuocTinh = {}, ...con) {
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
const NS = 'http://www.w3.org/2000/svg';
function s(the, thuocTinh = {}, ...con) {
  const el = document.createElementNS(NS, the);
  for (const [k, v] of Object.entries(thuocTinh)) if (v != null) el.setAttribute(k, v);
  for (const c of con.flat()) if (c) el.append(c);
  return el;
}
function icon(ten) {
  const el = s('svg', { 'aria-hidden': 'true' });
  el.append(s('use', { href: `#i-${ten}` }));
  return el;
}

// ---------- Gọi API ----------
async function api(duongDan, tuyChon = {}) {
  const ph = await fetch(duongDan, {
    ...tuyChon,
    headers: { accept: 'application/json', ...(tuyChon.body ? { 'content-type': 'application/json' } : {}) },
  });
  const duLieu = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(duLieu.loi || 'Không đọc được dữ liệu. Tải lại trang để thử lại.');
  return duLieu;
}

function bao(noiDung, { loi = false, hanhDong } = {}) {
  const el = h('div', { class: `bao${loi ? ' loi' : ''}` }, h('span', { text: noiDung }));
  if (hanhDong) el.append(h('button', { type: 'button', text: hanhDong.nhan, onclick: () => { hanhDong.lam(); el.remove(); } }));
  document.getElementById('vung-bao').append(el);
  setTimeout(() => el.remove(), hanhDong ? 6000 : 3500);
}

function khungLoi(e, thuLai) {
  return h('div', { class: 'bao-loi-trang', role: 'alert' }, h('span', { text: e.message }), h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Thử lại', onclick: thuLai }));
}

function xuong(cao, rong = '100%') {
  return h('div', { class: 'xuong', style: `height:${cao}px;width:${rong}` });
}

async function chep(van, nut) {
  try {
    await navigator.clipboard.writeText(van);
    bao('Đã chép.');
    if (nut) nut.setAttribute('aria-label', 'Đã chép');
  } catch {
    bao('Trình duyệt chặn chép, hãy bôi đen rồi chép tay.', { loi: true });
  }
}
function oChep(van, { lo = false } = {}) {
  const nut = h('button', { class: 'nut-icon', type: 'button', 'aria-label': 'Chép', onclick: () => chep(van, nut) }, icon('chep'));
  return h('div', { class: `o-chep${lo ? ' lo' : ''}` }, h('code', { translate: 'no', text: van }), nut);
}

// ---------- Trạng thái chung ----------
// Thay con của một phần tử, bỏ qua giá trị rỗng (null, false) để không hiện chữ "null".
function thay(el, ...con) {
  el.replaceChildren(...con.flat().filter((c) => c != null && c !== false));
}

// Tên nhóm Zalo thường đã bắt đầu bằng "Nhóm", tránh hiện "Nhóm Nhóm ...".
function tenNhom(ten) {
  return /^nh[oó]m\s/i.test(ten) ? ten : `Nhóm ${ten}`;
}

const trang = { toi: null, zalo: { loc: 'tat-ca', q: '' }, tin: { loc: 'tat-ca', q: '', chon: null, ds: [] }, viec: { tab: 'mo', duAn: 'tat-ca', xem: 'han', anTrong: false }, tep: { q: '' }, nho: { loai: 'tat-ca', q: '' } };
const TEN_MUC = { 'tong-quan': 'Tổng quan', 'hop-tin': 'Hộp tin', zalo: 'Zalo', viec: 'Việc', 'hieu-suat': 'Hiệu suất', 'du-an': 'Dự án', 'ghi-nho': 'Ghi nhớ', tep: 'Tệp', luong: 'Luồng', 'ket-noi': 'Kết nối', 'nhat-ky': 'Nhật ký chạy', 'du-lieu': 'Dữ liệu của bạn', 'da-chan': 'Đã chặn' };
// Bốn mục chính, mỗi mục gom vài trang con (kế hoạch chuẩn quốc tế 13/10/2026, giai đoạn 3).
// Đường dẫn cũ (#viec, #zalo...) giữ nguyên để liên kết đã lưu vẫn mở được.
const NHOM = [
  { ma: 'hom-nay', ten: 'Hôm nay', con: ['tong-quan', 'viec', 'hieu-suat'] },
  { ma: 'hop-tin', ten: 'Hộp tin', con: ['hop-tin', 'zalo', 'da-chan'] },
  { ma: 'du-an', ten: 'Dự án', con: ['du-an', 'tep', 'ghi-nho'] },
  { ma: 'cai-dat', ten: 'Cài đặt', con: ['ket-noi', 'luong', 'nhat-ky', 'du-lieu'] },
];
const TEN_TAB = { 'hop-tin': 'Tất cả tin', 'du-an': 'Dự án', 'nhat-ky': 'Nhật ký' };
const nhomCua = (muc) => NHOM.find((n) => n.con.includes(muc)) || NHOM[0];
const KET_QUA = { xong: 'Xong', loi: 'Lỗi', dang_chay: 'Đang chạy' };
const ICON_TP = { 'may-chu': 'he-thong', csdl: 'kho', 'hen-gio': 'dong-ho', thu: 'thu', zalo: 'zalo', tep: 'tep', lich: 'lich', ai: 'ai', telegram: 'telegram' };
const TEN_DEN = { xanh: 'ổn', vang: 'đang chờ', do: 'lỗi', xam: 'chưa dùng' };

function capNhatDem(soTin, soViec) {
  const dat = (id, n) => {
    const el = document.getElementById(id);
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = !n;
  };
  if (soTin != null) dat('dem-tin', soTin);
  if (soViec != null) dat('dem-viec', soViec);
}

// =====================================================================
// Tổng quan
// =====================================================================
async function veTongQuan(goc) {
  thay(goc, 
    h('div', { class: 'luoi-tq' },
      h('div', { class: 'bang anh-hung' }, xuong(22, '30%'), h('div', { style: 'height:10px' }), xuong(56, '60%'), h('div', { style: 'height:26px' }), xuong(150)),
      h('div', { class: 'bang dai-so' }, ...[1, 2, 3, 4].map(() => h('div', { class: 'o-so' }, xuong(14, '50%'), h('div', { style: 'height:10px' }), xuong(36, '40%')))),
    ),
  );
  const kq = await api('/api/tong-quan');
  const sl = kq.so_lieu;
  capNhatDem(sl.tin_chua_xem, sl.viec_mo);
  const tp = kq.tinh_trang.thanh_phan;
  const tt = tomTat(tp, sl);

  const luoi = h('div', { class: 'luoi-tq vao' });
  // Phần đầu: lời chào, câu tóm tắt, vòng sức khỏe, sóng 24 giờ.
  const gio = Number(fmt.gioSo.format(new Date()));
  const loiChao = gio < 11 ? 'Chào buổi sáng' : gio < 14 ? 'Chào buổi trưa' : gio < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dungDuoc = tp.filter((p) => p.den !== 'xam');
  const on = dungDuoc.filter((p) => p.den === 'xanh').length;
  const vong = vongSucKhoe(on, dungDuoc.length, tt.den);
  luoi.append(
    h('section', { class: 'bang anh-hung', 'aria-labelledby': 'tq-tom-tat' },
      h('div', { class: 'anh-hung-tren' },
        h('div', {},
          h('p', { class: 'chao', text: `${loiChao}, ${trang.toi?.nguoi_dung?.ten?.split(' ').slice(-2).join(' ') || 'bạn'}.` }),
          h('h2', { class: 'tom-tat', id: 'tq-tom-tat', dataset: { den: tt.den }, text: tt.cau }),
          h('p', { class: 'tom-tat-phu', text: tt.phu }),
        ),
        vong,
      ),
      veSong(kq.nhip),
    ),
  );

  // Dải số liệu: một bảng chia vạch, không phải bốn thẻ giống nhau.
  const tin7 = Array.from({ length: 7 }, (_, i) => {
    const ngay = congNgay(kq.hom_nay, i - 6);
    return kq.tin_7_ngay.find((r) => r.ngay === ngay)?.n || 0;
  });
  luoi.append(
    h('dl', { class: 'bang dai-so' },
      oSo('hop-tin', 'Tin hôm nay', sl.tin_hom_nay, sl.tin_chua_xem ? h('span', { class: 'ghi' }, h('b', { text: `${sl.tin_chua_xem} chưa xem` })) : h('span', { class: 'ghi', text: 'Đã xem hết' }), dongNho(tin7)),
      oSo('viec', 'Việc đang mở', sl.viec_mo, h('span', { class: 'ghi' }, sl.viec_qua_han ? h('b', { text: `${sl.viec_qua_han} quá hạn` }) : h('b', { class: 'tot', text: 'Không việc nào trễ' }))),
      oSo('dong-ho', 'Hạn hôm nay', sl.viec_hom_nay, h('span', { class: 'ghi', text: `${sl.xong_hom_nay} việc đã xong hôm nay` })),
      oSo('tep', 'Tệp tuần này', sl.tep_tuan, h('span', { class: 'ghi', text: 'Lưu trong kho tệp' })),
    ),
  );

  luoi.append(dongHieuSuat({ h, icon, api }));

  // Tổng hợp một lần: AI đọc hồ sơ, ghi nhớ, việc, tin 48 giờ rồi viết bản tổng hợp
  const khungTH = h('div', { class: 'tong-hop-noi-dung', 'aria-live': 'polite' });
  const nutTH = h('button', { class: 'nut nut-chinh', type: 'button' }, icon('ai'), 'Tổng hợp ngay');
  const veTH = (cuoi) => thay(khungTH, cuoi ? h('div', {}, h('p', { class: 'mo-ta', text: `Tổng hợp lúc ${luc(cuoi.luc)}` }), h('pre', { class: 'van-ban-tong-hop', text: cuoi.noi_dung })) : h('p', { class: 'mo-ta', text: 'Bấm nút để AI đọc toàn bộ việc, tin 48 giờ qua, hồ sơ và ghi nhớ rồi viết một bản: làm gì trước, rủi ro, ai đang chờ, việc nên giao trợ lý.' }));
  nutTH.addEventListener('click', async () => {
    nutTH.disabled = true;
    thay(khungTH, xuong(14, '70%'), xuong(14, '90%'), xuong(14, '60%'));
    try { veTH((await api('/api/tong-hop', { method: 'POST' })).cuoi); } catch (e) { bao(e.message, { loi: true }); veTH(null); }
    nutTH.disabled = false;
  });
  api('/api/tong-hop').then((r) => veTH(r.cuoi)).catch(() => veTH(null));
  luoi.append(h('section', { class: 'bang tong-hop' }, h('div', { class: 'bang-dau' }, h('h2', {}, icon('ai'), 'Tổng hợp'), nutTH), khungTH));

  luoi.append(bangViecSapToi(kq.viec_sap_toi, kq.hom_nay), bangTinMoi(kq.tin_moi));

  luoi.append(
    h('section', { class: 'bang bang-suc-khoe', 'aria-labelledby': 'tq-sk' },
      h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-sk' }, icon('he-thong'), 'Các bộ phận'), h('a', { class: 'lien-ket-nho', href: '#ket-noi' }, 'Cài kết nối', icon('mui-ten'))),
      h('div', { class: 'luoi-tp' }, ...tp.map((p) =>
        h('div', { class: 'tp' },
          h('span', { class: 'tp-icon', dataset: { den: p.den }, role: 'img', 'aria-label': `${p.ten}: ${TEN_DEN[p.den]}` }, icon(ICON_TP[p.ma] || 'he-thong')),
          h('div', {}, h('strong', { text: p.ten }), h('span', { text: p.mo_ta })),
        ))),
      h('div', { class: 'bang-cuon', tabindex: '0', role: 'region', 'aria-label': 'Bảng tác vụ' }, bangTacVu(kq.tinh_trang.tac_vu)),
    ),
  );
  thay(goc, luoi);
  requestAnimationFrame(() => vong.querySelector('.day-vong')?.style.setProperty('stroke-dashoffset', vong.dataset.dich));
}

function tomTat(tp, sl) {
  const loi = tp.filter((p) => p.den === 'do');
  const cho = tp.filter((p) => p.den === 'vang');
  const chuaNoi = tp.filter((p) => p.den === 'xam').length;
  const phuViec = sl.viec_mo ? `Còn ${sl.viec_mo} việc mở${sl.viec_qua_han ? `, ${sl.viec_qua_han} việc quá hạn` : ''}.` : 'Không còn việc nào mở.';
  if (loi.length) return { den: 'do', cau: loi.length === 1 ? `${loi[0].ten} đang lỗi.` : `${loi.length} bộ phận đang lỗi.`, phu: `${loi.map((p) => `${p.ten}: ${p.mo_ta}`).join('. ')}. ${phuViec}` };
  if (sl.viec_qua_han) return { den: 'vang', cau: `${sl.viec_qua_han} việc đã quá hạn.`, phu: `Hệ thống chạy ổn. ${phuViec}` };
  if (cho.length) return { den: 'vang', cau: 'Đang chờ tín hiệu đầu tiên.', phu: `${cho.map((p) => p.mo_ta).join('. ')}. ${chuaNoi ? `${chuaNoi} kết nối chưa cài.` : ''}` };
  return { den: 'xanh', cau: sl.viec_hom_nay ? `Hôm nay có ${sl.viec_hom_nay} việc tới hạn.` : 'Mọi thứ đang chạy êm.', phu: `${phuViec}${chuaNoi ? ` ${chuaNoi} kết nối chưa cài.` : ''}` };
}

function vongSucKhoe(on, tong, den) {
  const r = 52;
  const chuVi = 2 * Math.PI * r;
  const dich = tong ? chuVi * (1 - on / tong) : chuVi;
  const el = h('div', { class: 'vong', dataset: { den, dich: String(dich) }, role: 'img', 'aria-label': `${on} trên ${tong} bộ phận đang ổn` });
  const ve = s('svg', { viewBox: '0 0 132 132' },
    s('circle', { class: 'ray-vong', cx: 66, cy: 66, r }),
    s('circle', { class: 'day-vong', cx: 66, cy: 66, r, 'stroke-dasharray': chuVi, 'stroke-dashoffset': chuVi }),
  );
  el.append(ve, h('div', { class: 'vong-chu', 'aria-hidden': 'true' }, h('b', { text: `${on}/${tong}` }), h('small', { text: 'bộ phận ổn' })));
  return el;
}

function oSo(ten, nhan, so, ghi, phu) {
  return h('div', { class: 'o-so' },
    h('dt', {}, icon(ten), nhan),
    h('dd', {}, h('div', {}, h('span', { class: 'so-lon', text: fmt.so.format(so || 0) }), ghi), phu || null),
  );
}

function dongNho(ds) {
  const max = Math.max(1, ...ds);
  const W = 92;
  const H = 34;
  const diem = ds.map((v, i) => [(i / (ds.length - 1)) * (W - 4) + 2, H - 3 - (v / max) * (H - 8)]);
  const d = diem.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return s('svg', { class: 'dong-nho', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Số tin 7 ngày qua: ${ds.join(', ')}` },
    s('path', { class: 'vung', d: `${d} L${W - 2} ${H} L2 ${H} Z` }),
    s('path', { d }),
    s('circle', { cx: diem.at(-1)[0], cy: diem.at(-1)[1], r: 2.6, fill: 'currentColor', stroke: 'none', style: 'color:var(--nhan)' }),
  );
}

// Sóng 24 giờ: nửa trên là tin đến, nửa dưới là việc tạo ra và lượt chạy tự động.
function veSong(nhip) {
  const gioNay = Number(fmt.gioSo.format(new Date()));
  const W = 1000;
  const H = 150;
  const giua = H / 2;
  const cot = W / 24;
  const maxTren = Math.max(4, ...nhip.tin);
  const maxDuoi = Math.max(4, ...nhip.viec.map((v, i) => v + nhip.chay[i]));
  const ve = s('svg', { class: 've', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  ve.append(s('line', { class: 'duong-giua', x1: 0, x2: W, y1: giua, y2: giua }));
  const tongTin = nhip.tin.reduce((a, b) => a + b, 0);
  const tongViec = nhip.viec.reduce((a, b) => a + b, 0);
  const tongChay = nhip.chay.reduce((a, b) => a + b, 0);
  const tongLoi = nhip.loi.reduce((a, b) => a + b, 0);
  for (let g = 0; g < 24; g++) {
    const x = g * cot + cot * 0.22;
    const w = cot * 0.56;
    const nhom = s('g', { class: 'cot-gio' });
    if (g > gioNay) {
      nhom.append(s('rect', { class: 'cot cot-tuong-lai', x: x + w / 2 - 2, y: giua - 2, width: 4, height: 4, rx: 2 }));
    } else {
      const caoTin = Math.max(nhip.tin[g] ? 6 : 2, (nhip.tin[g] / maxTren) * (giua - 8));
      nhom.append(s('rect', { class: 'cot cot-tin', x, y: giua - 3 - caoTin, width: w, height: caoTin, rx: Math.min(4, w / 2), style: `animation-delay:${g * 22}ms` }));
      const caoViec = (nhip.viec[g] / maxDuoi) * (giua - 8);
      const caoChay = Math.max(2, (nhip.chay[g] / maxDuoi) * (giua - 8));
      nhom.append(s('rect', { class: `cot ${nhip.loi[g] ? 'cot-loi' : 'cot-chay'}`, x, y: giua + 3, width: w, height: caoChay, rx: Math.min(3, w / 2), style: `animation-delay:${g * 22 + 80}ms` }));
      if (caoViec) nhom.append(s('rect', { class: 'cot cot-viec', x, y: giua + 3 + caoChay + 2, width: w, height: caoViec, rx: Math.min(3, w / 2), style: `animation-delay:${g * 22 + 140}ms` }));
    }
    ve.append(s('rect', { class: 'vung-gio', x: g * cot, y: 0, width: cot, height: H, 'data-gio': g }), nhom);
  }
  const xKim = gioNay * cot + cot / 2;
  ve.append(s('line', { class: 'kim', x1: xKim, x2: xKim, y1: 4, y2: H - 4, 'vector-effect': 'non-scaling-stroke' }));

  const goiY = h('div', { class: 'goi-y-song', 'aria-hidden': 'true' });
  const khung = h('div', { class: 'song-ve', role: 'img', 'aria-label': `Hôm nay: ${tongTin} tin đến, ${tongViec} việc mới, ${tongChay} lượt chạy tự động, ${tongLoi} lượt lỗi.` }, ve, goiY);
  ve.addEventListener('pointermove', (e) => {
    const vung = e.target.closest('.vung-gio');
    if (!vung) return;
    const g = Number(vung.dataset.gio);
    if (g > gioNay) {
      goiY.classList.remove('hien');
      return;
    }
    thay(goiY, 
      h('b', { text: `${String(g).padStart(2, '0')}:00 - ${String(g).padStart(2, '0')}:59` }),
      h('span', {}, 'Tin đến', h('strong', { text: nhip.tin[g] })),
      h('span', {}, 'Việc mới', h('strong', { text: nhip.viec[g] })),
      h('span', {}, 'Lượt chạy', h('strong', { text: `${nhip.chay[g]}${nhip.loi[g] ? ` (${nhip.loi[g]} lỗi)` : ''}` })),
    );
    const rect = khung.getBoundingClientRect();
    const x = ((g + 0.5) / 24) * rect.width;
    goiY.style.left = `${Math.min(Math.max(x, 90), rect.width - 90)}px`;
    goiY.classList.add('hien');
  });
  ve.addEventListener('pointerleave', () => goiY.classList.remove('hien'));

  return h('div', { class: 'song' },
    h('div', { class: 'song-dau' }, h('h2', { text: 'Nhịp hôm nay' }), h('p', { text: `${tongTin} tin đến, ${tongViec} việc mới, ${tongChay} lượt chạy${tongLoi ? `, ${tongLoi} lỗi` : ''}` })),
    khung,
    h('div', { class: 'thuoc-gio', 'aria-hidden': 'true' }, ...Array.from({ length: 24 }, (_, g) => h('span', { text: `${g}h` }))),
    h('ul', { class: 'chu-thich', 'aria-hidden': 'true' },
      h('li', {}, h('i'), 'Tin đến'), h('li', {}, h('i', { class: 'viec' }), 'Việc mới'), h('li', {}, h('i', { class: 'chay' }), 'Lượt chạy tự động'), h('li', {}, h('i', { class: 'loi' }), 'Lượt lỗi'),
    ),
  );
}

function nhomTheoNgay(ds, hn) {
  const nhom = new Map();
  for (const v of ds) {
    const k = !v.han_ngay ? 'khong' : v.han_ngay < hn ? 'qua' : v.han_ngay;
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k).push(v);
  }
  return nhom;
}

function nhanNgay(k, hn) {
  if (k === 'qua') return h('span', { class: 'nhan qua-han', text: 'Quá hạn' });
  if (k === 'khong') return h('span', { class: 'nhan', text: 'Chưa có hạn' });
  if (k === hn) return h('span', { class: 'nhan hom-nay', text: 'Hôm nay' });
  if (k === congNgay(hn, 1)) return h('span', { class: 'nhan', text: 'Ngày mai' });
  return h('span', { class: 'nhan', text: ngayHienThi(k) });
}

function bangViecSapToi(ds, hn) {
  const goc = h('section', { class: 'bang bang-viec-toi', 'aria-labelledby': 'tq-viec' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-viec' }, icon('viec'), 'Việc sắp tới'), h('a', { class: 'lien-ket-nho', href: '#viec' }, 'Tất cả việc', icon('mui-ten'))),
  );
  if (!ds.length) {
    goc.append(h('div', { class: 'trong-trai', style: 'min-height:220px' }, icon('viec'), h('h3', { text: 'Chưa có việc nào' }), h('p', { text: 'Việc tách từ tin nhắn sẽ hiện ở đây. Bạn cũng có thể bấm Thêm việc.' })));
    return goc;
  }
  const ul = h('ul', { class: 'dong-thoi-gian' });
  for (const [k, cac] of nhomTheoNgay(ds, hn)) {
    ul.append(h('li', { class: 'ngay-nhom' }, h('h3', {}, nhanNgay(k, hn)), ...cac.map((v) => mucViec(v))));
  }
  goc.append(ul);
  return goc;
}

function mucViec(v) {
  const o = h('input', { class: 'o-xong', type: 'checkbox', 'aria-label': `Đánh dấu xong: ${v.tieu_de}` });
  const dong = h('div', { class: 'muc-viec' },
    o,
    h('button', { class: 'ten-viec', type: 'button', text: v.tieu_de, onclick: () => moNganViec(v) }),
    v.gio_hen ? h('span', { class: 'chip-gio', text: v.gio_hen }) : h('span'),
  );
  o.addEventListener('change', () => doiXong(v, o.checked, dong));
  dong._viec = v;
  return dong;
}


// Trình đơn chuột phải trên thẻ việc (và nút ba chấm trên điện thoại): các thao tác nhanh không cần mở ngăn sửa.
async function suaNhanh(v, thanThay, loiNhan) {
  try {
    await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify(thanThay) });
    const cu = Object.fromEntries(Object.keys(thanThay).map((k) => [k, v[k] ?? null]));
    bao(loiNhan, { hanhDong: { nhan: 'Hoàn tác', lam: async () => { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify(cu) }); moMuc(); } } });
  } catch (e) {
    bao(e.message, { loi: true });
  }
  moMuc();
}

async function moTrinhDonViec(v, x, y) {
  if (!duAnDs.length) { try { duAnDs = (await api('/api/du-an')).du_an || []; } catch {} }
  const xong = v.trang_thai === 'xong';
  const hn = homNay();
  const han = (n) => congNgay(hn, n);
  const hanMuc = (nhan, ngay) => ({ nhan, chon: (v.han_ngay || null) === ngay, lam: () => suaNhanh(v, { han_ngay: ngay }, ngay ? `Đã đổi hạn sang ${nhan.toLowerCase()}.` : 'Đã bỏ hạn.') });
  const coTin = Boolean(v.tin_nhan_id);
  const muc = [
    { nhan: 'Mở chi tiết', lam: () => moNganViec(v) },
    xong ? { nhan: 'Mở lại việc', lam: () => doiXong(v, false) } : { nhan: 'Đánh dấu xong', lam: () => doiXong(v, true) },
  ];
  if (!xong) {
    muc.push(
      { vach: true },
      { tieuDe: 'Đổi hạn' },
      hanMuc('Hôm nay', hn), hanMuc('Ngày mai', han(1)), hanMuc('Tuần sau', han(7)), hanMuc('Bỏ hạn', null),
      { nhan: 'Chuyển dự án', con: [
        { nhan: 'Chưa xếp dự án', chon: !v.du_an_id, lam: () => suaNhanh(v, { du_an_id: null }, 'Đã gỡ khỏi dự án.') },
        ...duAnDs.map((d) => ({ nhan: d.ten, chon: v.du_an_id === d.id, lam: () => suaNhanh(v, { du_an_id: d.id }, `Đã chuyển sang ${d.ten}.`) })),
      ] },
      { nhan: 'Đổi màu', con: [{ node: oChonMau(h, v.mau, (ma) => { dongTrinhDon(); suaNhanh(v, { mau: ma || null }, 'Đã đổi màu việc.'); }, { coKhong: true, nhan: 'Màu việc' }) }] },
    );
  }
  if (coTin) {
    muc.push({ vach: true }, { nhan: 'Xem tin gốc', lam: () => { location.hash = `hop-tin/${v.tin_nhan_id}`; } });
    if (v.tin_nguon === 'zalo' || v.tin_nguon === 'gmail') {
      muc.push({ nhan: 'Spam nguồn này', nguy: true, lam: async () => {
        if (!confirm('Chặn nguồn của tin này? Tin cũ của nguồn sẽ ẩn, việc chưa xong sinh từ đó sẽ gỡ, và AI không tạo việc từ nguồn này nữa. Bỏ chặn ở Hộp tin, mục Đã chặn.')) return;
        try {
          const kq = await api('/api/chan', { method: 'POST', body: JSON.stringify({ tin_id: v.tin_nhan_id }) });
          bao(`Đã chặn ${kq.nhan}. Ẩn ${kq.an_tin} tin${kq.go_viec ? `, gỡ ${kq.go_viec} việc chưa xong` : ''}.`);
        } catch (e) { bao(e.message, { loi: true }); }
        moMuc();
      } });
    }
  }
  if (!xong) {
    muc.push({ vach: true }, { nhan: 'Hủy việc', nguy: true, lam: async () => {
      try {
        await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'huy' }) });
        bao(`Đã hủy: ${v.tieu_de}`, { hanhDong: { nhan: 'Hoàn tác', lam: async () => { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'mo' }) }); moMuc(); } } });
      } catch (e) { bao(e.message, { loi: true }); }
      moMuc();
    } });
  }
  moTrinhDon({ x, y, muc, nhan: `Thao tác với việc: ${v.tieu_de}` });
}

document.addEventListener('contextmenu', (e) => {
  const the = e.target.closest?.('.the-viec, .muc-viec');
  if (!the?._viec || document.body.classList.contains('dang-keo-tha') || e.target.closest('input[type=text], textarea, select')) return;
  e.preventDefault();
  let { clientX: x, clientY: y } = e;
  if (!x && !y) { const r = the.getBoundingClientRect(); x = r.left + 24; y = r.top + 24; } // mở bằng phím Menu hoặc Shift+F10
  moTrinhDonViec(the._viec, x, y);
});

async function doiXong(v, xong, el) {
  try {
    el?.classList.add('dang-xong');
    await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: xong ? 'xong' : 'mo' }) });
    bao(xong ? `Đã xong: ${v.tieu_de}` : 'Đã mở lại việc.', { hanhDong: xong ? { nhan: 'Hoàn tác', lam: () => doiXong(v, false) } : null });
    setTimeout(() => moMuc(), 350);
  } catch (e) {
    el?.classList.remove('dang-xong');
    bao(e.message, { loi: true });
  }
}

function bangTinMoi(ds) {
  const goc = h('section', { class: 'bang bang-tin-moi', 'aria-labelledby': 'tq-tin' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-tin' }, icon('hop-tin'), 'Tin mới'), h('a', { class: 'lien-ket-nho', href: '#hop-tin' }, 'Mở hộp tin', icon('mui-ten'))),
  );
  if (!ds.length) {
    goc.append(h('div', { class: 'trong-trai', style: 'min-height:220px' }, icon('hop-tin'), h('h3', { text: 'Hộp tin còn trống' }), h('p', { text: 'Nối Zalo và chuyển tiếp thư ở trang Kết nối để tin bắt đầu về.' })));
    return goc;
  }
  goc.append(h('ul', { class: 'ds-tin-ngan' }, ...ds.map((t) =>
    h('li', { class: t.da_xem ? '' : 'chua-xem' },
      h('a', { href: `#hop-tin/${t.id}` },
        h('span', { class: `huy-hieu ${t.nguon}` }, icon(t.nguon === 'zalo' ? 'zalo' : 'thu')),
        h('div', { style: 'min-width:0' },
          h('div', { class: 'dong-1' }, h('strong', { text: t.nguoi_gui || 'Không rõ' }), h('span', { text: t.nhom || t.tieu_de || '' })),
          h('p', { text: trichTin(t.trich) }),
        ),
        h('time', { datetime: t.thoi_diem, text: luc(t.thoi_diem) }),
      ),
    ))));
  return goc;
}

// Đổi biểu thức cron (giờ UTC) sang câu dễ đọc theo giờ Việt Nam.
function lichDeDoc(cron) {
  const [phut, gio] = String(cron || '').split(' ');
  if (phut?.startsWith('*/') && gio === '*') return `${phut.slice(2)} phút một lần`;
  if (phut === '0' && gio === '*') return 'Mỗi giờ';
  if (/^\d+$/.test(phut) && /^\d+$/.test(gio)) return `${String((+gio + 7) % 24).padStart(2, '0')}:${phut.padStart(2, '0')} hằng ngày`;
  return cron || '';
}

function bangTacVu(ds) {
  return h('table', {},
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Tác vụ tự động' }), h('th', { scope: 'col', text: 'Lịch' }), h('th', { scope: 'col', text: 'Lần gần nhất' }), h('th', { scope: 'col', text: 'Kết quả' }), h('th', { scope: 'col', text: 'Ghi chú' }))),
    h('tbody', {}, ...ds.map((t) => {
      const c = t.lan_cuoi;
      return h('tr', {},
        h('td', { text: t.ten }),
        h('td', { class: 'lich', text: lichDeDoc(t.lich) }),
        h('td', { class: 'gio', text: !t.bat ? 'Chưa bật' : c ? luc(c.bat_dau) : 'Chưa chạy' }),
        h('td', {}, h('span', { class: `nhan-kq ${c?.trang_thai || 'mo'}`, text: c ? KET_QUA[c.trang_thai] : 'Chờ' })),
        h('td', { class: 'ghi-chu', text: c?.ghi_chu || '' }),
      );
    })),
  );
}

// =====================================================================
// Spam: chặn một nguồn tin
// =====================================================================
// Nút Spam mở khung xác nhận ngay tại chỗ. tuyChon: các cách chặn ({ loai, gia_tri, nhan }), gui(tuyChon) gọi API,
// sauKhi() chạy khi chặn xong. Tin cũ của nguồn bị ẩn, việc chưa xong sinh từ đó bị gỡ, AI không đọc nguồn này nữa.
function moTaChan(c, nguon) {
  if (c.loai === 'nhom') return tenNhom(c.nhan);
  if (c.loai === 'dia_chi') return `Mọi thư từ ${c.nhan}`;
  return nguon === 'zalo' ? `Tin riêng với "${c.nhan}"` : `Thư của "${c.nhan}"`;
}

function nutSpam({ nguon, tuyChon, gui, sauKhi }) {
  const khung = h('div', { class: 'hop-spam', hidden: true });
  const nut = h('button', { class: 'nut nut-nguy nut-nho', type: 'button', 'aria-expanded': 'false', onclick: () => { khung.hidden = !khung.hidden; nut.setAttribute('aria-expanded', String(!khung.hidden)); } }, icon('chan'), 'Spam');
  let chon = tuyChon[0];
  const tenNhom = `chan-${Math.random().toString(36).slice(2, 8)}`;
  const dongY = h('button', { class: 'nut nut-nguy nut-nho', type: 'button', text: 'Chặn' });
  dongY.addEventListener('click', async () => {
    dongY.disabled = true;
    try {
      const kq = await gui(chon);
      bao(`Đã chặn ${kq.nhan}. Ẩn ${kq.an_tin} tin${kq.go_viec ? `, gỡ ${kq.go_viec} việc chưa xong` : ''}. Bỏ chặn ở mục Đã chặn.`);
      api('/api/tong-quan').then((k) => capNhatDem(k.so_lieu.tin_chua_xem, k.so_lieu.viec_mo)).catch(() => {});
      sauKhi();
    } catch (e) {
      bao(e.message, { loi: true });
      dongY.disabled = false;
    }
  });
  khung.append(
    h('p', { class: 'hop-spam-dau', text: 'Không hiện và không tính thành việc cần làm:' }),
    ...tuyChon.map((c, i) => h('label', { class: 'hop-spam-chon' }, h('input', { type: 'radio', name: tenNhom, ...(i === 0 ? { checked: '' } : {}), onchange: () => { chon = c; } }), h('span', { text: moTaChan(c, nguon) }))),
    h('p', { class: 'mo-ta', text: 'Tin cũ của nguồn này sẽ ẩn và việc chưa xong sinh ra từ đó sẽ gỡ. Việc đã xong được giữ lại.' }),
    h('div', { class: 'hang-nut' }, dongY, h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Hủy', onclick: () => { khung.hidden = true; nut.setAttribute('aria-expanded', 'false'); } })),
  );
  return { nut, khung };
}

async function veDaChan(goc) {
  thay(goc, h('div', { class: 'bang' }, xuong(20, '40%'), h('div', { style: 'height:12px' }), xuong(60)));
  const ve = async () => {
    let ds;
    try { ds = (await api('/api/chan')).ds; } catch (e) { thay(goc, khungLoi(e, ve)); return; }
    const ten = { zalo: 'Zalo', gmail: 'Thư' };
    const LOAI_CHAN = { nhom: 'cả nhóm', nguoi: 'theo người gửi', dia_chi: 'cả địa chỉ' };
    thay(goc, h('div', { class: 'bang vao' },
      h('div', { class: 'bang-dau' }, h('h2', {}, icon('chan'), 'Nguồn đã chặn')),
      h('p', { class: 'mo-ta', text: 'Tin từ các nguồn này không hiện trong Hộp tin và không bao giờ được tính thành việc. Bỏ chặn thì tin cũ hiện lại, nhưng việc đã gỡ không tự trở lại.' }),
      ds.length
        ? h('ul', { class: 'ds-chan' }, ...ds.map((c) => h('li', {},
          h('span', { class: `huy-hieu ${c.nguon}` }, icon(c.nguon === 'zalo' ? 'zalo' : 'thu')),
          h('div', { style: 'min-width:0' }, h('strong', { text: c.nhan }), h('small', { text: `${ten[c.nguon]}, ${LOAI_CHAN[c.loai]}, chặn ${luc(c.tao_luc)}` })),
          h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Bỏ chặn', onclick: async (ev) => {
            ev.target.disabled = true;
            try { const kq = await api(`/api/chan/${c.id}`, { method: 'DELETE' }); bao(`Đã bỏ chặn ${c.nhan}${kq.hien_tin ? `, ${kq.hien_tin} tin hiện lại` : ''}.`); ve(); } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
          } }),
        )))
        : h('div', { class: 'trong-trai' }, icon('chan'), h('h3', { text: 'Chưa chặn nguồn nào' }), h('p', { text: 'Mở một tin hoặc hội thoại không cần xem, bấm Spam để ẩn và không tính thành việc.' })),
    ));
  };
  await ve();
}

// =====================================================================
// Hộp tin
// =====================================================================
async function veHopTin(goc, thamSo) {
  const t = trang.tin;
  if (thamSo) t.chon = Number(thamSo);
  const khungDs = h('div', { class: 'bang ds-tin', 'aria-label': 'Danh sách tin' }, ...[1, 2, 3, 4, 5].map(() => h('div', { style: 'padding:12px 10px' }, xuong(14, '60%'), h('div', { style: 'height:8px' }), xuong(32))));
  const khungDoc = h('div', { class: 'bang doc-tin', 'aria-live': 'polite' });
  const hop = h('div', { class: `hop-tin${t.chon && thamSo ? ' dang-doc' : ''}` }, khungDs, khungDoc);

  const nutLoc = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(t.loc === ma), onclick: () => { t.loc = ma; veHopTin(goc); } }, nhan);
  const oTim = h('input', { type: 'search', placeholder: 'Tìm người gửi, nhóm, nội dung…', value: t.q, 'aria-label': 'Tìm tin' });
  let hen;
  oTim.addEventListener('input', () => {
    clearTimeout(hen);
    hen = setTimeout(() => { t.q = oTim.value.trim(); napDs(); }, 300);
  });
  thay(goc, 
    h('div', { class: 'thanh-loc' },
      nutLoc('tat-ca', 'Tất cả'), nutLoc('chua-xem', 'Chưa xem'), nutLoc('zalo', 'Zalo'), nutLoc('gmail', 'Thư'),
      h('button', { class: 'chip', type: 'button', onclick: async () => { await api('/api/tin/da-xem-het', { method: 'POST' }); bao('Đã đánh dấu xem hết.'); capNhatDem(0); veHopTin(goc); } }, 'Đánh dấu xem hết'),
      h('label', { class: 'o-tim' }, icon('tim'), oTim),
    ),
    hop,
  );

  async function napDs() {
    const q = new URLSearchParams();
    if (t.loc === 'chua-xem') q.set('chua_xem', '1');
    if (t.loc === 'zalo' || t.loc === 'gmail') q.set('nguon', t.loc);
    if (t.q) q.set('q', t.q);
    try {
      const { tin } = await api(`/api/tin?${q}`);
      t.ds = tin;
      veDs();
      if (t.chon) docTin(t.chon);
      else if (window.matchMedia('(min-width: 861px)').matches && tin[0]) docTin(tin[0].id);
      else thay(khungDoc, trongDoc());
    } catch (e) {
      thay(khungDs, khungLoi(e, napDs));
    }
  }

  function veDs() {
    if (!t.ds.length) {
      thay(khungDs, h('div', { class: 'trong-trai' }, icon('hop-tin'), h('h3', { text: t.q ? 'Không tìm thấy tin nào' : 'Chưa có tin' }), h('p', { text: t.q ? 'Thử từ khóa khác.' : 'Tin Zalo và thư chuyển tiếp sẽ về đây.' })));
      return;
    }
    thay(khungDs, h('ul', {}, ...t.ds.map((x) =>
      h('li', { class: x.da_xem ? '' : 'chua-xem' },
        h('button', { type: 'button', 'aria-current': String(x.id === t.chon), dataset: { id: x.id }, onclick: () => { location.hash = `hop-tin/${x.id}`; } },
          h('span', { class: `huy-hieu ${x.nguon}` }, icon(x.nguon === 'zalo' ? 'zalo' : 'thu')),
          h('div', { style: 'min-width:0' },
            h('div', { class: 'dong-1' }, h('strong', { text: x.nguoi_gui || 'Không rõ' }), h('time', { datetime: x.thoi_diem, text: luc(x.thoi_diem) })),
            (x.nhom || x.tieu_de) ? h('div', { class: 'noi', text: x.nhom ? tenNhom(x.nhom) : x.tieu_de }) : null,
            h('p', { text: trichTin(x.trich) }),
            (x.so_tep || x.so_viec) ? h('div', { class: 'the-nho' }, x.so_tep ? h('span', { text: `${x.so_tep} tệp` }) : null, x.so_viec ? h('span', { class: 'viec', text: `${x.so_viec} việc` }) : null) : null,
          ),
        ),
      ))));
  }

  function trongDoc() {
    return h('div', { class: 'trong-trai' }, icon('hop-tin'), h('h3', { text: 'Chọn một tin để đọc' }), h('p', { text: 'Việc AI tách ra từ tin sẽ hiện ngay dưới nội dung.' }));
  }

  async function docTin(id) {
    t.chon = id;
    khungDs.querySelectorAll('button[data-id]').forEach((b) => b.setAttribute('aria-current', String(Number(b.dataset.id) === id)));
    thay(khungDoc, xuong(14, '30%'), h('div', { style: 'height:16px' }), xuong(34, '70%'), h('div', { style: 'height:20px' }), xuong(160));
    try {
      const { tin, tep, viec, chan } = await api(`/api/tin/${id}`);
      const muc = t.ds.find((x) => x.id === id);
      if (muc && !muc.da_xem) {
        muc.da_xem = 1;
        khungDs.querySelector(`button[data-id="${id}"]`)?.parentElement.classList.remove('chua-xem');
      }
      const spam = nutSpam({
        nguon: tin.nguon,
        tuyChon: chan || [],
        gui: (c) => api('/api/chan', { method: 'POST', body: JSON.stringify({ tin_id: tin.id, loai: c.loai }) }),
        sauKhi: () => { t.chon = null; location.hash = 'hop-tin'; veHopTin(goc); },
      });
      if (!(chan || []).length) spam.nut.hidden = true;
      thay(khungDoc, 
        h('button', { class: 'nut nut-phu nut-nho nut-quay', type: 'button', text: 'Quay lại danh sách', onclick: () => { t.chon = null; location.hash = 'hop-tin'; } }),
        h('div', { class: 'nguon' }, h('span', { class: `huy-hieu ${tin.nguon}` }, icon(tin.nguon === 'zalo' ? 'zalo' : 'thu')), tin.nguon === 'zalo' ? (tin.nhom ? `Zalo, ${tenNhom(tin.nhom)}` : 'Zalo, tin riêng') : 'Thư chuyển tiếp'),
        h('h2', { text: tin.tieu_de && tin.nguon === 'gmail' ? tin.tieu_de : tin.nguoi_gui || 'Không rõ người gửi' }),
        h('p', { class: 'meta', text: `${tin.nguon === 'gmail' ? `Từ ${tin.nguoi_gui || 'không rõ'}, ` : ''}${fmt.ngayGio.format(new Date(tin.thoi_diem))}` }),
        h('div', { class: 'than', text: tin.noi_dung || '(Không có nội dung)' }),
        tep.length ? h('div', { class: 'khoi' }, h('h3', { text: 'Tệp đính kèm' }), ...tep.map((f) => h('a', { class: 'tep-dinh', href: `/api/tep/${f.id}/tai`, onclick: (ev) => { const k = kieuMo(f); if (k && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); moXemTep(f, k); } } }, icon('tai'), f.ten, h('small', { text: kichThuoc(f.kich_thuoc) })))) : null,
        h('div', { class: 'khoi' },
          h('h3', { text: viec.length ? 'Việc tách từ tin này' : 'Chưa có việc nào từ tin này' }),
          ...viec.map((v) => h('div', { class: 'muc-viec' }, h('span', { class: `nhan-kq ${v.trang_thai === 'xong' ? 'xong' : 'dang_chay'}`, text: v.trang_thai === 'xong' ? 'Xong' : 'Mở' }), h('button', { class: 'ten-viec', type: 'button', text: v.tieu_de, onclick: () => moNganViec(v) }), v.han_ngay ? h('span', { class: 'chip-gio', text: `${ngayHienThi(v.han_ngay)}${v.gio_hen ? ` ${v.gio_hen}` : ''}` }) : h('span'))),
          h('div', { class: 'hang-nut' },
            h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => moNganViec(null, { tieu_de: '', ghi_chu: `Từ ${tin.nguoi_gui || ''}: ${(tin.noi_dung || '').slice(0, 300)}` }) }, icon('cong'), 'Tạo việc từ tin này'),
            spam.nut,
          ),
          spam.khung,
        ),
      );
      api('/api/tong-quan').then((kq) => capNhatDem(kq.so_lieu.tin_chua_xem, kq.so_lieu.viec_mo)).catch(() => {});
    } catch (e) {
      thay(khungDoc, khungLoi(e, () => docTin(id)));
    }
  }

  napDs();
}

// =====================================================================
// Việc
// =====================================================================
let duAnDs = [];
let cacViec = new Map();
let homNayCuaViec = '';

// Nhãn nguồn của việc: Zalo kèm tên nhóm hoặc người, Gmail kèm người gửi, Telegram, Tự thêm.
function nhanNguon(v) {
  const ma = v.nguon || v.tin_nguon || 'tay';
  const ai = (v.tin_nhom || v.tin_nguoi_gui || '').split('<')[0].trim();
  if (ma === 'zalo') return { ma, icon: 'zalo', chu: ai ? `Zalo · ${ai}` : 'Zalo' };
  if (ma === 'gmail') return { ma, icon: 'thu', chu: ai ? `Gmail · ${ai}` : 'Gmail' };
  if (ma === 'telegram') return { ma, icon: 'telegram', chu: 'Telegram' };
  if (ma === 'api') return { ma, icon: 'ai', chu: 'Dịch vụ ngoài' };
  return { ma: 'tay', icon: 'cong', chu: 'Tự thêm' };
}

async function veViec(goc) {
  const v = trang.viec;
  const oTen = h('input', { name: 'tieu_de', placeholder: 'Thêm nhanh một việc rồi nhấn Enter…', maxlength: '200', 'aria-label': 'Tên việc', autocomplete: 'off' });
  const oNgay = h('input', { name: 'han_ngay', type: 'date', 'aria-label': 'Hạn', value: homNay() });
  const oGio = h('input', { name: 'gio_hen', type: 'time', step: '300', 'aria-label': 'Giờ hẹn' });
  const form = h('form', { class: 'bang them-nhanh' }, oTen, oNgay, oGio, h('button', { class: 'nut nut-chinh', type: 'submit' }, icon('cong'), 'Thêm'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!oTen.value.trim()) {
      oTen.focus();
      bao('Nhập tên việc trước đã.', { loi: true });
      return;
    }
    try {
      await api('/api/viec', { method: 'POST', body: JSON.stringify({ tieu_de: oTen.value, han_ngay: oNgay.value || null, gio_hen: oGio.value || null }) });
      bao('Đã thêm việc.');
      oTen.value = '';
      napViec();
    } catch (err) {
      bao(err.message, { loi: true });
    }
  });

  const tab = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.tab === ma), onclick: () => { v.tab = ma; veViec(goc); } }, nhan);
  const vung = h('div', { class: 'cot-viec-wrap' }, ...[1, 2, 3].map(() => h('div', { class: 'cot-viec', style: 'padding:16px' }, xuong(16, '40%'), h('div', { style: 'height:14px' }), xuong(70), h('div', { style: 'height:8px' }), xuong(70))));
  const locDuAn = h('div', { class: 'thanh-loc loc-du-an', 'aria-label': 'Lọc theo dự án' });
  const xem = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.xem === ma), onclick: () => { v.xem = ma; veViec(goc); } }, nhan);
  thay(goc, form, h('div', { class: 'thanh-loc' }, tab('mo', 'Đang mở'), tab('xong', 'Đã xong'), v.tab === 'mo' ? h('span', { class: 'gian' }) : null, v.tab === 'mo' ? xem('han', 'Theo hạn') : null, v.tab === 'mo' ? xem('du-an', 'Theo dự án') : null, v.tab === 'mo' && v.xem === 'du-an' ? h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.anTrong), title: 'Ẩn các cột dự án chưa có việc', onclick: () => { v.anTrong = !v.anTrong; napViec(); } }, 'Ẩn cột trống') : null), locDuAn, vung);
  batKeoTha(vung, { khiTha: (d) => khiThaViec(d, v, napViec), nhanDuoc: (ma) => ma !== 'qua-han' && v.tab === 'mo',
    khiThaCot: async (ids) => {
      try { await api('/api/du-an/sap-xep', { method: 'POST', body: JSON.stringify({ ids }) }); bao('Đã lưu thứ tự dự án.'); } catch (err) { bao(err.message, { loi: true }); }
      napViec();
    } });

  function veLoc(viec) {
    const dem = (f) => viec.filter(f).length;
    const chip = (ma, nhan, so, mau) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.duAn === ma), onclick: () => { v.duAn = ma; napViec(); } }, hexMau(mau) ? h('i', { class: 'cham-mau', style: `--mau:${hexMau(mau)}` }) : null, nhan, h('b', { text: String(so) }));
    const ds = duAnDs.filter((d) => viec.some((x) => x.du_an_id === d.id) || v.duAn === d.id);
    thay(locDuAn, chip('tat-ca', 'Tất cả dự án', viec.length), ...ds.map((d) => chip(d.id, d.ten, dem((x) => x.du_an_id === d.id), d.mau)), dem((x) => !x.du_an_id) ? chip('khong', 'Chưa xếp dự án', dem((x) => !x.du_an_id)) : null);
  }

  async function napViec() {
    try {
      const [{ viec: tatCa, hom_nay: hn }, dsDa] = await Promise.all([api(`/api/viec?trang_thai=${v.tab}`), api('/api/du-an').catch(() => ({ du_an: [] }))]);
      duAnDs = dsDa.du_an;
      if (v.tab === 'mo') capNhatDem(null, tatCa.length);
      veLoc(tatCa);
      const viec = v.duAn === 'tat-ca' ? tatCa : tatCa.filter((x) => (v.duAn === 'khong' ? !x.du_an_id : x.du_an_id === v.duAn));
      cacViec = new Map(tatCa.map((x) => [x.id, x]));
      homNayCuaViec = hn;
      thay(vung, ...(v.tab === 'mo' ? (v.xem === 'du-an' ? cotTheoDuAn(viec, hn) : cotTheoHan(viec, hn)) : [cotXong(viec)]));
    } catch (e) {
      thay(vung, khungLoi(e, napViec));
    }
  }
  napViec();
}

function cotTheoHan(ds, hn) {
  const mai = congNgay(hn, 1);
  const cuoiTuan = congNgay(hn, 7);
  const cot = [
    { ma: 'qua-han', ten: 'Quá hạn', loc: (x) => x.han_ngay && x.han_ngay < hn },
    { ma: 'hom-nay', ten: 'Hôm nay', loc: (x) => x.han_ngay === hn },
    { ma: 'ngay-mai', ten: 'Ngày mai', loc: (x) => x.han_ngay === mai },
    { ma: 'tuan', ten: '7 ngày tới', loc: (x) => x.han_ngay > mai && x.han_ngay <= cuoiTuan },
    { ma: 'sau', ten: 'Sau đó', loc: (x) => x.han_ngay > cuoiTuan },
    { ma: 'khong', ten: 'Chưa có hạn', loc: (x) => !x.han_ngay },
  ];
  return cot
    .map((c) => ({ ...c, ds: ds.filter(c.loc) }))
    .filter((c) => c.ds.length || ['hom-nay', 'ngay-mai'].includes(c.ma))
    .map((c) => h('section', { class: 'cot-viec', dataset: { cot: c.ma }, 'aria-label': c.ten },
      h('header', {}, h('h2', { text: c.ten }), h('span', { text: String(c.ds.length) })),
      c.ds.length ? h('ul', {}, ...c.ds.map((x) => theViec(x, hn))) : h('p', { class: 'cot-trong', text: c.ma === 'hom-nay' ? 'Không có việc tới hạn hôm nay.' : 'Trống.' }),
    ));
}

function cotTheoDuAn(ds, hn) {
  const cot = [...duAnDs.map((d) => ({ ma: `da-${d.id}`, ten: d.ten, mau: d.mau, loc: (x) => x.du_an_id === d.id })), { ma: 'da-khong', ten: 'Chưa xếp dự án', loc: (x) => !x.du_an_id }];
  return cot.map((c) => ({ ...c, ds: ds.filter(c.loc) })).filter((c) => !(trang.viec.anTrong && !c.ds.length && c.ma !== 'da-khong')).map((c) => h('section', { class: 'cot-viec', dataset: { cot: c.ma }, 'aria-label': c.ten, ...(hexMau(c.mau) ? { style: `--mau:${hexMau(c.mau)}` } : {}) },
    h('header', {}, h('h2', { text: c.ten }), h('span', { text: String(c.ds.length) })),
    c.ds.length ? h('ul', {}, ...c.ds.map((x) => theViec(x, hn))) : h('p', { class: 'cot-trong', text: 'Kéo việc vào đây.' }),
  ));
}

// Thả thẻ vào cột: đổi hạn (xem theo hạn) hoặc đổi dự án (xem theo dự án), rồi lưu thứ tự cột đích.
async function khiThaViec({ id, tuCot, denCot, ids }, v, napLai) {
  const x = cacViec.get(id);
  if (!x) return napLai();
  const hn = homNayCuaViec;
  const cuaDuAn = denCot.startsWith('da-');
  const sua = {};
  if (cuaDuAn) {
    const moi = denCot === 'da-khong' ? null : Number(denCot.slice(3));
    if (moi !== (x.du_an_id || null)) sua.du_an_id = moi;
  } else if (tuCot !== denCot) {
    const han = { 'hom-nay': hn, 'ngay-mai': congNgay(hn, 1), tuan: congNgay(hn, 3), sau: congNgay(hn, 14), khong: null }[denCot];
    if (han !== undefined && han !== (x.han_ngay || null)) sua.han_ngay = han;
  }
  try {
    if (Object.keys(sua).length) await api(`/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify(sua) });
    if (!cuaDuAn) await api('/api/viec/sap-xep', { method: 'POST', body: JSON.stringify({ ids }) });
    const ten = { 'hom-nay': 'Hôm nay', 'ngay-mai': 'Ngày mai', tuan: '7 ngày tới', sau: 'Sau đó', khong: 'Chưa có hạn' }[denCot] || duAnDs.find((d) => `da-${d.id}` === denCot)?.ten || 'Chưa xếp dự án';
    const cu = { han_ngay: x.han_ngay || null, du_an_id: x.du_an_id || null };
    if (Object.keys(sua).length) bao(`Đã chuyển sang ${ten}.`, { hanhDong: { nhan: 'Hoàn tác', lam: async () => { await api(`/api/viec/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(Object.keys(sua).map((k) => [k, cu[k]]))) }); napLai(); } } });
  } catch (err) {
    bao(err.message, { loi: true });
  }
  napLai();
}

function cotXong(ds) {
  return h('section', { class: 'cot-viec', 'aria-label': 'Đã xong', style: 'grid-column: 1 / -1' },
    h('header', {}, h('h2', { text: 'Đã xong gần đây' }), h('span', { text: String(ds.length) })),
    ds.length ? h('ul', {}, ...ds.map((x) => theViec(x))) : h('p', { class: 'cot-trong', text: 'Chưa xong việc nào.' }),
  );
}

function theViec(v, hn) {
  const o = h('input', { class: 'o-xong', type: 'checkbox', checked: v.trang_thai === 'xong', 'aria-label': `${v.trang_thai === 'xong' ? 'Mở lại' : 'Đánh dấu xong'}: ${v.tieu_de}` });
  const mau = mauViec(v);
  const baCham = h('button', { class: 'nut-ba-cham', type: 'button', 'aria-label': `Thao tác với việc: ${v.tieu_de}`, 'aria-haspopup': 'menu', title: 'Thao tác' }, icon('ba-cham'));
  baCham.addEventListener('click', (ev) => { ev.stopPropagation(); const r = baCham.getBoundingClientRect(); moTrinhDonViec(v, r.left, r.bottom + 4); });
  const the = h('li', { class: `the-viec${mau ? ' co-mau' : ''}`, dataset: { id: String(v.id) }, ...(mau ? { style: `--mau:${mau}` } : {}) },
    o,
    h('div', { style: 'min-width:0' },
      h('button', { class: 'ten-viec', type: 'button', text: v.tieu_de, onclick: () => moNganViec(v) }),
      v.ghi_chu ? h('p', { class: 'ghi', text: v.ghi_chu }) : null,
      h('div', { class: 'chan' },
        v.han_ngay ? h('span', { class: hn && v.han_ngay < hn ? 'tre' : '' }, icon('lich'), ngayHienThi(v.han_ngay)) : null,
        v.gio_hen ? h('span', {}, icon('dong-ho'), v.gio_hen) : null,
        h('span', { class: `nguon ${nhanNguon(v).ma}`, title: `Nguồn: ${v.tin_nhom || v.tin_nguoi_gui || nhanNguon(v).chu}` }, icon(nhanNguon(v).icon), nhanNguon(v).chu),
        v.du_an_ten ? h('a', { class: 'nhan-du-an', href: `#du-an/${v.du_an_id}`, title: 'Xem lịch sử dự án' }, icon('du-an'), v.du_an_ten) : h('span', { class: 'nhan-du-an chua', text: 'Chưa xếp dự án' }),
        v.xong_luc ? h('span', {}, `Xong ${luc(v.xong_luc)}`) : null,
        v.claude_trang_thai ? h('span', { class: `nhan-claude ${v.claude_trang_thai}`, text: CHU_TRANG_THAI[v.claude_trang_thai] }) : null,
      ),
    ),
  );
  the.append(baCham);
  the._viec = v;
  o.addEventListener('change', () => doiXong(v, o.checked, the));
  return the;
}

// Ngăn kéo thêm và sửa việc, dùng chung cho mọi trang.
const ngan = document.getElementById('ngan-viec');
const formViec = document.getElementById('form-viec');
let viecDangSua = null;
let mauDangChon = null;
function moNganViec(v, macDinh = {}) {
  viecDangSua = v;
  formViec.reset();
  formViec.querySelector('.loi-form').hidden = true;
  document.getElementById('ngan-viec-tieu-de').textContent = v ? 'Sửa việc' : 'Thêm việc';
  document.getElementById('nut-huy-viec').hidden = !v;
  const du = v || { han_ngay: homNay(), ...macDinh };
  for (const k of ['tieu_de', 'han_ngay', 'gio_hen', 'ghi_chu']) formViec.elements[k].value = du[k] || '';
  const chon = formViec.elements.du_an_id;
  thay(chon, h('option', { value: '', text: 'Chưa xếp dự án' }), ...duAnDs.map((d) => h('option', { value: String(d.id), text: d.ten })));
  chon.value = du.du_an_id ? String(du.du_an_id) : '';
  mauDangChon = du.mau || null;
  thay(document.getElementById('mau-viec-hang'), oChonMau(h, mauDangChon, (m) => { mauDangChon = m; }, { coKhong: true, nhan: 'Màu riêng của việc' }));
  if (!duAnDs.length) api('/api/du-an').then((r) => { duAnDs = r.du_an; thay(chon, h('option', { value: '', text: 'Chưa xếp dự án' }), ...duAnDs.map((d) => h('option', { value: String(d.id), text: d.ten }))); chon.value = du.du_an_id ? String(du.du_an_id) : ''; }).catch(() => {});
  veKhoiClaude(document.getElementById('khoi-claude'), v, { h, api, bao, luc, sauKhiDat: () => { ngan.close(); moMuc(); } });
  ngan.showModal();
  formViec.elements.tieu_de.focus();
}
ngan.addEventListener('close', dungKhoiClaude);
ngan.addEventListener('click', (e) => {
  if (e.target === ngan || e.target.closest('[data-dong]')) ngan.close();
});
formViec.querySelectorAll('[data-han]').forEach((b) => b.addEventListener('click', () => {
  formViec.elements.han_ngay.value = b.dataset.han === '' ? '' : congNgay(homNay(), Number(b.dataset.han));
}));
formViec.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loiEl = formViec.querySelector('.loi-form');
  const du = Object.fromEntries(['tieu_de', 'han_ngay', 'gio_hen', 'ghi_chu'].map((k) => [k, formViec.elements[k].value.trim() || null]));
  du.du_an_id = formViec.elements.du_an_id.value ? Number(formViec.elements.du_an_id.value) : null;
  du.mau = mauDangChon;
  if (!du.tieu_de) {
    loiEl.textContent = 'Nhập tên việc.';
    loiEl.hidden = false;
    formViec.elements.tieu_de.focus();
    return;
  }
  try {
    if (viecDangSua) await api(`/api/viec/${viecDangSua.id}`, { method: 'PATCH', body: JSON.stringify(du) });
    else await api('/api/viec', { method: 'POST', body: JSON.stringify(du) });
    ngan.close();
    bao(viecDangSua ? 'Đã lưu thay đổi.' : 'Đã thêm việc.');
    moMuc();
  } catch (err) {
    loiEl.textContent = err.message;
    loiEl.hidden = false;
  }
});
document.getElementById('nut-huy-viec').addEventListener('click', async () => {
  if (!viecDangSua) return;
  const v = viecDangSua;
  try {
    await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'huy' }) });
    ngan.close();
    bao(`Đã hủy: ${v.tieu_de}`, { hanhDong: { nhan: 'Hoàn tác', lam: async () => { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'mo' }) }); moMuc(); } } });
    moMuc();
  } catch (err) {
    bao(err.message, { loi: true });
  }
});
document.getElementById('nut-them-viec').addEventListener('click', () => moNganViec(null));

// =====================================================================
// Tệp
// =====================================================================
function loaiTep(ten, loai) {
  const duoi = (ten.split('.').pop() || '').toLowerCase();
  if (duoi === 'pdf') return ['pdf', 'PDF'];
  if (['doc', 'docx', 'odt', 'rtf'].includes(duoi)) return ['doc', duoi.toUpperCase()];
  if (['xls', 'xlsx', 'csv', 'ods'].includes(duoi)) return ['xls', duoi.toUpperCase()];
  if (['ppt', 'pptx', 'odp'].includes(duoi)) return ['ppt', duoi.toUpperCase()];
  if (/^image\//.test(loai || '') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(duoi)) return ['anh', duoi.toUpperCase() || 'ẢNH'];
  if (['zip', 'rar', '7z'].includes(duoi)) return ['nen', duoi.toUpperCase()];
  return ['khac', (duoi || 'TỆP').toUpperCase().slice(0, 4)];
}

// Xem trước ngay trong trang: ảnh và PDF hiện thẳng, Word hiện phần chữ. Loại khác thì tải về.
function kieuXemTep(ten) {
  const duoi = (String(ten).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1]?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(duoi)) return 'anh';
  return duoi === 'pdf' ? 'pdf' : duoi === 'docx' ? 'docx' : null;
}

// Tệp đã nằm trên Drive thì mở thẳng bằng trình xem của Drive (Word, Excel, PowerPoint, PDF); ảnh vẫn xem bản lưu.
const DUOI_DRIVE = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf', 'odt', 'rtf', 'csv'];
function kieuMo(f) {
  const duoi = (String(f.ten).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1]?.toLowerCase();
  return f.drive_id && DUOI_DRIVE.includes(duoi) ? 'drive' : kieuXemTep(f.ten);
}

function moXemDrive(f) {
  const xem = `https://drive.google.com/file/d/${encodeURIComponent(f.drive_id)}`;
  const hop = h('dialog', { class: 'xem-tep rong', 'aria-label': `Xem ${f.ten} trên Drive` },
    h('header', {},
      h('div', {}, h('strong', { text: f.ten }), h('small', { text: 'Đang xem từ Google Drive' })),
      h('a', { class: 'nut nut-phu nut-nho', href: `${xem}/view`, target: '_blank', rel: 'noopener noreferrer' }, 'Mở trong Drive'),
      h('a', { class: 'nut nut-phu nut-nho', href: `/api/tep/${f.id}/tai` }, icon('tai'), 'Tải về'),
      h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Đóng', onclick: () => hop.close() })),
    h('div', { class: 'khung-xem pdf' }, h('iframe', { src: `${xem}/preview`, title: f.ten, allow: 'fullscreen' })),
    h('p', { class: 'ghi-chu-trang', style: 'margin:8px 16px', text: 'Không thấy nội dung? Đăng nhập Google bằng tài khoản có quyền xem kho, hoặc bấm Mở trong Drive.' }));
  hop.addEventListener('close', () => hop.remove());
  hop.addEventListener('click', (ev) => { if (ev.target === hop) hop.close(); });
  document.body.append(hop);
  hop.showModal();
}

function moXemTep(f, kieu) {
  if (kieu === 'drive') return moXemDrive(f);
  const nguon = `/api/tep/${f.id}/xem`;
  const oChu = kieu === 'docx' ? h('pre', { class: 'xem-chu', text: 'Đang đọc nội dung…' }) : null;
  const than = kieu === 'anh' ? h('img', { src: nguon, alt: f.ten }) : kieu === 'pdf' ? h('iframe', { src: nguon, title: f.ten }) : oChu;
  const hop = h('dialog', { class: 'xem-tep', 'aria-label': `Xem trước ${f.ten}` },
    h('header', {},
      h('div', {}, h('strong', { text: f.ten }), h('small', { text: kichThuoc(f.kich_thuoc) })),
      h('a', { class: 'nut nut-phu nut-nho', href: `/api/tep/${f.id}/tai` }, icon('tai'), 'Tải về'),
      h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Đóng', onclick: () => hop.close() })),
    h('div', { class: `khung-xem ${kieu}` }, than));
  hop.addEventListener('close', () => hop.remove());
  hop.addEventListener('click', (ev) => { if (ev.target === hop) hop.close(); });
  document.body.append(hop);
  hop.showModal();
  if (oChu) api(`/api/tep/${f.id}/chu`).then((r) => { oChu.textContent = r.chu; }).catch((e) => { oChu.textContent = e.message; });
}

// Phân loại tệp để lọc và nhóm: loại (ảnh, ảnh chụp màn hình, tài liệu...), nguồn, thời gian.
const LOAI_TEP = [['tat-ca', 'Tất cả loại'], ['anh', 'Ảnh'], ['man-hinh', 'Ảnh chụp màn hình'], ['tai-lieu', 'Tài liệu'], ['pdf', 'PDF'], ['bang', 'Bảng tính'], ['trinh-chieu', 'Trình chiếu'], ['khac', 'Khác']];
const NHOM_TEP = [['du-an', 'Dự án'], ['loai', 'Loại'], ['nguon', 'Nguồn'], ['thoi-gian', 'Thời gian'], ['khong', 'Không nhóm']];
const THOI_GIAN_TEP = ['Hôm nay', 'Tuần này', 'Cũ hơn'];

function loaiLocTep(f) {
  const [lop] = loaiTep(f.ten, f.loai);
  if (lop === 'anh') return /^(ảnh màn hình|screenshot|screen shot|ảnh chụp màn hình)/i.test(String(f.ten).replace(/^\d{6}_(Zalo|Gmail)_/, '').trim()) ? 'man-hinh' : 'anh';
  return { doc: 'tai-lieu', pdf: 'pdf', xls: 'bang', ppt: 'trinh-chieu' }[lop] || 'khac';
}
function nguonTep(f) {
  if (f.nguon === 'zalo') return `Zalo: ${f.tin_nhom || (f.nguoi_gui || '').split('<')[0].trim() || 'không rõ'}`;
  return f.nguon === 'gmail' ? 'Gmail' : 'Tải lên';
}
function thoiGianTep(f) {
  const t = Date.parse(f.tao_luc);
  if (Number.isNaN(t)) return THOI_GIAN_TEP[2];
  if (fmt.ngayISO.format(new Date(t)) === homNay()) return THOI_GIAN_TEP[0];
  return Date.now() - t <= 7 * 86400000 ? THOI_GIAN_TEP[1] : THOI_GIAN_TEP[2];
}

// Cách đồng bộ Google và nhãn gắn vào tiêu đề hoặc ghi chú: [Xong], [Hôm nay], [Zalo]...
const CHE_DO_GG = [
  ['ca-hai', 'Cả Tasks và Lịch', 'Việc sang Tasks, việc có ngày thêm sự kiện Lịch (có giờ, có màu). Nếu bật lớp Tasks trong Lịch, một việc có thể hiện hai mục.'],
  ['tasks', 'Chỉ Tasks', 'Không tạo sự kiện Lịch, và gỡ các sự kiện Sonicplan đã tạo. Việc có hạn tự hiện trong Lịch qua lớp Tasks của Google, không bị trùng.'],
  ['lich', 'Chỉ sự kiện Lịch', 'Không tạo việc mới trên Tasks. Bấm xong bên Tasks sẽ không còn tác dụng với việc mới.'],
];
function khoiNhanGoogle() {
  let ch = { che_do: 'ca-hai', cho: 'tieu_de', bat: [] };
  let loai = [];
  let thuTu = [];
  const goc = h('details', { class: 'nhan-gg' }, h('summary', { text: 'Cách đồng bộ và nhãn trên Google' }));
  const thanDoi = h('div', { class: 'than-nhan-gg' }, h('p', { class: 'mo-ta', text: 'Đang tải…' }));
  goc.append(thanDoi);
  let hen;
  const xemTruoc = h('ul', { class: 'xem-truoc-nhan' });
  async function capNhatXem() {
    try {
      const r = await api('/api/google-nhan/xem-truoc', { method: 'POST', body: JSON.stringify({ cau_hinh: ch }) });
      thay(xemTruoc, ...(r.mau.length ? r.mau.map((m) => h('li', {}, h('b', { text: m.tieu_de }), m.ghi_chu ? h('small', { text: m.ghi_chu.split('\n').slice(0, 2).join(' | ') }) : null, m.trang_thai === 'xong' && m.mau === '8' ? h('small', { text: 'Lịch: màu xám' }) : null)) : [h('li', { text: 'Chưa có việc nào để xem trước.' })]));
    } catch (e) { thay(xemTruoc, h('li', { text: e.message })); }
  }
  const sau = () => { clearTimeout(hen); hen = setTimeout(capNhatXem, 250); };
  function ve() {
    ch.bat = thuTu.filter((m) => ch.bat.includes(m));
    const hangLoai = thuTu.map((ma, i) => {
      const l = loai.find((x) => x.ma === ma);
      const o = h('input', { type: 'checkbox', checked: ch.bat.includes(ma), 'aria-label': l.ten });
      o.addEventListener('change', () => { ch.bat = thuTu.filter((m) => (m === ma ? o.checked : ch.bat.includes(m))); sau(); });
      const doi = (d) => () => { const j = i + d; if (j < 0 || j >= thuTu.length) return; [thuTu[i], thuTu[j]] = [thuTu[j], thuTu[i]]; ch.bat = thuTu.filter((m) => ch.bat.includes(m)); ve(); sau(); };
      return h('li', {}, h('label', {}, o, h('span', { text: l.ten })), h('button', { type: 'button', class: 'nut-nho-xep', 'aria-label': 'Đưa lên', text: '↑', onclick: doi(-1) }), h('button', { type: 'button', class: 'nut-nho-xep', 'aria-label': 'Đưa xuống', text: '↓', onclick: doi(1) }));
    });
    const radio = (ten, gt, nhan, mo, chon) => h('label', { class: 'chon-radio' }, h('input', { type: 'radio', name: ten, checked: gt, onchange: chon }), h('span', {}, h('b', { text: nhan }), mo ? h('small', { text: mo }) : null));
    thay(thanDoi,
      h('p', { class: 'mo-ta', text: 'Chọn việc sang Google theo cách nào, và nhãn lấy từ dữ liệu Sonicplan gắn vào tên hoặc ghi chú. Nhãn tự đổi theo ngày và trạng thái (Hôm nay, Quá hạn, Xong).' }),
      h('h3', { text: 'Sang Google ở đâu' }),
      ...CHE_DO_GG.map(([ma, nhan, mo]) => radio('che-do-gg', ch.che_do === ma, nhan, mo, () => { ch.che_do = ma; })),
      h('h3', { text: 'Nhãn nào được gắn, theo thứ tự' }),
      h('ul', { class: 'ds-loai-nhan' }, ...hangLoai),
      h('h3', { text: 'Đặt nhãn ở đâu' }),
      radio('cho-gg', ch.cho === 'tieu_de', 'Đầu tiêu đề', 'Ví dụ: [Hôm nay] [Zalo] Gửi báo cáo', () => { ch.cho = 'tieu_de'; sau(); }),
      radio('cho-gg', ch.cho === 'ghi_chu', 'Dòng đầu ghi chú', 'Tiêu đề giữ nguyên, nhãn nằm trong ghi chú.', () => { ch.cho = 'ghi_chu'; sau(); }),
      h('h3', { text: 'Xem trước với việc của anh' }),
      xemTruoc,
      h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
        try { await api('/api/google-nhan', { method: 'PUT', body: JSON.stringify({ cau_hinh: ch }) }); bao('Đã lưu. Các việc đã có sẽ cập nhật dần trong vài lượt đồng bộ (mỗi 5 phút).'); } catch (err) { bao(err.message, { loi: true }); }
      } }, 'Lưu')));
  }
  goc.addEventListener('toggle', async () => {
    if (!goc.open || loai.length) return;
    try {
      const r = await api('/api/google-nhan');
      ch = r.cau_hinh; loai = r.loai;
      thuTu = [...ch.bat, ...loai.map((l) => l.ma).filter((m) => !ch.bat.includes(m))];
      ve(); capNhatXem();
    } catch (e) { thay(thanDoi, khungLoi(e, () => { goc.open = false; goc.open = true; })); }
  });
  return goc;
}

// Mở thư mục kho trên Drive bằng đúng tài khoản đã nối (authuser theo email, tránh mở nhầm tài khoản đang đăng nhập trình duyệt).
function linkKhoDrive(kho) {
  const m = kho.thu_muc || {};
  const cuaTk = kho.da_noi?.email ? `authuser=${encodeURIComponent(kho.da_noi.email)}` : '';
  const dia = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}${cuaTk ? `?${cuaTk}` : ''}`;
  if (!m.goc) return h('p', { class: 'mo-ta', text: 'Thư mục trên Drive sẽ có sau lượt lưu đầu tiên. Bấm "Lưu ngay" để tạo.' });
  const muc = [['tin', 'Tin nhắn'], ['thu', 'Thư'], ['tep', 'Tệp'], ['phan_loai', 'Phân loại'], ['bo_nho', 'Bộ nhớ AI'], ['viec', 'Việc']].filter(([k]) => m[k]);
  return h('div', { class: 'truy-cap-kho' },
    h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-phu', href: dia(m.goc), target: '_blank', rel: 'noopener noreferrer' }, icon('kho'), `Mở Sonicplan kho trên Drive${kho.da_noi?.email ? ` (${kho.da_noi.email})` : ''}`)),
    muc.length ? h('div', { class: 'hang-nut' }, ...muc.map(([k, ten]) => h('a', { class: 'chip', href: dia(m[k]), target: '_blank', rel: 'noopener noreferrer' }, ten))) : null);
}

async function veTep(goc) {
  const t = trang.tep;
  t.nhom ||= 'du-an'; t.loai ||= 'tat-ca'; t.xem ||= 'luoi';
  const oTim = h('input', { type: 'search', placeholder: 'Tìm tên tệp, người gửi, nhóm…', value: t.q, 'aria-label': 'Tìm tệp' });
  const chonLoai = h('select', { 'aria-label': 'Lọc theo loại', class: 'chon-loc' }, ...LOAI_TEP.map(([ma, nhan]) => h('option', { value: ma, text: nhan })));
  chonLoai.value = t.loai;
  chonLoai.addEventListener('change', () => { t.loai = chonLoai.value; ve(); });
  const nutNhom = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(t.nhom === ma), onclick: () => { t.nhom = ma; capNhatNut(); ve(); } }, nhan);
  const nutXem = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(t.xem === ma), onclick: () => { t.xem = ma; capNhatNut(); ve(); } }, nhan);
  const hangNhom = h('div', { class: 'nhom-nut', role: 'group', 'aria-label': 'Nhóm theo' }, ...NHOM_TEP.map(([ma, nhan]) => nutNhom(ma, nhan)));
  const hangXem = h('div', { class: 'nhom-nut', role: 'group', 'aria-label': 'Kiểu xem' }, nutXem('luoi', 'Lưới'), nutXem('ds', 'Danh sách'));
  const demEl = h('span', { class: 'dem-tep' });
  const vung = h('div', {}, ...[1, 2, 3].map(() => h('div', { class: 'bang the-tep', style: 'margin-bottom:12px' }, xuong(54, '46px'), xuong(16, '80%'), xuong(12, '50%'))));
  function capNhatNut() {
    hangNhom.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(NHOM_TEP[i][0] === t.nhom)));
    hangXem.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(['luoi', 'ds'][i] === t.xem)));
  }
  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { t.q = oTim.value.trim(); ve(); }, 200); });
  thay(goc,
    h('div', { class: 'thanh-loc' }, h('label', { class: 'o-tim', style: 'margin-left:0' }, icon('tim'), oTim), chonLoai, hangXem),
    h('div', { class: 'thanh-loc' }, h('span', { class: 'nhan-nho', text: 'Nhóm theo' }), hangNhom, h('span', { class: 'gian' }), demEl),
    vung);

  let ds = [];
  let duAn = [];
  function nhomHoa(tep) {
    if (t.nhom === 'khong') return [{ ten: null, ds: tep }];
    const m = new Map();
    const them = (khoa, ten, mau, f) => { if (!m.has(khoa)) m.set(khoa, { khoa, ten, mau, ds: [] }); m.get(khoa).ds.push(f); };
    for (const f of tep) {
      if (t.nhom === 'du-an') { const d = duAn.find((x) => x.id === f.du_an_id); them(d ? `d${d.id}` : 'z', d ? d.ten : 'Chưa xếp dự án', d?.mau, f); }
      else if (t.nhom === 'loai') { const l = LOAI_TEP.find(([ma]) => ma === loaiLocTep(f)); them(l[0], l[1], null, f); }
      else if (t.nhom === 'nguon') { const n = nguonTep(f); them(n, n, null, f); }
      else { const g = thoiGianTep(f); them(g, g, null, f); }
    }
    const ra = [...m.values()];
    if (t.nhom === 'du-an') ra.sort((x, y) => (x.khoa === 'z') - (y.khoa === 'z') || duAn.findIndex((d) => `d${d.id}` === x.khoa) - duAn.findIndex((d) => `d${d.id}` === y.khoa));
    else if (t.nhom === 'loai') ra.sort((x, y) => LOAI_TEP.findIndex(([k]) => k === x.khoa) - LOAI_TEP.findIndex(([k]) => k === y.khoa));
    else if (t.nhom === 'thoi-gian') ra.sort((x, y) => THOI_GIAN_TEP.indexOf(x.khoa) - THOI_GIAN_TEP.indexOf(y.khoa));
    return ra;
  }

  function theTep(f) {
    const [lop, nhan] = loaiTep(f.ten, f.loai);
    const kieu = kieuMo(f);
    const mo = () => (kieu ? moXemTep(f, kieu) : location.assign(`/api/tep/${f.id}/tai`));
    const coAnh = ['anh', 'doc', 'pdf', 'xls', 'ppt'].includes(lop);
    const bieuTuong = () => h('span', { class: 'loai-tep lon', dataset: { loai: lop }, text: nhan });
    const khung = h('button', { class: 'anh-tep', type: 'button', 'aria-label': `${kieu ? 'Xem trước' : 'Tải'} ${f.ten}`, onclick: mo });
    if (coAnh) {
      const img = h('img', { src: `/api/tep/${f.id}/anh-nho`, alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('error', () => khung.replaceChildren(bieuTuong()));
      khung.append(img);
    } else khung.append(bieuTuong());
    const chon = h('select', { class: 'chon-du-an-tep', 'aria-label': `Dự án của ${f.ten}` }, h('option', { value: '', text: 'Chưa xếp dự án' }), ...duAn.map((d) => h('option', { value: String(d.id), text: d.ten })));
    chon.value = f.du_an_id ? String(f.du_an_id) : '';
    chon.addEventListener('change', async () => {
      const cu = f.du_an_id;
      try {
        await api(`/api/tep/${f.id}`, { method: 'PATCH', body: JSON.stringify({ du_an_id: chon.value ? Number(chon.value) : null }) });
        f.du_an_id = chon.value ? Number(chon.value) : null;
        bao('Đã đổi dự án của tệp.');
        if (t.nhom === 'du-an') ve();
      } catch (err) { chon.value = cu ? String(cu) : ''; bao(err.message, { loi: true }); }
    });
    const d = duAn.find((x) => x.id === f.du_an_id);
    if (hexMau(d?.mau)) chon.style.setProperty('--mau', hexMau(d.mau));
    return h('div', { class: 'bang the-tep' },
      khung,
      h('div', { class: 'than-tep' },
        h('button', { class: 'ten-tep', type: 'button', text: f.ten, title: f.ten, onclick: mo }),
        h('div', { class: 'meta' }, h('span', { text: kichThuoc(f.kich_thuoc) }), h('span', { text: nguonTep(f) }), f.nguoi_gui && f.nguon !== 'zalo' ? h('span', { text: f.nguoi_gui.split('<')[0].trim() }) : null, h('span', { text: luc(f.tao_luc) })),
        chon));
  }

  function ve() {
    const q = t.q.toLowerCase();
    const tep = ds.filter((f) => (t.loai === 'tat-ca' || loaiLocTep(f) === t.loai) && (!q || `${f.ten} ${f.nguoi_gui || ''} ${f.tin_nhom || ''}`.toLowerCase().includes(q)));
    demEl.textContent = `${tep.length} tệp`;
    if (!tep.length) {
      thay(vung, h('div', { class: 'bang trong-trai', style: 'min-height:280px' }, icon('tep'), h('h3', { text: ds.length ? 'Không có tệp khớp bộ lọc' : 'Chưa có tệp nào' }), h('p', { text: ds.length ? 'Thử bỏ bộ lọc hoặc đổi từ khóa.' : 'Tệp đính kèm trong thư và tệp gửi qua Zalo sẽ tự lưu vào đây.' })));
      return;
    }
    thay(vung, ...nhomHoa(tep).map((g) => h('section', { class: 'nhom-tep' },
      g.ten ? h('h2', { class: 'tieu-nhom-tep', ...(hexMau(g.mau) ? { style: `--mau:${hexMau(g.mau)}` } : {}) }, hexMau(g.mau) ? h('i', { class: 'cham-mau' }) : null, g.ten, h('span', { text: String(g.ds.length) })) : null,
      h('div', { class: t.xem === 'ds' ? 'luoi-tep ds' : 'luoi-tep' }, ...g.ds.map(theTep)))));
  }

  async function nap() {
    try {
      const [{ tep }, da] = await Promise.all([api('/api/tep'), api('/api/du-an').catch(() => ({ du_an: [] }))]);
      ds = tep;
      duAn = da.du_an;
      duAnDs = da.du_an;
      ve();
    } catch (e) {
      thay(vung, khungLoi(e, nap));
    }
  }
  nap();
}

// =====================================================================
// Ghi nhớ: điều hệ thống nhớ về người, dự án, quyết định; người dùng duyệt, sửa, ghim, xóa
// =====================================================================
const LOAI_NHO = { nguoi: 'Người', du_an: 'Dự án', quyet_dinh: 'Quyết định', su_that: 'Thông tin' };

async function veGhiNho(goc) {
  const n = trang.nho;
  const oTim = h('input', { type: 'search', placeholder: 'Tìm trong ghi nhớ…', value: n.q, 'aria-label': 'Tìm ghi nhớ' });
  const chip = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(n.loai === ma), onclick: () => { n.loai = ma; veGhiNho(goc); } }, nhan);
  const ds = h('div', { class: 'ds-nho' }, ...[1, 2, 3].map(() => h('div', { class: 'bang the-nho' }, xuong(16, '40%'), xuong(14, '90%'))));
  const dauMuc = h('div', { class: 'thanh-loc' }, chip('tat-ca', 'Tất cả'), chip('moi', 'Mới, chờ duyệt'), ...Object.entries(LOAI_NHO).map(([ma, nhan]) => chip(ma, nhan)), h('label', { class: 'o-tim' }, icon('tim'), oTim));
  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { n.q = oTim.value.trim(); nap(); }, 300); });

  const oLoai = h('select', { 'aria-label': 'Loại' }, ...Object.entries(LOAI_NHO).map(([ma, nhan]) => h('option', { value: ma, text: nhan })));
  const oTieu = h('input', { type: 'text', placeholder: 'Tiêu đề, ví dụ: Chị Lan', maxlength: '120', required: true, 'aria-label': 'Tiêu đề' });
  const oNoi = h('input', { type: 'text', placeholder: 'Điều cần nhớ, ví dụ: Trưởng phòng đào tạo', maxlength: '600', required: true, 'aria-label': 'Nội dung' });
  const form = h('form', { class: 'bang them-nho' }, oLoai, oTieu, oNoi, h('button', { class: 'nut nut-chinh', type: 'submit' }, icon('cong'), 'Thêm'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/ghi-nho', { method: 'POST', body: JSON.stringify({ loai: oLoai.value, tieu_de: oTieu.value, noi_dung: oNoi.value }) });
      oTieu.value = ''; oNoi.value = '';
      bao('Đã ghi nhớ.');
      nap();
    } catch (err) {
      bao(err.message, { loi: true });
    }
  });
  // Hồ sơ: vài dòng tự khai, đưa vào mọi lần AI chạy
  const oHoSo = h('textarea', { rows: '6', maxlength: '2000', placeholder: 'Ví dụ:\nTôi là quản lý dự án, phụ trách mảng đào tạo ngắn hạn.\nChị Lan là trưởng phòng, việc chị giao luôn ưu tiên cao.\nNhóm "Dự án A" trên Zalo là việc khách hàng.\nTôi hay làm việc buổi sáng, họp chiều. Xưng "em" với cấp trên.', 'aria-label': 'Hồ sơ của bạn' });
  const demHoSo = h('span', { class: 'mo-ta', text: '' });
  const capNhatDem = () => { demHoSo.textContent = `${oHoSo.value.length}/2000 ký tự`; };
  oHoSo.addEventListener('input', capNhatDem);
  const nutHoSo = h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
    nutHoSo.disabled = true;
    try { await api('/api/ho-so', { method: 'PUT', body: JSON.stringify({ noi_dung: oHoSo.value }) }); bao('Đã lưu hồ sơ. Lần sau AI đọc tin sẽ dùng nó.'); } catch (err) { bao(err.message, { loi: true }); }
    nutHoSo.disabled = false;
  } }, 'Lưu hồ sơ');
  api('/api/ho-so').then((r) => { oHoSo.value = r.noi_dung || ''; capNhatDem(); }).catch(() => {});
  const theHoSo = h('section', { class: 'bang ho-so' },
    h('h3', { text: 'Hồ sơ của bạn' }),
    h('p', { class: 'mo-ta', text: 'Vài dòng giúp AI hiểu bạn là ai và ai là ai trong công việc. AI đọc hồ sơ này mỗi lần tách việc, gợi ý, lập kế hoạch ngày và trả lời trên Telegram. Không ghi mật khẩu hay số thẻ.' }),
    oHoSo,
    h('div', { class: 'hang-nut' }, nutHoSo, demHoSo),
  );
  thay(goc, theHoSo, h('p', { class: 'tom-tat-phu', style: 'margin-bottom:14px', text: 'Hệ thống tự nhớ người, dự án và quyết định từ tin đến, rồi dùng lại khi đọc tin sau. Mục mới do AI thêm có nhãn chờ duyệt: bấm dấu tích nếu đúng, sửa hoặc xóa nếu sai.' }), form, dauMuc, ds);

  async function hanhDong(id, thanDu, thongBao) {
    try {
      await api(`/api/ghi-nho/${id}`, { method: 'PATCH', body: JSON.stringify(thanDu) });
      if (thongBao) bao(thongBao);
      nap();
    } catch (err) {
      bao(err.message, { loi: true });
    }
  }
  function the(g) {
    const tren = h('div', { class: 'dau-nho' },
      h('span', { class: 'nhan-nho', text: LOAI_NHO[g.loai] }),
      g.nguon === 'ai' && !g.da_duyet ? h('span', { class: 'nhan-nho moi', text: 'Mới, chờ duyệt' }) : null,
      g.do_tin_cay === 'thap' && !g.da_duyet ? h('span', { class: 'nhan-nho thap', text: 'AI dự phòng, cần kiểm' }) : null,
    );
    const noi = h('p', { class: 'noi-nho', text: g.noi_dung });
    const nut = (nhan, ten, lam, loiNut = false) => h('button', { class: `nut-icon${loiNut ? ' nguy' : ''}`, type: 'button', title: nhan, 'aria-label': nhan, onclick: lam }, icon(ten));
    const hang = h('div', { class: 'tac-nho' },
      g.nguon === 'ai' && !g.da_duyet ? nut('Đúng, giữ lại', 'xong', () => hanhDong(g.id, { da_duyet: true })) : null,
      nut(g.ghim ? 'Bỏ ghim' : 'Ghim', 'ghim', () => hanhDong(g.id, { ghim: !g.ghim })),
      nut('Sửa', 'sua', () => sua()),
      nut('Xóa', 'xoa', async () => {
        try {
          await api(`/api/ghi-nho/${g.id}`, { method: 'DELETE' });
          bao('Đã xóa.');
          nap();
        } catch (err) {
          bao(err.message, { loi: true });
        }
      }, true),
    );
    const el = h('article', { class: `bang the-nho${g.ghim ? ' ghim' : ''}` }, h('div', { class: 'hang-nho' }, tren, hang), h('h3', { text: g.tieu_de }), noi);
    function sua() {
      const o = h('textarea', { rows: '3', maxlength: '600', 'aria-label': 'Sửa nội dung' });
      o.value = g.noi_dung;
      const luu = h('button', { class: 'nut nut-chinh nut-nho', type: 'button', text: 'Lưu', onclick: () => hanhDong(g.id, { noi_dung: o.value }, 'Đã lưu.') });
      const huy = h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Hủy', onclick: () => noi.replaceWith(noi) });
      huy.onclick = () => { khung.replaceWith(noi); };
      const khung = h('div', { class: 'sua-nho' }, o, h('div', { class: 'tac-nho' }, luu, huy));
      noi.replaceWith(khung);
      o.focus();
    }
    return el;
  }
  async function nap() {
    try {
      const tham = new URLSearchParams();
      if (n.loai === 'moi') tham.set('moi', '1');
      else if (n.loai !== 'tat-ca') tham.set('loai', n.loai);
      if (n.q) tham.set('q', n.q);
      const kq = await api(`/api/ghi-nho${tham.size ? `?${tham}` : ''}`);
      if (!kq.ghi_nho.length) {
        thay(ds, h('div', { class: 'bang trong-trai', style: 'min-height:260px' }, icon('ghi-nho'), h('h3', { text: kq.tong ? 'Không có mục nào khớp' : 'Chưa nhớ gì' }), h('p', { text: kq.tong ? 'Thử bỏ bộ lọc hoặc đổi từ khóa.' : 'Khi có tin mới, hệ thống tự ghi lại người, dự án và quyết định ở đây. Anh cũng thêm tay được ở ô phía trên.' })));
        return;
      }
      thay(ds, ...kq.ghi_nho.map(the));
    } catch (e) {
      thay(ds, khungLoi(e, nap));
    }
  }
  nap();
}

// =====================================================================
// Zalo: danh sách nhóm và cá nhân, bấm vào đọc theo dòng thời gian như ứng dụng Zalo
// =====================================================================
function mauAnh(ten) {
  let b = 7;
  for (const c of ten) b = (b * 31 + c.codePointAt(0)) >>> 0;
  return b % 360;
}
function chuDau(ten) {
  const tu = ten.replace(/^Nhóm\s+/i, '').trim().split(/\s+/).filter(Boolean);
  const chu = tu.length > 1 ? Array.from(tu[0])[0] + Array.from(tu[tu.length - 1])[0] : Array.from(tu[0] || '?').slice(0, 2).join('');
  return chu.toUpperCase();
}
function anhZalo(ten, loai) {
  return h('span', { class: `anh-zalo${loai === 'nhom' ? ' nhom' : ''}`, style: `--h:${mauAnh(ten)}`, 'aria-hidden': 'true', text: chuDau(ten) });
}
function nhanNgayTin(iso) {
  const d = new Date(iso);
  const ngay = fmt.ngayISO.format(d);
  if (ngay === homNay()) return 'Hôm nay';
  if (ngay === congNgay(homNay(), -1)) return 'Hôm qua';
  return fmt.ngayDai.format(d);
}

// ---- Nội dung một bong bóng Zalo: ảnh, tệp, thẻ liên kết... ----
const daNapTin = new Set();

function moAnhNgoai(url) {
  const hop = h('dialog', { class: 'xem-tep', 'aria-label': 'Xem ảnh' },
    h('header', {}, h('div', {}, h('strong', { text: 'Ảnh trong tin nhắn' })), h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Đóng', onclick: () => hop.close() })),
    h('div', { class: 'khung-xem anh' }, h('img', { src: url, alt: 'Ảnh trong tin nhắn', referrerpolicy: 'no-referrer' })));
  hop.addEventListener('close', () => hop.remove());
  hop.addEventListener('click', (ev) => { if (ev.target === hop) hop.close(); });
  document.body.append(hop);
  hop.showModal();
}

// Ảnh hiện thu nhỏ trong bong bóng, bấm thì phóng to. tep có sẵn thì dùng bản lưu, chưa có thì hiện từ Zalo rồi tải về kho.
function anhTrongTin(m, tep, urlNgoai) {
  const nut = h('button', { class: 'anh-tin', type: 'button', 'aria-label': 'Phóng to ảnh' });
  const hong = () => nut.replaceChildren(h('span', { class: 'anh-hong' }, icon('tep'), h('small', { text: 'Ảnh không còn tải được' }), urlNgoai ? h('a', { href: urlNgoai, target: '_blank', rel: 'noopener noreferrer', text: 'Mở ảnh gốc' }) : null));
  const img = h('img', { loading: 'lazy', alt: 'Ảnh trong tin nhắn', referrerpolicy: 'no-referrer', src: tep ? `/api/tep/${tep.id}/xem` : urlNgoai });
  const napVe = () => api(`/api/tin/${m.id}/nap`, { method: 'POST' }).then((r) => { tep = r.tep; return r.tep; });
  img.addEventListener('load', () => {
    if (!tep && !daNapTin.has(m.id)) { daNapTin.add(m.id); napVe().catch(() => {}); }
  });
  img.addEventListener('error', async () => {
    if (!img.dataset.thu && urlNgoai) {
      img.dataset.thu = '1';
      try { await napVe(); img.src = `/api/tep/${tep.id}/xem`; return; } catch { /* hiện ảnh hỏng */ }
    }
    hong();
  });
  nut.addEventListener('click', () => { if (tep) moXemTep(tep, 'anh'); else moAnhNgoai(urlNgoai); });
  nut.append(img);
  return nut;
}

function theTep(ten, kichCo, bam, trangThai) {
  const { nhan, nhom } = nhanTep(ten);
  const noi = [h('span', { class: `ic-tep ${nhom}`, text: nhan }), h('span', { class: 'tt-tep' }, h('strong', { text: ten }), h('small', { text: trangThai || (kichCo ? kichThuoc(kichCo) : 'Tệp đính kèm') }))];
  return typeof bam === 'string' ? h('a', { class: 'the-tep-zalo', href: bam }, ...noi) : h('button', { class: 'the-tep-zalo', type: 'button', onclick: bam }, ...noi);
}

function tepTrongTin(f) {
  const kieu = kieuMo(f);
  if (kieu === 'anh') return anhTrongTin({ id: f.tin_nhan_id }, f, null);
  return kieu ? theTep(f.ten, f.kich_thuoc, () => moXemTep(f, kieu)) : theTep(f.ten, f.kich_thuoc, `/api/tep/${f.id}/tai`);
}

// Tệp chia sẻ chỉ có đường dẫn Zalo: bấm thì tải về kho rồi mở xem trước.
function tepNgoaiTrongTin(m, ten) {
  const nut = theTep(ten, 0, async () => {
    const nho = nut.querySelector('small');
    nho.textContent = 'Đang tải về…';
    try {
      const { tep } = await api(`/api/tin/${m.id}/nap`, { method: 'POST' });
      nho.textContent = kichThuoc(tep.kich_thuoc);
      const kieu = kieuXemTep(tep.ten);
      if (kieu) moXemTep(tep, kieu); else location.assign(`/api/tep/${tep.id}/tai`);
    } catch (e) { nho.textContent = e.message; }
  }, 'Bấm để tải về và xem');
  return nut;
}

function chuCoLienKet(chu) {
  return h('span', { class: 'chu-tin' }, ...tachLienKet(chu).map((p) => (p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', text: p.url }) : p.chu)));
}

function noiDungBong(m, files, tepTheoTin) {
  const k = phanTichTin(m.noi_dung);
  const ra = [];
  if (k.kieu === 'anh') ra.push(anhTrongTin(m, files[0] || null, k.url));
  else if (k.kieu === 'tep-ngoai') ra.push(files[0] ? tepTrongTin(files[0]) : tepNgoaiTrongTin(m, k.ten));
  else if (k.kieu === 'tep-gui') { ra.push(...files.map(tepTrongTin)); if (k.chu) ra.push(chuCoLienKet(k.chu)); }
  else if (k.kieu === 'the-lien-ket') ra.push(h('a', { class: 'the-lien-ket', href: k.url, target: '_blank', rel: 'noopener noreferrer' }, h('strong', { text: k.tieu_de }), k.mo_ta ? h('span', { text: k.mo_ta }) : null, h('small', { text: k.mien })));
  else if (k.kieu === 'danh-thiep') ra.push(h('div', { class: 'the-lien-ket' }, h('strong', { text: k.ten || 'Danh thiếp' }), h('span', { text: k.dien_thoai }), h('small', { text: 'Danh thiếp Zalo' })));
  else if (k.kieu === 'thu-hoi') ra.push(h('span', { class: 'chu-tin nhat', text: 'Tin nhắn đã thu hồi' }));
  else if (k.kieu === 'nhan-dan') ra.push(h('span', { class: 'chu-tin nhat', text: 'Đã gửi một nhãn dán' }));
  else if (k.kieu === 'binh-chon') ra.push(h('span', { class: 'chu-tin nhat', text: 'Bình chọn trong nhóm' }));
  else if (k.kieu === 'video') ra.push(h('span', { class: 'chu-tin nhat', text: 'Đã gửi một video (xem trong Zalo)' }));
  else ra.push(chuCoLienKet(k.chu));
  if (files.length && !['tep-gui', 'anh', 'tep-ngoai'].includes(k.kieu)) ra.push(...files.map(tepTrongTin));
  return { nut: ra, coAnh: k.kieu === 'anh' || (k.kieu === 'tep-gui' && files.some((f) => kieuXemTep(f.ten) === 'anh')) };
}

const khoaHoiThoai = (loai, ten) => `${loai}~${encodeURIComponent(ten)}`;

async function veZalo(goc, thamSo) {
  const z = trang.zalo;
  let chon = null;
  if (thamSo) {
    const [loai, ten] = thamSo.split('~');
    if ((loai === 'nhom' || loai === 'ca-nhan') && ten) chon = { loai, ten: decodeURIComponent(ten) };
  }
  const khungDs = h('div', { class: 'bang ds-tin ds-zalo', 'aria-label': 'Danh sách hội thoại Zalo' }, ...[1, 2, 3, 4, 5, 6].map(() => h('div', { style: 'padding:12px 10px' }, xuong(14, '60%'), h('div', { style: 'height:8px' }), xuong(28))));
  const khungDoc = h('div', { class: 'bang doc-zalo', 'aria-live': 'polite' });
  const hop = h('div', { class: `hop-zalo${chon ? ' dang-doc' : ''}` }, khungDs, khungDoc);
  const nutLoc = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(z.loc === ma), onclick: () => { z.loc = ma; veZalo(goc, thamSo); } }, nhan);
  const oTim = h('input', { type: 'search', placeholder: 'Tìm nhóm hoặc người…', value: z.q, 'aria-label': 'Tìm hội thoại' });
  let hen;
  oTim.addEventListener('input', () => { clearTimeout(hen); hen = setTimeout(() => { z.q = oTim.value.trim(); napDs(); }, 300); });
  thay(goc, h('div', { class: 'thanh-loc' }, nutLoc('tat-ca', 'Tất cả'), nutLoc('nhom', 'Nhóm'), nutLoc('ca-nhan', 'Cá nhân'), h('label', { class: 'o-tim' }, icon('tim'), oTim)), hop);

  let ds = [];
  async function napDs() {
    try {
      ds = (await api(`/api/zalo/hoi-thoai${z.q ? `?q=${encodeURIComponent(z.q)}` : ''}`)).ds;
      veDs();
      if (!chon) thay(khungDoc, h('div', { class: 'trong-trai' }, icon('zalo'), h('h3', { text: 'Chọn một hội thoại' }), h('p', { text: 'Tin Zalo hiện theo từng nhóm và từng người, mới nhất ở dưới.' })));
    } catch (e) {
      thay(khungDs, khungLoi(e, napDs));
    }
  }
  function veDs() {
    const loc = ds.filter((x) => z.loc === 'tat-ca' || x.loai === z.loc);
    if (!loc.length) {
      thay(khungDs, h('div', { class: 'trong-trai' }, icon('zalo'), h('h3', { text: z.q ? 'Không tìm thấy' : 'Chưa có tin Zalo' }), h('p', { text: z.q ? 'Thử từ khóa khác.' : 'Nối máy Mac ở mục Kết nối, tin Zalo sẽ về đây.' }), z.q ? null : h('a', { class: 'nut nut-chinh', href: '#ket-noi', style: 'margin-top:14px' }, 'Mở Kết nối')));
      return;
    }
    thay(khungDs, h('ul', {}, ...loc.map((x) => {
      const dang = chon && chon.loai === x.loai && chon.ten === x.ten;
      const ai = x.nguoi_cuoi === 'Tôi' ? 'Bạn: ' : x.loai === 'nhom' && x.nguoi_cuoi ? `${x.nguoi_cuoi.split(' ').slice(-1)[0]}: ` : '';
      return h('li', { class: x.chua_xem ? 'chua-xem' : '' },
        h('button', { type: 'button', 'aria-current': String(Boolean(dang)), onclick: () => { location.hash = `zalo/${khoaHoiThoai(x.loai, x.ten)}`; } },
          anhZalo(x.ten, x.loai),
          h('div', { style: 'min-width:0' },
            h('div', { class: 'dong-1' }, h('strong', { text: x.ten }), h('time', { datetime: x.cuoi, text: luc(x.cuoi) })),
            h('div', { class: 'dong-2' }, h('p', { text: `${ai}${trichTin(x.trich)}` }), x.chua_xem ? h('b', { class: 'dem-zalo', text: x.chua_xem > 99 ? '99+' : String(x.chua_xem), 'aria-label': `${x.chua_xem} tin chưa xem` }) : null),
          ),
        ));
    })));
  }

  async function moHoiThoai({ loai, ten }) {
    thay(khungDoc, xuong(40, '40%'), h('div', { style: 'height:16px' }), xuong(60, '55%'), h('div', { style: 'height:12px' }), xuong(40, '45%'));
    const tai = async (truoc) => {
      const q = new URLSearchParams({ loai, ten });
      if (truoc) { q.set('truoc_luc', truoc.thoi_diem); q.set('truoc_id', truoc.id); }
      return api(`/api/zalo/tin?${q}`);
    };
    let tin = [];
    let tep = [];
    let conNua = false;
    const luong = h('div', { class: 'luong-zalo', tabindex: '0', 'aria-label': `Tin trong ${ten}` });
    const veLuong = () => {
      const theoTin = new Map();
      for (const f of tep) (theoTin.get(f.tin_nhan_id) || theoTin.set(f.tin_nhan_id, []).get(f.tin_nhan_id)).push(f);
      const con = [];
      if (conNua) con.push(h('button', { class: 'nut nut-phu nut-nho tin-cu', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          const cu = await tai(tin[0]);
          const caoCu = luong.scrollHeight;
          tin = [...cu.tin, ...tin]; tep = [...cu.tep, ...tep]; conNua = cu.con_nua;
          veLuong();
          luong.scrollTop = luong.scrollHeight - caoCu;
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Xem tin cũ hơn'));
      let truoc = null;
      for (const m of tin) {
        const ngay = nhanNgayTin(m.thoi_diem);
        const ngayMoi = !truoc || nhanNgayTin(truoc.thoi_diem) !== ngay;
        if (ngayMoi) con.push(h('div', { class: 'ngay-phan' }, h('span', { text: ngay })));
        const lien = truoc && !ngayMoi && truoc.nguoi_gui === m.nguoi_gui && Date.parse(m.thoi_diem) - Date.parse(truoc.thoi_diem) < 5 * 60000;
        const toi = m.nguoi_gui === 'Tôi';
        const files = theoTin.get(m.id) || [];
        const { nut, coAnh } = noiDungBong(m, files);
        const ten = m.nguoi_gui || 'Không rõ';
        const bong = h('div', { class: `bong-chat${coAnh ? ' co-anh' : ''}` }, ...nut, h('time', { datetime: m.thoi_diem, text: fmt.gioPhut.format(new Date(m.thoi_diem)) }));
        con.push(h('div', { class: `tin-zalo${toi ? ' toi' : ''}${lien ? ' lien' : ''}` },
          toi ? null : lien ? h('span', { class: 'cho-anh', 'aria-hidden': 'true' }) : anhZalo(ten, 'ca-nhan'),
          h('div', { class: 'cot-tin' },
            !toi && loai === 'nhom' && !lien ? h('span', { class: 'ten-gui', text: ten }) : null,
            bong,
          ),
        ));
        truoc = m;
      }
      thay(luong, con);
    };
    const spamZalo = nutSpam({
      nguon: 'zalo',
      tuyChon: [{ loai: loai === 'nhom' ? 'nhom' : 'nguoi', gia_tri: ten, nhan: ten }],
      gui: (c) => api('/api/chan', { method: 'POST', body: JSON.stringify({ nguon: 'zalo', loai: c.loai, gia_tri: c.gia_tri, nhan: c.nhan }) }),
      sauKhi: () => { location.hash = 'zalo'; veZalo(goc); },
    });
    try {
      const kq = await tai(null);
      tin = kq.tin; tep = kq.tep; conNua = kq.con_nua;
      thay(khungDoc,
        h('header', { class: 'dau-zalo' },
          h('button', { class: 'nut nut-phu nut-nho nut-quay', type: 'button', 'aria-label': 'Quay lại danh sách', onclick: () => { location.hash = 'zalo'; } }, icon('mui-ten')),
          anhZalo(ten, loai),
          h('div', { style: 'flex:1;min-width:0' }, h('h2', { text: ten }), h('p', { text: loai === 'nhom' ? 'Nhóm Zalo' : 'Tin riêng' })),
          spamZalo.nut,
        ),
        spamZalo.khung,
        luong,
        h('p', { class: 'zalo-chi-doc', text: 'Sonicplan chỉ đọc tin Zalo, không gửi tin thay bạn.' }),
      );
      veLuong();
      luong.scrollTop = luong.scrollHeight;
      const muc = ds.find((x) => x.loai === loai && x.ten === ten);
      if (muc?.chua_xem) {
        muc.chua_xem = 0;
        veDs();
        api('/api/tong-quan').then((k) => capNhatDem(k.so_lieu.tin_chua_xem, k.so_lieu.viec_mo)).catch(() => {});
      }
    } catch (e) {
      thay(khungDoc, khungLoi(e, () => moHoiThoai({ loai, ten })));
    }
  }

  await napDs();
  if (chon) moHoiThoai(chon);
  else if (window.matchMedia('(min-width: 861px)').matches && ds[0]) location.replace(`#zalo/${khoaHoiThoai(ds[0].loai, ds[0].ten)}`);
}

// =====================================================================
// Kết nối
// =====================================================================
// Trang Kết nối hiện ngay bản đã lưu lần trước (sessionStorage), rồi lấy bản mới và vẽ lại nếu có khác.
// Sau mỗi thao tác (ve) luôn lấy bản mới, không dùng bản lưu, để không hiện trạng thái cũ.
const KHOA_LUU_KN = 'sonicplan-ket-noi';
function layLuuKn() {
  try { return JSON.parse(sessionStorage.getItem(KHOA_LUU_KN) || 'null'); } catch { return null; }
}
function ghiLuuKn(kn) {
  try { sessionStorage.setItem(KHOA_LUU_KN, JSON.stringify(kn)); } catch {}
}

async function veKetNoi(goc, { moi = false } = {}) {
  const ve = () => veKetNoi(goc, { moi: true }).catch((e) => bao(e.message, { loi: true }));
  const luu = moi ? null : layLuuKn();
  if (!luu) thay(goc, h('div', { class: 'ds-kn' }, ...[1, 2, 3, 4].map(() => h('div', { class: 'bang the-kn' }, xuong(44, '44px'), xuong(16, '60%'), xuong(80)))));
  const kn = luu || await api('/api/ket-noi');
  if (luu) {
    api('/api/ket-noi').then((moiKn) => {
      const doi = JSON.stringify(moiKn) !== JSON.stringify(luu);
      ghiLuuKn(moiKn);
      if (doi && location.hash.slice(1).split('/')[0] === 'ket-noi') ve();
    }).catch(() => {});
  } else ghiLuuKn(kn);
  const daoTrangThai = (den, chu) => h('span', { class: `trang-thai-kn ${den}`, text: chu });
  const dau = (ten, tieuDe, moTa, den, chu) => h('header', {}, h('span', { class: 'tp-icon', dataset: { den } }, icon(ten)), h('div', {}, h('h2', { text: tieuDe }), h('p', { text: moTa })), daoTrangThai(den, chu));

  // Google: đăng nhập một lần cho Gmail, Lịch, Tasks
  const gg = kn.google;
  const laChuGg = kn.tich_hop.vai_tro === 'chu';
  const ketQuaGg = new URLSearchParams(location.search).get('google');
  if (ketQuaGg) {
    history.replaceState(null, '', `${location.pathname}#ket-noi`);
    if (ketQuaGg === 'ok') bao('Đã nối Google. Thư mới, việc và lịch sẽ đồng bộ mỗi 5 phút.');
    else bao(ketQuaGg, { loi: true });
  }
  const oIdGg = h('input', { type: 'text', placeholder: 'Client ID (….apps.googleusercontent.com)', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Client ID' });
  const oBiMatGg = h('input', { type: 'password', placeholder: 'Client Secret', autocomplete: 'off', 'aria-label': 'Client Secret' });
  const khoiGg = [];
  if (gg.da_noi) {
    khoiGg.push(
      hangTaiKhoan(gg.da_noi.email || 'Tài khoản Google', gg.lan_cuoi ? `${gg.lan_cuoi.ghi_chu}, ${luc(gg.lan_cuoi.lan_cuoi)}` : 'Chờ lượt đồng bộ đầu tiên'),
      h('p', { class: 'ghi-nho-kn', text: `Thư mới vào hộp tin; việc mới sang Google Tasks, việc có ngày sang Lịch; việc bấm xong bên Tasks sẽ xong ở đây.${gg.da_noi.co_drive ? ' Tệp đính kèm lưu thêm vào thư mục Sonicplan trên Drive.' : ''}` }),
      gg.da_noi.email ? h('div', { class: 'hang-nut' }, ...[['Mở Gmail', 'https://mail.google.com/mail/'], ['Mở Lịch', 'https://calendar.google.com/calendar/r'], ['Mở Tasks', 'https://tasks.google.com/tasks/'], ['Mở Drive', 'https://drive.google.com/drive/my-drive']].map(([ten, dia]) => h('a', { class: 'chip', href: `${dia}?authuser=${encodeURIComponent(gg.da_noi.email)}`, target: '_blank', rel: 'noopener noreferrer', title: `Mở bằng tài khoản ${gg.da_noi.email}` }, ten))) : null,
      laChuGg ? khoiNhanGoogle() : null,
      gg.da_noi.co_drive ? null : h('p', { class: 'canh-bao-nho', text: 'Chưa có quyền Drive nên tệp đính kèm mới chỉ nằm ở kho của hệ thống. Bật Google Drive API trong dự án Google Cloud, rồi bấm Đăng nhập lại và tick quyền Drive.' }),
      laChuGg && !gg.da_noi.co_drive ? h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: '/api/google/bat-dau' }, icon('thu'), 'Đăng nhập lại để thêm Drive')) : null,
      laChuGg ? h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/google', { method: 'DELETE' }); bao('Đã gỡ kết nối Google.'); ve(); } }, 'Gỡ kết nối Google')) : null,
    );
  } else if (gg.co_client) {
    khoiGg.push(
      h('p', { class: 'mo-ta', text: 'Đã có Client ID. Bấm nút để chọn tài khoản Google và đồng ý các quyền Gmail, Lịch, Tasks, Drive. Nhớ tick đủ quyền.' }),
      laChuGg ? h('div', { class: 'hang-nut' },
        h('a', { class: 'nut nut-chinh', href: '/api/google/bat-dau' }, icon('thu'), 'Đăng nhập Google'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/google?het=1', { method: 'DELETE' }); ve(); } }, 'Đổi Client ID')) : null,
    );
  } else {
    khoiGg.push(
      h('p', { class: 'mo-ta', text: 'Làm một lần, khoảng 5 phút, rồi chỉ cần bấm Đăng nhập Google:' }),
      h('ol', { class: 'buoc' },
        h('li', {}, 'Vào console.cloud.google.com, tạo một dự án mới, rồi ở mục APIs & Services bật bốn API: Gmail API, Google Calendar API, Google Tasks API, Google Drive API.'),
        h('li', {}, 'Mục OAuth consent screen: chọn External, đặt tên ứng dụng, để chế độ Testing và thêm email của bạn vào Test users.'),
        h('li', {}, 'Mục Credentials, Create credentials, OAuth client ID, loại Web application. Ở Authorized redirect URIs dán địa chỉ bên dưới.'),
        h('li', {}, 'Chép Client ID và Client Secret dán vào hai ô dưới đây.'),
      ),
      oChep(gg.dia_chi_goi_lai),
      laChuGg ? h('div', { class: 'luoi-nhap' }, oIdGg, oBiMatGg, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api('/api/ket-noi/google', { method: 'POST', body: JSON.stringify({ client_id: oIdGg.value, client_secret: oBiMatGg.value }) });
          bao('Đã lưu. Bấm Đăng nhập Google để chọn tài khoản.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Lưu')) : null,
    );
  }
  const lanCuoiLoiGg = gg.lan_cuoi?.ghi_chu?.startsWith('Lỗi');
  // Kho Drive: tài khoản Google Drive riêng để giữ bản lưu tin nhắn, thư, tệp, bộ nhớ AI
  const kho = kn.kho_drive || { da_noi: null, lan_cuoi: null };
  const ketQuaKho = new URLSearchParams(location.search).get('kho');
  if (ketQuaKho) {
    history.replaceState(null, '', `${location.pathname}#ket-noi`);
    if (ketQuaKho === 'ok') bao('Đã nối Drive kho. Tin nhắn, thư, tệp và bộ nhớ AI sẽ được lưu sang đó mỗi 5 phút.');
    else bao(ketQuaKho, { loi: true });
  }
  const khoiKho = [];
  const loiKho = kho.lan_cuoi?.ghi_chu?.startsWith('Lỗi');
  if (kho.da_noi) {
    khoiKho.push(
      hangTaiKhoan(kho.da_noi.email || 'Tài khoản Drive', kho.lan_cuoi ? `${kho.lan_cuoi.ghi_chu}, ${luc(kho.lan_cuoi.lan_cuoi)}` : 'Chờ lượt lưu đầu tiên'),
      h('p', { class: 'ghi-nho-kn', text: 'Tin và thư gom thành một tệp mỗi ngày; Bộ nhớ AI và Việc ghi đè đúng một tệp. Hệ thống không bao giờ xóa gì trên Drive.' }),
      linkKhoDrive(kho),
      laChuGg ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
          ev.target.disabled = true;
          try { const r = await api('/api/kho-drive/luu-ngay', { method: 'POST' }); bao(r.loi.length ? r.loi.join('; ') : `Đã lưu: ${r.tep} tệp, ${r.tin} ngày tin và thư, ${r.bo_nho + r.viec} danh sách.`, r.loi.length ? { loi: true } : undefined); ve(); }
          catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
        } }, icon('kho'), 'Lưu ngay'),
        h('a', { class: 'nut nut-phu', href: '/api/kho-drive/bat-dau' }, 'Đổi tài khoản Drive'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/kho-drive', { method: 'DELETE' }); bao('Đã gỡ Drive kho. Tệp đã lưu vẫn còn trên Drive.'); ve(); } }, 'Gỡ kết nối')) : null,
    );
  } else if (!gg.co_client) {
    khoiKho.push(h('p', { class: 'mo-ta', text: 'Khai Client ID và Secret ở thẻ Google bên trên trước. Drive kho dùng chung chúng, không cần tạo thêm gì ở Google Cloud.' }));
  } else {
    khoiKho.push(
      h('p', { class: 'mo-ta', text: 'Bấm nút, chọn tài khoản Google có Drive muốn dùng làm kho (có thể khác tài khoản đã nối ở trên) và tick quyền Drive. Hệ thống chỉ thấy thư mục và tệp do chính nó tạo ra.' }),
      h('p', { class: 'canh-bao-nho', text: 'Nếu ứng dụng Google Cloud đang ở chế độ Testing, thêm email của tài khoản đó vào Test users ở mục OAuth consent screen trước, nếu không Google sẽ chặn.' }),
      laChuGg ? h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: '/api/kho-drive/bat-dau' }, icon('kho'), 'Chọn tài khoản Drive kho')) : null,
    );
  }
  const theKho = h('section', { class: 'bang the-kn rong' },
    dau('kho', 'Drive kho: nơi lưu lại tin nhắn, thư, bộ nhớ AI', 'Một Google Drive riêng giữ bản lưu của tin Zalo, thư, tệp đính kèm, bộ nhớ AI và danh sách việc, phòng khi cần tra lại hoặc đổi hệ thống.', kho.da_noi ? (loiKho ? 'do' : 'xanh') : 'xam', kho.da_noi ? (loiKho ? 'Đang lỗi' : 'Đã nối') : 'Chưa nối'),
    loiKho ? h('p', { class: 'canh-bao-nho', text: kho.lan_cuoi.ghi_chu }) : null,
    ...khoiKho,
  );
  const theGoogle = h('section', { class: 'bang the-kn rong' },
    dau('thu', 'Google: Gmail, Lịch, Tasks, Drive', 'Đăng nhập một lần, hệ thống đọc thư, ghi việc sang Tasks và Lịch, lưu tệp đính kèm vào Drive giúp bạn.', gg.da_noi ? (lanCuoiLoiGg ? 'do' : 'xanh') : gg.co_client ? 'vang' : 'xam', gg.da_noi ? (lanCuoiLoiGg ? 'Đang lỗi' : 'Đã nối') : gg.co_client ? 'Chờ đăng nhập' : 'Chưa nối'),
    lanCuoiLoiGg ? h('p', { class: 'canh-bao-nho', text: gg.lan_cuoi.ghi_chu }) : null,
    ...khoiGg,
  );

  // Thư
  const theThu = h('section', { class: 'bang the-kn' },
    dau('thu', 'Thư chuyển tiếp', 'Cách không cần đăng nhập: Gmail chuyển bản sao thư về đây, kèm tệp đính kèm.', kn.thu.lan_cuoi ? 'xanh' : kn.thu.dia_chi ? 'vang' : 'xam', kn.thu.lan_cuoi ? `Thư cuối ${luc(kn.thu.lan_cuoi.lan_cuoi)}` : kn.thu.xac_nhan ? 'Chờ bấm xác nhận' : kn.thu.dia_chi ? 'Chưa nối' : 'Chưa bật'),
  );
  if (kn.thu.xac_nhan) {
    const xn = kn.thu.xac_nhan;
    theThu.append(
      h('p', { text: `Gmail ${xn.tu || ''} vừa xin chuyển thư về đây. Bấm nút để đồng ý${xn.ma ? ` (mã ${xn.ma})` : ''}, rồi làm bước 3 bên dưới.` }),
      h('div', { class: 'hang-nut' }, xn.duong_dan ? h('a', { class: 'nut nut-chinh', href: xn.duong_dan, target: '_blank', rel: 'noopener' }, icon('thu'), 'Xác nhận chuyển thư') : oChep(xn.ma || '')),
    );
  }
  if (kn.thu.dia_chi) {
    theThu.append(oChep(kn.thu.dia_chi), h('ol', { class: 'buoc' },
      h('li', {}, 'Bấm nút Mở cài đặt Gmail, chọn Thêm địa chỉ chuyển tiếp, dán địa chỉ trên.'),
      h('li', {}, 'Quay lại trang này, nút Xác nhận chuyển thư sẽ hiện sau vài giây. Bấm nút đó.'),
      h('li', {}, 'Trong cài đặt Gmail, chọn Chuyển tiếp bản sao thư đến địa chỉ trên, bấm Lưu thay đổi.'),
    ), h('div', { class: 'hang-nut' },
      h('a', { class: 'nut nut-phu', href: 'https://mail.google.com/mail/u/0/#settings/fwdandpop', target: '_blank', rel: 'noopener' }, icon('thu'), 'Mở cài đặt Gmail'),
      h('button', { class: 'nut nut-phu', type: 'button', onclick: () => ve() }, icon('lap'), 'Kiểm tra lại'),
    ));
  } else {
    theThu.append(h('p', { class: 'canh-bao-nho', text: 'Hệ thống đang chuẩn bị địa chỉ nhận thư.' }));
  }

  // Zalo
  const oLenhZalo = h('div');
  const theZalo = h('section', { class: 'bang the-kn' },
    dau('zalo', 'Zalo trên máy Mac', 'Tin và tệp Zalo cá nhân tự về hộp tin.',
      !kn.zalo.khoa ? 'xam' : !kn.zalo.lan_cuoi ? 'vang' : Date.now() - Date.parse(kn.zalo.lan_cuoi.lan_cuoi) > 6 * 3600000 ? 'do' : 'xanh',
      !kn.zalo.khoa ? 'Chưa nối' : !kn.zalo.lan_cuoi ? 'Chờ máy Mac' : `Tín hiệu ${luc(kn.zalo.lan_cuoi.lan_cuoi)}`),
    h('ol', { class: 'buoc' },
      h('li', {}, 'Bấm Tạo lệnh, rồi bấm nút chép.'),
      h('li', {}, 'Trên máy Mac, mở ứng dụng Terminal, dán lệnh, nhấn Enter.'),
    ),
    oLenhZalo,
    h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
      if (kn.zalo.khoa && !confirm('Tạo lệnh mới thì máy Mac đang nối sẽ ngừng gửi cho đến khi chạy lệnh mới. Tiếp tục?')) return;
      try {
        const kq = await api('/api/ket-noi/zalo', { method: 'POST' });
        thay(oLenhZalo, oChep(kq.lenh, { lo: true }), h('p', { class: 'canh-bao-nho', style: 'margin-top:10px', text: 'Lệnh này chỉ hiện một lần, đừng gửi cho người khác.' }));
      } catch (e) { bao(e.message, { loi: true }); }
    } }, icon('lap'), kn.zalo.khoa ? 'Tạo lệnh mới' : 'Tạo lệnh')),
  );

  // Lịch
  const oLich = h('div');
  const theLich = h('section', { class: 'bang the-kn' },
    dau('lich', 'Lịch', 'Việc có hạn hiện trên Google Lịch (hoặc lịch iPhone, Outlook), tự cập nhật.', kn.lich.khoa ? 'xanh' : 'xam', kn.lich.khoa ? (kn.lich.khoa.dung_luc ? `Đọc ${luc(kn.lich.khoa.dung_luc)}` : 'Chờ lịch đọc') : 'Chưa nối'),
    oLich,
    h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
      if (kn.lich.khoa && !confirm('Nối lại thì lịch cũ ngừng cập nhật, phải thêm lại vào Google Lịch. Tiếp tục?')) return;
      try {
        const kq = await api('/api/ket-noi/lich', { method: 'POST' });
        thay(oLich,
          h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: kq.google, target: '_blank', rel: 'noopener' }, icon('lich'), 'Thêm vào Google Lịch')),
          h('p', { class: 'canh-bao-nho', style: 'margin-top:10px', text: 'Lịch khác (iPhone, Outlook): chép đường dẫn dưới rồi thêm lịch theo đường dẫn.' }),
          oChep(kq.duong_dan));
      } catch (e) { bao(e.message, { loi: true }); }
    } }, icon('lich'), kn.lich.khoa ? 'Nối lại' : 'Nối lịch')),
  );

  // Telegram
  const theTele = h('section', { class: 'bang the-kn' },
    dau('telegram', 'Báo qua Telegram', 'Nhắn thường để tạo việc, lệnh /viec /nho /hoi /tomtat; báo việc mới và cảnh báo khi máy Zalo im lặng.', kn.telegram.da_noi ? 'xanh' : 'xam', kn.telegram.da_noi ? 'Đã nối' : kn.telegram.co_bot ? 'Chưa nối' : 'Chưa cài bot'),
  );
  if (kn.telegram.co_bot) {
    theTele.append(
      h('ol', { class: 'buoc' }, h('li', {}, 'Bấm Nối Telegram, Telegram mở ra.'), h('li', {}, 'Bấm Start. Bot trả lời "Đã nối" là xong.')),
      h('div', { class: 'hang-nut' },
        h('a', { class: 'nut nut-chinh', href: kn.telegram.duong_dan, target: '_blank', rel: 'noopener' }, icon('telegram'), kn.telegram.da_noi ? 'Nối lại Telegram' : 'Nối Telegram'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: () => ve() }, icon('lap'), 'Kiểm tra lại'),
      ),
    );
  }
  if (kn.telegram.quan_tri) {
    const oMa = h('input', { type: 'password', placeholder: 'Dán mã bot @BotFather gửi', autocomplete: 'off', 'aria-label': 'Mã bot Telegram', style: 'flex:1;min-width:0' });
    theTele.append(
      h('p', { class: 'canh-bao-nho', style: 'margin-top:12px', text: kn.telegram.co_bot ? `Bot chung đang dùng: @${kn.telegram.ten_bot}. Dán mã khác nếu muốn đổi bot.` : 'Cài bot chung một lần: trong Telegram nhắn @BotFather, gõ /newbot, đặt tên, rồi dán mã nó gửi vào ô dưới.' }),
      h('div', { class: 'hang-nut' }, oMa, h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => {
        try {
          const kq = await api('/api/ket-noi/telegram/bot', { method: 'POST', body: JSON.stringify({ token: oMa.value }) });
          bao(`Đã cài bot @${kq.ten}.`);
          ve();
        } catch (e) { bao(e.message, { loi: true }); }
      } }, 'Lưu bot')),
    );
  } else if (!kn.telegram.co_bot) {
    theTele.append(h('p', { class: 'canh-bao-nho', text: 'Hệ thống đang chuẩn bị bot Telegram.' }));
  }

  // API: AI của riêng bạn và địa chỉ nhận việc mới
  const th = kn.tich_hop;
  const laChu = th.vai_tro === 'chu';
  const oLoaiAi = h('select', { 'aria-label': 'Loại dịch vụ AI' }, h('option', { value: 'claude', text: 'Claude (Anthropic)' }), h('option', { value: 'openai', text: 'Loại tương thích OpenAI' }));
  const oKhoaAi = h('input', { type: 'password', placeholder: 'Dán khóa API', autocomplete: 'off', 'aria-label': 'Khóa API' });
  const oMoHinh = h('input', { type: 'text', placeholder: 'Mô hình (bỏ trống để dùng mặc định)', autocomplete: 'off', 'aria-label': 'Mô hình' });
  const oDiaChiAi = h('input', { type: 'url', placeholder: 'Địa chỉ dịch vụ, ví dụ https://api.openai.com/v1', autocomplete: 'off', 'aria-label': 'Địa chỉ dịch vụ', hidden: true });
  oLoaiAi.addEventListener('change', () => { oDiaChiAi.hidden = oLoaiAi.value !== 'openai'; });
  const aiNut = h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
    ev.target.disabled = true;
    try {
      await api('/api/ket-noi/ai', { method: 'POST', body: JSON.stringify({ loai: oLoaiAi.value, khoa: oKhoaAi.value, mo_hinh: oMoHinh.value, dia_chi: oDiaChiAi.value }) });
      bao('Đã nối dịch vụ AI. Từ lượt tách việc sau sẽ dùng dịch vụ này.');
      ve();
    } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
  } }, icon('ai'), 'Kiểm tra và lưu');
  const khoiAi = h('div', { class: 'khoi-api' },
    h('h3', { text: 'AI của bạn' }),
    h('p', { class: 'mo-ta', text: th.ai ? `Đang dùng ${th.ai.loai === 'claude' ? 'Claude' : 'dịch vụ tương thích OpenAI'}, mô hình ${th.ai.mo_hinh}. Gặp lỗi thì tự quay về AI có sẵn.` : 'Mặc định tách việc bằng AI có sẵn của hệ thống. Dán khóa API của bạn nếu muốn dùng mô hình mạnh hơn.' }),
    th.ai?.loi ? h('p', { class: 'canh-bao-nho', text: th.ai.loi.ghi_chu }) : null,
    laChu ? (th.ai
      ? h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/ai', { method: 'DELETE' }); bao('Đã gỡ, quay về AI có sẵn.'); ve(); } }, 'Gỡ dịch vụ này'))
      : h('div', { class: 'luoi-nhap' }, oLoaiAi, oKhoaAi, oMoHinh, oDiaChiAi, aiNut)) : null,
  );

  const oDiaChiNhan = h('input', { type: 'url', placeholder: 'https://… địa chỉ nhận việc mới', autocomplete: 'off', 'aria-label': 'Địa chỉ nhận việc mới' });
  const khoiNhan = h('div', { class: 'khoi-api' },
    h('h3', { text: 'Báo việc mới tới dịch vụ khác' }),
    h('p', { class: 'mo-ta', text: th.webhook ? `Mỗi việc mới gửi tới ${th.webhook.host}. ${th.webhook.lan_cuoi ? `${th.webhook.lan_cuoi.ghi_chu}, ${luc(th.webhook.lan_cuoi.lan_cuoi)}.` : 'Chưa có việc nào được gửi.'}` : 'Mỗi việc mới (AI tách từ tin, hoặc bạn tự thêm) được gửi dạng JSON tới địa chỉ này. Dùng được với Zapier, Make, Google Apps Script, Slack, Notion và mọi dịch vụ có địa chỉ nhận (webhook).' }),
    laChu ? (th.webhook
      ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { try { await api('/api/ket-noi/webhook/thu', { method: 'POST' }); bao('Đã gửi một việc thử.'); } catch (e) { bao(e.message, { loi: true }); } } }, 'Gửi thử'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/webhook', { method: 'DELETE' }); bao('Đã gỡ địa chỉ.'); ve(); } }, 'Gỡ'))
      : h('div', { class: 'luoi-nhap' }, oDiaChiNhan, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api('/api/ket-noi/webhook', { method: 'POST', body: JSON.stringify({ url: oDiaChiNhan.value }) });
          bao('Đã nối. Em vừa gửi một tin thử tới địa chỉ này.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Kiểm tra và lưu'))) : null,
  );
  const nv = kn.nhan_viec;
  const khungMa = h('div');
  const khoiVao = h('div', { class: 'khoi-api' },
    h('h3', { text: 'Nhận việc từ dịch vụ khác' }),
    h('p', { class: 'mo-ta', text: nv.co ? `Đã có mã nhận việc. ${nv.lan_cuoi ? `${nv.lan_cuoi.ghi_chu}, ${luc(nv.lan_cuoi.lan_cuoi)}.` : 'Chưa nhận việc nào.'} Mã chỉ hiện một lần lúc tạo, mất thì tạo mã mới.` : 'Zapier, Make, Apps Script, biểu mẫu gửi việc vào đây. Gửi tieu_de để tạo việc ngay, hoặc noi_dung (văn bản tự do) để AI đọc và tách việc.' }),
    laChu ? h('div', { class: 'hang-nut' },
      h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          const kq = await api('/api/ket-noi/nhan-viec', { method: 'POST' });
          khungMa.replaceChildren(
            h('p', { class: 'canh-bao-nho', text: 'Chép mã ngay, sẽ không hiện lại. Gửi POST tới địa chỉ dưới, kèm Authorization: Bearer <mã>.' }),
            oChep(kq.ma),
            oChep(`curl -X POST ${kq.dia_chi} -H "Authorization: Bearer ${kq.ma}" -H "content-type: application/json" -d '{"tieu_de":"Nộp báo cáo","han_ngay":"2026-10-15"}'`),
          );
        } catch (e) { bao(e.message, { loi: true }); }
        ev.target.disabled = false;
      } }, nv.co ? 'Tạo mã mới' : 'Tạo mã nhận việc'),
      nv.co ? h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/nhan-viec', { method: 'DELETE' }); bao('Đã gỡ mã.'); ve(); } }, 'Gỡ mã') : null) : null,
    khungMa,
  );
  const gh = kn.github;
  const oTokenGh = h('input', { type: 'password', placeholder: 'Token GitHub (github_pat_…)', autocomplete: 'off', 'aria-label': 'Token GitHub' });
  const oKhoGh = h('input', { type: 'text', placeholder: 'Kho làm việc, ví dụ ten-ban/sonicplan-viec', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Kho GitHub' });
  const khoiGit = h('div', { class: 'khoi-api' },
    h('h3', { text: 'Claude Code làm việc thay bạn' }),
    h('p', { class: 'mo-ta', text: gh ? `Đã nối kho ${gh.repo}. Mở một việc, bấm "Giao Claude", kết quả hiện ngay trong việc đó. ${gh.lan_cuoi ? `Lần giao issue gần nhất: ${gh.lan_cuoi.ghi_chu}, ${luc(gh.lan_cuoi.lan_cuoi)}.` : ''}` : 'Claude Code chạy trên GitHub của bạn để làm việc bạn giao, rồi gửi kết quả về đây. Tạo token ở github.com/settings/personal-access-tokens, chọn đúng một kho, cấp quyền đọc ghi: Actions, Contents, Issues, Pull requests, Workflows.' }),
    laChu && gh ? h('ol', { class: 'mo-ta buoc-claude' },
      h('li', {}, 'Bấm "Cài luồng Claude" bên dưới (làm một lần).'),
      h('li', {}, 'Trên máy tính có Claude Code, chạy lệnh ', h('code', { text: 'claude setup-token' }), ', chép mã hiện ra.'),
      h('li', {}, 'Mở ', h('a', { href: `https://github.com/${gh.repo}/settings/secrets/actions/new`, target: '_blank', rel: 'noopener', text: 'trang Secrets của kho' }), ', đặt tên CLAUDE_CODE_OAUTH_TOKEN, dán mã, bấm Add secret.'),
    ) : null,
    laChu ? (gh
      ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
          ev.target.disabled = true;
          try { await api('/api/ket-noi/github/cai-claude', { method: 'POST' }); bao('Đã cài luồng Claude vào kho.'); } catch (e) { bao(e.message, { loi: true }); }
          ev.target.disabled = false;
        } }, 'Cài luồng Claude'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/github', { method: 'DELETE' }); bao('Đã gỡ GitHub.'); ve(); } }, 'Gỡ GitHub'))
      : h('div', { class: 'luoi-nhap' }, oKhoGh, oTokenGh, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api('/api/ket-noi/github', { method: 'POST', body: JSON.stringify({ token: oTokenGh.value, repo: oKhoGh.value }) });
          bao('Đã nối GitHub.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Kiểm tra và lưu'))) : null,
  );
  const theApi = h('section', { class: 'bang the-kn rong' },
    dau('ai', 'API trong luồng việc', 'Tin về, AI đọc, việc mới ra, rồi báo tiếp tới dịch vụ bạn dùng.', th.ai || th.webhook || nv.co || gh ? 'xanh' : 'xam', th.ai || th.webhook || nv.co || gh ? 'Đã nối' : 'Chưa nối'),
    h('div', { class: 'luoi-api' }, khoiAi, khoiNhan, khoiVao, khoiGit),
  );

  const theNen = h('section', { class: 'bang the-kn rong' },
    dau('ai', 'AI và kho tệp', 'Workers AI đọc tin mới mỗi 5 phút để tách việc; tệp và bản sao lưu hằng đêm nằm trong kho R2.', kn.ai.co && kn.tep.co ? 'xanh' : 'vang', kn.ai.co && kn.tep.co ? 'Sẵn sàng' : 'Thiếu cấu hình'),
    h('div', { class: 'luoi-tp', style: 'padding:0' },
      h('div', { class: 'tp' }, h('span', { class: 'tp-icon', dataset: { den: kn.ai.co ? 'xanh' : 'do' } }, icon('ai')), h('div', {}, h('strong', { text: 'Workers AI' }), h('span', { text: kn.ai.co ? 'Đã gắn, không cần khóa riêng' : 'Chưa gắn' }))),
      h('div', { class: 'tp' }, h('span', { class: 'tp-icon', dataset: { den: kn.tep.co ? 'xanh' : 'do' } }, icon('kho')), h('div', {}, h('strong', { text: 'Kho tệp R2' }), h('span', { text: kn.tep.co ? 'Đã gắn, sao lưu lúc 23h' : 'Chưa bật R2' }))),
      h('div', { class: 'tp' }, h('span', { class: 'tp-icon', dataset: { den: 'xanh' } }, icon('he-thong')), h('div', {}, h('strong', { text: 'Địa chỉ trang' }), h('span', { translate: 'no', text: kn.goc }))),
    ),
  );

  const nhomThe = [
    ['Tài khoản Google', [['google', theGoogle], ['kho', theKho]]],
    ['Tin vào', [['thu', theThu], ['zalo', theZalo], ['telegram', theTele]]],
    ['Gửi ra', [['lich', theLich], ['api', theApi]]],
    ['Hệ thống', [['nen', theNen]]],
  ];
  const cacThe = nhomThe.map(([ten, ds]) => [ten, ds.map(([ma, the]) => gapTheKn(the, ma))]);
  const tomTat = h('div', { class: 'tom-tat-kn', role: 'list' }, ...cacThe.flatMap(([, ds]) => ds).map((t) => h('button', { type: 'button', class: 'o-kn', role: 'listitem', dataset: { den: t.den }, onclick: () => {
    t.the.open = true;
    t.the.scrollIntoView({ behavior: 'smooth', block: 'start' });
    t.the.querySelector('summary').focus({ preventScroll: true });
  } }, t.bieuTuong, h('span', { class: 'o-kn-chu' }, h('b', { text: t.ten }), h('small', { text: t.trangThai })))));
  thay(goc, tomTat, ...cacThe.map(([ten, ds]) => h('section', { class: 'nhom-kn', 'aria-label': ten }, h('h2', { class: 'tieu-nhom-kn', text: ten }), h('div', { class: 'ds-kn' }, ...ds.map((t) => t.the)))));
}

// Hàng tài khoản đã nối: chữ cái đầu, email, dòng trạng thái lần chạy cuối.
function hangTaiKhoan(email, dong) {
  return h('div', { class: 'tai-khoan-kn' }, h('span', { class: 'dau-tk', 'aria-hidden': 'true', text: String(email).trim().charAt(0).toUpperCase() }), h('div', {}, h('b', { translate: 'no', text: email }), h('small', { text: dong })));
}

// Biến thẻ kết nối thành thẻ gập: tiêu đề luôn thấy, phần chi tiết mở khi cần làm gì (chưa nối, lỗi), gập khi đã ổn.
function gapTheKn(the, ma) {
  const dau = the.querySelector(':scope > header');
  const bieuTuong = dau.querySelector('.tp-icon');
  const den = bieuTuong.dataset.den;
  const ten = dau.querySelector('h2').textContent;
  const trangThai = dau.querySelector('.trang-thai-kn')?.textContent || '';
  const ct = h('details', { class: the.className, id: `kn-${ma}` });
  ct.open = den !== 'xanh';
  const tomTat = h('summary', {}, ...dau.children, h('span', { class: 'mui-kn', 'aria-hidden': 'true' }));
  ct.append(tomTat, h('div', { class: 'than-kn' }, ...[...the.children].filter((c) => c !== dau)));
  return { the: ct, ma, ten: ten.split(':')[0], den, trangThai, bieuTuong: bieuTuong.cloneNode(true) };
}

// =====================================================================
// Nhật ký chạy
// =====================================================================
// Chạy tay một tác vụ hẹn giờ (nút Chạy ngay, Chạy lại). Trả kết quả để nơi gọi vẽ lại.
async function chayNgay(ma) {
  try {
    const kq = await api('/api/chay-ngay', { method: 'POST', body: JSON.stringify({ tac_vu: ma }) });
    bao(kq.trang_thai === 'loi' ? `Lỗi: ${kq.ghi_chu}` : kq.ghi_chu || 'Đã chạy.', { loi: kq.trang_thai === 'loi' });
    return kq;
  } catch (e) {
    bao(e.message, { loi: true });
    return null;
  }
}
let locNhatKy = 'tat-ca';
async function veNhatKy(goc) {
  thay(goc, h('div', { class: 'bang', style: 'padding:20px' }, ...[1, 2, 3, 4, 5, 6].map(() => h('div', { style: 'margin-bottom:12px' }, xuong(18)))));
  const { dong } = await api('/api/nhat-ky?so_dong=300');
  const cacTacVu = [...new Set(dong.map((d) => d.tac_vu))];
  const loc = locNhatKy === 'tat-ca' ? dong : locNhatKy === 'loi' ? dong.filter((d) => d.trang_thai === 'loi') : dong.filter((d) => d.tac_vu === locNhatKy);
  const soLoi = dong.filter((d) => d.trang_thai === 'loi').length;
  const chip = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(locNhatKy === ma), onclick: () => { locNhatKy = ma; veNhatKy(goc); } }, nhan);
  thay(goc, 
    h('div', { class: 'thanh-loc' }, chip('tat-ca', 'Tất cả'), chip('loi', h('span', {}, 'Lỗi ', h('b', { text: String(soLoi) }))), ...cacTacVu.map((t) => chip(t, t))),
    h('div', { class: 'bang' }, h('div', { class: 'bang-cuon', tabindex: '0', role: 'region', 'aria-label': 'Bảng nhật ký' },
      loc.length
        ? h('table', {},
          h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Bắt đầu' }), h('th', { scope: 'col', text: 'Tác vụ' }), h('th', { scope: 'col', text: 'Kết quả' }), h('th', { scope: 'col', class: 'so', text: 'Số mục' }), h('th', { scope: 'col', text: 'Ghi chú' }), h('th', { scope: 'col' }, h('span', { class: 'chi-doc-man-hinh', text: 'Chạy lại' })))),
          h('tbody', {}, ...loc.map((d) => h('tr', {},
            h('td', { class: 'gio', text: fmt.ngayGio.format(new Date(d.bat_dau)) }),
            h('td', { translate: 'no', text: d.tac_vu }),
            h('td', {}, h('span', { class: `nhan-kq ${d.trang_thai}`, text: KET_QUA[d.trang_thai] || d.trang_thai })),
            h('td', { class: 'so', text: String(d.so_muc) }),
            h('td', { class: 'ghi-chu', text: d.ghi_chu || '' }),
            h('td', {}, d.trang_thai === 'loi' ? h('button', { class: 'nut nut-phu', type: 'button', onclick: async (ev) => { ev.target.disabled = true; await chayNgay(d.tac_vu); veNhatKy(goc); } }, 'Chạy lại') : null),
          ))))
        : h('div', { class: 'trong-trai', style: 'min-height:240px' }, icon('nhat-ky'), h('h3', { text: 'Chưa có lần chạy nào' }), h('p', { text: 'Hẹn giờ chạy lần đầu vào đầu giờ kế tiếp.' })),
    )),
  );
}

// =====================================================================
// Chuyển mục
// =====================================================================
async function veLuongTrang(goc) {
  const { veLuong } = await import('/luong.js');
  await veLuong(goc, { h, icon, api, bao, thay, khungLoi, xuong, luc, chayNgay });
}
function veDuAnTrang(goc, thamSo) {
  return veDuAn(goc, thamSo, { h, icon, api, bao, thay, khungLoi, xuong });
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

const VE = { 'tong-quan': veTongQuan, 'hop-tin': veHopTin, zalo: veZalo, viec: veViec, 'hieu-suat': (goc) => veHieuSuat(goc, { h, icon, api, bao, thay, khungLoi, xuong }), 'du-an': veDuAnTrang, 'ghi-nho': veGhiNho, tep: veTep, luong: veLuongTrang, 'ket-noi': veKetNoi, 'nhat-ky': veNhatKy, 'du-lieu': veDuLieu, 'da-chan': veDaChan };
let mucTruoc = null;

async function moMuc() {
  const [ma, thamSo] = (location.hash.slice(1) || 'tong-quan').split('/');
  const muc = VE[ma] ? ma : 'tong-quan';
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
  try {
    await VE[muc](goc, thamSo);
  } catch (e) {
    thay(goc, khungLoi(e, moMuc));
  }
}

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
function moBangLenh() {
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
    const dich = { t: 'tong-quan', h: 'hop-tin', v: 'viec' }[k];
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

// ---------- Khởi động ----------
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
  // Làm mới số đếm mỗi 2 phút khi trang đang mở.
  setInterval(() => {
    if (document.hidden) return;
    api('/api/tong-quan').then((kq) => capNhatDem(kq.so_lieu.tin_chua_xem, kq.so_lieu.viec_mo)).catch(() => {});
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
