// Trang Claude: khung chat giống Claude Code, chạy bằng trạm Claude trên máy Mac của chủ tổ chức.
// Trình duyệt nối WebSocket tới /api/tram/ws; phòng chat chuyển yêu cầu sang trạm và đưa chữ Claude về từng đoạn.

const MODEL = [['', 'Mặc định'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku'], ['fable', 'Fable']];
const EFFORT = [['', 'Mặc định'], ['low', 'Thấp'], ['medium', 'Vừa'], ['high', 'Cao'], ['xhigh', 'Rất cao'], ['max', 'Tối đa']];
const CHE_DO = [['acceptEdits', 'Tự sửa tệp'], ['plan', 'Chỉ lập kế hoạch']];
const GIAI_MODEL = 'Model Claude dùng cho lượt này. Opus mạnh nhất, Sonnet cân bằng, Haiku nhanh và rẻ. Mặc định là model đang đặt trong Claude Code trên máy Mac.';
const GIAI_EFFORT = 'Mức suy nghĩ: càng cao Claude nghĩ càng kỹ nhưng chậm hơn và tốn lượt dùng hơn. Mặc định theo cài đặt Claude Code trên máy Mac.';
const GIAI_CHE_DO = 'Tự sửa tệp: Claude được tạo và sửa tệp trong thư mục của phiên. Chỉ lập kế hoạch: Claude chỉ đọc và đề xuất, không sửa gì.';
const TEP_TOI_DA = 25 * 1024 * 1024;

// Trạng thái giữ qua các lần đổi trang, để kết nối và chữ đang chạy không mất khi anh sang trang khác rồi quay lại.
const st = {
  ws: null, noi: false, choNoi: 1000, henNoi: null, henNhip: null,
  tram: null, ds: [], chon: null, suKien: [], dangViet: '', dangLam: null,
  duAn: [], cauHinh: docCauHinh(), dinhKem: [], goc: null, d: null, laChu: false, nhap: '',
};

function docCauHinh() {
  try { return { model: '', effort: '', che_do: 'acceptEdits', du_an: '', ...JSON.parse(localStorage.getItem('sp.tram.cau-hinh') || '{}') }; } catch { return { model: '', effort: '', che_do: 'acceptEdits', du_an: '' }; }
}
function luuCauHinh() {
  try { localStorage.setItem('sp.tram.cau-hinh', JSON.stringify(st.cauHinh)); } catch {}
}

// ---------- Kết nối ----------
function noi() {
  if (st.ws && st.ws.readyState <= 1) return;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/tram/ws`);
  st.ws = ws;
  ws.onopen = () => {
    st.noi = true;
    st.choNoi = 1000;
    gui({ loai: 'chao' });
    gui({ loai: 'ds' });
    if (st.chon) gui({ loai: 'mo', phien: st.chon });
    clearInterval(st.henNhip);
    st.henNhip = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 30000);
    veDau();
  };
  ws.onmessage = (e) => {
    if (e.data === 'pong') return;
    let tin;
    try { tin = JSON.parse(e.data); } catch { return; }
    nhan(tin);
  };
  ws.onclose = () => {
    clearInterval(st.henNhip);
    st.noi = false;
    st.ws = null;
    veDau();
    clearTimeout(st.henNoi);
    st.henNoi = setTimeout(noi, st.choNoi);
    st.choNoi = Math.min(st.choNoi * 2, 30000);
  };
  ws.onerror = () => {};
}
function gui(tin) {
  if (st.ws?.readyState === 1) { st.ws.send(JSON.stringify(tin)); return true; }
  return false;
}

function nhan(tin) {
  if (tin.loai === 'trang_thai') { st.tram = tin; veDau(); veLuong(); return; }
  if (tin.loai === 'ds') { st.ds = tin.phien || []; veDs(); veDau(); veSoan(); return; }
  if (tin.loai === 'loi') { st.d?.bao(tin.noi_dung, { loi: true }); return; }
  if (tin.loai === 'het_han') return;
  if (tin.loai === 'lich_su') {
    if (tin.phien.id !== st.chon) return;
    capNhatPhien(tin.phien);
    st.suKien = tin.su_kien || [];
    st.dangViet = '';
    st.dangLam = null;
    veLuong(true);
    return;
  }
  if (tin.loai === 'phien') {
    capNhatPhien(tin.phien);
    // Phiên mới tạo từ chính trang này: chuyển sang phiên đó.
    if (tin.moi_tu && tin.moi_tu === st.maTam) { st.maTam = null; chonPhien(tin.phien.id, { khongMo: true }); }
    if (tin.phien.id === st.chon) { if (!tin.phien.dang_chay) { st.dangViet = ''; st.dangLam = null; } veSoan(); veLuong(); }
    return;
  }
  if (tin.loai === 'su_kien') {
    if (tin.phien !== st.chon) return;
    const sk = tin.su_kien;
    if (sk.tam) {
      if (sk.loai === 'chu_dang') { st.dangViet += sk.them || ''; st.dangLam = null; }
      else if (sk.loai === 'suy_nghi') st.dangLam = 'Claude đang suy nghĩ';
      else if (sk.loai === 'cong_cu_dang') st.dangLam = `Claude chuẩn bị dùng ${tenCongCu(sk.ten)}`;
      veDangChay();
      return;
    }
    if (st.suKien.some((x) => x.seq === sk.seq)) return;
    st.suKien.push(sk);
    if (sk.loai === 'chu' || sk.loai === 'xong') st.dangViet = '';
    if (sk.loai === 'cong_cu') st.dangLam = null;
    veLuong();
  }
}

function capNhatPhien(p) {
  const i = st.ds.findIndex((x) => x.id === p.id);
  if (i >= 0) st.ds[i] = p; else st.ds.unshift(p);
  st.ds.sort((a, b) => String(b.cap_nhat).localeCompare(String(a.cap_nhat)));
  veDs();
  if (p.id === st.chon) veDau();
}
const phienChon = () => st.ds.find((p) => p.id === st.chon) || null;

function chonPhien(id, { khongMo = false } = {}) {
  st.chon = id;
  st.dangViet = '';
  st.dangLam = null;
  if (!khongMo) { st.suKien = []; gui({ loai: 'mo', phien: id }); }
  const p = phienChon();
  if (p?.du_an) st.cauHinh.du_an = String(p.du_an.id ?? '');
  const muon = id ? `#claude/${id}` : '#claude';
  if (location.hash !== muon) history.replaceState(null, '', muon);
  veDs();
  veDau();
  veSoan();
  veLuong(true);
  st.o?.focus();
}

// ---------- Vẽ ----------
const TEN_CONG_CU = { Read: 'đọc tệp', Write: 'ghi tệp', Edit: 'sửa tệp', MultiEdit: 'sửa tệp', Glob: 'tìm tệp', Grep: 'tìm trong tệp', WebSearch: 'tìm trên web', WebFetch: 'mở trang web', TodoWrite: 'danh sách việc', Task: 'trợ lý con', Skill: 'kỹ năng', Bash: 'lệnh máy' };
const tenCongCu = (t) => TEN_CONG_CU[t] || t || 'công cụ';

function thoiGian(ms) {
  if (!ms) return '';
  const g = Math.round(ms / 1000);
  return g < 60 ? `${g} giây` : `${Math.floor(g / 60)} phút ${g % 60} giây`;
}

export function veTram(goc, d, thamSo) {
  st.d = d;
  st.goc = goc;
  st.laChu = d.laChu;
  const { h } = d;
  if (thamSo && thamSo !== st.chon) { st.chon = thamSo; st.suKien = []; }
  st.vDs = h('nav', { class: 'tram-ds', 'aria-label': 'Các phiên chat với Claude' });
  st.vDau = h('div', { class: 'tram-dau' });
  st.vLuong = h('div', { class: 'tram-luong', role: 'log', 'aria-live': 'polite', 'aria-label': 'Hội thoại với Claude', tabindex: '0' });
  st.vSoan = h('form', { class: 'tram-soan', onsubmit: (e) => { e.preventDefault(); guiYeuCau(); } });
  const chinh = h('div', { class: 'tram-chinh' }, st.vDau, st.vLuong, st.vSoan);
  // Kéo thả tệp vào khung chat.
  chinh.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); chinh.classList.add('dang-tha'); } });
  chinh.addEventListener('dragleave', (e) => { if (!chinh.contains(e.relatedTarget)) chinh.classList.remove('dang-tha'); });
  chinh.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); chinh.classList.remove('dang-tha'); themTep([...e.dataTransfer.files]); } });
  d.thay(goc, h('div', { class: 'tram' }, st.vDs, chinh));
  veDs(); veDau(); veSoan(); veLuong(true);
  if (st.noi) { gui({ loai: 'ds' }); if (st.chon) gui({ loai: 'mo', phien: st.chon }); } else noi();
  if (!st.duAn.length) d.api('/api/du-an').then((r) => { st.duAn = r.du_an || []; veDau(); }).catch(() => {});
  st.o?.focus();
}

