// Giao diện Sonicplan, Mục Tổng quan.
import { moKhungSoanPrompt } from '../claude.js';
import { dongHieuSuat } from '../hieu-suat.js';
import { oChonMau } from '../mau.js';
import { dongTrinhDon, moTrinhDon } from '../trinh-don.js';
import { trichTin } from '../zalo-tin.js';
import { ICON_TP, KET_QUA, S, TEN_DEN, TEN_MUC, api, bao, capNhatDem, congNgay, fmt, h, homNay, icon, lienKet, locTin, locViec, luc, meo, ngayHienThi, s, tenNhom, thay, trang, xuong } from './chung.js';
import { moMuc } from './dieu-huong.js';
import { moNganViec, saoViec, soanPromptNhanh } from './viec.js';

// =====================================================================
// Tổng quan
// =====================================================================
// Các khối của Tổng quan: tên hiện trong Tinh chỉnh và độ rộng (day: cả hàng, nua: nửa hàng).
const KHOI_TQ = {
  'can-lam': { ten: 'Cần xử lý ngay', rong: 'day' },
  'de-xuat-claude': { ten: 'Đề xuất soạn prompt', rong: 'day' },
  'chi-so': { ten: 'Chỉ số chính', rong: 'day' },
  'du-an': { ten: 'Theo dự án', rong: 'nua' },
  'viec-toi': { ten: 'Việc sắp tới', rong: 'nua' },
  nhip: { ten: 'Nhịp hôm nay', rong: 'day' },
  'hieu-suat': { ten: 'Hiệu suất', rong: 'day' },
  'tong-hop': { ten: 'Tổng hợp của AI', rong: 'nua' },
  'tin-moi': { ten: 'Tin mới', rong: 'nua' },
  'he-thong': { ten: 'Các bộ phận', rong: 'day' },
};

const TRANG_KHOI = { 'can-lam': 'viec', 'de-xuat-claude': 'viec', 'chi-so': 'viec', 'du-an': 'du-an', 'viec-toi': 'viec', nhip: 'hop-tin', 'hieu-suat': 'hieu-suat', 'tong-hop': 'hop-tin', 'tin-moi': 'hop-tin', 'he-thong': 'ket-noi' };

export async function veTongQuan(goc) {
  if (!lamMoiEm) thay(goc,
    h('div', { class: 'luoi-tq' },
      h('div', { class: 'bang can-lam' }, ...[1, 2, 3, 4].map(() => h('div', { class: 'o-can' }, xuong(14, '50%'), h('div', { style: 'height:10px' }), xuong(36, '40%')))),
      h('div', { class: 'bang chi-so' }, xuong(150)),
    ),
  );
  const kq = await api('/api/tong-quan');
  const sl = kq.so_lieu;
  capNhatDem(sl.tin_chua_xem, sl.viec_mo);
  const tp = kq.tinh_trang.thanh_phan;
  const tt = tomTat(tp, sl);
  const boCuc = kq.bo_cuc;
  S.boCucTQ = boCuc;

  // Dòng đầu: lời chào, tình trạng hệ thống gọn trong một nút nhỏ, nút Tinh chỉnh.
  const gio = Number(fmt.gioSo.format(new Date()));
  const loiChao = gio < 11 ? 'Chào buổi sáng' : gio < 14 ? 'Chào buổi trưa' : gio < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dungDuoc = tp.filter((p) => p.den !== 'xam');
  const on = dungDuoc.filter((p) => p.den === 'xanh').length;
  const chuaOn = dungDuoc.filter((p) => p.den !== 'xanh');
  const chuaCai = tp.filter((p) => p.den === 'xam');
  const denHt = tp.some((p) => p.den === 'do') ? 'do' : chuaOn.length ? 'vang' : 'xanh';
  const meoHt = `${on} trên ${dungDuoc.length} bộ phận đã cài đang chạy ổn.${chuaOn.length ? ` Chưa ổn: ${chuaOn.map((p) => `${p.ten} (${p.mo_ta})`).join('; ')}.` : ''}${chuaCai.length ? ` Chưa cài: ${chuaCai.map((p) => p.ten).join(', ')}.` : ''} Bấm để mở trang Kết nối.`;
  const dau = h('div', { class: 'tq-dau' },
    h('div', { class: 'tq-chao' },
      h('p', { class: 'chao', text: `${loiChao}, ${trang.toi?.nguoi_dung?.ten?.split(' ').slice(-2).join(' ') || 'bạn'}.` }),
      h('p', { class: 'tom-tat', dataset: { den: tt.den }, text: tt.cau })),
    h('div', { class: 'tq-dau-nut' },
      lienKet('ket-noi', null, { class: 'chip-he-thong', dataset: { den: denHt }, ...meo(meoHt) }, h('i', { 'aria-hidden': 'true' }), `${on}/${dungDuoc.length} bộ phận ổn`),
      h('button', { class: 'nut nut-phu', type: 'button', onclick: () => moTinhChinh(boCuc) }, icon('sua'), h('span', { text: 'Tinh chỉnh' }))),
  );

  const ve = {
    'can-lam': () => khoiCanLam(sl, kq.claude),
    'de-xuat-claude': () => khoiDeXuatClaude(kq.de_xuat_claude, kq.hom_nay),
    'chi-so': () => khoiChiSo(kq),
    'du-an': () => khoiDuAn(kq.du_an),
    'viec-toi': () => bangViecSapToi(kq.viec_sap_toi, kq.hom_nay),
    nhip: () => h('section', { class: 'bang khoi-nhip' }, veSong(kq.nhip)),
    'hieu-suat': () => dongHieuSuat({ h, icon, api }),
    'tong-hop': () => khoiTongHop(),
    'tin-moi': () => bangTinMoi(kq.tin_moi.slice(0, 5)),
    'he-thong': () => khoiHeThong(tp, kq.tinh_trang.tac_vu, on, dungDuoc.length),
  };
  const luoi = h('div', { class: lamMoiEm ? 'luoi-tq' : 'luoi-tq vao' }, dau);
  const hien = boCuc.thu_tu.filter((k) => !boCuc.an.includes(k) && ve[k]);
  for (const k of hien) {
    const el = ve[k]();
    el.classList.add('khoi-tq', `rong-${KHOI_TQ[k].rong}`);
    el.dataset.khoi = k;
    el._td = () => ({ nhan: `Khối ${KHOI_TQ[k].ten}`, muc: [
      { nhan: `Mở trang ${TEN_MUC[TRANG_KHOI[k]]}`, lam: () => { location.hash = TRANG_KHOI[k]; } },
      { nhan: 'Tinh chỉnh Tổng quan', lam: () => moTinhChinh(boCuc) },
      { nhan: 'Tải lại dữ liệu', lam: () => moMuc() },
    ] });
    luoi.append(el);
  }
  if (!hien.length) luoi.append(h('div', { class: 'bang trong-trai rong-day' }, h('h3', { text: 'Bạn đã ẩn hết các khối' }), h('p', { text: 'Bấm Tinh chỉnh để hiện lại.' })));
  thay(goc, luoi);
}

