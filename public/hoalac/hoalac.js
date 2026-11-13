// Giao diện Viện Hòa Lạc: bảng Kanban (kéo-thả đổi trạng thái) và lịch Gantt rút gọn (thanh theo CPM).
import { api, apiTep, bao, datDuAn, duAnDaLuu, fmt, h, khungLoi, layTep, thay } from './chung.js';

const CAC_TRANG_THAI = [
  { ma: 'chua_lam', ten: 'Chưa làm' },
  { ma: 'dang_lam', ten: 'Đang làm' },
  { ma: 'xong', ten: 'Xong' },
  { ma: 'tam_dung', ten: 'Tạm dừng' },
];

const CAC_MUC_RAID = [
  { ma: 'rui_ro', ten: 'Rủi ro' },
  { ma: 'van_de', ten: 'Vấn đề' },
  { ma: 'thay_doi', ten: 'Thay đổi' },
  { ma: 'quyet_dinh', ten: 'Quyết định' },
  { ma: 'bai_hoc', ten: 'Bài học' },
];
let raidSub = 'rui_ro';

const CAC_MUC_PHAP_LY = [
  { ma: 'ben_lien_quan', ten: 'Các bên' },
  { ma: 'raci', ten: 'RACI' },
  { ma: 'hop_dong', ten: 'Hợp đồng' },
  { ma: 'thu_tuc', ten: 'Thủ tục' },
  { ma: 'van_ban', ten: 'Văn bản' },
  { ma: 'hop', ten: 'Họp' },
];
let phapLySub = 'thu_tuc';

const CAC_MUC_NGAN_SACH = [
  { ma: 'dong', ten: 'Dòng ngân sách' },
  { ma: 'dot_tra', ten: 'Đợt thanh toán' },
  { ma: 'giai_ngan', ten: 'Giải ngân' },
  { ma: 'evm', ten: 'EVM' },
];
let nganSachSub = 'dong';

async function chinh() {
  const goc = document.getElementById('goc');
  // Danh mục dự án dựng ở máy chủ từ đúng các dự án người dùng là thành viên. Lựa chọn cũ (URL hoặc
  // localStorage) chỉ dùng khi còn nằm trong danh mục; không thì mở dự án đầu tiên. Gọi danh mục khi
  // chưa gắn x-to-chuc, vì máy chủ trả 403 cho dự án không còn thuộc người dùng.
  const daLuu = duAnDaLuu();
  let duAn, tuanNay;
  try {
    ({ du_an: duAn, tuan_nay: tuanNay } = await api('/api/hoalac/danh-muc'));
  } catch (e) {
    thay(goc, khungLoi(e));
    return;
  }
  if (!duAn.length) {
    thay(goc, khungLoi(new Error('Tài khoản này chưa thuộc dự án nào.')));
    return;
  }
  const dangMo = duAn.find((x) => x.id === daLuu) || duAn[0];
  datDuAn(dangMo.id);
  veChonDuAn(duAn, dangMo);

  // doi_tac: chỉ thấy hạng mục, thủ tục được gán. xem (Ban Giám hiệu): thấy hết, không sửa được gì.
  const chiXem = dangMo.vai_tro === 'doi_tac';
  const chiDoc = dangMo.vai_tro === 'xem';
  document.getElementById('tieu-de').textContent = `Quản lý dự án${chiXem ? ' (chỉ xem phần được giao)' : chiDoc ? ' (chỉ xem)' : ''}`;
  if (chiDoc) batChiDoc(goc);

  const moTab = {
    'tong-quan': () => veTongQuan(goc, duAn, dangMo),
    bgh: () => veBgh(goc, duAn, dangMo, tuanNay),
    kanban: () => taiVaVe(goc, chiXem || chiDoc, 'kanban'),
    gantt: () => taiVaVe(goc, chiXem, 'gantt'),
    raid: () => taiVaVeRaid(goc),
    'phap-ly': () => taiVaVePhapLy(goc, chiXem),
    'ban-giao': () => taiVaVeBanGiao(goc),
    'ho-so': () => taiVaVeHoSo(goc),
    'ngan-sach': () => taiVaVeNganSach(goc),
  };
  const bat = tabDuocBat(dangMo);
  const cacTab = [];
  for (const ma of Object.keys(moTab)) {
    const nut = document.getElementById(`tab-${ma}`);
    if (!nut) continue; // index.html cũ còn trong bộ nhớ đệm, chưa có nút tab mới
    if (!bat.includes(ma)) { nut.remove(); continue; }
    cacTab.push(nut);
    nut.onclick = () => { chonTab(nut, cacTab); moTab[ma](); };
  }
  // ?tab=... mở đúng tab (khi chuyển dự án từ trang BGH); Ban Giám hiệu (vai trò xem) mở thẳng trang BGH.
  const tabUrl = new URLSearchParams(location.search).get('tab') || (chiDoc ? 'bgh' : '');
  const dau = cacTab.find((t) => t.id === `tab-${tabUrl}`) || cacTab[0];
  chonTab(dau, cacTab);
  await moTab[dau.id.slice(4)]();
}

// Tab mặc định theo loại dự án; to_chuc.phan_bat (danh sách cách nhau bằng dấu phẩy) ghi đè khi có.
// Đối tác: RAID, Ngân sách, Bàn giao trả 403 cho mọi thao tác (không có cơ chế gán theo dòng), và
// Tổng quan không có số liệu cho họ, nên chỉ còn Kanban, Gantt, Pháp lý (vePhapLy() tự ẩn 5 mục còn lại).
const TAB_MAC_DINH = {
  xay_dung: ['tong-quan', 'bgh', 'kanban', 'gantt', 'raid', 'phap-ly', 'ho-so', 'ngan-sach'],
  nghien_cuu: ['tong-quan', 'bgh', 'kanban', 'gantt', 'raid', 'ban-giao', 'ho-so', 'ngan-sach'],
};
function tabDuocBat(da) {
  const rieng = String(da.phan_bat || '').split(',').map((x) => x.trim()).filter(Boolean);
  const bat = rieng.length ? ['tong-quan', 'bgh', ...rieng] : (TAB_MAC_DINH[da.loai_du_an] || TAB_MAC_DINH.xay_dung);
  if (da.vai_tro === 'doi_tac') {
    const conLai = bat.filter((x) => ['kanban', 'gantt', 'phap-ly'].includes(x));
    return conLai.length ? conLai : ['kanban'];
  }
  return bat;
}

function veChonDuAn(duAn, dangMo) {
  const ten = document.getElementById('ten-to-chuc');
  const khung = document.getElementById('khung-chon-du-an');
  const chon = document.getElementById('chon-du-an');
  document.title = `${dangMo.ten} - Quản lý dự án`;
  if (duAn.length < 2) { ten.textContent = dangMo.ten; return; }
  ten.hidden = true;
  khung.hidden = false;
  thay(chon, duAn.map((x) => h('option', { value: x.id, selected: x.id === dangMo.id, text: x.ten })));
  chon.onchange = () => moDuAn(chon.value);
}

function moDuAn(id, tab = '') {
  datDuAn(id);
  location.href = `/hoalac?du-an=${encodeURIComponent(id)}${tab ? `&tab=${tab}` : ''}`;
}

// Vai trò xem: máy chủ đã trả 403 cho mọi lệnh ghi (src/hoalac/api.js); ở đây chỉ ẩn ô nhập, nút
// và khóa ô chọn trạng thái để người xem không bấm nhầm rồi gặp lỗi.
function batChiDoc(goc) {
  document.body.classList.add('chi-doc');
  const khoa = () => { for (const s of goc.querySelectorAll('.hang-dong-raid select')) s.disabled = true; };
  new MutationObserver(khoa).observe(goc, { childList: true, subtree: true });
}

const TEN_LOAI_DU_AN = { xay_dung: 'Xây dựng', nghien_cuu: 'Nghiên cứu' };
const TEN_MAU = { xanh: 'Đúng tiến độ', vang: 'Cần chú ý', do: 'Chậm, có rủi ro' };

// Tổng quan: mỗi dự án một thẻ (học trang danh mục của Monday, Asana): màu trạng thái, % tiến độ,
// việc quá hạn, rủi ro cao, 3 mốc tới. Đây cũng là trang Ban Giám hiệu xem.
function veTongQuan(goc, duAn, dangMo) {
  const the = duAn.map((x) => {
    const coSo = x.mau != null;
    return h('article', { class: `the-du-an${x.id === dangMo.id ? ' dang-mo' : ''}` },
      h('div', { class: 'dau-the-du-an' },
        h('h2', { text: x.ten }),
        coSo ? h('span', { class: `nhan-trang-thai nhan-${x.mau}`, text: TEN_MAU[x.mau] }) : null,
      ),
      h('div', { class: 'loai-du-an', text: TEN_LOAI_DU_AN[x.loai_du_an] || '' }),
      coSo ? h('div', { class: 'so-du-an' },
        h('div', {}, h('strong', { text: `${x.tien_do_pt}%` }), h('span', { text: 'tiến độ' })),
        h('div', {}, h('strong', { text: String(x.qua_han) }), h('span', { text: x.qua_han_gang ? `quá hạn (${x.qua_han_gang} trên đường găng)` : 'quá hạn' })),
        h('div', {}, h('strong', { text: String(x.rui_ro_cao) }), h('span', { text: 'rủi ro cao' })),
      ) : null,
      coSo ? h('div', { class: 'tien-do' }, h('div', { class: 'tien-do-trong', style: `width:${x.tien_do_pt}%` })) : null,
      coSo ? h('div', { class: 'moc-toi' },
        h('h3', { text: 'Mốc sắp tới' }),
        x.moc_toi.length
          ? h('ul', {}, ...x.moc_toi.map((m) => h('li', {}, h('time', { text: fmt.ngayNgan.format(new Date(m.ngay)) }), ' ', m.ten)))
          : h('p', { class: 'trong', text: 'Chưa có mốc nào phía trước.' }),
      ) : null,
      x.id === dangMo.id ? h('p', { class: 'nhan-dang-mo', text: 'Đang mở' })
        : h('button', { type: 'button', class: 'nut-mo-du-an', onclick: () => moDuAn(x.id) }, 'Mở dự án này'),
    );
  });
  const taoMoi = dangMo.vai_tro === 'chu'
    ? h('form', { class: 'form-raid', onsubmit: (e) => taoDuAn(e) },
      h('input', { name: 'ten', required: true, placeholder: 'Tên dự án mới', 'aria-label': 'Tên dự án mới' }),
      oChon('loai_du_an', Object.entries(TEN_LOAI_DU_AN), 'xay_dung'),
      h('button', { type: 'submit' }, 'Tạo dự án'))
    : null;
  thay(goc, h('div', { class: 'khung-raid' }, h('div', { class: 'luoi-du-an' }, ...the), taoMoi));
}