function veDs() {
  if (!st.vDs) return;
  const { h, icon, thay, luc } = st.d;
  thay(st.vDs,
    h('button', { class: 'nut nut-chinh tram-moi', type: 'button', onclick: () => chonPhien(null) }, icon('cong'), 'Phiên mới'),
    st.ds.length ? h('ul', {}, ...st.ds.map((p) => h('li', {},
      h('a', { href: `#claude/${p.id}`, ...(p.id === st.chon ? { 'aria-current': 'page' } : {}), onclick: (e) => { e.preventDefault(); chonPhien(p.id); } },
        h('span', { class: 'tram-ds-ten', text: p.tieu_de || 'Phiên chưa đặt tên' }),
        h('small', {}, p.dang_chay ? h('span', { class: 'cham-chay', 'aria-label': 'Đang chạy' }) : null, p.du_an?.ten ? `${p.du_an.ten} · ` : '', luc(p.cap_nhat)))))) : h('p', { class: 'tram-ds-trong', text: 'Chưa có phiên nào. Gõ yêu cầu ở khung bên phải để bắt đầu.' }),
  );
}

function oChon(ds, giaTri, khiDoi, nhan, giai) {
  const { h, meo } = st.d;
  const chon = h('select', { 'aria-label': nhan, onchange: () => khiDoi(chon.value) }, ...ds.map(([v, t]) => h('option', { value: v, text: t })));
  chon.value = giaTri ?? '';
  return h('label', { class: 'tram-chon', ...meo(giai) }, h('span', { text: nhan }), chon);
}

