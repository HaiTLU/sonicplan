// Giao diện Sonicplan, Mục Zalo: nhóm và cá nhân theo dòng thời gian.
import { nhanTep, phanTichTin, tachLienKet, trichTin } from '../zalo-tin.js';
import { api, bao, chep, congNgay, fmt, h, homNay, icon, khungLoi, kichThuoc, lamMoiDem, luc, s, thay, trang, xuong } from './chung.js';
import { moMuc } from './dieu-huong.js';
import { nutSpam } from './hop-tin.js';
import { kieuMo, kieuXemTep, moXemTep } from './tep.js';
import { chepChu } from './viec.js';

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
// Bảy màu như Telegram: cùng một tên luôn ra cùng một màu, ở ảnh đại diện và tên người gửi trong nhóm.
const chiSoMau = (ten) => mauAnh(ten) % 7;
// anh: địa chỉ ảnh đại diện Zalo đã lưu. Có ảnh thì phủ lên chữ cái đầu; ảnh lỗi thì bỏ ảnh, chữ cái vẫn còn bên dưới.
function anhZalo(ten, loai, anh) {
  const the = h('span', { class: `anh-zalo${loai === 'nhom' ? ' nhom' : ''}`, 'data-m': String(chiSoMau(ten)), style: `--h:${mauAnh(ten)}`, 'aria-hidden': 'true', text: chuDau(ten) });
  if (anh) {
    const hinh = h('img', { src: anh, alt: '', loading: 'lazy', decoding: 'async' });
    hinh.addEventListener('error', () => hinh.remove());
    the.append(hinh);
  }
  return the;
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

export function theTep(ten, kichCo, bam, trangThai) {
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

function cuocGoi(chu) {
  const [dong1, ...con] = String(chu).split('\n');
  return h('div', { class: 'cuoc-goi' }, h('span', { class: 'ic-goi' }, icon('dien-thoai')), h('div', { class: 'tt-goi' }, h('strong', { text: dong1 }), con.length ? h('small', { text: con.join(' ') }) : null));
}

function noiDungBong(m, files, tepTheoTin) {
  const k = phanTichTin(m.noi_dung);
  const ra = [];
  if (k.kieu === 'anh') ra.push(anhTrongTin(m, files[0] || null, k.url));
  else if (k.kieu === 'tep-ngoai') ra.push(files[0] ? tepTrongTin(files[0]) : tepNgoaiTrongTin(m, k.ten));
  else if (k.kieu === 'tep-gui') { ra.push(...files.map(tepTrongTin)); if (k.chu) ra.push(chuCoLienKet(k.chu)); }
  else if (k.kieu === 'the-lien-ket') ra.push(h('a', { class: 'the-lien-ket', href: k.url, target: '_blank', rel: 'noopener noreferrer' }, h('strong', { text: k.tieu_de }), k.mo_ta ? h('span', { text: k.mo_ta }) : null, h('small', { text: k.mien })));
  else if (k.kieu === 'danh-thiep') ra.push(h('div', { class: 'the-lien-he' }, anhZalo(k.ten || 'Danh thiếp', 'ca-nhan'), h('div', { class: 'tt-lien-he' }, h('strong', { text: k.ten || 'Danh thiếp' }), k.dien_thoai ? h('span', { text: k.dien_thoai }) : null, h('small', { text: 'Danh thiếp Zalo' }))));
  else if (k.kieu === 'thu-hoi') ra.push(h('span', { class: 'chu-tin nhat', text: 'Tin nhắn đã thu hồi' }));
  else if (k.kieu === 'nhan-dan') ra.push(h('span', { class: 'chu-tin nhat', text: 'Đã gửi một nhãn dán' }));
  else if (k.kieu === 'binh-chon') ra.push(h('span', { class: 'chu-tin nhat', text: 'Bình chọn trong nhóm' }));
  else if (k.kieu === 'video') ra.push(h('span', { class: 'chu-tin nhat', text: 'Đã gửi một video (xem trong Zalo)' }));
  else if (/^Cuộc gọi/i.test(k.chu || '')) ra.push(cuocGoi(k.chu));
  else ra.push(chuCoLienKet(k.chu));
  if (files.length && !['tep-gui', 'anh', 'tep-ngoai'].includes(k.kieu)) ra.push(...files.map(tepTrongTin));
  return { nut: ra, coAnh: k.kieu === 'anh' || (k.kieu === 'tep-gui' && files.some((f) => kieuXemTep(f.ten) === 'anh')) };
}

// Khóa hội thoại do máy chủ trả: mã hội thoại Zalo, hoặc "loại~tên" với tin cũ chưa có mã.
const khoaHoiThoai = (x) => encodeURIComponent(x.khoa);

// Khung soạn tin: Sonicplan không gửi thay bạn. Bấm gửi thì chép tin và mở Zalo để bạn dán vào đúng hội thoại.
function khungSoan(ten) {
  const o = h('textarea', { class: 'o-soan', name: 'tin', autocomplete: 'off', rows: '1', maxlength: '4000', placeholder: 'Soạn tin…', 'aria-label': `Soạn tin cho ${ten}` });
  const nut = h('button', { class: 'nut-gui-zalo', type: 'submit', disabled: true, 'aria-label': 'Chép tin và mở Zalo' }, icon('gui'));
  const khop = () => { o.style.height = 'auto'; o.style.height = `${Math.min(o.scrollHeight, 160)}px`; nut.disabled = !o.value.trim(); };
  o.addEventListener('input', khop);
  const form = h('form', { class: 'soan-zalo' }, o, nut);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const van = o.value.trim();
    if (!van) return;
    // Mở Zalo ngay trong lúc còn thao tác bấm của người dùng (Safari chặn cửa sổ mở sau lệnh chờ), rồi mới đợi kết quả chép.
    const chep = navigator.clipboard.writeText(van);
    window.open('https://chat.zalo.me/', '_blank', 'noopener');
    try {
      await chep;
    } catch {
      bao('Trình duyệt chặn chép. Tin vẫn còn trong ô soạn: bôi đen và chép tay, hoặc cho phép trang này chép.', { loi: true });
      return;
    }
    bao(`Đã chép tin. Dán vào hội thoại "${ten}" trong Zalo rồi bấm gửi.`);
    o.value = '';
    khop();
  });
  // Enter gửi, Shift+Enter xuống dòng. Đang gõ dấu tiếng Việt (IME) thì Enter chỉ chốt chữ, không gửi.
  o.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) { ev.preventDefault(); form.requestSubmit(); }
  });
  return h('div', { class: 'vung-soan' }, form, h('p', { class: 'goi-y-soan', text: 'Sonicplan không gửi thay bạn: bấm gửi sẽ chép tin và mở Zalo.' }));
}

