// Giao diện Sonicplan, Mục Tệp.
import { hexMau } from '../mau.js';
import { S, api, bao, fmt, h, homNay, icon, khungLoi, kichThuoc, luc, thay, trang, xuong } from './chung.js';
import { chepChu } from './viec.js';
import { theTep } from './zalo.js';

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
export function kieuXemTep(ten) {
  const duoi = (String(ten).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1]?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(duoi)) return 'anh';
  return duoi === 'pdf' ? 'pdf' : duoi === 'docx' ? 'docx' : null;
}

// Tệp đã nằm trên Drive thì mở thẳng bằng trình xem của Drive (Word, Excel, PowerPoint, PDF); ảnh vẫn xem bản lưu.
const DUOI_DRIVE = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf', 'odt', 'rtf', 'csv', 'md', 'txt', 'm4a', 'mp3', 'wav', 'webm', 'ogg', 'oga', 'aac', 'opus', 'flac', 'amr', 'caf'];
export function kieuMo(f) {
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

export function moXemTep(f, kieu) {
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
  return f.nguon === 'gmail' ? 'Gmail' : f.nguon === 'hop' ? 'Cuộc họp' : 'Tải lên';
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
export function khoiNhanGoogle() {
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
export function linkKhoDrive(kho) {
  const m = kho.thu_muc || {};
  const cuaTk = kho.da_noi?.email ? `authuser=${encodeURIComponent(kho.da_noi.email)}` : '';
  const dia = (id) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}${cuaTk ? `?${cuaTk}` : ''}`;
  if (!m.goc) return h('p', { class: 'mo-ta', text: 'Thư mục trên Drive sẽ có sau lượt lưu đầu tiên. Bấm "Lưu ngay" để tạo.' });
  const muc = [['tin', 'Tin nhắn'], ['thu', 'Thư'], ['tep', 'Tệp'], ['phan_loai', 'Phân loại'], ['bo_nho', 'Bộ nhớ AI'], ['viec', 'Việc']].filter(([k]) => m[k]);
  return h('div', { class: 'truy-cap-kho' },
    h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-phu', href: dia(m.goc), target: '_blank', rel: 'noopener noreferrer' }, icon('kho'), `Mở Sonicplan kho trên Drive${kho.da_noi?.email ? ` (${kho.da_noi.email})` : ''}`)),
    muc.length ? h('div', { class: 'hang-nut' }, ...muc.map(([k, ten]) => h('a', { class: 'chip', href: dia(m[k]), target: '_blank', rel: 'noopener noreferrer' }, ten))) : null);
}

export async function veTep(goc) {
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
    const theT = h('div', { class: 'bang the-tep' },
      khung,
      h('div', { class: 'than-tep' },
        h('button', { class: 'ten-tep', type: 'button', text: f.ten, title: f.ten, onclick: mo }),
        h('div', { class: 'meta' }, h('span', { text: kichThuoc(f.kich_thuoc) }), h('span', { text: nguonTep(f) }), f.nguoi_gui && f.nguon !== 'zalo' ? h('span', { text: f.nguoi_gui.split('<')[0].trim() }) : null, h('span', { text: luc(f.tao_luc) })),
        chon));
    theT._td = () => ({ nhan: `Thao tác với tệp ${f.ten}`, muc: [
      { nhan: 'Mở xem', lam: mo },
      { nhan: 'Tải xuống', lam: () => { location.href = `/api/tep/${f.id}/tai`; } },
      { nhan: 'Sao chép tên tệp', lam: () => chepChu(f.ten) },
      f.tin_nhan_id ? { vach: true } : null,
      f.tin_nhan_id ? { nhan: 'Xem tin gốc', lam: () => { location.hash = `hop-tin/${f.tin_nhan_id}`; } } : null,
    ] });
    return theT;
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
      S.duAnDs = da.du_an;
      ve();
    } catch (e) {
      thay(vung, khungLoi(e, nap));
    }
  }
  nap();
}