// Báo cáo Ban Giám hiệu: mỗi dự án một mục đọc được trong một lượt cuộn (học mẫu cập nhật trạng thái
// của Asana): đèn, tiến độ, mốc tới, việc quá hạn, rủi ro cao, bản cập nhật tuần chủ dự án đã lưu.
// Đèn luôn tính từ số liệu ở máy chủ, không cho sửa tay. Chủ dự án đang mở thấy ô soạn: AI soạn nháp
// (chỉ trả chữ, không lưu), anh sửa rồi bấm lưu thì BGH mới thấy.
function veBgh(goc, duAn, dangMo, tuanNay) {
  // Ngày nhập tay sai định dạng thì in nguyên chữ, không để Intl ném lỗi làm trắng cả trang.
  const ngay = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? String(s ?? '') : fmt.ngayNgan.format(d); };
  const danhSach = (tieuDe, ds, trong, dong) => h('div', { class: 'cot-bgh' },
    h('h3', { text: tieuDe }),
    ds.length ? h('ul', {}, ...ds.map(dong)) : h('p', { class: 'trong', text: trong }));
  const muc = duAn.filter((x) => x.mau != null).map((x) => {
    const cn = x.cap_nhat;
    const cuTuan = cn && cn.tuan !== tuanNay;
    return h('section', { class: 'muc-bgh', 'aria-labelledby': `bgh-${x.id}` },
      h('div', { class: 'dau-the-du-an' },
        h('h2', { id: `bgh-${x.id}`, text: x.ten }),
        h('span', { class: `nhan-trang-thai nhan-${x.mau}`, text: TEN_MAU[x.mau] })),
      h('div', { class: 'tien-do-bgh' },
        h('strong', { text: `${x.tien_do_pt}%` }), h('span', { text: 'tiến độ chung' }),
        h('div', { class: 'tien-do', role: 'progressbar', 'aria-valuenow': x.tien_do_pt, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': `Tiến độ ${x.ten}` },
          h('div', { class: 'tien-do-trong', style: `width:${x.tien_do_pt}%` }))),
      h('div', { class: 'luoi-bgh' },
        danhSach('Mốc sắp tới', x.moc_toi, 'Chưa có mốc nào phía trước.',
          (m) => h('li', {}, h('time', { text: ngay(m.ngay) }), ' ', m.ten)),
        danhSach(`Việc quá hạn (${x.qua_han})`, x.qua_han_ds, 'Không có việc quá hạn.',
          (v) => h('li', {}, h('time', { text: ngay(v.ngay) }), ' ', v.ten, v.gang ? h('span', { class: 'nhan-gang', text: 'đường găng' }) : null)),
        danhSach(`Rủi ro cao (${x.rui_ro_cao})`, x.rui_ro_ds, 'Không có rủi ro cao.',
          (r) => h('li', {}, r.ten, h('span', { class: 'diem-rui-ro', text: ` ${r.diem} điểm` })))),
      h('div', { class: 'cap-nhat-bgh' },
        h('h3', { text: 'Cập nhật tuần' }),
        cn ? h('p', { class: 'chu-cap-nhat', text: cn.noi_dung }) : h('p', { class: 'trong', text: 'Chưa có bản cập nhật nào.' }),
        cn ? h('p', { class: 'ghi-chu-bgh', text: `Tuần từ ${fmt.ngayDai.format(new Date(cn.tuan))}${cuTuan ? ' (chưa có bản tuần này)' : ''}, cập nhật ${new Date(cn.cap_nhat_luc).toLocaleString('vi-VN')}` }) : null),
      x.vai_tro === 'chu' ? oSoanCapNhat(x, dangMo, cuTuan || !cn ? '' : cn.noi_dung) : null,
    );
  });
  thay(goc, h('div', { class: 'khung-raid' },
    h('div', { class: 'dau-bgh' },
      h('h2', { text: 'Báo cáo Ban Giám hiệu' }),
      h('p', { class: 'ghi-chu-bgh', text: `Tuần từ ${fmt.ngayDai.format(new Date(tuanNay))}. Đèn tính tự động: đỏ khi có việc quá hạn trên đường găng hoặc từ 3 rủi ro cao; vàng khi có việc quá hạn hoặc rủi ro cao.` })),
    ...muc));
}

// Ô soạn cập nhật tuần, chỉ cho chủ dự án. Máy chủ nhận lệnh cho dự án đang mở (x-to-chuc), nên dự án
// khác phải mở trước.
function oSoanCapNhat(x, dangMo, banTuanNay) {
  if (x.id !== dangMo.id) {
    return h('button', { type: 'button', class: 'nut-mo-du-an', onclick: () => moDuAn(x.id, 'bgh') }, 'Mở dự án này để viết cập nhật tuần');
  }
  const o = h('textarea', { id: 'o-cap-nhat', rows: 8, maxlength: 4000, placeholder: 'Bấm "AI soạn nháp" hoặc tự viết, rồi sửa và lưu.' });
  o.value = banTuanNay;
  const ghiChu = h('p', { class: 'ghi-chu-bgh', 'aria-live': 'polite' });
  const nutNhap = h('button', { type: 'button', class: 'nut-mo-du-an', onclick: async () => {
    nutNhap.disabled = true;
    ghiChu.textContent = 'Đang soạn nháp...';
    try {
      const r = await api('/api/hoalac/cap-nhat-tuan/soan-nhap', { method: 'POST', body: '{}' });
      o.value = r.noi_dung;
      ghiChu.textContent = r.ai ? 'AI đã soạn nháp từ số liệu. Anh đọc, sửa rồi bấm lưu.' : 'Chưa gọi được AI, đây là bản dựng thẳng từ số liệu. Anh sửa rồi bấm lưu.';
    } catch (e) {
      ghiChu.textContent = '';
      bao(e.message, true);
    } finally {
      nutNhap.disabled = false;
    }
  } }, 'AI soạn nháp');
  const nutLuu = h('button', { type: 'submit' }, 'Lưu cho BGH xem');
  return h('form', { class: 'form-raid soan-bgh', onsubmit: async (e) => {
    e.preventDefault();
    nutLuu.disabled = true;
    try {
      await api('/api/hoalac/cap-nhat-tuan', { method: 'PUT', body: JSON.stringify({ noi_dung: o.value }) });
      bao('Đã lưu bản cập nhật tuần.');
      const { du_an: moi, tuan_nay: tuan } = await api('/api/hoalac/danh-muc');
      veBgh(document.getElementById('goc'), moi, dangMo, tuan);
    } catch (err) {
      bao(err.message, true);
    } finally {
      nutLuu.disabled = false;
    }
  } },
  h('label', { for: 'o-cap-nhat', class: 'nhan-o-bgh' }, 'Bản cập nhật tuần này (chỉ chủ dự án thấy ô này)'),
  o, h('div', { class: 'hang-nut-bgh' }, nutNhap, nutLuu), ghiChu);
}

async function taoDuAn(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const { id } = await api('/api/hoalac/danh-muc', { method: 'POST', body: JSON.stringify({ ten: fd.get('ten'), loai_du_an: fd.get('loai_du_an') }) });
    moDuAn(id);
  } catch (err) {
    bao(err.message, true);
  }
}

function chonTab(chon, cacTab) {
  for (const t of cacTab) t === chon ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current');
}