function veDau() {
  if (!st.vDau) return;
  const { h, thay, meo } = st.d;
  const p = phienChon();
  const tr = st.tram;
  const den = !st.noi ? ['xam', 'Đang nối lại...', 'Trang đang nối lại với Sonicplan.'] : !tr ? ['xam', 'Đang kiểm trạm...', 'Đang hỏi trạng thái trạm Claude.'] : tr.tram_mo ? ['xanh', `Trạm đang chạy${tr.may ? ` trên ${tr.may}` : ''}`, `Trạm Claude trên máy Mac đang nối. ${tr.claude ? `Claude Code ${tr.claude}. ` : ''}Bản trạm ${tr.phien_ban || '?'}.`] : ['do', 'Trạm đang tắt', 'Máy Mac đang ngủ hoặc trạm chưa cài. Yêu cầu gửi lúc này sẽ chờ đến khi trạm bật lại.'];
  const duAn = [['', 'Không gắn dự án'], ...st.duAn.map((x) => [String(x.id), x.ten])];
  thay(st.vDau,
    h('div', { class: 'tram-dau-tren' },
      h('h2', { text: p?.tieu_de || 'Phiên mới' }),
      h('button', { class: `tram-den ${den[0]}`, type: 'button', ...meo(den[2]), onclick: () => moCaiTram() }, h('span', { class: 'cham' }), den[1])),
    h('div', { class: 'tram-cau-hinh' },
      oChon(duAn, st.cauHinh.du_an, (v) => { st.cauHinh.du_an = v; luuCauHinh(); }, 'Dự án', 'Tệp Claude tạo ra được xếp vào thư mục của dự án này trên máy Mac.'),
      oChon(MODEL, st.cauHinh.model, (v) => { st.cauHinh.model = v; luuCauHinh(); }, 'Model', GIAI_MODEL),
      oChon(EFFORT, st.cauHinh.effort, (v) => { st.cauHinh.effort = v; luuCauHinh(); }, 'Effort', GIAI_EFFORT),
      oChon(CHE_DO, st.cauHinh.che_do, (v) => { st.cauHinh.che_do = v; luuCauHinh(); }, 'Chế độ', GIAI_CHE_DO)),
  );
}