export async function veZalo(goc, thamSo) {
  const z = trang.zalo;
  let chon = null;
  if (thamSo) {
    const khoa = decodeURIComponent(thamSo);
    if (/^(nhom|ca-nhan)[~:]./.test(khoa)) chon = { khoa, loai: khoa.startsWith('nhom') ? 'nhom' : 'ca-nhan', ten: khoa.includes('~') ? khoa.slice(khoa.indexOf('~') + 1) : 'Hội thoại' };
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
      const dang = chon && chon.khoa === x.khoa;
      const ai = x.nguoi_cuoi === 'Tôi' ? 'Bạn: ' : x.loai === 'nhom' && x.nguoi_cuoi ? `${x.nguoi_cuoi.split(' ').slice(-1)[0]}: ` : '';
      const li = h('li', { class: x.chua_xem ? 'chua-xem' : '' },
        h('button', { type: 'button', 'aria-current': String(Boolean(dang)), onclick: () => { location.hash = `zalo/${khoaHoiThoai(x)}`; } },
          anhZalo(x.ten, x.loai, x.anh),
          h('div', { style: 'min-width:0' },
            h('div', { class: 'dong-1' }, h('strong', { text: x.ten }), h('time', { datetime: x.cuoi, text: luc(x.cuoi) })),
            h('div', { class: 'dong-2' }, h('p', { text: `${ai}${trichTin(x.trich)}` }), x.chua_xem ? h('b', { class: 'dem-zalo', text: x.chua_xem > 99 ? '99+' : String(x.chua_xem), 'aria-label': `${x.chua_xem} tin chưa xem` }) : null),
          ),
        ));
      li._td = () => ({ nhan: `Thao tác với ${x.ten}`, muc: [
        { nhan: 'Mở hội thoại', lam: () => { location.hash = `zalo/${khoaHoiThoai(x)}`; } },
        { nhan: 'Sao chép tên', lam: () => chepChu(x.ten) },
        { vach: true },
        { nhan: x.loai === 'nhom' ? 'Spam nhóm này' : 'Spam người này', nguy: true, lam: async () => {
          if (!confirm(`Chặn "${x.ten}"? Tin cũ sẽ ẩn, việc chưa xong sinh từ đó sẽ gỡ, và AI không tạo việc từ đây nữa. Bỏ chặn ở Hộp tin, mục Đã chặn.`)) return;
          try {
            const kq = await api('/api/chan', { method: 'POST', body: JSON.stringify({ nguon: 'zalo', loai: x.loai === 'nhom' ? 'nhom' : 'nguoi', gia_tri: x.ten, nhan: x.ten }) });
            bao(`Đã chặn ${kq.nhan}. Ẩn ${kq.an_tin} tin${kq.go_viec ? `, gỡ ${kq.go_viec} việc chưa xong` : ''}.`);
          } catch (e) { bao(e.message, { loi: true }); }
          moMuc();
        } },
      ] });
      return li;
    })));
  }

  async function moHoiThoai({ khoa, loai, ten }) {
    thay(khungDoc, xuong(40, '40%'), h('div', { style: 'height:16px' }), xuong(60, '55%'), h('div', { style: 'height:12px' }), xuong(40, '45%'));
    const tai = async (truoc) => {
      const q = new URLSearchParams({ khoa });
      if (truoc) { q.set('truoc_luc', truoc.thoi_diem); q.set('truoc_id', truoc.id); }
      return api(`/api/zalo/tin?${q}`);
    };
    let tin = [];
    let anhHoiThoai = null;
    const anhNguoi = {};
    const nhoAnh = (kq) => { if (kq.anh_hoi_thoai) anhHoiThoai = kq.anh_hoi_thoai; Object.assign(anhNguoi, kq.anh_nguoi); };
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
          tin = [...cu.tin, ...tin]; tep = [...cu.tep, ...tep]; conNua = cu.con_nua; nhoAnh(cu);
          veLuong();
          luong.scrollTop = luong.scrollHeight - caoCu;
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Xem tin cũ hơn'));
      let truoc = null;
      let truocEl = null;
      // Hết một cụm tin liền nhau: đánh dấu tin cuối (có đuôi bong bóng) và đặt ảnh đại diện ở đó, như Telegram.
      const dongCum = () => {
        if (!truocEl) return;
        truocEl.classList.add('cuoi');
        if (!truocEl.classList.contains('toi')) truocEl.querySelector('.cho-anh')?.replaceWith(anhZalo(truocEl._ten, 'ca-nhan', truocEl._anh));
      };
      for (const m of tin) {
        const ngay = nhanNgayTin(m.thoi_diem);
        const ngayMoi = !truoc || nhanNgayTin(truoc.thoi_diem) !== ngay;
        if (ngayMoi) con.push(h('div', { class: 'ngay-phan' }, h('span', { text: ngay })));
        const lien = truoc && !ngayMoi && truoc.nguoi_gui === m.nguoi_gui && Date.parse(m.thoi_diem) - Date.parse(truoc.thoi_diem) < 5 * 60000;
        const toi = m.nguoi_gui === 'Tôi';
        const files = theoTin.get(m.id) || [];
        const { nut, coAnh } = noiDungBong(m, files);
        const ten = m.nguoi_gui || 'Không rõ';
        if (!lien) dongCum();
        const bong = h('div', { class: `bong-chat${coAnh ? ' co-anh' : ''}` },
          !toi && loai === 'nhom' && !lien ? h('span', { class: `ten-gui m${chiSoMau(ten)}`, text: ten }) : null,
          ...nut,
          h('time', { datetime: m.thoi_diem, text: fmt.gioPhut.format(new Date(m.thoi_diem)) }));
        const hang = h('div', { class: `tin-zalo${toi ? ' toi' : ''}${lien ? ' lien' : ''}` },
          toi ? null : h('span', { class: 'cho-anh', 'aria-hidden': 'true' }),
          h('div', { class: 'cot-tin' }, bong),
        );
        hang._ten = ten;
        hang._anh = loai === 'nhom' ? anhNguoi[ten] : anhHoiThoai;
        if (toi && loai === 'ca-nhan' && khoa.includes('~')) hang._td = () => mucChuyenTin(m);
        con.push(hang);
        truocEl = hang;
        truoc = m;
      }
      dongCum();
      thay(luong, con);
    };
    // Tin mình gửi mà máy chủ chưa biết gửi cho ai: chuyển tay sang đúng người (cả cụm tin liền nhau hoặc một tin).
    const mucChuyenTin = (m) => {
      const i = tin.indexOf(m);
      const lienNhau = (a, b) => a.nguoi_gui === 'Tôi' && b.nguoi_gui === 'Tôi' && Math.abs(Date.parse(a.thoi_diem) - Date.parse(b.thoi_diem)) < 5 * 60000;
      let tu = i; let den = i;
      while (tu > 0 && lienNhau(tin[tu - 1], tin[tu])) tu--;
      while (den < tin.length - 1 && lienNhau(tin[den], tin[den + 1])) den++;
      const cum = tin.slice(tu, den + 1).map((t) => t.id);
      const dich = ds.filter((x) => x.loai === 'ca-nhan' && x.khoa.includes(':') && x.khoa !== khoa).slice(0, 8);
      const chuyen = (ids, x) => async () => {
        try {
          const kq = await api('/api/zalo/chuyen-tin', { method: 'POST', body: JSON.stringify({ ids, khoa_dich: x.khoa }) });
          bao(`Đã chuyển ${kq.da_chuyen} tin sang ${x.ten}.`);
        } catch (e) { bao(e.message, { loi: true }); return; }
        await napDs();
        moHoiThoai({ khoa, loai, ten });
      };
      if (!dich.length) return { nhan: 'Chuyển tin', muc: [{ nhan: 'Chưa có cuộc trò chuyện nào đã vá để chuyển tới', lam: () => {} }] };
      return { nhan: 'Chuyển tin này sang người khác', muc: [
        ...dich.map((x) => ({ nhan: cum.length > 1 ? `Chuyển cả cụm ${cum.length} tin sang ${x.ten}` : `Chuyển tin này sang ${x.ten}`, lam: chuyen(cum, x) })),
        ...(cum.length > 1 ? [{ vach: true }, ...dich.slice(0, 3).map((x) => ({ nhan: `Chỉ tin này sang ${x.ten}`, lam: chuyen([m.id], x) }))] : []),
      ] };
    };
    const spamZalo = nutSpam({
      nguon: 'zalo',
      tuyChon: [{ loai: loai === 'nhom' ? 'nhom' : 'nguoi', gia_tri: ten, nhan: ten }],
      gui: (c) => api('/api/chan', { method: 'POST', body: JSON.stringify({ nguon: 'zalo', loai: c.loai, gia_tri: c.gia_tri, nhan: c.nhan }) }),
      sauKhi: () => { location.hash = 'zalo'; veZalo(goc); },
    });
    try {
      const kq = await tai(null);
      tin = kq.tin; tep = kq.tep; conNua = kq.con_nua; nhoAnh(kq);
      thay(khungDoc,
        h('header', { class: 'dau-zalo' },
          h('button', { class: 'nut nut-phu nut-nho nut-quay', type: 'button', 'aria-label': 'Quay lại danh sách', onclick: () => { location.hash = 'zalo'; } }, icon('mui-ten')),
          anhZalo(ten, loai, anhHoiThoai),
          h('div', { style: 'flex:1;min-width:0' }, h('h2', { text: ten }), h('p', { text: loai === 'nhom' ? 'Nhóm Zalo' : 'Tin riêng' })),
          spamZalo.nut,
        ),
        spamZalo.khung,
        luong,
        khungSoan(ten),
      );
      veLuong();
      luong.scrollTop = luong.scrollHeight;
      // Tin mới về thì hiện ngay trong hội thoại đang mở, không cần tải lại trang.
      const nghe = setInterval(async () => {
        if (!luong.isConnected) { clearInterval(nghe); return; }
        if (document.hidden || !tin.length) return;
        try {
          const r = await api(`/api/zalo/tin?${new URLSearchParams({ khoa, sau_id: String(tin[tin.length - 1].id) })}`);
          if (!r.tin.length) return;
          const dangODay = luong.scrollHeight - luong.scrollTop - luong.clientHeight < 120;
          tin = [...tin, ...r.tin]; nhoAnh(r);
          tep = [...tep, ...r.tep];
          veLuong();
          if (dangODay) luong.scrollTop = luong.scrollHeight;
        } catch { /* lần sau thử lại */ }
      }, 10000);
      const muc = ds.find((x) => x.khoa === khoa);
      if (muc?.chua_xem) {
        muc.chua_xem = 0;
        veDs();
        lamMoiDem();
      }
    } catch (e) {
      thay(khungDoc, khungLoi(e, () => moHoiThoai({ khoa, loai, ten })));
    }
  }

  await napDs();
  if (chon) {
    const m = ds.find((x) => x.khoa === chon.khoa);
    if (m) chon = { khoa: m.khoa, loai: m.loai, ten: m.ten };
    moHoiThoai(chon);
  } else if (window.matchMedia('(min-width: 861px)').matches && ds[0]) location.replace(`#zalo/${khoaHoiThoai(ds[0])}`);
}
