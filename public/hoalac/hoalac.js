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
  const moKanban = () => taiVaVe(goc, chiXem, 'kanban');
  const moGantt = () => taiVaVe(goc, chiXem, 'gantt');
  if (chiXem) {
    // Đối tác: RAID trả 403 cho mọi thao tác, không gọi API và không cho thấy tab này.
    tabRaid.remove();
    const cacTab = [tabKanban, tabGantt];
    tabKanban.onclick = () => { chonTab(tabKanban, cacTab); moKanban(); };
    tabGantt.onclick = () => { chonTab(tabGantt, cacTab); moGantt(); };
  } else {
    const cacTab = [tabKanban, tabGantt, tabRaid];
    const moRaid = () => taiVaVeRaid(goc);
    tabKanban.onclick = () => { chonTab(tabKanban, cacTab); moKanban(); };
    tabGantt.onclick = () => { chonTab(tabGantt, cacTab); moGantt(); };
    tabRaid.onclick = () => { chonTab(tabRaid, cacTab); moRaid(); };
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
  for (const [k, v] of fd.entries()) if (v !== '') than[k] = v;
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

chinh();