// Bảng cài trạm: chủ tổ chức bấm tạo lệnh, chép lệnh, dán vào Terminal trên máy Mac.
function moCaiTram() {
  const { h, icon, api, bao, oChep } = st.d;
  const tr = st.tram || {};
  const ket = h('div', { class: 'tram-cai-lenh' });
  const nut = h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
    nut.disabled = true;
    try {
      const { lenh } = await api('/api/tram/lenh-cai', { method: 'POST', body: '{}' });
      st.d.thay(ket, oChep(lenh, { lo: true }), h('p', { class: 'canh-bao-nho', text: 'Lệnh này chứa mã riêng của trạm. Không gửi lệnh cho người khác. Tạo lệnh mới thì lệnh cũ hết dùng được.' }));
    } catch (e) { bao(e.message, { loi: true }); }
    nut.disabled = false;
  } }, tr.co_khoa ? 'Tạo lệnh cài mới' : 'Tạo lệnh cài');
  const hop = h('dialog', { class: 'tram-hop-cai', 'aria-labelledby': 'tram-cai-td', onclose: () => hop.remove() },
    h('div', { class: 'kc-dau' }, h('h2', { id: 'tram-cai-td', text: tr.tram_mo ? 'Trạm Claude đang chạy' : 'Cài trạm Claude trên máy Mac' }),
      h('button', { class: 'nut-icon', type: 'button', 'aria-label': 'Đóng', onclick: () => hop.close() }, icon('dong'))),
    h('div', { class: 'tram-hop-than' },
      h('p', { text: 'Trạm là chương trình nhỏ chạy nền trên máy Mac, gọi Claude Code ngay trên máy bằng tài khoản Claude đang đăng nhập ở đó. Trạm chỉ nối ra Sonicplan, không mở cổng nào trên máy.' }),
      tr.tram_mo ? h('p', { text: `Máy: ${tr.may || '?'} · Claude Code ${tr.claude || '?'} · bản trạm ${tr.phien_ban || '?'}.` }) : null,
      st.laChu ? h('ol', { class: 'buoc' },
        h('li', { text: 'Trên máy Mac, cài Claude Code và đăng nhập (gõ claude trong Terminal một lần).' }),
        h('li', {}, 'Bấm nút dưới để tạo lệnh cài, rồi bấm biểu tượng chép.'),
        h('li', { text: 'Mở Terminal trên máy Mac, dán lệnh, bấm Enter. Trạm tự chạy lại khi máy khởi động.' }),
        h('li', { text: 'Đèn trên trang này chuyển xanh "Trạm đang chạy" là xong.' })) : h('p', { text: 'Chỉ chủ tổ chức cài được trạm.' }),
      st.laChu ? nut : null, ket,
      h('p', { class: 'tram-ghi', text: 'Tệp Claude tạo nằm ở thư mục "Sonicplan Claude" trong thư mục nhà của máy Mac, xếp theo dự án. Nhật ký trạm: ~/.sonicplan-tram/nhat-ky.log.' })),
  );
  document.body.append(hop);
  hop.showModal();
}

