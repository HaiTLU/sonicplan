// Giao diện Sonicplan, Mục Việc, trình đơn chuột phải và ngăn sửa việc.
import { anhDuAn, boAnh, chonVaTaiAnh, oChonIcon } from '../anh-du-an.js';
import { CHU_TRANG_THAI, dungKhoiClaude, moKhungGiaoClaude, veKhoiClaude } from '../claude.js';
import { batKeoTha } from '../keo-tha.js';
import { hexMau, mauViec, oChonMau } from '../mau.js';
import { dongTrinhDon, moTrinhDon } from '../trinh-don.js';
import { NHOM, S, api, bao, capNhatDem, congNgay, h, homNay, icon, khungLoi, luc, meo, ngayHienThi, thay, trang, xuong } from './chung.js';
import { luuTuyChonViec } from './tuy-chon-viec.js';
import { moBangLenh } from './bang-lenh.js';
import { moMuc } from './dieu-huong.js';
import { doiXong, huyViec, moTinhChinh, moTrinhDonViec, mucTrinhDonViec } from './tong-quan.js';

// =====================================================================
// Việc
// =====================================================================
let cacViec = new Map();
let homNayCuaViec = '';

// Nhãn nguồn của việc: Zalo kèm tên nhóm hoặc người, Gmail kèm người gửi, Telegram, Tự thêm.
function nhanNguon(v) {
  const ma = v.nguon || v.tin_nguon || 'tay';
  const ai = (v.tin_nhom || v.tin_nguoi_gui || '').split('<')[0].trim();
  if (ma === 'zalo') return { ma, icon: 'zalo', chu: ai ? `Zalo · ${ai}` : 'Zalo' };
  if (ma === 'gmail') return { ma, icon: 'thu', chu: ai ? `Gmail · ${ai}` : 'Gmail' };
  if (ma === 'hop') return { ma, icon: 'ghi-am', chu: 'Cuộc họp' };
  if (ma === 'telegram') return { ma, icon: 'telegram', chu: 'Telegram' };
  if (ma === 'api') return { ma, icon: 'ai', chu: 'Dịch vụ ngoài' };
  return { ma: 'tay', icon: 'cong', chu: 'Tự thêm' };
}