async function taiVaVe(goc, chiXem, cheDo) {
  try {
    const { hang_muc } = await api('/api/hoalac/hang-muc');
    thay(goc, cheDo === 'kanban' ? veKanban(hang_muc, chiXem) : veGantt(hang_muc));
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

function veKanban(hangMuc, chiXem) {
  const cot = CAC_TRANG_THAI.map(({ ma, ten }) => {
    const ds = hangMuc.filter((x) => x.trang_thai === ma);
    const cotEl = h('div', { class: 'cot-kanban', dataset: { trangThai: ma } },
      h('h3', {}, `${ten} (${ds.length})`),
      ...ds.map((x) => theKanban(x, chiXem)),
    );
    if (!chiXem) {
      cotEl.addEventListener('dragover', (e) => e.preventDefault());
      cotEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData('text/plain'));
        if (!id) return;
        try {
          await api(`/api/hoalac/hang-muc/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: ma }) });
          await taiVaVe(document.getElementById('goc'), chiXem, 'kanban');
        } catch (err) {
          bao(err.message, true);
        }
      });
    }
    return cotEl;
  });
  return h('div', { class: 'bang-kanban' }, ...cot);
}

function theKanban(x, chiXem) {
  const the = h('div', { class: `the-kanban${x.tren_duong_gang ? ' tren-gang' : ''}`, draggable: chiXem ? null : 'true' },
    h('strong', { text: x.ten }),
    x.phu_trach ? h('div', { class: 'phu-trach', text: x.phu_trach }) : null,
    h('div', { class: 'tien-do' }, h('div', { class: 'tien-do-trong', style: `width:${x.tien_do_pt || 0}%` })),
  );
  if (!chiXem) the.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(x.id)));
  return the;
}

function veGantt(hangMuc) {
  const coNgay = hangMuc.filter((x) => x.som_bd != null);
  if (!coNgay.length) return h('p', { class: 'trong' }, 'Chưa có hạng mục nào tính được ngày (cần đặt thời gian và phụ thuộc).');
  const toiDa = Math.max(1, ...coNgay.map((x) => x.som_kt));
  const hang = coNgay.map((x) => h('div', { class: 'hang-gantt' },
    h('div', { class: 'ten-gantt', text: x.ten }),
    h('div', { class: 'truc-gantt' },
      h('div', {
        class: `thanh-gantt${x.tren_duong_gang ? ' tren-gang' : ''}`,
        style: `left:${(x.som_bd / toiDa) * 100}%;width:${Math.max(((x.som_kt - x.som_bd) / toiDa) * 100, 1)}%`,
        title: `Sớm nhất ${x.som_bd}-${x.som_kt}, muộn nhất ${x.muon_bd}-${x.muon_kt}, dư trước ${x.du_truoc_ngay} ngày`,
      }),
    ),
  ));
  return h('div', { class: 'bang-gantt' }, h('p', { class: 'ghi-chu' }, 'Số ngày tính từ ngày khởi công dự án (ngày 0). Thanh đỏ: nằm trên đường gang (CPM), chậm là trễ cả dự án.'), ...hang);
}

// ---------- RAID: rủi ro, vấn đề, thay đổi, quyết định, bài học ----------
async function taiVaVeRaid(goc) {
  try {
    const [rr, vd, td, qd, bh] = await Promise.all([
      api('/api/hoalac/rui-ro'), api('/api/hoalac/van-de'), api('/api/hoalac/thay-doi'),
      api('/api/hoalac/quyet-dinh'), api('/api/hoalac/bai-hoc'),
    ]);
    thay(goc, veRaid(goc, { rui_ro: rr.rui_ro, van_de: vd.van_de, thay_doi: td.thay_doi, quyet_dinh: qd.quyet_dinh, bai_hoc: bh.bai_hoc }));
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

function veRaid(goc, d) {
  const subNav = h('nav', { class: 'sub-raid', 'aria-label': 'Mục RAID' },
    ...CAC_MUC_RAID.map(({ ma, ten }) => h('button', {
      type: 'button',
      'aria-current': ma === raidSub ? 'true' : null,
      onclick: () => { raidSub = ma; thay(goc, veRaid(goc, d)); },
      text: `${ten} (${d[ma].length})`,
    })),
  );
  const lamMoi = () => taiVaVeRaid(goc);
  const noiDung = {
    rui_ro: () => veRuiRo(d.rui_ro, lamMoi),
    van_de: () => veVanDe(d.van_de, d.rui_ro, lamMoi),
    thay_doi: () => veThayDoi(d.thay_doi, lamMoi),
    quyet_dinh: () => veQuyetDinh(d.quyet_dinh, lamMoi),
    bai_hoc: () => veBaiHoc(d.bai_hoc, lamMoi),
  }[raidSub]();
  return h('div', { class: 'khung-raid' }, subNav, noiDung);
}

function nhanMucDo(diem) {
  const cap = diem >= 15 ? 'cao' : diem >= 8 ? 'trung' : 'thap';
  const ten = { cao: 'Cao', trung: 'Trung bình', thap: 'Thấp' }[cap];
  return h('span', { class: `nhan-muc-do nhan-muc-do-${cap}` }, `${ten} (${diem})`);
}

async function guiForm(e, duongDan, lamMoi) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const than = {};
  for (const [k, v] of fd.entries()) {
    if (v === '') continue;
    const o = e.target.elements[k];
    than[k] = o && o.type === 'number' ? Number(v) : v;
  }
  try {
    await api(duongDan, { method: 'POST', body: JSON.stringify(than) });
    e.target.reset();
    await lamMoi();
  } catch (err) {
    bao(err.message, true);
  }
}

async function xoaRaid(duongDan, lamMoi) {
  if (!confirm('Xóa mục này? Không khôi phục được.')) return;
  try {
    await api(duongDan, { method: 'DELETE' });
    await lamMoi();
  } catch (err) {
    bao(err.message, true);
  }
}

function oChon(ten, cacTuyChon, giaTriHien) {
  return h('select', { name: ten },
    ...cacTuyChon.map(([gt, nhan]) => h('option', { value: gt, selected: gt === giaTriHien ? true : null }, nhan)),
  );
}

function veRuiRo(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/rui-ro', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên rủi ro', required: true }),
    h('textarea', { name: 'mo_ta', placeholder: 'Mô tả' }),
    h('label', {}, 'Xác suất (1-5) ', oChon('xac_suat', [1, 2, 3, 4, 5].map((n) => [n, n]), 3)),
    h('label', {}, 'Tác động (1-5) ', oChon('tac_dong', [1, 2, 3, 4, 5].map((n) => [n, n]), 3)),
    h('input', { name: 'bien_phap', placeholder: 'Biện pháp ứng phó' }),
    h('input', { name: 'phu_trach', placeholder: 'Phụ trách' }),
    h('button', { type: 'submit' }, 'Thêm rủi ro'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có rủi ro nào.'));
  const list = ds.map((r) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: r.ten }), nhanMucDo(r.muc_do)),
    r.mo_ta ? h('p', { text: r.mo_ta }) : null,
    h('p', { class: 'chi-tiet-raid' }, `Xác suất ${r.xac_suat} × Tác động ${r.tac_dong}${r.bien_phap ? ` · Biện pháp: ${r.bien_phap}` : ''}${r.phu_trach ? ` · Phụ trách: ${r.phu_trach}` : ''}`),
    h('div', { class: 'hang-dong-raid' },
      dungChonTrangThai(r, '/api/hoalac/rui-ro', lamMoi),
      h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/rui-ro/${r.id}`, lamMoi) }, 'Xóa'),
    ),
  ));
  return h('div', {}, form, ...list);
}

function veVanDe(ds, dsRuiRo, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/van-de', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên vấn đề', required: true }),
    h('textarea', { name: 'mo_ta', placeholder: 'Mô tả' }),
    h('label', {}, 'Mức độ ', oChon('muc_do', [['thap', 'Thấp'], ['trung', 'Trung bình'], ['cao', 'Cao']], 'trung')),
    h('input', { name: 'phu_trach', placeholder: 'Phụ trách' }),
    h('button', { type: 'submit' }, 'Thêm vấn đề'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có vấn đề nào.'));
  const tenRuiRo = (id) => dsRuiRo.find((r) => r.id === id)?.ten;
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), h('span', { class: `nhan-muc-do nhan-muc-do-${x.muc_do}` }, x.muc_do === 'cao' ? 'Cao' : x.muc_do === 'thap' ? 'Thấp' : 'Trung bình')),
    x.mo_ta ? h('p', { text: x.mo_ta }) : null,
    h('p', { class: 'chi-tiet-raid' }, `${x.phu_trach ? `Phụ trách: ${x.phu_trach}` : ''}${x.rui_ro_id ? ` · Từ rủi ro: ${tenRuiRo(x.rui_ro_id) || x.rui_ro_id}` : ''}`),
    h('div', { class: 'hang-dong-raid' }, dungChonTrangThai(x, '/api/hoalac/van-de', lamMoi),
      h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/van-de/${x.id}`, lamMoi) }, 'Xóa'),
    ),
  ));
  return h('div', {}, form, ...list);
}

function dungChonTrangThai(x, goc, lamMoi) {
  const s = oChon('trang_thai', [['mo', 'Mở'], ['dang_xu_ly', 'Đang xử lý'], ['da_dong', 'Đã đóng']], x.trang_thai);
  s.onchange = async () => {
    try { await api(`${goc}/${x.id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: s.value }) }); await lamMoi(); } catch (err) { bao(err.message, true); }
  };
  return s;
}

const TEN_TRANG_THAI_THAY_DOI = { de_xuat: 'Đề xuất', xem_xet: 'Đang xem xét', duyet: 'Đã duyệt', tu_choi: 'Từ chối' };

function veThayDoi(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/thay-doi', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên yêu cầu thay đổi', required: true }),
    h('textarea', { name: 'mo_ta', placeholder: 'Mô tả' }),
    h('input', { name: 'ly_do', placeholder: 'Lý do' }),
    h('input', { name: 'anh_huong', placeholder: 'Ảnh hưởng (phạm vi, thời gian, chi phí)' }),
    h('button', { type: 'submit' }, 'Đề xuất thay đổi'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có yêu cầu thay đổi nào.'));
  const chuyen = async (id, trangThai) => {
    let ghiChu = '';
    // prompt() trả null khi người dùng bấm Cancel: dừng hẳn, không coi là "để trống rồi vẫn gửi",
    // vì duyệt/từ chối là quyết định một chiều không lùi lại được.
    if (trangThai === 'tu_choi') {
      const tra = prompt('Lý do từ chối (không bắt buộc):');
      if (tra === null) return;
      ghiChu = tra;
    }
    if (trangThai === 'duyet') {
      const tra = prompt('Ghi chú khi duyệt (không bắt buộc):');
      if (tra === null) return;
      ghiChu = tra;
    }
    try {
      await api(`/api/hoalac/thay-doi/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: trangThai, ghi_chu_duyet: ghiChu || undefined }) });
      await lamMoi();
    } catch (err) { bao(err.message, true); }
  };
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), h('span', { class: `nhan-trang-thai nhan-trang-thai-${x.trang_thai}` }, TEN_TRANG_THAI_THAY_DOI[x.trang_thai])),
    x.mo_ta ? h('p', { text: x.mo_ta }) : null,
    h('p', { class: 'chi-tiet-raid' }, `${x.ly_do ? `Lý do: ${x.ly_do}` : ''}${x.anh_huong ? ` · Ảnh hưởng: ${x.anh_huong}` : ''}`),
    x.ghi_chu_duyet ? h('p', { class: 'chi-tiet-raid' }, `Ghi chú duyệt: ${x.ghi_chu_duyet}${x.duyet_boi ? ` (${x.duyet_boi})` : ''}`) : null,
    h('div', { class: 'hang-dong-raid' },
      x.trang_thai === 'de_xuat' ? h('button', { type: 'button', onclick: () => chuyen(x.id, 'xem_xet') }, 'Chuyển xem xét') : null,
      x.trang_thai === 'xem_xet' ? h('button', { type: 'button', onclick: () => chuyen(x.id, 'duyet') }, 'Duyệt') : null,
      x.trang_thai === 'xem_xet' ? h('button', { type: 'button', onclick: () => chuyen(x.id, 'tu_choi') }, 'Từ chối') : null,
      h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/thay-doi/${x.id}`, lamMoi) }, 'Xóa'),
    ),
  ));
  return h('div', {}, form, ...list);
}