function veSoan() {
  if (!st.vSoan) return;
  const { h, icon, thay, kichThuoc } = st.d;
  const p = phienChon();
  const dangChay = Boolean(p?.dang_chay);
  if (!st.o) {
    st.o = h('textarea', { class: 'tram-o', rows: '1', placeholder: 'Giao việc cho Claude... (Enter để gửi, Shift+Enter xuống dòng)', 'aria-label': 'Yêu cầu cho Claude' });
    st.o.addEventListener('input', () => { st.nhap = st.o.value; coGian(); });
    st.o.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); guiYeuCau(); }
      if (e.key === 'Escape' && phienChon()?.dang_chay) { e.preventDefault(); dungLuot(); }
    });
    st.o.addEventListener('paste', (e) => {
      const tep = [...(e.clipboardData?.files || [])];
      if (tep.length) { e.preventDefault(); themTep(tep); }
    });
    st.chonTep = h('input', { type: 'file', multiple: true, hidden: true, onchange: () => { themTep([...st.chonTep.files]); st.chonTep.value = ''; } });
  }
  // Khung soạn dựng một lần mỗi lần vào trang; sau đó chỉ thay chip và nút, để ô gõ không mất con trỏ.
  if (!st.vSoan.firstChild) {
    st.vChips = h('div', { class: 'tram-chips' });
    st.vGoiY = h('small', { class: 'tram-goi-y' });
    st.vNut = h('span', { class: 'tram-nut-boc' });
    thay(st.vSoan, st.vChips,
      h('div', { class: 'tram-o-boc' }, st.o,
        h('div', { class: 'tram-soan-duoi' },
          h('button', { class: 'nut-icon', type: 'button', 'aria-label': 'Đính kèm ảnh, tệp', title: 'Đính kèm ảnh, tệp (hoặc kéo thả, dán ảnh)', onclick: () => st.chonTep.click() }, icon('kep')),
          st.vGoiY, st.vNut)),
      st.chonTep);
    st.o.value = st.nhap;
  }
  thay(st.vChips, ...st.dinhKem.map((t) => h('span', { class: `tram-chip${t.loi ? ' loi' : ''}` },
    t.anh ? h('img', { src: t.anh, alt: '' }) : icon('tep'),
    h('span', { class: 'ten', text: t.ten }),
    h('small', { text: t.dang ? 'đang tải...' : t.loi ? 'lỗi' : kichThuoc(t.kich_thuoc) }),
    h('button', { class: 'nut-icon', type: 'button', 'aria-label': `Bỏ ${t.ten}`, onclick: () => { st.dinhKem = st.dinhKem.filter((x) => x !== t); veSoan(); } }, icon('dong')))));
  st.vChips.hidden = !st.dinhKem.length;
  st.vGoiY.textContent = dangChay ? 'Claude đang làm. Bấm Dừng hoặc Esc để ngắt, rồi gõ hướng mới.' : 'Kéo thả hoặc dán ảnh chụp màn hình vào đây.';
  if (st.vNut.dataset.chay !== String(dangChay)) {
    st.vNut.dataset.chay = String(dangChay);
    thay(st.vNut, dangChay
      ? h('button', { class: 'nut tram-nut-dung', type: 'button', onclick: dungLuot, title: 'Dừng Claude (Esc)' }, icon('dung'), 'Dừng')
      : h('button', { class: 'nut nut-chinh tram-nut-gui', type: 'submit', title: 'Gửi (Enter)' }, icon('gui'), 'Gửi'));
  }
  coGian();
}
function coGian() {
  if (!st.o) return;
  st.o.style.height = 'auto';
  st.o.style.height = `${Math.min(st.o.scrollHeight, 260)}px`;
}