export async function veViec(goc) {
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
  const chon = (khoa, nhan, ds) => h('label', { class: 'chon-loc' }, h('span', { text: nhan }), h('select', { 'aria-label': nhan, onchange: (e) => { v[khoa] = e.target.value; luuTuyChonViec(v); napViec(); } }, ...ds.map(([ma, ten]) => h('option', { value: ma, selected: v[khoa] === ma, text: ten }))));
  // Bộ lọc phụ gom vào nút "Lọc" kèm số bộ lọc đang bật; máy tính mở sẵn, điện thoại gập sẵn trừ khi đang lọc.
  const soLoc = ['nguon', 'han', 'nang'].filter((k) => v[k] && v[k] !== 'tat-ca').length + (v.chiSao ? 1 : 0);
  if (v.moLoc === undefined) v.moLoc = !window.matchMedia?.('(max-width: 860px)').matches;
  const boLoc = (noiDung) => {
    const d = h('details', { class: 'bo-loc-viec', ...(v.moLoc || soLoc ? { open: true } : {}) },
      h('summary', {}, icon('tim'), soLoc ? `Lọc (${soLoc})` : 'Lọc'), noiDung);
    d.addEventListener('toggle', () => { v.moLoc = d.open; });
    return d;
  };
  const locKhac = v.tab === 'mo' ? boLoc(h('div', { class: 'thanh-loc loc-khac', 'aria-label': 'Bộ lọc việc' },
    chon('nguon', 'Nguồn', [['tat-ca', 'Tất cả'], ['zalo', 'Zalo'], ['gmail', 'Gmail'], ['hop', 'Cuộc họp'], ['tay', 'Tự thêm']]),
    chon('han', 'Hạn', [['tat-ca', 'Tất cả'], ['qua-han', 'Quá hạn'], ['hom-nay', 'Hôm nay'], ['tuan', 'Tuần này'], ['khong', 'Chưa có hạn']]),
    chon('nang', 'Độ nặng', [['tat-ca', 'Tất cả'], ['nhe', 'Nhẹ'], ['vua', 'Vừa'], ['nang', 'Nặng'], ['rat_nang', 'Rất nặng']]),
    h('button', { class: 'chip chip-sao', type: 'button', 'aria-pressed': String(v.chiSao), onclick: () => { v.chiSao = !v.chiSao; luuTuyChonViec(v); veViec(goc); } }, icon('sao'), 'Có sao'),
  )) : null;
  const xem = (ma, nhan) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.xem === ma), onclick: () => { v.xem = ma; luuTuyChonViec(v); veViec(goc); } }, nhan);
  thay(goc, form, h('div', { class: 'thanh-loc' }, tab('mo', 'Đang mở'), tab('xong', 'Đã xong'), v.tab === 'mo' ? h('span', { class: 'gian' }) : null, v.tab === 'mo' ? xem('han', 'Theo hạn') : null, v.tab === 'mo' ? xem('du-an', 'Theo dự án') : null, v.tab === 'mo' && v.xem === 'du-an' ? h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.anTrong), title: 'Ẩn các cột dự án chưa có việc', onclick: () => { v.anTrong = !v.anTrong; luuTuyChonViec(v); napViec(); } }, 'Ẩn cột trống') : null), locDuAn, locKhac, vung);
  batKeoTha(vung, { khiTha: (d) => khiThaViec(d, v, napViec), nhanDuoc: (ma) => ma !== 'qua-han' && v.tab === 'mo',
    khiThaCot: async (ids) => {
      try { await api('/api/du-an/sap-xep', { method: 'POST', body: JSON.stringify({ ids }) }); bao('Đã lưu thứ tự dự án.'); } catch (err) { bao(err.message, { loi: true }); }
      napViec();
    } });

  // Tạo dự án ngay trên trang Việc: bấm "+ Dự án", gõ tên, Enter. Dự án mới được chọn sẵn để thêm việc vào.
  function nutThemDuAn() {
    const o = h('input', { type: 'text', class: 'o-du-an-moi', placeholder: 'Tên dự án mới', maxlength: '80', autocomplete: 'off', 'aria-label': 'Tên dự án mới' });
    const dong = () => { form.hidden = true; nut.hidden = false; o.value = ''; };
    const nut = h('button', { class: 'chip chip-them-du-an', type: 'button', onclick: () => { nut.hidden = true; form.hidden = false; o.focus(); } }, icon('cong'), 'Dự án');
    const form = h('form', { class: 'them-du-an-nhanh', hidden: true },
      o,
      h('button', { class: 'chip', type: 'submit' }, 'Tạo'),
      h('button', { class: 'chip', type: 'button', onclick: dong }, 'Hủy'));
    o.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') dong(); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const ten = o.value.trim();
      if (!ten) { o.focus(); return; }
      try {
        const r = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ten, luu_o: 'kho' }) });
        bao(r.drive_loi ? `Đã tạo dự án "${ten}". ${r.drive_loi}` : `Đã tạo dự án "${ten}".`, r.drive_loi ? { loi: true } : undefined);
        v.duAn = r.id;
        napViec();
      } catch (err) { bao(err.message, { loi: true }); }
    });
    return h('span', { class: 'them-du-an' }, nut, form);
  }

  function veLoc(viec) {
    const dem = (f) => viec.filter(f).length;
    const chip = (ma, nhan, so, mau, da) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v.duAn === ma), onclick: () => { v.duAn = ma; napViec(); } }, da && (da.icon || da.anh_khoa) ? anhDuAn(h, da, 'nho') : hexMau(mau) ? h('i', { class: 'cham-mau', style: `--mau:${hexMau(mau)}` }) : null, nhan, h('b', { text: String(so) }));
    const ds = S.duAnDs.filter((d) => viec.some((x) => x.du_an_id === d.id) || v.duAn === d.id);
    thay(locDuAn, chip('tat-ca', 'Tất cả dự án', viec.length), ...ds.map((d) => chip(d.id, d.ten, dem((x) => x.du_an_id === d.id), d.mau, d)), dem((x) => !x.du_an_id) ? chip('khong', 'Chưa xếp dự án', dem((x) => !x.du_an_id)) : null, nutThemDuAn());
  }

  async function napViec() {
    try {
      const [{ viec: tatCa, hom_nay: hn }, dsDa] = await Promise.all([api(`/api/viec?trang_thai=${v.tab}`), api('/api/du-an').catch(() => ({ du_an: [] }))]);
      S.duAnDs = dsDa.du_an;
      if (v.tab === 'mo') capNhatDem(null, tatCa.length);
      veLoc(tatCa);
      const hn2 = hn;
      const hanKhop = { 'qua-han': (x) => x.han_ngay && x.han_ngay < hn2, 'hom-nay': (x) => x.han_ngay === hn2, tuan: (x) => x.han_ngay && x.han_ngay >= hn2 && x.han_ngay <= congNgay(hn2, 7), khong: (x) => !x.han_ngay }[v.han];
      const viec = tatCa.filter((x) => (v.duAn === 'tat-ca' || (v.duAn === 'khong' ? !x.du_an_id : x.du_an_id === v.duAn))
        && (v.tab !== 'mo' || ((v.nguon === 'tat-ca' || nhanNguon(x).ma === v.nguon) && (!hanKhop || hanKhop(x)) && (v.nang === 'tat-ca' || x.do_nang === v.nang) && (!v.chiSao || x.sao))));
      cacViec = new Map(tatCa.map((x) => [x.id, x]));
      homNayCuaViec = hn;
      thay(vung, ...(v.tab === 'mo' ? (v.xem === 'du-an' ? cotTheoDuAn(viec, hn) : cotTheoHan(viec, hn)) : [cotXong(viec)]));
    } catch (e) {
      thay(vung, khungLoi(e, napViec));
    }
  }
  S.napLaiViec = napViec;
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