// Bốn ô "Cần xử lý ngay": số lớn, bấm vào mở đúng danh sách.
function khoiCanLam(sl, cl) {
  const o = (nhan, so, mau, hash, dat, giai, phu) => lienKet(hash, dat, { class: `o-can${so ? ` co ${mau}` : ''}`, 'aria-label': `${nhan}: ${so}`, ...meo(giai) },
    h('span', { class: 'o-can-nhan', text: nhan }),
    h('b', { class: 'o-can-so', text: fmt.so.format(so || 0) }),
    h('small', { text: phu }));
  const tong = (sl.viec_qua_han || 0) + (sl.viec_hom_nay || 0) + (sl.tin_chua_xem || 0);
  return h('section', { class: 'bang can-lam', 'aria-labelledby': 'tq-can-lam' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-can-lam' }, 'Cần xử lý ngay'),
      h('span', { class: 'mo-ta', text: tong ? 'Bấm vào ô để mở danh sách' : 'Không có gì cần xử lý ngay' })),
    tong ? null : h('p', { class: 'can-lam-trong', text: `Không có việc quá hạn, việc tới hạn hôm nay hay tin chưa xem. ${sl.xong_hom_nay ? `Đã xong ${sl.xong_hom_nay} việc hôm nay.` : ''}`.trim() }),
    tong ? h('div', { class: 'luoi-can' },
      o('Quá hạn', sl.viec_qua_han, 'do', 'viec', locViec('mo'), 'Việc còn mở có hạn trước hôm nay. Bấm để xem, các việc này nằm ở cột Quá hạn.', 'việc trễ hạn'),
      o('Tới hạn hôm nay', sl.viec_hom_nay, 'cam', 'viec', locViec('mo'), 'Việc còn mở có hạn đúng hôm nay. Bấm để xem ở cột Hôm nay.', `${sl.xong_hom_nay} việc đã xong hôm nay`),
      o('Tin chưa xem', sl.tin_chua_xem, 'xanh', 'hop-tin', locTin('chua-xem'), 'Tin Zalo và thư chưa mở đọc. Bấm để xem riêng các tin này.', `${sl.tin_hom_nay} tin đến hôm nay`),
    ) : null,
  );
}

// So sánh với kỳ trước, viết thành chữ: "+3 so với hôm qua".
function soSanhKy(nay, truoc, ky) {
  const d = (nay || 0) - (truoc || 0);
  return h('span', { class: `ss-ky${d > 0 ? ' tang' : d < 0 ? ' giam' : ''}`, text: d ? `${d > 0 ? '+' : ''}${fmt.so.format(d)} so với ${ky}` : `bằng ${ky}` });
}

