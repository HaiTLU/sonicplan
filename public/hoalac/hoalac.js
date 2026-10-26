// Giao diện Viện Hòa Lạc: bảng Kanban (kéo-thả đổi trạng thái) và lịch Gantt rút gọn (thanh theo CPM).
import { api, bao, fmt, h, khungLoi, thay } from './chung.js';

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
  { ma: 'giai_ngan', ten: 'Giải ngân' },
  { ma: 'evm', ten: 'EVM' },
];
let nganSachSub = 'dong';

async function chinh() {
  const goc = document.getElementById('goc');
  let toi;
  try {
    toi = await api('/api/toi');
  } catch (e) {
    thay(goc, khungLoi(e));
    return;
  }
  document.getElementById('ten-to-chuc').textContent = toi.to_chuc.ten;
  const chiXem = toi.to_chuc.vai_tro === 'doi_tac';
  document.getElementById('tieu-de').textContent = `Quản lý dự án${chiXem ? ' (chỉ xem phần được giao)' : ''}`;

  const tabKanban = document.getElementById('tab-kanban');
  const tabGantt = document.getElementById('tab-gantt');
  const tabRaid = document.getElementById('tab-raid');
  const tabPhapLy = document.getElementById('tab-phap-ly');
  const tabNganSach = document.getElementById('tab-ngan-sach');
  const moKanban = () => taiVaVe(goc, chiXem, 'kanban');
  const moGantt = () => taiVaVe(goc, chiXem, 'gantt');
  const moPhapLy = () => taiVaVePhapLy(goc, chiXem);
  if (chiXem) {
    // Đối tác: RAID và Ngân sách trả 403 cho mọi thao tác (không có cơ chế gán theo dòng), không gọi API
    // và không cho thấy hai tab này. Pháp lý vẫn còn vì đối tác được xem đúng thủ tục được gán (404 nếu
    // không), nhưng vePhapLy() tự ẩn 5 mục còn lại.
    tabRaid.remove();
    tabNganSach.remove();
    const cacTab = [tabKanban, tabGantt, tabPhapLy];
    tabKanban.onclick = () => { chonTab(tabKanban, cacTab); moKanban(); };
    tabGantt.onclick = () => { chonTab(tabGantt, cacTab); moGantt(); };
    tabPhapLy.onclick = () => { chonTab(tabPhapLy, cacTab); moPhapLy(); };
  } else {
    const cacTab = [tabKanban, tabGantt, tabRaid, tabPhapLy, tabNganSach];
    const moRaid = () => taiVaVeRaid(goc);
    const moNganSach = () => taiVaVeNganSach(goc);
    tabKanban.onclick = () => { chonTab(tabKanban, cacTab); moKanban(); };
    tabGantt.onclick = () => { chonTab(tabGantt, cacTab); moGantt(); };
    tabRaid.onclick = () => { chonTab(tabRaid, cacTab); moRaid(); };
    tabPhapLy.onclick = () => { chonTab(tabPhapLy, cacTab); moPhapLy(); };
    tabNganSach.onclick = () => { chonTab(tabNganSach, cacTab); moNganSach(); };
  }
  await moKanban();
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
    const [ns, gn, evm] = await Promise.all([
      api('/api/hoalac/ngan-sach'), api('/api/hoalac/giai-ngan'), api('/api/hoalac/evm'),
    ]);
    thay(goc, veNganSach(goc, { ngan_sach: ns.ngan_sach, giai_ngan: gn.giai_ngan, evm: evm.evm }));
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
      text: `${ten} (${d[ma === 'dong' ? 'ngan_sach' : ma].length})`,
    })),
  );
  const lamMoi = () => taiVaVeNganSach(goc);
  const noiDung = {
    dong: () => veDongNganSach(d.ngan_sach, lamMoi),
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
    h('div', { class: 'hang-dong-raid' }, h('button', { type: 'button', onclick: () => xoaRaid(`/api/hoalac/giai-ngan/${x.id}`, lamMoi) }, 'Xóa')),
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