// Nút Claude ở đầu cột dự án: giao các việc đang mở của dự án (gộp một lượt hoặc từng việc).
function nutClaudeCot(c) {
  const mo = c.ds.filter((x) => x.trang_thai === 'mo' && !['cho', 'dang_lam'].includes(x.claude_trang_thai));
  if (!c.id || !mo.length) return null;
  return h('button', { class: 'nut-claude-cot', type: 'button', 'aria-label': `Giao Claude cả dự án ${c.ten} (${mo.length} việc)`, ...meo(`Giao Claude làm ${mo.length} việc đang mở của dự án, gộp một lượt hoặc từng việc.`), onclick: () => giaoClaudeNhanh(mo, c.ten) }, icon('ai'));
}

function cotTheoDuAn(ds, hn) {
  const cot = [...S.duAnDs.map((d) => ({ ma: `da-${d.id}`, id: d.id, sao: d.sao, drive_link: d.drive_link, drive_kho_id: d.drive_kho_id, ten: d.ten, mau: d.mau, icon: d.icon, anh_khoa: d.anh_khoa, loc: (x) => x.du_an_id === d.id })), { ma: 'da-khong', ten: 'Chưa xếp dự án', loc: (x) => !x.du_an_id }];
  return cot.map((c) => ({ ...c, ds: ds.filter(c.loc) })).filter((c) => !(trang.viec.anTrong && !c.ds.length && c.ma !== 'da-khong')).map((c) => {
    const muc = () => (c.id ? mucTrinhDonDuAn(c, { ds: c.ds, cot: true }) : [{ nhan: 'Thêm việc chưa xếp dự án', lam: () => moNganViec(null) }]);
    const baCham = h('button', { class: 'nut-ba-cham nut-menu-cot', type: 'button', 'aria-label': `Thao tác với ${c.ten}`, 'aria-haspopup': 'menu', title: 'Thao tác' }, icon('ba-cham'));
    baCham.addEventListener('click', (ev) => { ev.stopPropagation(); const r = baCham.getBoundingClientRect(); moTrinhDon({ x: r.left, y: r.bottom + 4, muc: muc(), nhan: `Thao tác với ${c.ten}` }); });
    const el = h('section', { class: `cot-viec${c.id && S.cotThu.has(c.id) ? ' thu-gon' : ''}`, dataset: { cot: c.ma }, 'aria-label': c.ten, ...(hexMau(c.mau) ? { style: `--mau:${hexMau(c.mau)}` } : {}) },
      h('header', {}, h('h2', {}, c.id ? anhDuAn(h, c, 'nho') : null, c.ten), h('span', { class: 'dau-cot' }, nutClaudeCot(c), c.id ? nutSao(Boolean(c.sao), `dự án ${c.ten}`, () => saoDuAn(c.id, !c.sao)) : null, h('span', { text: String(c.ds.length) }), baCham)),
      c.ds.length ? h('ul', {}, ...c.ds.map((x) => theViec(x, hn))) : h('p', { class: 'cot-trong', text: 'Kéo việc vào đây.' }),
    );
    el._td = () => ({ muc: muc(), nhan: `Thao tác với ${c.ten}` });
    return el;
  });
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
    const ten = { 'hom-nay': 'Hôm nay', 'ngay-mai': 'Ngày mai', tuan: '7 ngày tới', sau: 'Sau đó', khong: 'Chưa có hạn' }[denCot] || S.duAnDs.find((d) => `da-${d.id}` === denCot)?.ten || 'Chưa xếp dự án';
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

function nutSao(bat, ten, khiBam) {
  const n = h('button', { class: `nut-sao${bat ? ' co-sao' : ''}`, type: 'button', 'aria-pressed': String(bat), 'aria-label': `${bat ? 'Bỏ sao' : 'Gắn sao'} ${ten}`, title: bat ? 'Bỏ sao' : 'Gắn sao' }, icon('sao'));
  n.addEventListener('click', (ev) => { ev.stopPropagation(); khiBam(); });
  return n;
}
async function saoDuAn(id, bat) {
  try { await api(`/api/du-an/${id}`, { method: 'PATCH', body: JSON.stringify({ sao: bat }) }); } catch (e) { bao(e.message, { loi: true }); }
  S.napLaiViec();
}
export async function saoViec(v, bat) {
  try { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ sao: bat }) }); } catch (e) { bao(e.message, { loi: true }); }
  S.napLaiViec();
}