// Lưới 6 chỉ số: số, so với kỳ trước, đường 8 ngày.
function khoiChiSo(kq) {
  const sl = kq.so_lieu;
  const nd = kq.theo_ngay;
  const cl = kq.claude || {};
  const ngay8 = Array.from({ length: 8 }, (_, i) => ngayHienThi(congNgay(kq.hom_nay, i - 7)));
  const chuoi = (ten, ds) => `${ten} 8 ngày qua: ${ds.map((v, i) => `${ngay8[i]}: ${v}`).join(', ')}.`;
  const o = ({ ten, nhan, so, ss, ds, hash, dat, giai, ghi }) => h('div', { class: 'o-cs' },
    h('dt', {}, icon(ten), nhan),
    h('dd', {},
      h('div', { class: 'o-cs-tren' },
        lienKet(hash, dat, { class: 'so-lon so-bam', 'aria-label': `${nhan}: ${fmt.so.format(so || 0)}`, ...meo(giai) }, fmt.so.format(so || 0)),
        ds ? h('span', meo(chuoi(nhan, ds)), dongNho(ds, chuoi(nhan, ds))) : null),
      ss, ghi ? h('span', { class: 'ghi', text: ghi }) : null));
  return h('section', { class: 'bang chi-so', 'aria-labelledby': 'tq-chi-so' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-chi-so' }, 'Chỉ số chính'), h('span', { class: 'mo-ta', text: 'Đường nhỏ là 8 ngày gần nhất' })),
    h('dl', { class: 'luoi-cs' },
      o({ ten: 'hop-tin', nhan: 'Tin đến hôm nay', so: nd.tin[7], ss: soSanhKy(nd.tin[7], nd.tin[6], 'hôm qua'), ds: nd.tin, hash: 'hop-tin', dat: locTin('hom-nay'),
        giai: 'Tin Zalo và thư nhận từ 0 giờ hôm nay (giờ Việt Nam), không tính nguồn đã chặn. Bấm để xem.' }),
      o({ ten: 'cong', nhan: 'Việc mới hôm nay', so: nd.viec[7], ss: soSanhKy(nd.viec[7], nd.viec[6], 'hôm qua'), ds: nd.viec, hash: 'viec', dat: locViec('mo'),
        giai: 'Việc tạo trong hôm nay, do AI tách từ tin hoặc bạn tự thêm. Bấm để mở trang Việc.' }),
      o({ ten: 'xong', nhan: 'Việc xong hôm nay', so: nd.xong[7], ss: soSanhKy(nd.xong[7], nd.xong[6], 'hôm qua'), ds: nd.xong, hash: 'viec', dat: locViec('xong'),
        giai: 'Việc bấm xong trong hôm nay. Bấm để xem danh sách đã xong.' }),
      o({ ten: 'viec', nhan: 'Việc đang mở', so: sl.viec_mo, ss: h('span', { class: 'ss-ky', text: `hôm nay thêm ${nd.viec[7]}, xong ${nd.xong[7]}` }), hash: 'viec', dat: locViec('mo'),
        giai: 'Việc chưa xong và chưa hủy, gồm cả việc chưa có hạn. Bấm để xem theo hạn.',
        ghi: sl.viec_qua_han ? `${sl.viec_qua_han} quá hạn` : 'không việc nào trễ' }),
      o({ ten: 'ai', nhan: 'Prompt 7 ngày', so: cl.prompt_7, hash: 'viec', dat: locViec('mo'),
        giai: 'Số prompt đã soạn cho Claude trong 7 ngày qua. Chỉ soạn khi bạn bấm Soạn prompt, mỗi lần bấm một lần gọi AI.' }),
      o({ ten: 'tep', nhan: 'Tệp 7 ngày', so: sl.tep_tuan, ss: soSanhKy(sl.tep_tuan, sl.tep_tuan_truoc, '7 ngày trước'), hash: 'tep', dat: () => { trang.tep.q = ''; },
        giai: 'Tệp đính kèm từ tin Zalo và thư được lưu vào kho trong 7 ngày qua, so với 7 ngày trước đó. Bấm để mở trang Tệp.' }),
    ),
  );
}

// Bảng theo dự án: chỉ các dự án có việc, quá hạn tô đỏ, bấm tên mở dự án.
function khoiDuAn(ds) {
  const co = (ds || []).filter((d) => d.mo || d.qua_han || d.sap_han || d.xong_7);
  const goc = h('section', { class: 'bang tq-du-an', 'aria-labelledby': 'tq-du-an' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-du-an' }, icon('du-an'), 'Theo dự án'), h('a', { class: 'lien-ket-nho', href: '#du-an' }, 'Tất cả dự án', icon('mui-ten'))));
  if (!co.length) {
    goc.append(h('p', { class: 'mo-ta dem-trong', text: 'Chưa dự án nào có việc. Xếp việc vào dự án ở trang Việc để theo dõi ở đây.' }));
    return goc;
  }
  const so = (n, lop) => h('td', { class: `so${n && lop ? ` ${lop}` : ''}`, text: n ? fmt.so.format(n) : '-' });
  goc.append(h('div', { class: 'bang-cuon', tabindex: '0', role: 'region', 'aria-label': 'Bảng việc theo dự án' },
    h('table', { class: 'bang-so' },
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col', text: 'Dự án' }),
        h('th', { scope: 'col', class: 'so', ...meo('Việc chưa xong trong dự án.') }, 'Đang mở'),
        h('th', { scope: 'col', class: 'so', ...meo('Việc còn mở có hạn trước hôm nay.') }, 'Quá hạn'),
        h('th', { scope: 'col', class: 'so', ...meo('Việc còn mở có hạn từ hôm nay đến 7 ngày tới.') }, 'Hạn 7 ngày'),
        h('th', { scope: 'col', class: 'so', ...meo('Việc bấm xong trong 7 ngày qua.') }, 'Xong 7 ngày'))),
      h('tbody', {}, ...co.slice(0, 8).map((d) => h('tr', {},
        h('th', { scope: 'row' }, h('a', { href: `#du-an/${d.id}` }, h('i', { class: 'cham-mau', style: d.mau ? `background:${d.mau}` : '' }), h('span', { text: d.ten }))),
        so(d.mo), so(d.qua_han, 'do'), so(d.sap_han, 'cam'), so(d.xong_7, 'tot'))))),
  ));
  return goc;
}

// Tổng hợp của AI: hiện vài dòng đầu, bấm "Xem đầy đủ" để mở hết.
function khoiTongHop() {
  const khung = h('div', { class: 'tong-hop-noi-dung', 'aria-live': 'polite' });
  const nut = h('button', { class: 'nut nut-phu', type: 'button' }, icon('ai'), h('span', { text: 'Tổng hợp lại' }));
  const ve = (cuoi) => {
    if (!cuoi) return thay(khung, h('p', { class: 'mo-ta', text: 'Bấm "Tổng hợp lại" để AI đọc việc, tin 48 giờ qua, hồ sơ và ghi nhớ rồi viết: làm gì trước, rủi ro, ai đang chờ.' }));
    const vb = h('pre', { class: 'van-ban-tong-hop thu-gon', id: 'tq-th-vb', text: cuoi.noi_dung });
    const mo = h('button', { class: 'lien-ket-nho nut-mo-rong', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'tq-th-vb', text: 'Xem đầy đủ' });
    mo.addEventListener('click', () => {
      const dong = vb.classList.toggle('thu-gon');
      mo.textContent = dong ? 'Xem đầy đủ' : 'Thu gọn';
      mo.setAttribute('aria-expanded', String(!dong));
    });
    thay(khung, h('p', { class: 'mo-ta', text: `Viết lúc ${luc(cuoi.luc)}` }), vb, mo);
  };
  nut.addEventListener('click', async () => {
    nut.disabled = true;
    thay(khung, xuong(14, '70%'), xuong(14, '90%'), xuong(14, '60%'));
    try { ve((await api('/api/tong-hop', { method: 'POST' })).cuoi); } catch (e) { bao(e.message, { loi: true }); ve(null); }
    nut.disabled = false;
  });
  thay(khung, xuong(14, '70%'), xuong(14, '90%'));
  api('/api/tong-hop').then((r) => ve(r.cuoi)).catch(() => ve(null));
  return h('section', { class: 'bang tong-hop', 'aria-labelledby': 'tq-th' }, h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-th' }, icon('ai'), 'Tổng hợp của AI'), nut), khung);
}

// Các bộ phận: thu gọn thành một dòng, tự mở khi có bộ phận lỗi.
function khoiHeThong(tp, tacVu, on, tong) {
  const loi = tp.some((p) => p.den === 'do');
  return h('details', { class: 'bang bang-suc-khoe', ...(loi ? { open: '' } : {}) },
    h('summary', { class: 'bang-dau' }, h('h2', {}, icon('he-thong'), 'Các bộ phận'), h('span', { class: 'mo-ta', text: `${on}/${tong} ổn${loi ? ', có bộ phận lỗi' : ''}. Bấm để ${loi ? 'thu gọn' : 'xem chi tiết'}` })),
    h('div', { class: 'luoi-tp' }, ...tp.map((p) =>
      h('div', { class: 'tp' },
        h('span', { class: 'tp-icon', dataset: { den: p.den }, role: 'img', 'aria-label': `${p.ten}: ${TEN_DEN[p.den]}` }, icon(ICON_TP[p.ma] || 'he-thong')),
        h('div', {}, h('strong', { text: p.ten }), h('span', { text: p.mo_ta })),
      ))),
    h('div', { class: 'bang-cuon', tabindex: '0', role: 'region', 'aria-label': 'Bảng tác vụ' }, bangTacVu(tacVu)),
    h('p', { class: 'tp-chan' }, h('a', { class: 'lien-ket-nho', href: '#ket-noi' }, 'Cài kết nối', icon('mui-ten'))),
  );
}

// Tinh chỉnh: bật tắt từng khối và đổi thứ tự, lưu theo người dùng.
export function moTinhChinh(boCuc) {
  const thuTu = [...boCuc.thu_tu];
  const an = new Set(boCuc.an);
  const hop = h('dialog', { class: 'khung-claude khung-tinh-chinh', 'aria-labelledby': 'tc-tieu-de' });
  const dong = () => hop.close();
  hop.addEventListener('close', () => hop.remove());
  hop.addEventListener('click', (e) => { if (e.target === hop) dong(); });
  const ds = h('ol', { class: 'ds-tinh-chinh' });
  const veDs = (giuNut) => {
    thay(ds, thuTu.map((k, i) => h('li', {},
      h('label', {},
        h('input', { type: 'checkbox', ...(an.has(k) ? {} : { checked: '' }), onchange: (e) => { if (e.target.checked) an.delete(k); else an.add(k); } }),
        h('span', { text: KHOI_TQ[k].ten })),
      h('button', { class: 'nut-doi', type: 'button', 'aria-label': `Đưa ${KHOI_TQ[k].ten} lên`, disabled: i === 0 ? '' : null, dataset: { k, huong: 'len' }, onclick: () => doi(i, -1, 'len') }, '↑'),
      h('button', { class: 'nut-doi', type: 'button', 'aria-label': `Đưa ${KHOI_TQ[k].ten} xuống`, disabled: i === thuTu.length - 1 ? '' : null, dataset: { k, huong: 'xuong' }, onclick: () => doi(i, 1, 'xuong') }, '↓'),
    )));
    if (giuNut) ds.querySelector(`[data-k="${giuNut.k}"][data-huong="${giuNut.huong}"]:not([disabled])`)?.focus();
  };
  const doi = (i, d, huong) => {
    const j = i + d;
    if (j < 0 || j >= thuTu.length) return;
    [thuTu[i], thuTu[j]] = [thuTu[j], thuTu[i]];
    veDs({ k: thuTu[j], huong });
  };
  const luu = async (bc) => {
    try {
      await api('/api/tong-quan/bo-cuc', { method: 'PUT', body: JSON.stringify(bc) });
      bao('Đã lưu cách sắp xếp Tổng quan.');
      dong();
      moMuc();
    } catch (e) { bao(e.message, { loi: true }); }
  };
  const form = h('form', { method: 'dialog' },
    h('header', { class: 'kc-dau' },
      h('h2', { id: 'tc-tieu-de' }, icon('sua'), h('span', { text: 'Tinh chỉnh Tổng quan' })),
      h('button', { class: 'nut-dong', type: 'button', 'aria-label': 'Đóng', onclick: dong }, '×')),
    h('div', { class: 'kc-than' },
      h('p', { class: 'kc-ghi', text: 'Bỏ chọn để ẩn khối. Dùng mũi tên để đổi thứ tự. Chỉ áp dụng cho tài khoản của bạn.' }),
      ds),
    h('footer', { class: 'kc-chan' },
      h('button', { class: 'nut nut-phu', type: 'button', style: 'margin-right:auto', onclick: () => luu({}) }, 'Khôi phục mặc định'),
      h('button', { class: 'nut nut-phu', type: 'button', onclick: dong }, 'Hủy'),
      h('button', { class: 'nut nut-chinh', type: 'submit' }, 'Lưu')),
  );
  form.addEventListener('submit', (e) => { e.preventDefault(); luu({ thu_tu: thuTu, an: [...an] }); });
  hop.append(form);
  document.body.append(hop);
  veDs();
  hop.showModal();
}

export function tomTat(tp, sl) {
  const loi = tp.filter((p) => p.den === 'do');
  const cho = tp.filter((p) => p.den === 'vang');
  const chuaNoi = tp.filter((p) => p.den === 'xam').length;
  const phuViec = sl.viec_mo ? `Còn ${sl.viec_mo} việc mở${sl.viec_qua_han ? `, ${sl.viec_qua_han} việc quá hạn` : ''}.` : 'Không còn việc nào mở.';
  if (loi.length) return { den: 'do', cau: loi.length === 1 ? `${loi[0].ten} đang lỗi.` : `${loi.length} bộ phận đang lỗi.`, phu: `${loi.map((p) => `${p.ten}: ${p.mo_ta}`).join('. ')}. ${phuViec}` };
  if (sl.viec_qua_han) return { den: 'vang', cau: `${sl.viec_qua_han} việc đã quá hạn.`, phu: `Hệ thống chạy ổn. ${phuViec}` };
  if (cho.length) return { den: 'vang', cau: cho.length === 1 ? `${cho[0].ten} chưa nhận dữ liệu lần nào.` : `${cho.length} bộ phận chưa nhận dữ liệu lần nào.`, phu: `${cho.map((p) => p.mo_ta).join('. ')}. ${chuaNoi ? `${chuaNoi} kết nối chưa cài.` : ''}` };
  return { den: 'xanh', cau: sl.viec_hom_nay ? `Hôm nay có ${sl.viec_hom_nay} việc tới hạn.` : 'Mọi thứ đang chạy êm.', phu: `${phuViec}${chuaNoi ? ` ${chuaNoi} kết nối chưa cài.` : ''}` };
}

function dongNho(ds, nhan = `Số tin 7 ngày qua: ${ds.join(', ')}`) {
  const max = Math.max(1, ...ds);
  const W = 92;
  const H = 34;
  const diem = ds.map((v, i) => [(i / (ds.length - 1)) * (W - 4) + 2, H - 3 - (v / max) * (H - 8)]);
  const d = diem.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return s('svg', { class: 'dong-nho', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': nhan },
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
  const khung = h('div', { class: 'song-ve', role: 'img', 'aria-label': `Hôm nay: ${tongTin} tin đến, ${tongViec} việc mới, ${tongChay} lượt chạy tự động, ${tongLoi} lượt lỗi. Bấm vào một cột giờ để xem tin của giờ đó.` }, ve, goiY);
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
  // Bấm vào một cột giờ: mở Hộp tin, chỉ các tin đến trong giờ đó.
  ve.addEventListener('click', (e) => {
    const vung = e.target.closest('.vung-gio');
    if (!vung || Number(vung.dataset.gio) > gioNay) return;
    locTin('hom-nay', Number(vung.dataset.gio))();
    if (location.hash === '#hop-tin') moMuc(); else location.hash = 'hop-tin';
  });

  return h('div', { class: 'song' },
    h('div', { class: 'song-dau' }, h('h2', { text: 'Nhịp hôm nay' }), h('p', { class: 'song-so' },
      lienKet('hop-tin', locTin('hom-nay'), meo('Tin Zalo và thư nhận từ 0 giờ hôm nay. Bấm để xem.'), `${tongTin} tin đến`), ', ',
      lienKet('viec', locViec('mo'), meo('Việc tạo trong hôm nay, do AI tách từ tin hoặc bạn tự thêm. Bấm để mở trang Việc.'), `${tongViec} việc mới`), ', ',
      lienKet('nhat-ky', () => { S.locNhatKy = 'tat-ca'; }, meo('Số lần các tác vụ tự động chạy hôm nay: nhận thư, tách việc, đồng bộ Google, lưu kho, nhắc việc. Bấm để xem Nhật ký chạy.'), `${tongChay} lượt chạy`),
      tongLoi ? ', ' : null,
      tongLoi ? lienKet('nhat-ky', () => { S.locNhatKy = 'loi'; }, { class: 'so-loi', ...meo('Lượt chạy bị lỗi hôm nay. Bấm để xem lỗi và chạy lại.') }, `${tongLoi} lỗi`) : null)),
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

// Đề xuất soạn prompt: việc AI thấy Claude tự làm được. Không tự soạn, bạn bấm mới soạn.
function khoiDeXuatClaude(dx, hn) {
  const ds = dx?.viec || [];
  const tong = dx?.tong || 0;
  const giao = (cac) => moKhungSoanPrompt(cac, { h, api, bao, icon, sauKhiSoan: () => moMuc() });
  const goc = h('section', { class: 'bang de-xuat-claude', 'aria-labelledby': 'tq-de-xuat' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-de-xuat' }, icon('ai'), 'Đề xuất soạn prompt'),
      ds.length > 1
        ? h('button', { class: 'nut nut-phu nut-nho', type: 'button', ...meo('Soạn một prompt cho các việc đang hiện để dán sang Claude khác.'), onclick: () => giao(ds) }, icon('ai'), `Soạn cho cả ${ds.length} việc`)
        : h('span', { class: 'mo-ta', text: ds.length ? 'Bấm Soạn prompt cho việc cần' : 'Chưa có đề xuất' })),
  );
  if (!ds.length) {
    goc.append(h('p', { class: 'mo-ta', style: 'padding:0 20px 18px', text: 'Khi AI tách việc từ tin nhắn và thấy Claude tự làm được (soạn nháp, tra cứu, tóm tắt), việc đó hiện ở đây. Sonicplan không tự làm: bạn bấm Soạn prompt, copy rồi dán sang Claude khác.' }));
    return goc;
  }
  const ul = h('ul', { class: 'dong-thoi-gian' });
  for (const v of ds) {
    const dong = h('div', { class: 'muc-viec' },
      h('button', { class: 'ten-viec', type: 'button', text: v.tieu_de, onclick: () => moNganViec(v) }),
      h('span', { class: 'de-xuat-nut' },
        v.han_ngay ? nhanNgay(v.han_ngay < hn ? 'qua' : v.han_ngay, hn) : null,
        h('button', { class: 'nut nut-phu nut-nho', type: 'button', 'aria-label': `Soạn prompt: ${v.tieu_de}`, onclick: () => giao([v]) }, icon('ai'), 'Soạn prompt'),
        h('button', { class: 'nut nut-phu nut-nho', type: 'button', 'aria-label': `Để tôi tự làm: ${v.tieu_de}`, ...meo('Bỏ khỏi đề xuất, việc vẫn ở trang Việc như việc bạn tự làm.'), onclick: () => suaNhanh(v, { nhom: 'anh_tu_lam' }, `Đã bỏ khỏi đề xuất: ${v.tieu_de}`) }, 'Để tôi làm')),
    );
    dong._viec = v;
    dong._td = async () => ({ muc: await mucTrinhDonViec(v), nhan: `Thao tác với việc: ${v.tieu_de}` });
    ul.append(h('li', {}, dong));
  }
  goc.append(ul);
  if (tong > ds.length) goc.append(h('p', { class: 'mo-ta', style: 'padding:0 20px 14px', text: `Còn ${tong - ds.length} việc đề xuất khác, xem ở trang Việc.` }));
  return goc;
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
  dong._td = async () => ({ muc: await mucTrinhDonViec(v), nhan: `Thao tác với việc: ${v.tieu_de}` });
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

export async function mucTrinhDonViec(v) {
  if (!S.duAnDs.length) { try { S.duAnDs = (await api('/api/du-an')).du_an || []; } catch {} }
  const xong = v.trang_thai === 'xong';
  const hn = homNay();
  const han = (n) => congNgay(hn, n);
  const hanMuc = (nhan, ngay) => ({ nhan, chon: (v.han_ngay || null) === ngay, lam: () => suaNhanh(v, { han_ngay: ngay }, ngay ? `Đã đổi hạn sang ${nhan.toLowerCase()}.` : 'Đã bỏ hạn.') });
  const coTin = Boolean(v.tin_nhan_id);
  const muc = [
    { nhan: 'Mở chi tiết', lam: () => moNganViec(v) },
    ...(xong ? [] : [{ nhan: 'Soạn prompt cho Claude', lam: () => soanPromptNhanh([v]) }]),
    xong ? { nhan: 'Mở lại việc', lam: () => doiXong(v, false) } : { nhan: 'Đánh dấu xong', lam: () => doiXong(v, true) },
    { nhan: v.sao ? 'Bỏ sao' : 'Gắn sao', lam: () => saoViec(v, !v.sao) },
  ];
  if (!xong) {
    muc.push(
      { vach: true },
      { tieuDe: 'Đổi hạn' },
      hanMuc('Hôm nay', hn), hanMuc('Ngày mai', han(1)), hanMuc('Tuần sau', han(7)), hanMuc('Bỏ hạn', null),
      { nhan: 'Chuyển dự án', con: [
        { nhan: 'Chưa xếp dự án', chon: !v.du_an_id, lam: () => suaNhanh(v, { du_an_id: null }, 'Đã gỡ khỏi dự án.') },
        ...S.duAnDs.map((d) => ({ nhan: d.ten, chon: v.du_an_id === d.id, lam: () => suaNhanh(v, { du_an_id: d.id }, `Đã chuyển sang ${d.ten}.`) })),
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
    muc.push({ vach: true }, { nhan: 'Hủy việc', nguy: true, lam: () => huyViec(v) });
  }
  return muc;
}
export async function moTrinhDonViec(v, x, y) {
  moTrinhDon({ x, y, muc: await mucTrinhDonViec(v), nhan: `Thao tác với việc: ${v.tieu_de}` });
}

// Làm mới êm: vẽ lại dữ liệu ngay tại chỗ, không hiện khung xương và không chạy lại hiệu ứng vào trang.
let lamMoiEm = false;
async function moMucEm() {
  lamMoiEm = true;
  try { await moMuc(); } finally { lamMoiEm = false; }
}
const dangOTrangViec = () => (location.hash.slice(1) || 'viec').split('/')[0] === 'viec';
function napSauKhiDoi() { return dangOTrangViec() ? S.napLaiViec() : moMucEm(); }
export const itChuyenDong = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Dòng việc mờ dần rồi thu chiều cao về 0, các dòng dưới trượt lên; trả về hàm gỡ hiệu ứng nếu cần hoàn lại.
function rutGon(el) {
  if (!el?.isConnected || itChuyenDong()) return { xong: Promise.resolve(), hoan: () => {} };
  const cs = getComputedStyle(el);
  const khoang = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
  const cu = el.getAttribute('style');
  el.style.boxSizing = 'border-box';
  el.style.height = `${el.offsetHeight}px`;
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.transition = 'height .3s var(--em), opacity .22s, padding .3s var(--em), margin .3s var(--em), border-width .3s';
  void el.offsetHeight;
  Object.assign(el.style, { height: '0px', opacity: '0', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', marginBottom: `${-khoang}px` });
  if (cs.display === 'grid') el.style.minHeight = '0';
  return {
    xong: new Promise((r) => setTimeout(r, 320)),
    hoan: () => { if (cu == null) el.removeAttribute('style'); else el.setAttribute('style', cu); },
  };
}
const timDongViec = (id) => [...document.querySelectorAll('.the-viec, .muc-viec')].find((e) => e._viec?.id === id);

// Cập nhật lạc quan: ô tick và dòng việc đổi ngay, API chạy ngầm, lỗi thì hoàn lại.
export async function doiXong(v, xong, el) {
  const rut = el ? rutGon(el) : null;
  el?.classList.add('dang-xong');
  try {
    await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: xong ? 'xong' : 'mo' }) });
    bao(xong ? `Đã xong: ${v.tieu_de}` : 'Đã mở lại việc.', { hanhDong: xong ? { nhan: 'Hoàn tác', lam: () => doiXong(v, false) } : null });
    await rut?.xong;
    await napSauKhiDoi();
  } catch (e) {
    rut?.hoan();
    el?.classList.remove('dang-xong');
    const o = el?.querySelector('.o-xong');
    if (o) o.checked = !xong;
    bao(e.message, { loi: true });
  }
}

// Hủy việc (xóa khỏi danh sách) cũng thu dòng mượt rồi mới làm mới.
export async function huyViec(v) {
  const rut = rutGon(timDongViec(v.id));
  try {
    await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'huy' }) });
    // Việc do AI tách: cho ghi lý do hủy ngay sau đó để AI học (không bắt buộc).
    const ghiLyDo = v.nguon && v.nguon !== 'tay' ? async () => {
      const lyDo = window.prompt('Vì sao hủy việc này? Ví dụ: chuyện riêng, không phải việc của tôi, trùng việc khác.');
      if (!lyDo || !lyDo.trim()) return;
      try { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'huy', ly_do: lyDo.trim() }) }); bao('Đã ghi lý do. AI sẽ học từ đây.'); } catch (e) { bao(e.message, { loi: true }); }
    } : null;
    bao(`Đã hủy: ${v.tieu_de}`, { hanhDong2: ghiLyDo ? { nhan: 'Ghi lý do', lam: ghiLyDo } : null, hanhDong: { nhan: 'Hoàn tác', lam: async () => { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'mo' }) }); await napSauKhiDoi(); } } });
    await rut.xong;
  } catch (e) {
    rut.hoan();
    bao(e.message, { loi: true });
  }
  await napSauKhiDoi();
}