function veQuyetDinh(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/quyet-dinh', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên quyết định', required: true }),
    h('textarea', { name: 'noi_dung', placeholder: 'Nội dung' }),
    h('input', { name: 'can_cu', placeholder: 'Căn cứ' }),
    h('input', { name: 'nguoi_quyet_dinh', placeholder: 'Người quyết định' }),
    h('input', { name: 'ngay_quyet_dinh', type: 'date' }),
    h('button', { type: 'submit' }, 'Ghi quyết định'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có quyết định nào.'));
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), x.ngay_quyet_dinh ? h('span', { class: 'chi-tiet-raid', text: fmt.ngayNgan.format(new Date(`${x.ngay_quyet_dinh}T00:00:00Z`)) }) : null),
    x.noi_dung ? h('p', { text: x.noi_dung }) : null,
    h('p', { class: 'chi-tiet-raid' }, `${x.can_cu ? `Căn cứ: ${x.can_cu}` : ''}${x.nguoi_quyet_dinh ? ` · Người quyết định: ${x.nguoi_quyet_dinh}` : ''}`),
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/quyet-dinh/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

function veBaiHoc(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/bai-hoc', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên bài học', required: true }),
    h('textarea', { name: 'mo_ta', placeholder: 'Mô tả' }),
    h('label', {}, 'Loại ', oChon('loai', [['tot', 'Điều tốt, nên giữ'], ['chua_tot', 'Điều chưa tốt, cần tránh']], 'tot')),
    h('input', { name: 'de_xuat_ap_dung', placeholder: 'Đề xuất áp dụng' }),
    h('button', { type: 'submit' }, 'Ghi bài học'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có bài học nào.'));
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), h('span', { class: `nhan-loai-bai-hoc nhan-loai-bai-hoc-${x.loai}` }, x.loai === 'tot' ? 'Điều tốt' : 'Cần tránh')),
    x.mo_ta ? h('p', { text: x.mo_ta }) : null,
    x.de_xuat_ap_dung ? h('p', { class: 'chi-tiet-raid' }, `Đề xuất áp dụng: ${x.de_xuat_ap_dung}`) : null,
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/bai-hoc/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

// ---------- Pháp lý: các bên liên quan, RACI, hợp đồng, thủ tục, văn bản, họp ----------
// Đối tác chỉ GET được thủ tục được gán (404 nếu không), 5 mục còn lại chặn hẳn (403) ở api.js;
// vePhapLy() giữ đúng chính sách đó bằng cách chỉ hiện mục "Thủ tục" trong sub-nav khi chiXem.
async function taiVaVePhapLy(goc, chiXem) {
  try {
    if (chiXem) {
      const { thu_tuc } = await api('/api/hoalac/thu-tuc');
      phapLySub = 'thu_tuc';
      thay(goc, vePhapLy(goc, chiXem, { thu_tuc, ben_lien_quan: [], raci: [], hop_dong: [], van_ban: [], hop: [] }));
      return;
    }
    const [bl, rc, hd, tt, vb, hp] = await Promise.all([
      api('/api/hoalac/ben-lien-quan'), api('/api/hoalac/raci'), api('/api/hoalac/hop-dong'),
      api('/api/hoalac/thu-tuc'), api('/api/hoalac/van-ban'), api('/api/hoalac/hop'),
    ]);
    thay(goc, vePhapLy(goc, chiXem, {
      ben_lien_quan: bl.ben_lien_quan, raci: rc.raci, hop_dong: hd.hop_dong,
      thu_tuc: tt.thu_tuc, van_ban: vb.van_ban, hop: hp.hop,
    }));
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

function vePhapLy(goc, chiXem, d) {
  const muc = chiXem ? CAC_MUC_PHAP_LY.filter((x) => x.ma === 'thu_tuc') : CAC_MUC_PHAP_LY;
  const subNav = h('nav', { class: 'sub-raid', 'aria-label': 'Mục Pháp lý' },
    ...muc.map(({ ma, ten }) => h('button', {
      type: 'button',
      'aria-current': ma === phapLySub ? 'true' : null,
      onclick: () => { phapLySub = ma; thay(goc, vePhapLy(goc, chiXem, d)); },
      text: `${ten} (${d[ma].length})`,
    })),
  );
  const lamMoi = () => taiVaVePhapLy(goc, chiXem);
  const noiDung = {
    ben_lien_quan: () => veBenLienQuan(d.ben_lien_quan, lamMoi),
    raci: () => veRaci(d.raci, d.ben_lien_quan, lamMoi),
    hop_dong: () => veHopDong(d.hop_dong, d.ben_lien_quan, lamMoi),
    thu_tuc: () => veThuTuc(d.thu_tuc, chiXem, lamMoi),
    van_ban: () => veVanBan(d.van_ban, d.thu_tuc, lamMoi),
    hop: () => veHop(d.hop, lamMoi),
  }[phapLySub]();
  return h('div', { class: 'khung-raid' }, subNav, noiDung);
}

const TEN_LOAI_BEN = { noi_bo: 'Nội bộ', tu_van: 'Tư vấn', co_quan_nha_nuoc: 'Cơ quan nhà nước', khac: 'Khác' };

function veBenLienQuan(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/ben-lien-quan', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên bên liên quan', required: true }),
    h('label', {}, 'Loại ', oChon('loai', Object.entries(TEN_LOAI_BEN), 'tu_van')),
    h('input', { name: 'don_vi', placeholder: 'Đơn vị' }),
    h('input', { name: 'vai_tro', placeholder: 'Vai trò trong dự án' }),
    h('input', { name: 'lien_he', placeholder: 'Liên hệ (email/SĐT)' }),
    h('label', {}, 'Mức ảnh hưởng ', oChon('muc_do_anh_huong', [['cao', 'Cao'], ['trung_binh', 'Trung bình'], ['thap', 'Thấp']], 'trung_binh')),
    h('button', { type: 'submit' }, 'Thêm bên liên quan'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có bên liên quan nào.'));
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), h('span', { class: 'chi-tiet-raid', text: TEN_LOAI_BEN[x.loai] })),
    h('p', { class: 'chi-tiet-raid' }, `${x.don_vi ? `Đơn vị: ${x.don_vi}` : ''}${x.vai_tro ? ` · Vai trò: ${x.vai_tro}` : ''}${x.lien_he ? ` · Liên hệ: ${x.lien_he}` : ''}`),
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/ben-lien-quan/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

const TEN_VAI_TRO_RACI = { R: 'R - Thực hiện', A: 'A - Chịu trách nhiệm', C: 'C - Tư vấn', I: 'I - Thông báo' };

function veRaci(ds, dsBen, lamMoi) {
  if (!dsBen.length) return h('p', { class: 'trong' }, 'Thêm bên liên quan trước khi gán RACI.');
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/raci', lamMoi) },
    h('input', { name: 'hoat_dong', placeholder: 'Hoạt động / công việc', required: true }),
    oChon('ben_lien_quan_id', dsBen.map((b) => [b.id, b.ten])),
    h('label', {}, 'Vai trò ', oChon('vai_tro', Object.entries(TEN_VAI_TRO_RACI), 'R')),
    h('button', { type: 'submit' }, 'Thêm RACI'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có phân quyền RACI nào.'));
  const tenBen = (id) => dsBen.find((b) => b.id === id)?.ten || id;
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.hoat_dong }), h('span', { class: 'nhan-trang-thai', text: x.vai_tro })),
    h('p', { class: 'chi-tiet-raid' }, `Bên: ${tenBen(x.ben_lien_quan_id)}`),
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/raci/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

const TEN_TRANG_THAI_HOP_DONG = { du_thao: 'Dự thảo', da_ky: 'Đã ký', dang_thuc_hien: 'Đang thực hiện', da_hoan_thanh: 'Đã hoàn thành', da_huy: 'Đã hủy' };

function veHopDong(ds, dsBen, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/hop-dong', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên hợp đồng', required: true }),
    dsBen.length ? oChon('ben_lien_quan_id', [['', 'Bên liên quan (tùy chọn)'], ...dsBen.map((b) => [b.id, b.ten])]) : null,
    h('input', { name: 'so_hop_dong', placeholder: 'Số hợp đồng' }),
    h('input', { name: 'gia_tri', type: 'number', step: '0.01', placeholder: 'Giá trị' }),
    h('input', { name: 'ngay_ky', type: 'date' }),
    h('label', {}, 'Trạng thái ', oChon('trang_thai', Object.entries(TEN_TRANG_THAI_HOP_DONG), 'du_thao')),
    h('button', { type: 'submit' }, 'Thêm hợp đồng'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có hợp đồng nào.'));
  const tenBen = (id) => dsBen.find((b) => b.id === id)?.ten;
  const doiTrangThai = async (id, trangThai) => {
    try { await api(`/api/hoalac/hop-dong/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: trangThai }) }); await lamMoi(); } catch (err) { bao(err.message, true); }
  };
  const list = ds.map((x) => {
    const chonTrangThai = oChon('trang_thai', Object.entries(TEN_TRANG_THAI_HOP_DONG), x.trang_thai);
    chonTrangThai.onchange = () => doiTrangThai(x.id, chonTrangThai.value);
    return h('div', { class: 'the-raid' },
      h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), x.gia_tri != null ? h('span', { class: 'chi-tiet-raid', text: `${Number(x.gia_tri).toLocaleString('vi-VN')} ${x.don_vi_tien}` }) : null),
      h('p', { class: 'chi-tiet-raid' }, `${x.so_hop_dong ? `Số: ${x.so_hop_dong}` : ''}${x.ben_lien_quan_id ? ` · Bên: ${tenBen(x.ben_lien_quan_id) || x.ben_lien_quan_id}` : ''}${x.ngay_ky ? ` · Ký ngày: ${x.ngay_ky}` : ''}`),
      h('div', { class: 'hang-dong-raid' }, chonTrangThai, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/hop-dong/${x.id}`, lamMoi) }, 'Xóa')),
    );
  });
  return h('div', {}, form, ...list);
}