// Nút Claude trên thẻ: chưa giao thì mở khung giao; đã giao thì nhãn trạng thái mở chi tiết để xem kết quả hoặc trả lời câu hỏi.
// ---------- Trình đơn chuột phải cho mọi đối tượng ----------
export const chepChu = (van, loiNhan = 'Đã chép.') => navigator.clipboard?.writeText(van).then(() => bao(loiNhan), () => bao('Trình duyệt chặn chép.', { loi: true }));
try { S.cotThu = new Set(JSON.parse(localStorage.getItem('sp.cot.thu') || '[]')); } catch {}
function datThuGon(id, bat) {
  if (bat) S.cotThu.add(id); else S.cotThu.delete(id);
  try { localStorage.setItem('sp.cot.thu', JSON.stringify([...S.cotThu])); } catch {}
  S.napLaiViec();
}
async function suaDuAnNhanh(d, thanThay, loiNhan) {
  try {
    await api(`/api/du-an/${d.id}`, { method: 'PATCH', body: JSON.stringify(thanThay) });
    if (loiNhan) bao(loiNhan);
  } catch (e) { bao(e.message, { loi: true }); }
  moMuc();
}
// Lưu mọi thứ của dự án vào thư mục Drive riêng: bật (tự tạo thư mục), lưu lại toàn bộ, tắt.
export async function driveDuAn(d, kieu) {
  try {
    if (kieu === 'bat') {
      bao('Đang tạo thư mục Drive cho dự án…');
      const r = await api(`/api/du-an/${d.id}/drive-kho`, { method: 'POST' });
      bao('Đã bật lưu dự án vào Drive. Thư, tin Zalo, tệp, kết quả Claude, lịch và lịch sử sẽ về thư mục trong vài phút.', { hanhDong: { nhan: 'Mở thư mục', lam: () => window.open(r.link, '_blank', 'noopener') } });
    } else if (kieu === 'dong-bo') {
      bao('Đang lưu lại toàn bộ vào Drive…');
      const r = await api(`/api/du-an/${d.id}/drive-kho/dong-bo`, { method: 'POST' });
      bao(r.so ? `Đã lưu ${r.so} mục vào Drive. Nếu dự án còn nhiều tệp, phần còn lại tự về trong các lượt sau.` : 'Đã kiểm, Drive đã đủ.');
    } else if (kieu === 'tat') {
      if (!confirm(`Tắt lưu "${d.ten}" vào Drive? Thư mục và tệp đã lưu vẫn còn nguyên trên Drive.`)) return;
      await api(`/api/du-an/${d.id}/drive-kho`, { method: 'DELETE' });
      bao('Đã tắt lưu vào Drive.');
    } else if (kieu === 'link') {
      const link = prompt('Dán link thư mục Drive có sẵn (chỉ để bấm mở; Sonicplan không ghi vào thư mục này)', d.drive_link || '');
      if (link === null) return;
      await api(`/api/du-an/${d.id}`, { method: 'PATCH', body: JSON.stringify({ drive_link: link }) });
      bao('Đã lưu link thư mục.');
    }
  } catch (e) { bao(e.message, { loi: true }); }
  moMuc();
}
export function mucTrinhDonDuAn(d, { ds = [], cot = false } = {}) {
  const moDs = ds.filter((x) => x.trang_thai === 'mo' && !['cho', 'dang_lam'].includes(x.claude_trang_thai));
  const thu = S.cotThu.has(d.id);
  return [
    { nhan: 'Thêm việc vào dự án', lam: () => moNganViec(null, { du_an_id: d.id }) },
    { nhan: 'Xem lịch sử dự án', lam: () => { location.hash = `du-an/${d.id}`; } },
    cot && moDs.length ? { nhan: `Giao Claude cả dự án (${moDs.length} việc)`, lam: () => giaoClaudeNhanh(moDs, d.ten) } : null,
    { nhan: d.sao ? 'Bỏ sao' : 'Gắn sao', lam: () => (cot ? saoDuAn(d.id, !d.sao) : suaDuAnNhanh(d, { sao: !d.sao }, d.sao ? 'Đã bỏ sao.' : 'Đã gắn sao.')) },
    cot ? { nhan: thu ? 'Mở rộng cột' : 'Thu gọn cột', lam: () => datThuGon(d.id, !thu) } : null,
    { vach: true },
    d.drive_link ? { nhan: 'Mở thư mục Drive', lam: () => window.open(d.drive_link, '_blank', 'noopener') } : null,
    d.drive_kho_id
      ? { nhan: 'Đồng bộ lại toàn bộ vào Drive', lam: () => driveDuAn(d, 'dong-bo') }
      : { nhan: 'Lưu dự án vào Drive (tự tạo thư mục)', lam: () => driveDuAn(d, 'bat') },
    { nhan: d.drive_link ? 'Đổi link thư mục Drive' : 'Dán link thư mục Drive có sẵn', lam: () => driveDuAn(d, 'link') },
    d.drive_kho_id ? { nhan: 'Tắt lưu vào Drive', lam: () => driveDuAn(d, 'tat') } : null,
    { vach: true },
    { nhan: 'Đổi tên', lam: () => { const ten = (prompt('Tên dự án', d.ten) || '').trim(); if (ten && ten !== d.ten) suaDuAnNhanh(d, { ten }, 'Đã đổi tên dự án.'); } },
    { nhan: 'Đổi biểu tượng', con: [{ node: oChonIcon(h, d.icon || null, (bt) => { dongTrinhDon(); suaDuAnNhanh(d, { icon: bt }, 'Đã đổi biểu tượng dự án.'); }, { nhan: `Biểu tượng của ${d.ten}` }) }] },
    { nhan: d.anh_khoa ? 'Đổi ảnh đại diện…' : 'Tải ảnh đại diện…', lam: () => chonVaTaiAnh(d, { bao, xong: () => moMuc() }) },
    d.anh_khoa ? { nhan: 'Gỡ ảnh đại diện', lam: async () => { try { await boAnh(d.id); bao('Đã gỡ ảnh.'); } catch (e) { bao(e.message, { loi: true }); } moMuc(); } } : null,
    { nhan: 'Đổi màu', con: [{ node: oChonMau(h, d.mau || null, (ma) => { dongTrinhDon(); suaDuAnNhanh(d, { mau: ma || null }, 'Đã đổi màu dự án.'); }, { nhan: `Màu của ${d.ten}` }) }] },
    { vach: true },
    { nhan: 'Gỡ dự án', nguy: true, lam: async () => {
      if (!confirm(`Gỡ dự án "${d.ten}"? Các việc vẫn còn, chỉ mất nhãn dự án.`)) return;
      try { await api(`/api/du-an/${d.id}`, { method: 'DELETE' }); bao('Đã gỡ dự án.'); } catch (e) { bao(e.message, { loi: true }); }
      moMuc();
    } },
  ];
}
export async function chanTuTin(tin) {
  if (!confirm('Chặn nguồn của tin này? Tin cũ của nguồn sẽ ẩn, việc chưa xong sinh từ đó sẽ gỡ, và AI không tạo việc từ nguồn này nữa. Bỏ chặn ở Hộp tin, mục Đã chặn.')) return;
  try {
    const kq = await api('/api/chan', { method: 'POST', body: JSON.stringify({ tin_id: tin.id }) });
    bao(`Đã chặn ${kq.nhan}. Ẩn ${kq.an_tin} tin${kq.go_viec ? `, gỡ ${kq.go_viec} việc chưa xong` : ''}.`);
  } catch (e) { bao(e.message, { loi: true }); }
  moMuc();
}
export function mucChung() {
  const o = [
    { nhan: 'Thêm việc', lam: () => moNganViec(null) },
    { nhan: 'Mở bảng lệnh (Ctrl K)', lam: () => moBangLenh() },
    { nhan: 'Tải lại dữ liệu trang', lam: () => { moMuc(); bao('Đã tải lại.'); } },
    { vach: true },
    { nhan: 'Đi tới', con: NHOM.map((n) => ({ nhan: n.ten, lam: () => { location.hash = n.con[0]; } })) },
  ];
  if ((location.hash.slice(1) || 'viec').split('/')[0] === 'tong-quan' && S.boCucTQ) o.push({ nhan: 'Tinh chỉnh Tổng quan', lam: () => moTinhChinh(S.boCucTQ) });
  return o;
}