// Biểu tượng nguồn tin; cuộc họp (ghi âm, biên bản) đứng tên cuộc họp thay cho người gửi.
// Các nguồn tin của Hộp tin. Thêm nguồn mới: thêm một dòng ở đây (tên, biểu tượng), màu ở .huy-hieu.<mã> trong kieu.css.
export const NGUON_TIN = { zalo: { ten: 'Zalo', icon: 'zalo' }, gmail: { ten: 'Thư', icon: 'thu' }, hop: { ten: 'Họp', icon: 'ghi-am' } };
export const iconNguon = (nguon) => icon(NGUON_TIN[nguon]?.icon || 'thu');
export const tenGuiTin = (t) => (t.nguon === 'hop' ? t.tieu_de || 'Cuộc họp' : t.nguoi_gui || 'Không rõ');
export const dongPhuTin = (t) => (t.nguon === 'hop' ? 'Cuộc họp' : t.nhom ? tenNhom(t.nhom) : t.tieu_de);

function bangTinMoi(ds) {
  const goc = h('section', { class: 'bang bang-tin-moi', 'aria-labelledby': 'tq-tin' },
    h('div', { class: 'bang-dau' }, h('h2', { id: 'tq-tin' }, icon('hop-tin'), 'Tin mới'), h('a', { class: 'lien-ket-nho', href: '#hop-tin' }, 'Mở hộp tin', icon('mui-ten'))),
  );
  if (!ds.length) {
    goc.append(h('div', { class: 'trong-trai', style: 'min-height:220px' }, icon('hop-tin'), h('h3', { text: 'Hộp tin còn trống' }), h('p', { text: 'Nối Zalo và Google ở trang Kết nối để tin bắt đầu về.' })));
    return goc;
  }
  goc.append(h('ul', { class: 'ds-tin-ngan' }, ...ds.map((t) =>
    h('li', { class: t.da_xem ? '' : 'chua-xem' },
      h('a', { href: `#hop-tin/${t.id}` },
        h('span', { class: `huy-hieu ${t.nguon}` }, iconNguon(t.nguon)),
        h('div', { style: 'min-width:0' },
          h('div', { class: 'dong-1' }, h('strong', { text: tenGuiTin(t) }), h('span', { text: t.nguon === 'hop' ? 'Cuộc họp' : t.nhom || t.tieu_de || '' })),
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