// ---------- Bàn giao: sản phẩm đơn vị thuê ngoài phải nộp (dự án nghiên cứu, ví dụ Ipsos) ----------
const TEN_TRANG_THAI_BAN_GIAO = { chua_giao: 'Chưa giao', da_giao: 'Đã giao', dang_xem: 'Đang xem', yeu_cau_sua: 'Yêu cầu sửa', da_duyet: 'Đã duyệt' };

async function taiVaVeBanGiao(goc) {
  try {
    const [{ ban_giao }, { ben_lien_quan }] = await Promise.all([api('/api/hoalac/ban-giao'), api('/api/hoalac/ben-lien-quan')]);
    thay(goc, veBanGiao(ban_giao, ben_lien_quan, () => taiVaVeBanGiao(goc)));
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

function veBanGiao(ds, dsBen, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/ban-giao', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên sản phẩm bàn giao', required: true }),
    dsBen.length ? oChon('ben_giao_id', [['', 'Bên giao (tùy chọn)'], ...dsBen.map((b) => [b.id, b.ten])]) : null,
    h('label', {}, 'Hạn ', h('input', { name: 'han', type: 'date' })),
    h('button', { type: 'submit' }, 'Thêm sản phẩm'),
  );
  if (!ds.length) return h('div', { class: 'khung-raid' }, form, h('p', { class: 'trong' }, 'Chưa có sản phẩm bàn giao nào.'));
  const homNay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const tenBen = (id) => dsBen.find((b) => b.id === id)?.ten;
  const list = ds.map((x) => {
    const tre = x.han && x.han < homNay && !['da_giao', 'da_duyet'].includes(x.trang_thai);
    const chon = oChon('trang_thai', Object.entries(TEN_TRANG_THAI_BAN_GIAO), x.trang_thai);
    chon.onchange = async () => {
      const than = { trang_thai: chon.value };
      if (chon.value === 'da_giao' && !x.ngay_giao) than.ngay_giao = homNay;
      try { await api(`/api/hoalac/ban-giao/${x.id}`, { method: 'PUT', body: JSON.stringify(than) }); await lamMoi(); } catch (err) { bao(err.message, true); }
    };
    return h('div', { class: `the-raid${tre ? ' tre-han' : ''}` },
      h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }),
        h('span', { class: `nhan-trang-thai nhan-ban-giao-${x.trang_thai}`, text: TEN_TRANG_THAI_BAN_GIAO[x.trang_thai] })),
      h('p', { class: 'chi-tiet-raid' }, [
        x.han ? `Hạn: ${fmt.ngayNgan.format(new Date(x.han))}${tre ? ' (quá hạn)' : ''}` : 'Chưa có hạn',
        x.ben_giao_id ? `Bên giao: ${tenBen(x.ben_giao_id) || x.ben_giao_id}` : '',
        x.ngay_giao ? `Đã nộp: ${fmt.ngayNgan.format(new Date(x.ngay_giao))}` : '',
      ].filter(Boolean).join(' · ')),
      x.mo_ta ? h('p', { class: 'chi-tiet-raid', text: x.mo_ta }) : null,
      h('div', { class: 'hang-dong-raid' }, chon, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/ban-giao/${x.id}`, lamMoi) }, 'Xóa')),
    );
  });
  return h('div', { class: 'khung-raid' }, form, ...list);
}

// ---------- Kho hồ sơ: thư mục chuẩn, gắn mục, phiên bản, nhãn duyệt, hạn hiệu lực ----------
const TEN_THU_MUC = { phap_ly: 'Pháp lý', hop_dong: 'Hợp đồng', van_ban: 'Văn bản', bien_ban_hop: 'Biên bản họp', ban_giao: 'Bàn giao', khac: 'Khác' };
const TEN_TRANG_THAI_HO_SO = { du_thao: 'Dự thảo', cho_duyet: 'Chờ duyệt', da_duyet: 'Đã duyệt', het_hieu_luc: 'Hết hiệu lực' };
const TEP_TOI_DA_MB = 50;
let locThuMuc = '';
const ngayDu = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
const coTep = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const xemDuoc = (ten) => /\.(pdf|png|jpe?g|gif|webp)$/i.test(ten || '');

async function taiVaVeHoSo(goc) {
  try {
    const rong = (k) => () => ({ [k]: [] });
    const [{ ho_so }, { thu_tuc }, { hop_dong }, { ban_giao }] = await Promise.all([
      api('/api/hoalac/ho-so'),
      api('/api/hoalac/thu-tuc').catch(rong('thu_tuc')),
      api('/api/hoalac/hop-dong').catch(rong('hop_dong')),
      api('/api/hoalac/ban-giao').catch(rong('ban_giao')),
    ]);
    const ve = () => thay(goc, veHoSo(ho_so, { thu_tuc, hop_dong, ban_giao }, () => taiVaVeHoSo(goc), ve));
    ve();
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

// Tải về (lưu tệp) hoặc xem trong thẻ mới. Mở thẻ trước khi chờ mạng để trình duyệt không chặn cửa sổ bật lên.
async function moTepHoSo(pbId, ten, xem) {
  const cuaSo = xem ? window.open('', '_blank') : null;
  try {
    const url = URL.createObjectURL(await layTep(`/api/hoalac/ho-so/phien-ban/${pbId}/tai${xem ? '?xem=1' : ''}`));
    if (cuaSo) { cuaSo.opener = null; cuaSo.location = url; } else {
      const a = h('a', { href: url, download: ten });
      document.body.append(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    cuaSo?.close();
    bao(err.message, true);
  }
}

function oGanHoSo(gan, giaTri = '') {
  const nhom = [['thu_tuc_id', 'Thủ tục', gan.thu_tuc], ['hop_dong_id', 'Hợp đồng', gan.hop_dong], ['ban_giao_id', 'Sản phẩm bàn giao', gan.ban_giao]]
    .filter(([, , ds]) => ds.length)
    .map(([k, nhan, ds]) => h('optgroup', { label: nhan }, ...ds.map((x) => h('option', { value: `${k}:${x.id}` }, x.ten))));
  if (!nhom.length) return null;
  const chon = h('select', { name: 'gan', 'aria-label': 'Gắn với mục' }, h('option', { value: '' }, 'Gắn với (tùy chọn)'), ...nhom);
  chon.value = giaTri;
  return chon;
}

function kiemCoTep(tep) {
  if (tep && tep.size > TEP_TOI_DA_MB * 1048576) { bao(`Tệp lớn quá (tối đa ${TEP_TOI_DA_MB} MB).`, true); return false; }
  return true;
}

function veHoSo(ds, gan, lamMoi, veLai) {
  const form = h('form', { class: 'form-raid form-ho-so', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!kiemCoTep(fd.get('tep'))) return;
    const g = fd.get('gan');
    fd.delete('gan');
    if (g) { const [k, v] = g.split(':'); fd.set(k, v); }
    for (const k of ['ten', 'mo_ta', 'han_hieu_luc']) if (fd.get(k) === '') fd.delete(k);
    const nut = e.target.querySelector('button[type=submit]');
    nut.disabled = true; nut.textContent = 'Đang tải lên...';
    try { await apiTep('/api/hoalac/ho-so', fd); bao('Đã tải hồ sơ lên.'); await lamMoi(); } catch (err) {
      bao(err.message, true); nut.disabled = false; nut.textContent = 'Tải hồ sơ lên';
    }
  } },
    h('input', { name: 'tep', type: 'file', required: true, 'aria-label': 'Chọn tệp (tối đa 50 MB)' }),
    h('input', { name: 'ten', placeholder: 'Tên hồ sơ (trống thì lấy tên tệp)' }),
    h('label', {}, 'Thư mục ', oChon('thu_muc', Object.entries(TEN_THU_MUC), locThuMuc || 'phap_ly')),
    oGanHoSo(gan),
    h('label', {}, 'Hiệu lực đến ', h('input', { name: 'han_hieu_luc', type: 'date' })),
    h('label', {}, 'Trạng thái ', oChon('trang_thai', Object.entries(TEN_TRANG_THAI_HO_SO), 'du_thao')),
    h('input', { name: 'mo_ta', placeholder: 'Mô tả (tùy chọn)' }),
    h('button', { type: 'submit' }, 'Tải hồ sơ lên'),
  );
  const dem = (tm) => ds.filter((x) => !tm || x.thu_muc === tm).length;
  const loc = h('div', { class: 'loc-ho-so', role: 'group', 'aria-label': 'Lọc theo thư mục' },
    ...[['', 'Tất cả'], ...Object.entries(TEN_THU_MUC)].map(([tm, nhan]) => h('button', {
      type: 'button', class: locThuMuc === tm ? 'dang-chon' : null, 'aria-pressed': locThuMuc === tm ? 'true' : 'false',
      onclick: () => { locThuMuc = tm; veLai(); },
    }, `${nhan} (${dem(tm)})`)));
  const loc_ds = ds.filter((x) => !locThuMuc || x.thu_muc === locThuMuc);
  const canhBao = ds.filter((x) => x.tinh_trang_han);
  const dauTrang = canhBao.length
    ? h('p', { class: 'canh-bao-ho-so', text: `${canhBao.filter((x) => x.tinh_trang_han === 'het_han').length} hồ sơ đã hết hạn, ${canhBao.filter((x) => x.tinh_trang_han === 'sap_het_han').length} hồ sơ hết hạn trong 30 ngày.` })
    : null;
  if (!loc_ds.length) return h('div', { class: 'khung-raid' }, form, loc, dauTrang, h('p', { class: 'trong' }, ds.length ? 'Thư mục này chưa có hồ sơ.' : 'Chưa có hồ sơ nào. Chọn tệp ở trên để tải lên.'));
  return h('div', { class: 'khung-raid' }, form, loc, dauTrang, ...loc_ds.map((x) => theHoSo(x, lamMoi, gan)));
}

// Biểu mẫu sửa thông tin hồ sơ (tên, thư mục, mục gắn, hạn, mô tả). Gửi đủ ba trường gắn để đổi hoặc bỏ gắn.
function formSuaHoSo(x, gan, lamMoi, dong) {
  const giaTriGan = x.thu_tuc_id ? `thu_tuc_id:${x.thu_tuc_id}` : x.hop_dong_id ? `hop_dong_id:${x.hop_dong_id}` : x.ban_giao_id ? `ban_giao_id:${x.ban_giao_id}` : '';
  return h('form', { class: 'form-raid form-ho-so form-sua-ho-so', onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const than = { ten: fd.get('ten'), thu_muc: fd.get('thu_muc'), mo_ta: fd.get('mo_ta'), han_hieu_luc: fd.get('han_hieu_luc') || null };
    if (fd.has('gan')) {
      const [k, v] = (fd.get('gan') || ':').split(':');
      for (const t of ['thu_tuc_id', 'hop_dong_id', 'ban_giao_id']) than[t] = t === k ? Number(v) : null;
    }
    const nut = e.target.querySelector('button[type=submit]');
    nut.disabled = true;
    try { await api(`/api/hoalac/ho-so/${x.id}`, { method: 'PUT', body: JSON.stringify(than) }); bao('Đã lưu thông tin hồ sơ.'); await lamMoi(); } catch (err) {
      bao(err.message, true); nut.disabled = false;
    }
  } },
    h('input', { name: 'ten', required: true, maxlength: 300, value: x.ten, 'aria-label': 'Tên hồ sơ' }),
    h('label', {}, 'Thư mục ', oChon('thu_muc', Object.entries(TEN_THU_MUC), x.thu_muc)),
    oGanHoSo(gan, giaTriGan),
    h('label', {}, 'Hiệu lực đến ', h('input', { name: 'han_hieu_luc', type: 'date', value: x.han_hieu_luc || '' })),
    h('input', { name: 'mo_ta', placeholder: 'Mô tả (tùy chọn)', value: x.mo_ta || '' }),
    h('button', { type: 'submit' }, 'Lưu'),
    h('button', { type: 'button', onclick: dong }, 'Hủy'),
  );
}

function theHoSo(x, lamMoi, gan) {
  const chon = oChon('trang_thai', Object.entries(TEN_TRANG_THAI_HO_SO), x.trang_thai);
  chon.setAttribute('aria-label', `Trạng thái phiên bản ${x.so}`);
  chon.onchange = async () => {
    try { await api(`/api/hoalac/ho-so/phien-ban/${x.pb_id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: chon.value }) }); await lamMoi(); } catch (err) {
      bao(err.message, true); chon.value = x.trang_thai;
    }
  };
  const tepMoi = h('input', { type: 'file', hidden: true, 'aria-label': 'Chọn bản mới', onchange: async () => {
    const tep = tepMoi.files[0];
    if (!tep || !kiemCoTep(tep)) return;
    const fd = new FormData();
    fd.set('tep', tep);
    try { await apiTep(`/api/hoalac/ho-so/${x.id}/phien-ban`, fd); bao(`Đã tải bản v${x.so + 1}.`); await lamMoi(); } catch (err) { bao(err.message, true); }
  } });
  const lichSu = h('div', { class: 'lich-su-ho-so', hidden: true });
  const moLichSu = async () => {
    if (!lichSu.hidden) { lichSu.hidden = true; return; }
    try {
      const { phien_ban } = await api(`/api/hoalac/ho-so/${x.id}/phien-ban`);
      thay(lichSu, h('ul', {}, ...phien_ban.map((v) => h('li', {},
        h('span', { text: `v${v.so} · ${TEN_TRANG_THAI_HO_SO[v.trang_thai]} · ${v.ten_tep} (${coTep(v.kich_thuoc)}) · tải lên ${ngayDu(v.tao_luc)} bởi ${v.tao_boi}${v.doi_luc ? ` · đổi nhãn ${ngayDu(v.doi_luc)} bởi ${v.doi_boi}` : ''}${v.ghi_chu ? ` · ${v.ghi_chu}` : ''}` }),
        ' ', h('button', { type: 'button', onclick: () => moTepHoSo(v.id, v.ten_tep, false) }, 'Tải về')))));
      lichSu.hidden = false;
    } catch (err) { bao(err.message, true); }
  };
  const khungSua = h('div', { hidden: true });
  const moSua = () => {
    if (!khungSua.hidden) { khungSua.hidden = true; return; }
    thay(khungSua, formSuaHoSo(x, gan, lamMoi, () => { khungSua.hidden = true; }));
    khungSua.hidden = false;
  };
  const tenGan = x.ten_thu_tuc ? `Thủ tục: ${x.ten_thu_tuc}` : x.ten_hop_dong ? `Hợp đồng: ${x.ten_hop_dong}` : x.ten_ban_giao ? `Bàn giao: ${x.ten_ban_giao}` : '';
  const nhanHan = x.tinh_trang_han === 'het_han' ? h('span', { class: 'nhan-han nhan-han-het', text: 'Đã hết hạn' })
    : x.tinh_trang_han === 'sap_het_han' ? h('span', { class: 'nhan-han nhan-han-sap', text: 'Sắp hết hạn' }) : null;
  return h('div', { class: `the-raid the-ho-so${x.tinh_trang_han === 'het_han' ? ' tre-han' : x.tinh_trang_han === 'sap_het_han' ? ' sap-het-han' : ''}` },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }),
      h('span', { class: `nhan-trang-thai nhan-ho-so-${x.trang_thai}`, text: `v${x.so} · ${TEN_TRANG_THAI_HO_SO[x.trang_thai]}` }), nhanHan),
    h('p', { class: 'chi-tiet-raid' }, [
      TEN_THU_MUC[x.thu_muc], tenGan,
      x.han_hieu_luc ? `Hiệu lực đến ${ngayDu(x.han_hieu_luc)}` : '',
      `${x.ten_tep} (${coTep(x.kich_thuoc)})`,
      x.doi_luc ? `Nhãn đổi ${ngayDu(x.doi_luc)} bởi ${x.doi_boi}` : '',
    ].filter(Boolean).join(' · ')),
    x.mo_ta ? h('p', { class: 'chi-tiet-raid', text: x.mo_ta }) : null,
    h('div', { class: 'hang-tai-ho-so' },
      h('button', { type: 'button', onclick: () => moTepHoSo(x.pb_id, x.ten_tep, false) }, 'Tải về'),
      xemDuoc(x.ten_tep) ? h('button', { type: 'button', onclick: () => moTepHoSo(x.pb_id, x.ten_tep, true) }, 'Xem') : null,
      h('button', { type: 'button', onclick: moLichSu }, 'Lịch sử')),
    h('div', { class: 'hang-dong-raid' }, chon, tepMoi, h('button', { type: 'button', onclick: () => tepMoi.click() }, 'Tải bản mới'),
      h('button', { type: 'button', onclick: moSua }, 'Sửa thông tin')),
    khungSua,
    lichSu,
  );
}