export function giaoClaudeNhanh(ds, duAn = null) {
  moKhungGiaoClaude(ds, { h, api, bao, icon, duAn, sauKhiGiao: () => S.napLaiViec() });
}
function nutClaudeThe(v) {
  if (v.claude_trang_thai) {
    return h('button', { class: `nhan-claude ${v.claude_trang_thai}`, type: 'button', text: CHU_TRANG_THAI[v.claude_trang_thai], 'aria-label': `${CHU_TRANG_THAI[v.claude_trang_thai]}: ${v.tieu_de}. Mở để xem`, onclick: () => moNganViec(v) });
  }
  if (v.trang_thai !== 'mo') return null;
  if (v.claude_can_tep) return h('button', { class: 'nhan-claude giao can-tep', type: 'button', 'aria-label': `Cần thêm tệp rồi giao Claude: ${v.tieu_de}`, ...meo('Việc này thiếu tệp hoặc nội dung nên Claude chưa tự làm. Thêm tệp (hoặc dặn thêm) rồi bấm giao.'), onclick: () => giaoClaudeNhanh([v]) }, icon('ai'), 'Cần thêm tệp');
  return h('button', { class: 'nhan-claude giao', type: 'button', 'aria-label': `Giao Claude: ${v.tieu_de}`, ...meo('Giao việc này cho Claude Code làm. Claude hỏi lại nếu việc chưa rõ.'), onclick: () => giaoClaudeNhanh([v]) }, icon('ai'), 'Claude');
}