async function themTep(ds) {
  for (const f of ds) {
    if (f.size > TEP_TOI_DA) { st.d.bao(`${f.name || 'Tệp'} lớn quá 25 MB.`, { loi: true }); continue; }
    if (st.dinhKem.length >= 20) { st.d.bao('Mỗi lượt đính kèm tối đa 20 tệp.', { loi: true }); break; }
    const ten = f.name || `anh-chup-${Date.now()}.png`;
    const t = { ten, kich_thuoc: f.size, loai: f.type, dang: true, anh: /^image\//.test(f.type) ? URL.createObjectURL(f) : null };
    st.dinhKem.push(t);
    veSoan();
    try {
      const ra = await fetch(`/api/tram/tep?phien=${encodeURIComponent(st.chon || 'moi')}`, { method: 'POST', body: f, headers: { 'content-type': f.type || 'application/octet-stream', 'x-ten-tep': encodeURIComponent(ten), accept: 'application/json' } });
      const j = await ra.json().catch(() => ({}));
      if (!ra.ok) throw new Error(j.loi || 'Không tải được tệp lên.');
      Object.assign(t, { khoa: j.khoa, ten: j.ten, kich_thuoc: j.kich_thuoc, loai: j.loai, dang: false });
    } catch (e) {
      Object.assign(t, { dang: false, loi: true });
      st.d.bao(e.message, { loi: true });
    }
    veSoan();
  }
}

function guiYeuCau() {
  const p = phienChon();
  if (p?.dang_chay) return;
  const noiDung = st.o.value.trim();
  if (st.dinhKem.some((t) => t.dang)) { st.d.bao('Chờ tệp tải lên xong rồi gửi.'); return; }
  const dinhKem = st.dinhKem.filter((t) => t.khoa).map(({ ten, khoa, kich_thuoc, loai }) => ({ ten, khoa, kich_thuoc, loai }));
  if (!noiDung && !dinhKem.length) return;
  const da = st.duAn.find((x) => String(x.id) === st.cauHinh.du_an);
  st.maTam = st.chon ? null : Math.random().toString(36).slice(2);
  const ok = gui({ loai: 'gui', phien: st.chon, noi_dung: noiDung, du_an: da ? { id: da.id, ten: da.ten } : null, model: st.cauHinh.model || null, effort: st.cauHinh.effort || null, che_do: st.cauHinh.che_do, dinh_kem: dinhKem, ma_tam: st.maTam });
  if (!ok) { st.d.bao('Mất kết nối, đang nối lại. Thử gửi lại sau vài giây.', { loi: true }); return; }
  st.nhap = '';
  st.o.value = '';
  st.dinhKem = [];
  veSoan();
}
function dungLuot() {
  if (st.chon) gui({ loai: 'dung', phien: st.chon });
}

// Chữ Claude: đoạn văn, khối mã ```...```, **đậm**, `mã`. Dựng bằng phần tử, không dùng innerHTML.
function chuClaude(van) {
  const { h } = st.d;
  const ra = h('div', { class: 'tram-md' });
  const phan = String(van).split(/```[^\n]*\n?/);
  phan.forEach((doan, i) => {
    if (i % 2 === 1) { ra.append(h('pre', {}, h('code', { text: doan.replace(/\n$/, '') }))); return; }
    for (const khoi of doan.split(/\n{2,}/)) {
      if (!khoi.trim()) continue;
      const tieuDe = khoi.match(/^(#{1,4})\s+(.*)$/);
      const el = tieuDe ? h(`h${Math.min(tieuDe[1].length + 2, 6)}`) : h('p');
      dongChu(el, tieuDe ? tieuDe[2] : khoi);
      ra.append(el);
    }
  });
  return ra;
}
function dongChu(el, van) {
  const { h } = st.d;
  for (const m of van.split(/(\*\*[^*]+\*\*|`[^`\n]+`)/)) {
    if (!m) continue;
    if (m.startsWith('**') && m.endsWith('**') && m.length > 4) el.append(h('strong', { text: m.slice(2, -2) }));
    else if (m.startsWith('`') && m.endsWith('`') && m.length > 2) el.append(h('code', { text: m.slice(1, -1) }));
    else el.append(m);
  }
}

function theTep(t) {
  const { h, icon, kichThuoc } = st.d;
  const loai = t.loai_tep || t.loai || '';
  const duong = `/api/tram/tep?k=${encodeURIComponent(t.khoa)}`;
  const anh = /^image\/(png|jpe?g|gif|webp)/.test(loai);
  return h('div', { class: 'tram-tep' },
    anh ? h('a', { href: duong, target: '_blank', rel: 'noopener', class: 'tram-tep-anh' }, h('img', { src: duong, alt: t.ten, loading: 'lazy' })) : h('span', { class: 'tram-tep-icon' }, icon('tep')),
    h('div', { class: 'tram-tep-chu' }, h('b', { text: t.ten }), h('small', { text: kichThuoc(t.kich_thuoc) })),
    h('a', { class: 'nut nut-phu nut-nho', href: duong, target: '_blank', rel: 'noopener' }, 'Xem'),
    h('a', { class: 'nut-icon', href: `${duong}&tai=1`, 'aria-label': `Tải ${t.ten}`, title: 'Tải về' }, icon('tai')));
}