const TEN_TRANG_THAI_THU_TUC = { todo: 'Chưa làm', doing: 'Đang làm', wait: 'Đang chờ', done: 'Xong', block: 'Bị chặn' };

function veThuTuc(ds, chiXem, lamMoi) {
  const form = chiXem ? null : h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/thu-tuc', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên thủ tục', required: true }),
    h('label', {}, 'Nhóm ', oChon('nhom', ['A', 'B', 'C', 'D', 'E'].map((n) => [n, `Nhóm ${n}`]), 'A')),
    h('input', { name: 'don_vi_phu_trach', placeholder: 'Đơn vị phụ trách' }),
    h('input', { name: 'so_ngay', type: 'number', placeholder: 'Số ngày dự kiến' }),
    h('button', { type: 'submit' }, 'Thêm thủ tục'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có thủ tục nào.'));
  const doiTrangThai = async (id, trangThai) => {
    try { await api(`/api/hoalac/thu-tuc/${id}`, { method: 'PUT', body: JSON.stringify({ trang_thai: trangThai }) }); await lamMoi(); } catch (err) { bao(err.message, true); }
  };
  const list = ds.map((x) => {
    const chonTrangThai = oChon('trang_thai', Object.entries(TEN_TRANG_THAI_THU_TUC), x.trang_thai);
    chonTrangThai.onchange = () => doiTrangThai(x.id, chonTrangThai.value);
    return h('div', { class: 'the-raid' },
      h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ten }), h('span', { class: 'chi-tiet-raid', text: `Nhóm ${x.nhom}` })),
      h('p', { class: 'chi-tiet-raid' }, `${x.don_vi_phu_trach ? `Phụ trách: ${x.don_vi_phu_trach}` : ''}${x.so_ngay != null ? ` · Dự kiến: ${x.so_ngay} ngày` : ''}${x.la_moc ? ' · Mốc dự án' : ''}`),
      h('div', { class: 'hang-dong-raid' },
        chonTrangThai,
        chiXem ? null : h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/thu-tuc/${x.id}`, lamMoi) }, 'Xóa'),
      ),
    );
  });
  return h('div', {}, form, ...list);
}

const TEN_LOAI_VAN_BAN = { den: 'Văn bản đến', di: 'Văn bản đi' };

// thoi_gian là chuỗi "YYYY-MM-DDTHH:MM" từ <input type="datetime-local">, không có múi giờ - ghép chuỗi trực
// tiếp để hiện lại đúng giờ đã gõ, không qua Date()/Intl (dựng Date từ chuỗi này đọc theo múi giờ máy, rồi
// ép hiện theo UTC sẽ lệch giờ với người dùng ở múi giờ khác UTC).
function gioHopDaGo(s) {
  const khop = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
  if (!khop) return s || '';
  const [, nam, thang, ngay, gio, phut] = khop;
  return `${gio}:${phut} ${ngay}/${thang}/${nam}`;
}

function veVanBan(ds, dsThuTuc, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/van-ban', lamMoi) },
    h('label', {}, 'Loại ', oChon('loai', Object.entries(TEN_LOAI_VAN_BAN), 'den')),
    h('input', { name: 'so_hieu', placeholder: 'Số hiệu' }),
    h('input', { name: 'trich_yeu', placeholder: 'Trích yếu', required: true }),
    h('input', { name: 'noi_gui', placeholder: 'Nơi gửi' }),
    h('input', { name: 'noi_nhan', placeholder: 'Nơi nhận' }),
    h('input', { name: 'ngay_van_ban', type: 'date' }),
    dsThuTuc.length ? oChon('lien_quan_thu_tuc_id', [['', 'Liên quan thủ tục (tùy chọn)'], ...dsThuTuc.map((t) => [t.id, t.ten])]) : null,
    h('button', { type: 'submit' }, 'Thêm văn bản'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có văn bản nào.'));
  const tenThuTuc = (id) => dsThuTuc.find((t) => t.id === id)?.ten;
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.trich_yeu }), h('span', { class: 'chi-tiet-raid', text: TEN_LOAI_VAN_BAN[x.loai] })),
    h('p', { class: 'chi-tiet-raid' }, `${x.so_hieu ? `Số: ${x.so_hieu}` : ''}${x.noi_gui ? ` · Nơi gửi: ${x.noi_gui}` : ''}${x.noi_nhan ? ` · Nơi nhận: ${x.noi_nhan}` : ''}${x.ngay_van_ban ? ` · Ngày: ${x.ngay_van_ban}` : ''}${x.lien_quan_thu_tuc_id ? ` · Thủ tục: ${tenThuTuc(x.lien_quan_thu_tuc_id) || x.lien_quan_thu_tuc_id}` : ''}`),
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/van-ban/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

function veHop(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/hop', lamMoi) },
    h('input', { name: 'tieu_de', placeholder: 'Tiêu đề cuộc họp', required: true }),
    h('input', { name: 'thoi_gian', type: 'datetime-local', required: true }),
    h('input', { name: 'dia_diem', placeholder: 'Địa điểm' }),
    h('input', { name: 'thanh_phan', placeholder: 'Thành phần tham dự' }),
    h('textarea', { name: 'noi_dung', placeholder: 'Nội dung chính' }),
    h('button', { type: 'submit' }, 'Thêm cuộc họp'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có cuộc họp nào.'));
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.tieu_de }), h('span', { class: 'chi-tiet-raid', text: gioHopDaGo(x.thoi_gian) })),
    h('p', { class: 'chi-tiet-raid' }, `${x.dia_diem ? `Địa điểm: ${x.dia_diem}` : ''}${x.thanh_phan ? ` · Thành phần: ${x.thanh_phan}` : ''}`),
    x.noi_dung ? h('p', { text: x.noi_dung }) : null,
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/hop/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

// ---------- Ngân sách & EVM ----------
// Không có cơ chế gán theo dòng cho đối tác (api.js chặn hẳn 403), nên module này chỉ chạy khi !chiXem.
function tienOrChuaThongNhat(so, donVi) {
  return so != null ? `${Number(so).toLocaleString('vi-VN')}${donVi ? ` ${donVi}` : ''}` : 'chưa thống nhất';
}

async function taiVaVeNganSach(goc) {
  try {
    const [ns, gn, evm, tt, hd, hm, bg] = await Promise.all([
      api('/api/hoalac/ngan-sach'), api('/api/hoalac/giai-ngan'), api('/api/hoalac/evm'),
      api('/api/hoalac/dot-thanh-toan'), api('/api/hoalac/hop-dong'), api('/api/hoalac/hang-muc'), api('/api/hoalac/ban-giao'),
    ]);
    thay(goc, veNganSach(goc, {
      ngan_sach: ns.ngan_sach, giai_ngan: gn.giai_ngan, evm: evm.evm,
      dot_tra: tt.dot_thanh_toan, canh_bao: tt.canh_bao, hop_dong: hd.hop_dong, hang_muc: hm.hang_muc, ban_giao: bg.ban_giao,
    }));
  } catch (e) {
    thay(goc, khungLoi(e));
  }
}

function veNganSach(goc, d) {
  const subNav = h('nav', { class: 'sub-raid', 'aria-label': 'Mục ngân sách' },
    ...CAC_MUC_NGAN_SACH.map(({ ma, ten }) => h('button', {
      type: 'button',
      'aria-current': ma === nganSachSub ? 'true' : null,
      onclick: () => { nganSachSub = ma; thay(goc, veNganSach(goc, d)); },
      text: `${ten} (${d[ma === 'dong' ? 'ngan_sach' : ma].length})${ma === 'dot_tra' && d.canh_bao.length ? ` - ${d.canh_bao.length} cảnh báo` : ''}`,
    })),
  );
  const lamMoi = () => taiVaVeNganSach(goc);
  const noiDung = {
    dong: () => veDongNganSach(d.ngan_sach, lamMoi),
    dot_tra: () => veDotThanhToan(d, lamMoi),
    giai_ngan: () => veGiaiNgan(d.giai_ngan, d.ngan_sach, lamMoi),
    evm: () => veEvm(d.evm, lamMoi),
  }[nganSachSub]();
  return h('div', { class: 'khung-raid' }, subNav, noiDung);
}

// Xóa một số tiền về NULL (quay lại "chưa thống nhất") không làm được bằng cách để trống ô trong form -
// guiForm() bỏ qua field rỗng, PUT coi là "không đổi" (BO_QUA). Phải gửi null tường minh qua nút riêng.
async function boSoVeChuaThongNhat(duongDan, truong, lamMoi) {
  if (!confirm('Bỏ số này, quay về "chưa thống nhất"?')) return;
  try {
    await api(duongDan, { method: 'PUT', body: JSON.stringify({ [truong]: null }) });
    await lamMoi();
  } catch (err) { bao(err.message, true); }
}

function veDongNganSach(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/ngan-sach', lamMoi) },
    h('input', { name: 'ten', placeholder: 'Tên dòng ngân sách', required: true }),
    h('input', { name: 'nhom', placeholder: 'Nhóm' }),
    h('input', { name: 'ngan_sach_du_kien', type: 'number', step: '0.001', placeholder: 'Số dự kiến (để trống nếu chưa thống nhất)' }),
    h('input', { name: 'don_vi_tien', placeholder: 'Đơn vị tiền (VND)' }),
    h('input', { name: 'nguon', placeholder: 'Nguồn số liệu (tên hồ sơ)' }),
    h('label', {}, 'Trạng thái số liệu ', oChon('trang_thai_so_lieu', [['chua_thong_nhat', 'Chưa thống nhất'], ['da_xac_nhan', 'Đã xác nhận']], 'chua_thong_nhat')),
    h('button', { type: 'submit' }, 'Thêm dòng ngân sách'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có dòng ngân sách nào.'));
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' },
      h('strong', { text: x.ten }),
      h('span', { class: `nhan-trang-thai nhan-trang-thai-${x.trang_thai_so_lieu}`, text: tienOrChuaThongNhat(x.ngan_sach_du_kien, x.don_vi_tien) }),
    ),
    h('p', { class: 'chi-tiet-raid' }, `${x.nhom ? `Nhóm: ${x.nhom}` : ''}${x.nguon ? ` · Nguồn: ${x.nguon}` : ''} · ${x.trang_thai_so_lieu === 'da_xac_nhan' ? 'Đã xác nhận' : 'Chưa thống nhất'}`),
    x.ghi_chu ? h('p', { text: x.ghi_chu }) : null,
    h('div', { class: 'hang-dong-raid' },
      x.ngan_sach_du_kien != null
        ? h('button', { type: 'button', onclick: () => boSoVeChuaThongNhat(`/api/hoalac/ngan-sach/${x.id}`, 'ngan_sach_du_kien', lamMoi) }, 'Bỏ số')
        : null,
      h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/ngan-sach/${x.id}`, lamMoi) }, 'Xóa'),
    ),
  ));
  return h('div', {}, form, ...list);
}

