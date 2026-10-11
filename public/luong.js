// Trang Luồng: sơ đồ nút từ tin vào, AI, ghi nhớ và việc, đến các việc tự chạy và nơi gửi ra.
// Bấm một nút để bật tắt và chỉnh ngay: giờ, ngưỡng, khóa AI. Nổi khối 3D nhẹ, tắt khi máy ưu tiên giảm chuyển động.

const COT = [
  { ma: 'vao', ten: 'Tin vào' },
  { ma: 'ai', ten: 'Lõi AI' },
  { ma: 'luu', ten: 'Ghi nhớ và việc' },
  { ma: 'chay', ten: 'Tự chạy' },
  { ma: 'ra', ten: 'Gửi ra' },
];

// ma_tv: mã tác vụ có công tắc; den: mã đèn kết nối ở /api/tinh-trang; nguong: các ô chỉnh số.
const NUT = [
  { id: 'zalo', cot: 'vao', ten: 'Zalo', icon: 'zalo', den: 'zalo', ma_tv: 'canh-zalo', bat_nhan: 'Canh máy Mac gửi Zalo', nguong: ['zalo_im_gio'], mo_ta: 'Tin nhóm và cá nhân từ máy Mac. Công tắc là việc canh: báo Telegram khi máy im quá lâu.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'google', cot: 'vao', ten: 'Google', icon: 'thu', den: 'google', ma_tv: 'dong-bo-google', bat_nhan: 'Đồng bộ Gmail, Tasks, Lịch', mo_ta: 'Đăng nhập Google một lần: thư mới vào hộp tin, việc sang Tasks, việc có ngày sang Lịch, việc xong bên Tasks về lại.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'thu', cot: 'vao', ten: 'Thư', icon: 'thu', den: 'thu', mo_ta: 'Thư chuyển tiếp từ Gmail vào hộp tin.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'telegram-vao', cot: 'vao', ten: 'Telegram', icon: 'telegram', den: 'telegram', mo_ta: 'Lệnh /tomtat và /tomtat24 từ Telegram.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'api-vao', cot: 'vao', ten: 'Dịch vụ ngoài', icon: 'ai', sap_co: true, mo_ta: 'Địa chỉ để Zapier, Make, biểu mẫu gửi việc vào. Sắp có.' },
  { id: 'ai', cot: 'ai', ten: 'AI đọc và lập kế hoạch', icon: 'ai', ma_tv: 'tach-viec', bat_nhan: 'Đọc tin và tách việc', ai: true, mo_ta: 'Đọc từng lô tin cùng điều đã nhớ, rồi cho ra việc, kế hoạch các bước, ghi nhớ và phân tích.', nguong: [], phu: { ma_tv: 'goi-y', bat_nhan: 'Gợi ý kế hoạch cho việc cũ', nguong: ['goi_y_toi_da'] } },
  { id: 'ghi-nho', cot: 'luu', ten: 'Ghi nhớ', icon: 'ghi-nho', so: ['ghi_nho', 'mục'], mo_ta: 'Người, dự án, quyết định hệ thống đã nhớ. Bạn duyệt, sửa, xóa được.', lien_ket: ['ghi-nho', 'Mở trang Ghi nhớ'] },
  { id: 'viec', cot: 'luu', ten: 'Việc', icon: 'viec', so: ['viec_mo', 'đang mở'], mo_ta: 'Việc có hạn, giờ hẹn, nhóm và kế hoạch các bước.', lien_ket: ['viec', 'Mở trang Việc'] },
  { id: 'nhac-viec', cot: 'chay', ten: 'Nhắc việc', icon: 'dong-ho', ma_tv: 'nhac-viec', bat_nhan: 'Nhắc theo giờ hẹn', nguong: ['nhac_truoc_phut'], so: ['nhac_sap_toi', 'sắp tới'], mo_ta: 'Nhắc trước giờ hẹn và đúng giờ, mỗi lời một lần.' },
  { id: 'bao-viec-moi', cot: 'chay', ten: 'Báo việc mới', icon: 'telegram', ma_tv: 'bao-viec-moi', bat_nhan: 'Báo việc mới mỗi giờ', mo_ta: 'Gom việc mới thành một tin mỗi giờ.' },
  { id: 'ban-tin', cot: 'chay', ten: 'Bản tin sáng và chiều', icon: 'lich', ma_tv: 'ban-tin', bat_nhan: 'Gửi bản tin', nguong: ['gio_ban_tin', 'gio_nhac_chieu'], mo_ta: 'Sáng: quá hạn, hạn hôm nay, 3 ngày tới và lưu ý từ tin mới. Chiều: việc còn mở.' },
  { id: 'bao-cao-tuan', cot: 'chay', ten: 'Báo cáo tuần', icon: 'lich', ma_tv: 'bao-cao-tuan', bat_nhan: 'Gửi báo cáo tuần', mo_ta: 'Sáng thứ Hai: việc xong, còn mở, quá hạn, tín hiệu Zalo.' },
  { id: 'canh-viec', cot: 'chay', ten: 'Canh việc mất', icon: 'he-thong', ma_tv: 'canh-viec', bat_nhan: 'Canh việc biến mất', nguong: ['mat_viec', 'mat_viec_mo'], mo_ta: 'So danh sách việc mỗi giờ, báo kèm tên khi mất bất thường.' },
  { id: 'don-cuoi-ngay', cot: 'chay', ten: 'Dọn cuối ngày', icon: 'lap', ma_tv: 'don-cuoi-ngay', bat_nhan: 'Dời việc chưa xong sang mai', mo_ta: 'Lúc 23h dời việc có hạn chưa xong sang ngày mai.' },
  { id: 'sao-luu', cot: 'chay', ten: 'Sao lưu đêm', icon: 'kho', ma_tv: 'sao-luu', bat_nhan: 'Sao lưu mỗi đêm', mo_ta: 'Lúc 23h lưu việc, tin 90 ngày, tệp và ghi nhớ vào kho.' },
  { id: 'telegram-ra', cot: 'ra', ten: 'Telegram', icon: 'telegram', den: 'telegram', nguong: ['yen_tu', 'yen_den'], mo_ta: 'Nơi nhận mọi thông báo. Ngoài giờ yên lặng mới gửi, sáng gộp thành một tin.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'webhook-ra', cot: 'ra', ten: 'Dịch vụ ngoài', icon: 'ai', webhook: true, mo_ta: 'Mỗi việc mới được gửi tới địa chỉ bạn đã khai ở trang Kết nối.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
];

const LIEN_KET = [
  ['zalo', 'ai'], ['google', 'ai'], ['thu', 'ai'], ['telegram-vao', 'ai'], ['api-vao', 'ai'],
  ['ai', 'ghi-nho'], ['ai', 'viec'], ['ghi-nho', 'ai'],
  ['viec', 'nhac-viec'], ['viec', 'bao-viec-moi'], ['viec', 'ban-tin'], ['viec', 'bao-cao-tuan'], ['viec', 'canh-viec'], ['viec', 'don-cuoi-ngay'], ['viec', 'sao-luu'],
  ['nhac-viec', 'telegram-ra'], ['bao-viec-moi', 'telegram-ra'], ['ban-tin', 'telegram-ra'], ['bao-cao-tuan', 'telegram-ra'], ['canh-viec', 'telegram-ra'],
  ['viec', 'webhook-ra'],
];

const NHAN_NGUONG = {
  zalo_im_gio: ['Báo khi Zalo im quá', 'giờ'],
  mat_viec: ['Báo khi mất từ', 'việc'],
  mat_viec_mo: ['hoặc từ', 'việc chưa xong'],
  goi_y_toi_da: ['Gợi ý tối đa mỗi giờ', 'việc'],
  nhac_truoc_phut: ['Nhắc trước giờ hẹn', 'phút'],
  yen_tu: ['Yên lặng từ', 'giờ'],
  yen_den: ['đến', 'giờ sáng'],
  gio_ban_tin: ['Bản tin sáng lúc', 'giờ'],
  gio_nhac_chieu: ['Nhắc chiều lúc', 'giờ'],
};

const DEN_TEN = { xanh: 'Đang chạy', vang: 'Đang chờ', do: 'Đang lỗi', xam: 'Chưa nối' };

export async function veLuong(goc, tro) {
  const { h, icon, api, bao, thay, khungLoi, xuong, luc } = tro;
  thay(goc, h('div', { class: 'bang', style: 'padding:24px' }, xuong(16, '30%'), xuong(200)));
  let lg, tt;
  try {
    [lg, tt] = await Promise.all([api('/api/luong'), api('/api/tinh-trang')]);
  } catch (e) {
    thay(goc, khungLoi(e, () => veLuong(goc, tro)));
    return;
  }
  const denKetNoi = Object.fromEntries(tt.thanh_phan.map((t) => [t.ma, t]));
  const lanCuoi = Object.fromEntries(tt.tac_vu.map((t) => [t.ma, t.lan_cuoi]));
  let chon = NUT.find((n) => n.id === (sessionStorageDoc('luong-chon') || 'ai'))?.id || 'ai';

  // Trạng thái hiện trên nút: { den, chu }
  function trangThai(n) {
    if (n.sap_co) return { den: 'xam', chu: 'Sắp có' };
    const tv = [n.ma_tv, n.phu?.ma_tv].filter(Boolean);
    if (tv.length && tv.every((m) => lg.bat[m] === false)) return { den: 'tat', chu: 'Đã tắt' };
    if (n.den && denKetNoi[n.den]) { const d = denKetNoi[n.den]; return { den: d.den, chu: DEN_TEN[d.den] || d.mo_ta }; }
    if (n.webhook) return lg.webhook ? { den: 'xanh', chu: 'Đã khai địa chỉ' } : { den: 'xam', chu: 'Chưa khai địa chỉ' };
    if (n.id === 'ai') return { den: 'xanh', chu: lg.ai ? `Claude, ${lg.ai.mo_hinh}`.replace('Claude, claude', 'Claude, claude') : 'AI có sẵn của hệ thống' };
    if (n.so) return { den: 'xanh', chu: `${lg.so_lieu[n.so[0]]} ${n.so[1]}` };
    const l = n.ma_tv && lanCuoi[n.ma_tv];
    if (l) return { den: l.trang_thai === 'loi' ? 'do' : 'xanh', chu: l.trang_thai === 'loi' ? 'Lần gần nhất lỗi' : `Chạy ${luc(l.ket_thuc || l.bat_dau)}` };
    return { den: 'vang', chu: n.so ? '' : 'Chưa đến giờ chạy' };
  }

  const stage = h('div', { class: 'ban-luong' });
  const dayLien = s('svg', { class: 'day-luong', 'aria-hidden': 'true' });
  const cacNut = new Map();
  const tren = h('div', { class: 'cot-luong-wrap' });
  for (const c of COT) {
    const cot = h('div', { class: 'cot-luong', dataset: { cot: c.ma } }, h('h3', { class: 'ten-cot', text: c.ten }));
    for (const n of NUT.filter((x) => x.cot === c.ma)) {
      const nut = h('div', { class: 'nut-luong', role: 'button', tabindex: n.sap_co ? '-1' : '0', dataset: { id: n.id, sapCo: n.sap_co ? '1' : undefined }, 'aria-label': n.ten, onclick: () => datChon(n.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); datChon(n.id); } } });
      cacNut.set(n.id, nut);
      cot.append(nut);
    }
    tren.append(cot);
  }
  stage.append(dayLien, tren);
  const sanKhau = h('div', { class: 'san-luong' }, stage);
  const bang = h('aside', { class: 'bang bang-luong', 'aria-live': 'polite' });
  const dong = h('button', { class: 'nut-icon dong-luong', type: 'button', 'aria-label': 'Đóng chi tiết', onclick: () => bang.classList.remove('mo') }, icon('dong'));

  thay(goc, h('p', { class: 'tom-tat-phu', style: 'margin-bottom:14px', text: 'Tin đi từ trái sang phải: vào, AI đọc và lập kế hoạch, lưu thành ghi nhớ và việc, rồi các khâu tự chạy gửi kết quả ra. Bấm một nút để bật tắt và chỉnh.' }), h('div', { class: 'luong-khung' }, sanKhau, bang));

  function sessionStorageDoc(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function sessionStorageGhi(k, v) { try { sessionStorage.setItem(k, v); } catch { /* bỏ qua */ } }

  function veNut() {
    for (const n of NUT) {
      const tt1 = trangThai(n);
      const nut = cacNut.get(n.id);
      nut.dataset.den = tt1.den;
      nut.classList.toggle('chon', n.id === chon);
      nut.classList.toggle('tat', tt1.den === 'tat');
      const dau = [h('span', { class: 'den-nut', 'aria-hidden': 'true' }), h('span', { class: 'bieu-nut' }, icon(n.icon))];
      const chu = h('div', { class: 'chu-nut' }, h('strong', { text: n.ten }), h('span', { text: tt1.chu }));
      const them = [];
      if (n.ma_tv && !n.ai) {
        const bat = lg.bat[n.ma_tv] !== false;
        them.push(congTac(bat, `Bật tắt ${n.ten}`, (v) => dat({ bat: { [n.ma_tv]: v } })));
      }
      nut.replaceChildren(...dau, chu, ...them);
    }
    veDay();
  }

  function congTac(bat, nhan, khiDoi) {
    return h('button', { class: 'cong-tac', type: 'button', role: 'switch', 'aria-checked': String(bat), 'aria-label': nhan, onclick: (e) => { e.stopPropagation(); khiDoi(!bat); } }, h('span'));
  }

  async function dat(thanDu) {
    try {
      const kq = await api('/api/luong', { method: 'PATCH', body: JSON.stringify(thanDu) });
      lg = { ...lg, ...kq };
      veNut();
      veBang();
    } catch (e) {
      bao(e.message, { loi: true });
      veNut();
      veBang();
    }
  }

  function datChon(id) {
    const n = NUT.find((x) => x.id === id);
    if (!n || n.sap_co && false) return;
    chon = id;
    sessionStorageGhi('luong-chon', id);
    veNut();
    veBang();
    bang.classList.add('mo');
  }

  function oSo(khoa) {
    const [nhan, donVi] = NHAN_NGUONG[khoa];
    const g = lg.gioi_han[khoa];
    const o = h('input', { type: 'number', min: String(g.min), max: String(g.max), step: '1', value: String(lg.nguong[khoa]), inputmode: 'numeric', 'aria-label': `${nhan} (${g.min} đến ${g.max})` });
    let hen;
    o.addEventListener('change', () => { clearTimeout(hen); hen = setTimeout(() => dat({ nguong: { [khoa]: Number(o.value) } }), 150); });
    return h('label', { class: 'o-nguong' }, h('span', { text: nhan }), h('div', {}, o, h('em', { text: donVi })), h('small', { text: `Từ ${g.min} đến ${g.max}, mặc định ${g.mac_dinh}` }));
  }

  function veBang() {
    const n = NUT.find((x) => x.id === chon);
    const tt1 = trangThai(n);
    const phan = [dong, h('div', { class: 'dau-bang-luong' }, h('span', { class: 'bieu-nut lon' }, icon(n.icon)), h('div', {}, h('h2', { text: n.ten }), h('p', { class: `trang-thai den-${tt1.den}` }, h('span', { class: 'den-nut' }), tt1.chu || DEN_TEN[tt1.den])))];
    phan.push(h('p', { class: 'mo-ta-luong', text: n.mo_ta }));
    const khuTv = (tv, nhan, dsNguong) => {
      const bat = lg.bat[tv] !== false;
      const lc = lanCuoi[tv];
      phan.push(h('div', { class: 'khu-luong' },
        h('div', { class: 'hang-cong-tac' }, h('span', { text: nhan }), congTac(bat, nhan, (v) => dat({ bat: { [tv]: v } }))),
        lc ? h('p', { class: `lan-chay ${lc.trang_thai === 'loi' ? 'loi' : ''}`, text: `Lần gần nhất ${luc(lc.ket_thuc || lc.bat_dau)}: ${lc.ghi_chu || (lc.trang_thai === 'loi' ? 'lỗi' : 'xong')}` }) : h('p', { class: 'lan-chay', text: 'Chưa chạy lần nào, hoặc chưa đến giờ của khâu này.' }),
        ...dsNguong.map(oSo)));
    };
    if (n.ma_tv) khuTv(n.ma_tv, n.bat_nhan, n.nguong || []);
    else if (n.nguong?.length) phan.push(h('div', { class: 'khu-luong' }, ...n.nguong.map(oSo)));
    if (n.phu) khuTv(n.phu.ma_tv, n.phu.bat_nhan, n.phu.nguong || []);
    if (n.ai) phan.push(khuKhoaAi());
    if (n.lien_ket) phan.push(h('a', { class: 'nut nut-phu', href: `#${n.lien_ket[0]}`, text: n.lien_ket[1] }));
    bang.replaceChildren(...phan);
  }

  // Dán khóa AI ngay trên sơ đồ, dùng chung API với trang Kết nối.
  function khuKhoaAi() {
    const loai = h('select', { 'aria-label': 'Nhà cung cấp AI' }, h('option', { value: 'claude', text: 'Claude (Anthropic)' }), h('option', { value: 'openai', text: 'Loại tương thích OpenAI' }));
    const khoa = h('input', { type: 'password', placeholder: 'Dán khóa API', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Khóa API' });
    const diaChi = h('input', { type: 'url', placeholder: 'Địa chỉ dịch vụ (để trống nếu dùng OpenAI)', hidden: true, 'aria-label': 'Địa chỉ dịch vụ' });
    const moHinh = h('input', { type: 'text', placeholder: 'Mô hình (bỏ trống để dùng mặc định)', 'aria-label': 'Mô hình' });
    loai.addEventListener('change', () => { diaChi.hidden = loai.value !== 'openai'; });
    const luu = h('button', { class: 'nut nut-chinh', type: 'submit', text: 'Kiểm tra và lưu' });
    const form = h('form', { class: 'khu-luong form-khoa' }, h('strong', { text: lg.ai ? 'Đổi khóa AI' : 'Dùng khóa AI của bạn' }), h('p', { class: 'lan-chay', text: lg.ai ? `Đang dùng ${lg.ai.loai === 'claude' ? 'Claude' : 'dịch vụ tương thích OpenAI'}, mô hình ${lg.ai.mo_hinh}. Lỗi thì tự quay về AI có sẵn.` : 'Đang dùng AI có sẵn của hệ thống. Dán khóa để dùng mô hình mạnh hơn.' }), loai, khoa, diaChi, moHinh, luu);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      luu.disabled = true;
      luu.textContent = 'Đang thử khóa…';
      try {
        const kq = await api('/api/ket-noi/ai', { method: 'POST', body: JSON.stringify({ loai: loai.value, khoa: khoa.value, mo_hinh: moHinh.value, dia_chi: diaChi.value }) });
        lg.ai = { loai: kq.loai, mo_hinh: kq.mo_hinh };
        khoa.value = '';
        bao('Đã lưu khóa AI.');
        veNut();
        veBang();
      } catch (err) {
        bao(err.message, { loi: true });
        luu.disabled = false;
        luu.textContent = 'Kiểm tra và lưu';
      }
    });
    return form;
  }

  // Vẽ đường nối giữa các nút theo vị trí thật (offset không bị méo bởi phép nghiêng 3D).
  function veDay() {
    if (getComputedStyle(dayLien).display === 'none') return;
    const R = stage.offsetWidth;
    const C = stage.offsetHeight;
    dayLien.setAttribute('viewBox', `0 0 ${R} ${C}`);
    dayLien.setAttribute('width', R);
    dayLien.setAttribute('height', C);
    const toaDo = (id) => {
      const el = cacNut.get(id);
      let x = 0, y = 0, e = el;
      while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      return { l: x, r: x + el.offsetWidth, m: y + el.offsetHeight / 2 };
    };
    const duong = [];
    for (const [a, b] of LIEN_KET) {
      const A = toaDo(a), B = toaDo(b);
      const nguocLai = A.l > B.l; // ghi nhớ quay lại AI
      const x1 = nguocLai ? A.l : A.r, x2 = nguocLai ? B.r : B.l;
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.5) * (nguocLai ? -1 : 1);
      const hoatDong = trangThai(NUT.find((n) => n.id === a)).den === 'xanh' && trangThai(NUT.find((n) => n.id === b)).den !== 'tat';
      const sapCo = NUT.find((n) => n.id === a).sap_co;
      duong.push(s('path', {
        d: `M${x1},${A.m} C${x1 + dx},${A.m} ${x2 - dx},${B.m} ${x2},${B.m}`,
        class: `lien${hoatDong ? ' chay' : ''}${sapCo ? ' sap-co' : ''}${a === chon || b === chon ? ' noi-bat' : ''}`,
      }));
    }
    dayLien.replaceChildren(...duong);
  }
  function s(ten, tt) { const el = document.createElementNS('http://www.w3.org/2000/svg', ten); for (const [k, v] of Object.entries(tt)) el.setAttribute(k, v); return el; }

  // Nghiêng theo con trỏ một chút (chỉ khi người dùng di chuột; tắt khi giảm chuyển động).
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sanKhau.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = sanKhau.getBoundingClientRect();
      sanKhau.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 7}deg`);
      sanKhau.style.setProperty('--rx', `${(((e.clientY - r.top) / r.height) - 0.5) * -3}deg`);
    });
    sanKhau.addEventListener('pointerleave', () => { sanKhau.style.setProperty('--ry', '0deg'); sanKhau.style.setProperty('--rx', '0deg'); });
  }

  veNut();
  veBang();
  new ResizeObserver(veDay).observe(stage);
}