// Chip ngày giờ trên thẻ: "Thứ 2, 19/10 · 14:45"; bấm để sửa nhanh ngày và giờ, không cần mở cả ngăn sửa việc.
function chipHan(v, hn) {
  const mo = v.trang_thai === 'mo';
  if (!v.han_ngay && !mo) return null;
  const chu = v.han_ngay ? `${ngayHienThi(v.han_ngay)}${v.gio_hen ? ` · ${v.gio_hen}` : ''}` : 'Thêm ngày giờ';
  const lop = `${v.han_ngay && hn && v.han_ngay < hn ? 'tre' : ''}${v.han_ngay ? '' : ' chua-han'}${mo ? ' sua-han' : ''}`.trim();
  const chip = h('span', { class: lop, ...(mo ? { role: 'button', tabindex: '0', 'aria-label': `Sửa ngày giờ: ${v.tieu_de}`, title: 'Bấm để sửa ngày giờ' } : {}) }, icon(v.han_ngay ? 'lich' : 'dong-ho'), chu);
  if (mo) {
    chip.addEventListener('click', (ev) => { ev.stopPropagation(); moSuaHan(v, chip); });
    chip.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); moSuaHan(v, chip); } });
  }
  return chip;
}

let khungHan = null;
function dongSuaHan() {
  if (!khungHan) return;
  khungHan.remove();
  khungHan = null;
  document.removeEventListener('pointerdown', khiBamNgoaiHan, true);
  document.removeEventListener('keydown', khiPhimHan, true);
}
const khiBamNgoaiHan = (ev) => { if (khungHan && !khungHan.contains(ev.target)) dongSuaHan(); };
const khiPhimHan = (ev) => { if (ev.key === 'Escape') dongSuaHan(); };