// ---------- Đợt thanh toán của hợp đồng (cảnh báo tính ở máy chủ: src/hoalac/thanh-toan.js) ----------
const TEN_TRANG_THAI_DOT = { cho: 'Chờ', da_de_nghi: 'Đã đề nghị', da_tra: 'Đã trả', huy: 'Hủy' };
const TEN_CANH_BAO = { qua_han: 'Quá hạn', sap_den_han: 'Sắp đến hạn', du_dieu_kien: 'Đủ điều kiện, chưa đề nghị', lech_gia_tri: 'Tổng các đợt lệch giá trị hợp đồng' };
const homNayVN = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const ngayVN = (s) => fmt.ngayNgan.format(new Date(`${s}T00:00:00Z`));

async function ghiDot(duongDan, method, than, lamMoi) {
  try {
    await api(duongDan, { method, body: than ? JSON.stringify(than) : undefined });
    await lamMoi();
  } catch (err) { bao(err.message, true); }
}

function veOCanhBao(ds) {
  if (!ds.length) return h('p', { class: 'trong' }, 'Không có cảnh báo thanh toán.');
  return h('div', { class: 'o-canh-bao', role: 'status' },
    h('strong', {}, `${ds.length} cảnh báo thanh toán`),
    h('ul', {}, ...ds.map((c) => h('li', {}, c.loai === 'lech_gia_tri'
      ? `${c.ten_hop_dong}: ${TEN_CANH_BAO[c.loai]} (đợt ${tienOrChuaThongNhat(c.tong_dot)} / hợp đồng ${tienOrChuaThongNhat(c.gia_tri)}${c.du_so ? '' : ', còn đợt chưa có số'})`
      : `${c.ten} - ${c.ten_hop_dong}: ${TEN_CANH_BAO[c.loai]}${c.han ? `, hạn ${ngayVN(c.han)}` : ''}`))),
  );
}