function veSuKien(sk, ketQua) {
  const { h, icon, meo } = st.d;
  if (sk.loai === 'nguoi') {
    const cau = [sk.model && MODEL.find((x) => x[0] === sk.model)?.[1], sk.effort && `effort ${EFFORT.find((x) => x[0] === sk.effort)?.[1]?.toLowerCase()}`, sk.che_do === 'plan' ? 'chỉ lập kế hoạch' : null].filter(Boolean).join(' · ');
    return h('div', { class: 'tram-nguoi' },
      sk.noi_dung ? h('div', { class: 'tram-bong', text: sk.noi_dung }) : null,
      sk.dinh_kem?.length ? h('div', { class: 'tram-tep-ds' }, ...sk.dinh_kem.map(theTep)) : null,
      cau ? h('small', { text: cau }) : null);
  }
  if (sk.loai === 'chu') return h('div', { class: 'tram-claude' }, chuClaude(sk.noi_dung));
  if (sk.loai === 'cong_cu') {
    const kq = ketQua.get(sk.id);
    return h('details', { class: `tram-cong-cu${kq?.loi ? ' loi' : ''}` },
      h('summary', {}, h('span', { class: 'cham-cc' }), h('span', { text: sk.mo_ta || `Dùng ${tenCongCu(sk.ten)}` }), kq ? null : h('small', { text: 'đang chạy' })),
      h('pre', { text: sk.chi_tiet || '' }),
      kq?.tom_tat ? h('pre', { class: 'kq', text: kq.tom_tat }) : null);
  }
  if (sk.loai === 'tep') return theTep(sk);
  if (sk.loai === 'he_thong') return h('p', { class: 'tram-he-thong', text: sk.noi_dung });
  if (sk.loai === 'xong') {
    const phan = [];
    if (sk.thoi_gian_ms) phan.push(h('span', { text: `chạy ${thoiGian(sk.thoi_gian_ms)}` }));
    if (sk.chi_phi) phan.push(h('span', { tabindex: '0', ...meo('Claude Code tự tính chi phí theo giá API. Với gói Max số này chỉ để tham khảo, không bị trừ tiền.') }, `ước tính ${sk.chi_phi.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} USD`));
    if (sk.thu_muc) phan.push(h('span', { tabindex: '0', ...meo(`Tệp của phiên nằm trên máy Mac ở: ${sk.thu_muc}`) }, 'thư mục trên Mac'));
    return h('div', { class: `tram-xong${sk.thanh_cong ? '' : ' loi'}` },
      sk.thanh_cong ? icon('xong') : icon(sk.da_dung ? 'dung' : 'dong'),
      h('span', { text: sk.thanh_cong ? 'Claude đã xong lượt này' : sk.da_dung ? 'Đã dừng' : `Lỗi: ${sk.loi || 'không rõ'}` }),
      ...phan);
  }
  return null;
}

function veLuong(cuonXuong = false) {
  if (!st.vLuong) return;
  const { h, thay } = st.d;
  const ganDay = st.vLuong.scrollHeight - st.vLuong.scrollTop - st.vLuong.clientHeight < 80;
  const ketQua = new Map(st.suKien.filter((x) => x.loai === 'ket_qua_cong_cu').map((x) => [x.id, x]));
  const p = phienChon();
  if (!st.chon && !st.suKien.length) {
    thay(st.vLuong, h('div', { class: 'tram-trong' },
      h('h3', { text: 'Giao việc cho Claude' }),
      h('p', { text: 'Gõ yêu cầu như khi dùng Claude Code. Chữ trả lời hiện dần, mỗi việc Claude làm hiện thành một dòng mở ra xem được, tệp Claude tạo hiện thành thẻ để xem hoặc tải.' }),
      st.tram && !st.tram.tram_mo ? h('button', { class: 'nut nut-phu', type: 'button', onclick: moCaiTram }, st.tram.co_khoa ? 'Trạm đang tắt: xem cách bật' : 'Cài trạm Claude trên máy Mac') : null));
    return;
  }
  st.vDangChay = h('div', { class: 'tram-dang' });
  thay(st.vLuong, ...st.suKien.filter((x) => x.loai !== 'ket_qua_cong_cu').map((x) => veSuKien(x, ketQua)), p?.dang_chay ? st.vDangChay : null);
  veDangChay();
  if (cuonXuong || ganDay) st.vLuong.scrollTop = st.vLuong.scrollHeight;
}

function veDangChay() {
  const el = st.vDangChay;
  if (!el?.isConnected) return;
  const { h, thay } = st.d;
  const p = phienChon();
  const ganDay = st.vLuong.scrollHeight - st.vLuong.scrollTop - st.vLuong.clientHeight < 80;
  const nhan = p?.cho_tram ? 'Đang chờ trạm Claude trên máy Mac bật lại' : st.dangLam || 'Claude đang làm';
  thay(el,
    st.dangViet ? h('div', { class: 'tram-claude dang-viet' }, chuClaude(st.dangViet)) : null,
    h('p', { class: 'tram-dang-nhan' }, h('span', { class: 'quay', 'aria-hidden': 'true' }), nhan));
  if (ganDay) st.vLuong.scrollTop = st.vLuong.scrollHeight;
}

export function dongTram() {
  // Giữ kết nối khi rời trang để lượt đang chạy vẫn cập nhật; chỉ bỏ tham chiếu khung vẽ.
  st.vDs = st.vDau = st.vLuong = st.vSoan = st.vDangChay = null;
}