function moSuaHan(v, neo) {
  dongSuaHan();
  const oNgay = h('input', { type: 'date', value: v.han_ngay || '', 'aria-label': 'Ngày hạn' });
  const oGio = h('input', { type: 'time', step: '300', value: v.gio_hen || '', 'aria-label': 'Giờ hẹn' });
  const loi = h('p', { class: 'loi-form', hidden: true });
  const luu = async (ngay, gio) => {
    // Có giờ mà chưa có ngày thì lấy hôm nay, để giờ không bị mồ côi.
    const sua = { han_ngay: ngay || (gio ? homNay() : null), gio_hen: ngay || gio ? gio || null : null };
    try {
      await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify(sua) });
      dongSuaHan();
      bao('Đã lưu ngày giờ.');
      moMuc();
    } catch (err) {
      loi.textContent = err.message;
      loi.hidden = false;
    }
  };
  const nhanh = [['Hôm nay', 0], ['Ngày mai', 1], ['Tuần sau', 7]].map(([ten, n]) => h('button', { type: 'button', text: ten, onclick: () => { oNgay.value = congNgay(homNay(), n); } }));
  khungHan = h('div', { class: 'trinh-don khung-han', role: 'dialog', 'aria-label': 'Sửa ngày giờ' },
    h('div', { class: 'hang-2' },
      h('label', { class: 'truong' }, h('span', { text: 'Ngày' }), oNgay),
      h('label', { class: 'truong' }, h('span', { text: 'Giờ' }), oGio),
    ),
    h('div', { class: 'chon-nhanh' }, ...nhanh),
    loi,
    h('div', { class: 'hang-nut' },
      h('button', { type: 'button', class: 'nut-phu', text: 'Bỏ ngày giờ', onclick: () => luu(null, null) }),
      h('button', { type: 'button', class: 'nut-chinh', text: 'Lưu', onclick: () => luu(oNgay.value || null, oGio.value || null) }),
    ),
  );
  document.body.append(khungHan);
  const r = neo.getBoundingClientRect();
  const rong = khungHan.offsetWidth;
  khungHan.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - rong - 8))}px`;
  khungHan.style.top = `${Math.min(r.bottom + 6, Math.max(8, window.innerHeight - khungHan.offsetHeight - 8))}px`;
  document.addEventListener('pointerdown', khiBamNgoaiHan, true);
  document.addEventListener('keydown', khiPhimHan, true);
  (v.han_ngay ? oGio : oNgay).focus();
}

function theViec(v, hn) {
  const o = h('input', { class: 'o-xong', type: 'checkbox', checked: v.trang_thai === 'xong', 'aria-label': `${v.trang_thai === 'xong' ? 'Mở lại' : 'Đánh dấu xong'}: ${v.tieu_de}` });
  const mau = mauViec(v);
  const baCham = h('button', { class: 'nut-ba-cham', type: 'button', 'aria-label': `Thao tác với việc: ${v.tieu_de}`, 'aria-haspopup': 'menu', title: 'Thao tác' }, icon('ba-cham'));
  baCham.addEventListener('click', (ev) => { ev.stopPropagation(); const r = baCham.getBoundingClientRect(); moTrinhDonViec(v, r.left, r.bottom + 4); });
  const the = h('li', { class: `the-viec${mau ? ' co-mau' : ''}${v.sao ? ' co-sao' : ''}`, dataset: { id: String(v.id) }, ...(mau ? { style: `--mau:${mau}` } : {}) },
    o,
    h('div', { style: 'min-width:0' },
      h('button', { class: 'ten-viec', type: 'button', text: v.tieu_de, onclick: () => moNganViec(v) }),
      v.ghi_chu ? h('p', { class: 'ghi', text: v.ghi_chu }) : null,
      h('div', { class: 'chan' },
        chipHan(v, hn),
        v.so_lan_doi ? h('span', { class: v.so_lan_doi >= 3 ? 'tre' : '', ...meo(`Việc tự dời sang ngày sau ${v.so_lan_doi} lần vì chưa xong cuối ngày. Hạn gốc ${v.han_goc ? ngayHienThi(v.han_goc) : 'không rõ'}. Sửa hạn để bỏ đếm.`) }, `Dời ${v.so_lan_doi} lần`) : null,
        h('span', { class: `nguon ${nhanNguon(v).ma}`, title: `Nguồn: ${v.tin_nhom || v.tin_nguoi_gui || nhanNguon(v).chu}` }, icon(nhanNguon(v).icon), nhanNguon(v).chu),
        v.du_an_ten ? h('a', { class: 'nhan-du-an', href: `#du-an/${v.du_an_id}`, title: 'Xem lịch sử dự án' }, v.du_an_icon || v.du_an_anh ? anhDuAn(h, v, 'nho') : icon('du-an'), v.du_an_ten) : h('span', { class: 'nhan-du-an chua', text: 'Chưa xếp dự án' }),
        v.xong_luc ? h('span', {}, `Xong ${luc(v.xong_luc)}`) : null,
        nutClaudeThe(v),
      ),
    ),
  );
  the.append(nutSao(Boolean(v.sao), `việc ${v.tieu_de}`, () => saoViec(v, !v.sao)), baCham);
  the._viec = v;
  the._td = async () => ({ muc: await mucTrinhDonViec(v), nhan: `Thao tác với việc: ${v.tieu_de}` });
  o.addEventListener('change', () => doiXong(v, o.checked, the));
  return the;
}