function veDotThanhToan(d, lamMoi) {
  const canhBao = veOCanhBao(d.canh_bao);
  if (!d.hop_dong.length) return h('div', {}, canhBao, h('p', { class: 'trong' }, 'Chưa có hợp đồng. Thêm hợp đồng trước (mục Pháp lý - Hợp đồng).'));
  const tenHm = (id) => d.hang_muc.find((x) => x.id === id)?.ten;
  const tenBg = (id) => d.ban_giao.find((x) => x.id === id)?.ten;
  const tuyChonLienKet = [['', 'Điều kiện: không gắn'],
    ...d.hang_muc.map((x) => [`hm:${x.id}`, `Hạng mục: ${x.ten}`]),
    ...d.ban_giao.map((x) => [`bg:${x.id}`, `Bàn giao: ${x.ten}`])];
  const homNay = homNayVN();

  const formThem = (hd) => h('form', {
    class: 'form-raid',
    onsubmit: async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const than = { hop_dong_id: hd.id, ten: f.ten.value.trim() };
      if (f.so_tien.value !== '') than.so_tien = Number(f.so_tien.value);
      if (f.han.value) than.han = f.han.value;
      if (f.dieu_kien.value.trim()) than.dieu_kien = f.dieu_kien.value.trim();
      const lk = f.lien_ket.value;
      if (lk.startsWith('hm:')) than.hang_muc_id = Number(lk.slice(3));
      if (lk.startsWith('bg:')) than.ban_giao_id = Number(lk.slice(3));
      await ghiDot('/api/hoalac/dot-thanh-toan', 'POST', than, lamMoi);
    },
  },
    h('input', { name: 'ten', placeholder: 'Tên đợt (ví dụ: Tạm ứng)', required: true }),
    h('input', { name: 'so_tien', type: 'number', step: '0.001', min: '0', placeholder: 'Số tiền (để trống nếu chưa thống nhất)' }),
    h('label', {}, 'Hạn ', h('input', { name: 'han', type: 'date' })),
    oChon('lien_ket', tuyChonLienKet, ''),
    h('input', { name: 'dieu_kien', placeholder: 'Ghi chú điều kiện' }),
    h('button', { type: 'submit' }, 'Thêm đợt'),
  );

  const theDot = (x) => {
    const loi = d.canh_bao.filter((c) => c.dot_id === x.id);
    const dieuKien = [
      x.hang_muc_id ? `Hạng mục: ${tenHm(x.hang_muc_id) || x.hang_muc_id}` : '',
      x.ban_giao_id ? `Bàn giao: ${tenBg(x.ban_giao_id) || x.ban_giao_id}` : '',
      x.dieu_kien,
    ].filter(Boolean).join(' · ');
    const hangNut = [];
    if (x.trang_thai === 'da_tra') {
      hangNut.push(h('button', { type: 'button', onclick: () => confirm('Bỏ đánh dấu đã trả? Dòng giải ngân đi kèm sẽ bị gỡ.') && ghiDot(`/api/hoalac/dot-thanh-toan/${x.id}/bo-tra`, 'POST', null, lamMoi) }, 'Bỏ đã trả'));
    } else {
      const chon = oChon('trang_thai', [['cho', 'Chờ'], ['da_de_nghi', 'Đã đề nghị'], ['huy', 'Hủy']], x.trang_thai);
      chon.onchange = () => ghiDot(`/api/hoalac/dot-thanh-toan/${x.id}`, 'PUT', { trang_thai: chon.value }, lamMoi);
      hangNut.push(chon);
      if (x.trang_thai !== 'huy') {
        hangNut.push(h('details', { class: 'mo-tra' },
          h('summary', {}, 'Đã trả'),
          h('form', {
            class: 'form-raid',
            onsubmit: async (e) => {
              e.preventDefault();
              const f = e.target.elements;
              const than = { so_tien: Number(f.so_tien.value), ngay: f.ngay.value };
              if (f.ngan_sach_dong_id && f.ngan_sach_dong_id.value) than.ngan_sach_dong_id = Number(f.ngan_sach_dong_id.value);
              await ghiDot(`/api/hoalac/dot-thanh-toan/${x.id}/tra`, 'POST', than, lamMoi);
            },
          },
            h('input', { name: 'so_tien', type: 'number', step: '0.001', min: '0', required: true, placeholder: 'Số tiền đã trả', value: x.so_tien != null ? String(x.so_tien) : null }),
            h('input', { name: 'ngay', type: 'date', required: true, value: homNay }),
            d.ngan_sach.length ? oChon('ngan_sach_dong_id', [['', 'Dòng ngân sách (tùy chọn)'], ...d.ngan_sach.map((n) => [n.id, n.ten])]) : null,
            h('button', { type: 'submit' }, 'Ghi đã trả và tạo giải ngân'),
          ),
        ));
      }
      hangNut.push(h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/dot-thanh-toan/${x.id}`, lamMoi) }, 'Xóa'));
    }
    return h('div', { class: `the-dot${loi.some((c) => c.loai === 'qua_han') ? ' tre-han' : ''}` },
      h('div', { class: 'dau-the-raid' },
        h('strong', { text: x.ten }),
        h('span', { class: `nhan-trang-thai nhan-dot-${x.trang_thai}`, text: TEN_TRANG_THAI_DOT[x.trang_thai] })),
      h('p', { class: 'chi-tiet-raid' }, [
        tienOrChuaThongNhat(x.so_tien),
        x.han ? `Hạn: ${ngayVN(x.han)}` : 'Chưa có hạn',
        x.ngay_tra ? `Đã trả: ${ngayVN(x.ngay_tra)}` : '',
      ].filter(Boolean).join(' · ')),
      dieuKien ? h('p', { class: 'chi-tiet-raid', text: `Điều kiện: ${dieuKien}` }) : null,
      loi.length ? h('p', { class: 'nhac-dot', text: loi.map((c) => TEN_CANH_BAO[c.loai]).join(' · ') }) : null,
      h('div', { class: 'hang-dong-raid' }, ...hangNut),
    );
  };

  const theHd = d.hop_dong.map((hd) => {
    const dots = d.dot_tra.filter((x) => x.hop_dong_id === hd.id);
    return h('div', { class: 'the-raid' },
      h('div', { class: 'dau-the-raid' }, h('strong', { text: hd.ten }),
        h('span', { class: 'chi-tiet-raid', text: hd.gia_tri != null ? `Giá trị: ${tienOrChuaThongNhat(hd.gia_tri, hd.don_vi_tien)}` : 'Giá trị chưa thống nhất' })),
      dots.length ? h('div', { class: 'ds-dot' }, ...dots.map(theDot)) : h('p', { class: 'trong' }, 'Chưa có đợt thanh toán.'),
      formThem(hd),
    );
  });
  return h('div', {}, canhBao, ...theHd);
}

function veGiaiNgan(ds, dsDong, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/giai-ngan', lamMoi) },
    dsDong.length ? oChon('ngan_sach_dong_id', [['', 'Dòng ngân sách (tùy chọn)'], ...dsDong.map((x) => [x.id, x.ten])]) : null,
    h('input', { name: 'so_tien', type: 'number', step: '0.001', placeholder: 'Số tiền', required: true }),
    h('input', { name: 'ngay', type: 'date' }),
    h('input', { name: 'noi_dung', placeholder: 'Nội dung' }),
    h('button', { type: 'submit' }, 'Thêm giải ngân'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có giải ngân nào.'));
  const tenDong = (id) => dsDong.find((x) => x.id === id)?.ten;
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: tienOrChuaThongNhat(x.so_tien) }), x.ngay ? h('span', { class: 'chi-tiet-raid', text: fmt.ngayNgan.format(new Date(`${x.ngay}T00:00:00Z`)) }) : null),
    h('p', { class: 'chi-tiet-raid' }, `${x.ngan_sach_dong_id ? `Dòng: ${tenDong(x.ngan_sach_dong_id) || x.ngan_sach_dong_id}` : ''}${x.noi_dung ? ` · ${x.noi_dung}` : ''}`),
    x.dot_id
      ? h('p', { class: 'chi-tiet-raid', text: 'Tạo từ đợt thanh toán. Muốn gỡ thì bỏ đánh dấu đã trả ở tab Hợp đồng.' })
      : h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/giai-ngan/${x.id}`, lamMoi) }, 'Xóa')),
  ));
  return h('div', {}, form, ...list);
}

function veEvm(ds, lamMoi) {
  const form = h('form', { class: 'form-raid', onsubmit: (e) => guiForm(e, '/api/hoalac/evm', lamMoi) },
    h('input', { name: 'ky', placeholder: 'Kỳ báo cáo (ví dụ 2026-10)', required: true }),
    h('input', { name: 'pv', type: 'number', step: '0.001', placeholder: 'PV - giá trị dự kiến' }),
    h('input', { name: 'ac', type: 'number', step: '0.001', placeholder: 'AC - chi phí thực tế' }),
    h('input', { name: 'ev', type: 'number', step: '0.001', placeholder: 'EV - giá trị đạt được' }),
    h('button', { type: 'submit' }, 'Thêm kỳ EVM'),
  );
  if (!ds.length) return h('div', {}, form, h('p', { class: 'trong' }, 'Chưa có kỳ EVM nào.'));
  const truong = [['pv', 'PV'], ['ac', 'AC'], ['ev', 'EV']];
  const list = ds.map((x) => h('div', { class: 'the-raid' },
    h('div', { class: 'dau-the-raid' }, h('strong', { text: x.ky }),
      x.cpi != null ? h('span', { class: 'chi-tiet-raid', text: `CPI ${x.cpi.toFixed(2)}` }) : null,
      x.spi != null ? h('span', { class: 'chi-tiet-raid', text: `SPI ${x.spi.toFixed(2)}` }) : null,
    ),
    h('p', { class: 'chi-tiet-raid' },
      truong.map(([k, ten]) => `${ten}: ${tienOrChuaThongNhat(x[k])}`).join(' · '),
    ),
    h('div', { class: 'hang-dong-raid' },
      ...truong.filter(([k]) => x[k] != null).map(([k, ten]) =>
        h('button', { type: 'button', onclick: () => boSoVeChuaThongNhat(`/api/hoalac/evm/${x.id}`, k, lamMoi) }, `Bỏ ${ten}`)),
      h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/evm/${x.id}`, lamMoi) }, 'Xóa'),
    ),
  ));
  return h('div', {}, form, ...list);
}

chinh();