// Ngăn kéo thêm và sửa việc, dùng chung cho mọi trang.
const ngan = document.getElementById('ngan-viec');
const formViec = document.getElementById('form-viec');
// Kéo mép trái của ngăn để đổi độ rộng; nhớ trên trình duyệt này. Bấm đúp để về mặc định, phím mũi tên trái phải chỉnh từng bước.
const KHOA_RONG_NGAN = 'sp.ngan.rong';
const gioiHanRong = (px) => Math.round(Math.min(Math.max(px, 400), window.innerWidth * 0.95));
function datRongNgan(px) {
  if (px == null) ngan.style.removeProperty('--rong-ngan');
  else ngan.style.setProperty('--rong-ngan', `${gioiHanRong(px)}px`);
}
function nhoRongNgan() {
  try {
    const v = Number(ngan.style.getPropertyValue('--rong-ngan').replace('px', ''));
    if (v) localStorage.setItem(KHOA_RONG_NGAN, String(v)); else localStorage.removeItem(KHOA_RONG_NGAN);
  } catch { /* không lưu được thì thôi */ }
}
try { const da = Number(localStorage.getItem(KHOA_RONG_NGAN)); if (da) datRongNgan(da); } catch { /* chặn lưu trữ */ }
const tayKeo = h('div', { class: 'tay-keo-ngan', role: 'separator', 'aria-orientation': 'vertical', tabindex: '0', title: 'Kéo để đổi độ rộng, bấm đúp để về mặc định', 'aria-label': 'Đổi độ rộng ngăn' });
tayKeo.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  tayKeo.setPointerCapture(e.pointerId);
  tayKeo.classList.add('dang-keo');
  ngan.classList.add('dang-doi-rong');
});
tayKeo.addEventListener('pointermove', (e) => { if (tayKeo.hasPointerCapture(e.pointerId)) datRongNgan(window.innerWidth - e.clientX); });
const xongKeo = (e) => {
  if (!tayKeo.hasPointerCapture(e.pointerId)) return;
  tayKeo.releasePointerCapture(e.pointerId);
  tayKeo.classList.remove('dang-keo');
  ngan.classList.remove('dang-doi-rong');
  nhoRongNgan();
};
tayKeo.addEventListener('pointerup', xongKeo);
tayKeo.addEventListener('pointercancel', xongKeo);
tayKeo.addEventListener('dblclick', () => { datRongNgan(null); nhoRongNgan(); });
tayKeo.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  datRongNgan(ngan.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 40 : -40));
  nhoRongNgan();
});
ngan.prepend(tayKeo);
let viecDangSua = null;
let mauDangChon = null;
export function moNganViec(v, macDinh = {}) {
  viecDangSua = v;
  formViec.reset();
  formViec.querySelector('.loi-form').hidden = true;
  document.getElementById('ngan-viec-tieu-de').textContent = v ? 'Sửa việc' : 'Thêm việc';
  document.getElementById('nut-huy-viec').hidden = !v;
  const du = v || { han_ngay: homNay(), ...macDinh };
  for (const k of ['tieu_de', 'han_ngay', 'gio_hen', 'ghi_chu']) formViec.elements[k].value = du[k] || '';
  const chon = formViec.elements.du_an_id;
  thay(chon, h('option', { value: '', text: 'Chưa xếp dự án' }), ...S.duAnDs.map((d) => h('option', { value: String(d.id), text: d.ten })));
  chon.value = du.du_an_id ? String(du.du_an_id) : '';
  mauDangChon = du.mau || null;
  thay(document.getElementById('mau-viec-hang'), oChonMau(h, mauDangChon, (m) => { mauDangChon = m; }, { coKhong: true, nhan: 'Màu riêng của việc' }));
  if (!S.duAnDs.length) api('/api/du-an').then((r) => { S.duAnDs = r.du_an; thay(chon, h('option', { value: '', text: 'Chưa xếp dự án' }), ...S.duAnDs.map((d) => h('option', { value: String(d.id), text: d.ten }))); chon.value = du.du_an_id ? String(du.du_an_id) : ''; }).catch(() => {});
  veKhoiClaude(document.getElementById('khoi-claude'), v, { h, api, bao, luc, icon, sauKhiDat: () => { ngan.close(); moMuc(); } });
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
  ngan.close();
  huyViec(v);
});
document.getElementById('nut-them-viec').addEventListener('click', () => moNganViec(null));
