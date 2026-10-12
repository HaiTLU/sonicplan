// Trang Luồng: sơ đồ nút trên mặt phẳng vô hạn. Kéo nền để di chuyển, Ctrl + cuộn (hoặc chụm hai ngón) để phóng to,
// kéo nút hoặc cả nhóm để sắp lại (lưu vào máy chủ), thu gọn từng nhóm, bấm nút để bật tắt và chỉnh.
// "Chạy thử" cho chấm sáng chạy dọc đường nối theo thứ tự thật, mỗi nút hiện số liệu của lần chạy thật gần nhất.
// Chuyển động chỉ dùng transform và opacity để mượt ở 120 hình mỗi giây.

const NHOM = [
  { ma: 'vao', ten: 'Tin vào' },
  { ma: 'ai', ten: 'Lõi AI' },
  { ma: 'luu', ten: 'Ghi nhớ và việc' },
  { ma: 'chay', ten: 'Tự chạy' },
  { ma: 'ra', ten: 'Gửi ra' },
];

// ma_tv: mã tác vụ có công tắc; den: mã đèn kết nối ở /api/tinh-trang; nguong: các ô chỉnh số.
const NUT = [
  { id: 'zalo', nhom: 'vao', ten: 'Zalo', icon: 'zalo', den: 'zalo', ma_tv: 'canh-zalo', bat_nhan: 'Canh máy Mac gửi Zalo', nguong: ['zalo_im_gio'], mo_ta: 'Tin nhóm và cá nhân từ máy Mac. Công tắc là việc canh: báo Telegram khi máy im quá lâu.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'google', nhom: 'vao', ten: 'Google', icon: 'thu', den: 'google', ma_tv: 'dong-bo-google', bat_nhan: 'Đồng bộ Gmail, Tasks, Lịch', mo_ta: 'Đăng nhập Google một lần: thư mới vào hộp tin, việc sang Tasks, việc có ngày sang Lịch, việc xong bên Tasks về lại, tệp đính kèm lưu thêm vào Drive.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'thu', nhom: 'vao', ten: 'Thư', icon: 'thu', den: 'thu', mo_ta: 'Thư chuyển tiếp từ Gmail vào hộp tin.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'telegram-vao', nhom: 'vao', ten: 'Telegram', icon: 'telegram', den: 'telegram', mo_ta: 'Nhắn thường để tạo việc; /viec, /nho, /hoi, /tomtat.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'api-vao', nhom: 'vao', ten: 'Dịch vụ ngoài', icon: 'ket-noi', den: 'api-vao', mo_ta: 'Zapier, Make, biểu mẫu gửi việc vào qua một địa chỉ riêng có mã. Việc có tiêu đề tạo ngay, văn bản tự do thì AI đọc.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'ai', nhom: 'ai', ten: 'AI đọc và lập kế hoạch', icon: 'ai', ma_tv: 'tach-viec', bat_nhan: 'Đọc tin và tách việc', ai: true, mo_ta: 'Đọc từng lô tin cùng điều đã nhớ, rồi cho ra việc, kế hoạch các bước, ghi nhớ và phân tích.', nguong: [], phu: { ma_tv: 'goi-y', bat_nhan: 'Gợi ý kế hoạch cho việc cũ', nguong: ['goi_y_toi_da'] } },
  { id: 'ghi-nho', nhom: 'luu', ten: 'Ghi nhớ', icon: 'ghi-nho', so: ['ghi_nho', 'mục'], mo_ta: 'Người, dự án, quyết định hệ thống đã nhớ. Bạn duyệt, sửa, xóa được.', lien_ket: ['ghi-nho', 'Mở trang Ghi nhớ'] },
  { id: 'viec', nhom: 'luu', ten: 'Việc', icon: 'viec', so: ['viec_mo', 'đang mở'], mo_ta: 'Việc có hạn, giờ hẹn, nhóm và kế hoạch các bước.', lien_ket: ['viec', 'Mở trang Việc'] },
  { id: 'nhac-viec', nhom: 'chay', ten: 'Nhắc việc', icon: 'dong-ho', ma_tv: 'nhac-viec', bat_nhan: 'Nhắc theo giờ hẹn', nguong: ['nhac_truoc_phut'], so: ['nhac_sap_toi', 'sắp tới'], mo_ta: 'Nhắc trước giờ hẹn và đúng giờ, mỗi lời một lần.' },
  { id: 'giao-github', nhom: 'chay', ten: 'Giao việc cho Claude', icon: 'ai', den: 'github', ma_tv: 'giao-github', bat_nhan: 'Mở issue cho việc AI tự làm', mo_ta: 'Mỗi giờ mở GitHub issue cho việc nhóm AI tự làm, tối đa 5 việc mỗi lượt. Cần nối GitHub ở trang Kết nối.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'bao-viec-moi', nhom: 'chay', ten: 'Báo việc mới', icon: 'telegram', ma_tv: 'bao-viec-moi', bat_nhan: 'Báo việc mới mỗi giờ', mo_ta: 'Gom việc mới thành một tin mỗi giờ.' },
  { id: 'ban-tin', nhom: 'chay', ten: 'Bản tin sáng và chiều', icon: 'lich', ma_tv: 'ban-tin', bat_nhan: 'Gửi bản tin', nguong: ['gio_ban_tin', 'gio_nhac_chieu'], mo_ta: 'Sáng: quá hạn, hạn hôm nay, 3 ngày tới và lưu ý từ tin mới. Chiều: việc còn mở.' },
  { id: 'bao-cao-tuan', nhom: 'chay', ten: 'Báo cáo tuần', icon: 'lich', ma_tv: 'bao-cao-tuan', bat_nhan: 'Gửi báo cáo tuần', mo_ta: 'Sáng thứ Hai: việc xong, còn mở, quá hạn, tín hiệu Zalo.' },
  { id: 'canh-viec', nhom: 'chay', ten: 'Canh việc mất', icon: 'he-thong', ma_tv: 'canh-viec', bat_nhan: 'Canh việc biến mất', nguong: ['mat_viec', 'mat_viec_mo'], mo_ta: 'So danh sách việc mỗi giờ, báo kèm tên khi mất bất thường.' },
  { id: 'don-cuoi-ngay', nhom: 'chay', ten: 'Dọn cuối ngày', icon: 'lap', ma_tv: 'don-cuoi-ngay', bat_nhan: 'Dời việc chưa xong sang mai', mo_ta: 'Lúc 23h dời việc có hạn chưa xong sang ngày mai.' },
  { id: 'sao-luu', nhom: 'chay', ten: 'Sao lưu đêm', icon: 'kho', ma_tv: 'sao-luu', bat_nhan: 'Sao lưu mỗi đêm', mo_ta: 'Lúc 23h lưu việc, tin 90 ngày, tệp và ghi nhớ vào kho.' },
  { id: 'google-tasks', nhom: 'ra', ten: 'Google Tasks', icon: 'viec', den: 'google', theo_tv: 'dong-bo-google', so: ['tasks_google', 'việc đang mở trên Tasks'], mo_ta: 'Mỗi 5 phút: việc mới đẩy sang Google Tasks, đổi tên hay hạn thì cập nhật, việc xong ở đây thì đánh dấu xong bên đó. Việc bấm xong trong Google Tasks cũng về xong ở đây. Bật tắt ở nút Google.', lien_ket: ['viec', 'Mở trang Việc'] },
  { id: 'google-lich', nhom: 'ra', ten: 'Google Lịch', icon: 'lich', den: 'google', theo_tv: 'dong-bo-google', so: ['lich_google', 'việc có trên Lịch'], mo_ta: 'Mỗi 5 phút: việc còn mở có ngày hạn thành sự kiện Lịch (có giờ hẹn thì đặt đúng giờ), đổi hạn thì dời sự kiện, việc xong thì gỡ. Bật tắt ở nút Google.', lien_ket: ['viec', 'Mở trang Việc'] },
  { id: 'kho-drive', nhom: 'ra', ten: 'Kho Drive', icon: 'kho', den: 'kho', ma_tv: 'luu-kho', bat_nhan: 'Lưu vào Drive kho mỗi 5 phút', mo_ta: 'Một Google Drive riêng (có thể là tài khoản khác) giữ bản lưu: tin nhắn Zalo và thư theo ngày, tệp đính kèm, bộ nhớ AI và danh sách việc. Không xóa gì trên Drive.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'telegram-ra', nhom: 'ra', ten: 'Telegram', icon: 'telegram', den: 'telegram', nguong: ['yen_tu', 'yen_den'], mo_ta: 'Nơi nhận mọi thông báo. Ngoài giờ yên lặng mới gửi, sáng gộp thành một tin.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
  { id: 'webhook-ra', nhom: 'ra', ten: 'Dịch vụ ngoài', icon: 'ket-noi', webhook: true, mo_ta: 'Mỗi việc mới được gửi tới địa chỉ bạn đã khai ở trang Kết nối.', lien_ket: ['ket-noi', 'Mở trang Kết nối'] },
];

const LIEN_KET = [
  ['zalo', 'ai'], ['google', 'ai'], ['thu', 'ai'], ['telegram-vao', 'ai'], ['api-vao', 'ai'],
  ['ai', 'ghi-nho'], ['ai', 'viec'], ['ghi-nho', 'ai'],
  ['viec', 'nhac-viec'], ['viec', 'giao-github'], ['viec', 'bao-viec-moi'], ['viec', 'ban-tin'], ['viec', 'bao-cao-tuan'], ['viec', 'canh-viec'], ['viec', 'don-cuoi-ngay'], ['viec', 'sao-luu'],
  ['nhac-viec', 'telegram-ra'], ['bao-viec-moi', 'telegram-ra'], ['ban-tin', 'telegram-ra'], ['bao-cao-tuan', 'telegram-ra'], ['canh-viec', 'telegram-ra'],
  ['viec', 'google-tasks'], ['google-tasks', 'viec'], ['viec', 'google-lich'],
  ['viec', 'webhook-ra'], ['viec', 'kho-drive'], ['ghi-nho', 'kho-drive'], ['zalo', 'kho-drive'], ['google', 'kho-drive'],
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

const DEN_TEN = { xanh: 'Đang chạy', vang: 'Đang chờ', do: 'Đang lỗi', xam: 'Chưa nối', tat: 'Đã tắt' };
const TEN_TV = Object.fromEntries(NUT.flatMap((n) => [n.ma_tv && [n.ma_tv, n.ten], n.phu && [n.phu.ma_tv, n.phu.bat_nhan]].filter(Boolean)));

// Kích thước nút trên mặt phẳng (đơn vị của sơ đồ, nhân với mức phóng).
const RONG_NGANG = 256;
const RONG_DOC = 164; // điện thoại: hai cột nút trong mỗi nhóm
const CAO = 64;
const CAO_AI = 84;
const CAO_NHOM_GON = 64;
const DAU_NHOM = 34; // chiều cao dải tên nhóm
const DEM = 14; // khoảng đệm trong khung nhóm
const KHE_NUT = 16;
const KHE_NHOM = 96;
const LUOI = 24;
const NS = 'http://www.w3.org/2000/svg';
const GIAM_CHUYEN_DONG = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function veLuong(goc, tro) {
  const { h, icon, api, bao, thay, khungLoi, xuong, luc, chayNgay } = tro;
  thay(goc, h('div', { class: 'bang', style: 'padding:24px' }, xuong(16, '30%'), xuong(320)));
  let lg, tt;
  try {
    [lg, tt] = await Promise.all([api('/api/luong'), api('/api/tinh-trang')]);
  } catch (e) {
    thay(goc, khungLoi(e, () => veLuong(goc, tro)));
    return;
  }
  const denKetNoi = Object.fromEntries(tt.thanh_phan.map((t) => [t.ma, t]));
  const lanCuoi = Object.fromEntries(tt.tac_vu.map((t) => [t.ma, t.lan_cuoi]));
  let nhatKy = null; // tải khi mở bảng bên lần đầu
  const boCuc = { ngang: { vi_tri: {}, thu_gon: [] }, doc: { vi_tri: {}, thu_gon: [] }, ...(lg.bo_cuc || {}) };
  for (const k of ['ngang', 'doc']) boCuc[k] = { vi_tri: { ...(boCuc[k]?.vi_tri || {}) }, thu_gon: [...(boCuc[k]?.thu_gon || [])] };
  // Điện thoại lần đầu: gọn các nhóm nhiều nút để thấy cả chuỗi; bấm nhóm để xem và bật tắt từng khâu.
  if (!lg.bo_cuc?.doc) boCuc.doc.thu_gon = ['vao', 'chay', 'ra'];

  // ---------- Trạng thái từng nút ----------
  function trangThai(n) {
    const tv = [n.ma_tv, n.phu?.ma_tv, n.theo_tv].filter(Boolean);
    if (tv.length && tv.every((m) => lg.bat[m] === false)) return { den: 'tat', chu: 'Đã tắt' };
    if (n.theo_tv && n.so) { const d = denKetNoi[n.den]; return d ? { den: d.den, chu: `${lg.so_lieu[n.so[0]] ?? 0} ${n.so[1]}` } : { den: 'xam', chu: 'Chưa đăng nhập Google' }; }
    if (n.den && denKetNoi[n.den]) { const d = denKetNoi[n.den]; return { den: d.den, chu: d.mo_ta || DEN_TEN[d.den] }; }
    if (n.webhook) return lg.webhook ? { den: 'xanh', chu: 'Đã khai địa chỉ' } : { den: 'xam', chu: 'Chưa khai địa chỉ' };
    if (n.id === 'ai') return { den: 'xanh', chu: lg.ai ? `Claude, ${lg.ai.mo_hinh}` : 'AI có sẵn của hệ thống' };
    if (n.so) return { den: 'xanh', chu: `${lg.so_lieu[n.so[0]]} ${n.so[1]}` };
    const l = n.ma_tv && lanCuoi[n.ma_tv];
    if (l) return { den: l.trang_thai === 'loi' ? 'do' : 'xanh', chu: l.trang_thai === 'loi' ? 'Lần gần nhất lỗi' : `Chạy ${luc(l.ket_thuc || l.bat_dau)}` };
    return { den: 'vang', chu: 'Chưa đến giờ chạy' };
  }
  const tatHet = (n) => trangThai(n).den === 'tat';

  // Số liệu hiện trên nút khi chạy thử: lấy từ lần chạy thật gần nhất, không gửi gì ra ngoài.
  function ketQuaThu(n) {
    if (tatHet(n)) return { chu: 'Đã tắt, bỏ qua', loai: 'mo' };
    if (n.id === 'ai') {
      const l = lanCuoi['tach-viec'];
      const cho = lg.so_lieu.tin_cho;
      return { chu: cho ? `${cho} tin chờ đọc` : (l?.ghi_chu || 'Không có tin chờ'), loai: l?.trang_thai === 'loi' ? 'loi' : 'on' };
    }
    if (n.theo_tv && !denKetNoi[n.den]) return { chu: 'Chưa đăng nhập Google', loai: 'mo' };
    if (n.so) return { chu: `${lg.so_lieu[n.so[0]] ?? 0} ${n.so[1]}`, loai: 'on' };
    if (n.webhook) return lg.webhook ? { chu: 'Gửi việc mới', loai: 'on' } : { chu: 'Chưa khai địa chỉ', loai: 'mo' };
    const l = n.ma_tv && lanCuoi[n.ma_tv];
    if (l) return { chu: rutGon(l.ghi_chu || (l.trang_thai === 'loi' ? 'Lỗi' : `Xong${l.so_muc ? `, ${l.so_muc} mục` : ''}`), 44), loai: l.trang_thai === 'loi' ? 'loi' : 'on' };
    if (n.den && denKetNoi[n.den]) { const d = denKetNoi[n.den]; return { chu: rutGon(d.mo_ta || DEN_TEN[d.den], 44), loai: d.den === 'do' ? 'loi' : d.den === 'xanh' ? 'on' : 'mo' }; }
    if (n.den) return { chu: 'Chưa nối', loai: 'mo' };
    return { chu: 'Chưa chạy lần nào', loai: 'mo' };
  }
  const rutGon = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  // ---------- Khung trang ----------
  const luoi = h('div', { class: 'luoi-so-do', 'aria-hidden': 'true' });
  const day = s('svg', { class: 'day-so-do', width: '1', height: '1', 'aria-hidden': 'true' });
  const lopDay = s('g', {});
  const lopCham = s('g', { class: 'cham-so-do' });
  day.append(lopDay, lopCham);
  const lopKhung = h('div', { class: 'lop-khung' });
  const lopNut = h('div', { class: 'lop-nut' });
  const theGioi = h('div', { class: 'the-gioi' }, lopKhung, day, lopNut);
  const nhanMuc = h('span', { class: 'muc-phong', text: '100%' });
  const trangLuu = h('span', { class: 'trang-luu', 'aria-live': 'polite' });
  const nutChay = h('button', { class: 'nut nut-chinh nut-nho nut-chay-thu', type: 'button', onclick: () => chayThu() }, icon('lap'), h('span', { text: 'Chạy thử' }));
  const nutGon = h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => doiGonHet() });
  const thanhTren = h('div', { class: 'thanh-so-do tren' },
    nutChay,
    h('button', { class: 'nut nut-phu nut-nho', type: 'button', text: 'Xếp gọn', title: 'Đưa các nút về bố cục tự động', onclick: () => xepGon() }),
    nutGon,
    trangLuu);
  const nutTron = (nhan, chu, lam) => h('button', { class: 'nut-tron', type: 'button', 'aria-label': nhan, title: nhan, onclick: lam }, chu);
  const thanhDuoi = h('div', { class: 'thanh-so-do duoi' },
    nutTron('Vừa màn hình', '⤢', () => vuaManHinh(true)),
    nutTron('Thu nhỏ', '−', () => phongQuanh(1 / 1.25)),
    nhanMuc,
    nutTron('Phóng to', '+', () => phongQuanh(1.25)));
  const goiY = h('p', { class: 'goi-y-so-do', text: matchMedia('(pointer: coarse)').matches ? 'Kéo để di chuyển, chụm hai ngón để phóng to, giữ và kéo nút để sắp lại.' : 'Kéo nền để di chuyển, Ctrl + cuộn để phóng to, kéo nút hoặc tên nhóm để sắp lại.' });
  const nhatKyThu = h('div', { class: 'nhat-ky-thu', hidden: true, 'aria-live': 'polite' });
  const bang = h('aside', { class: 'bang-so-do', 'aria-label': 'Chi tiết khâu' });
  const khung = h('div', { class: 'khung-so-do', tabindex: '0', role: 'application', 'aria-label': 'Sơ đồ luồng. Phím + và - để phóng, 0 để vừa màn hình, mũi tên để dời nút đang chọn.' }, luoi, theGioi, thanhTren, thanhDuoi, goiY, bang);

  thay(goc, h('p', { class: 'tom-tat-phu', style: 'margin-bottom:12px', text: 'Tin đi từ trái sang phải: vào, AI đọc và lập kế hoạch, lưu thành ghi nhớ và việc, rồi các khâu tự chạy gửi kết quả ra. Bấm một nút để bật tắt và chỉnh, bấm Chạy thử để xem tin chạy qua từng khâu.' }), khung, nhatKyThu);

  // ---------- Bố cục ----------
  let huong = 'ngang';
  const nhin = { x: 0, y: 0, k: 1 };
  const viTri = new Map(); // id nút hoặc 'nhom-<ma>' -> {x, y}
  const cacNut = new Map(); // id -> phần tử
  const cacKhung = new Map(); // mã nhóm -> phần tử khung
  let canhHien = []; // [{tu, den, nguoc, el}]
  let chon = null;

  const rong = () => (huong === 'ngang' ? RONG_NGANG : RONG_DOC);
  const rongCua = (id) => (huong === 'doc' && id.startsWith('nhom-') ? RONG_DOC * 2 + KHE_NUT : rong());
  const caoNut = (id) => (id.startsWith('nhom-') ? CAO_NHOM_GON : NUT.find((n) => n.id === id)?.ai ? CAO_AI : CAO);
  const nhomCua = (id) => NUT.find((n) => n.id === id)?.nhom;
  const thuGon = () => new Set(boCuc[huong].thu_gon);
  const hien = (id) => { const tg = thuGon(); return id.startsWith('nhom-') ? tg.has(id.slice(5)) : !tg.has(nhomCua(id)); };

  // Bố cục tự động: ngang thì nhóm là cột, dọc (điện thoại) thì nhóm xếp chồng từ trên xuống.
  function boCucTuDong() {
    const kq = {};
    const tg = thuGon();
    const kichNhom = NHOM.map((g) => {
      if (tg.has(g.ma)) return { g, cao: CAO_NHOM_GON, ds: [] };
      const ds = NUT.filter((n) => n.nhom === g.ma);
      return { g, ds, cao: ds.reduce((t, n) => t + caoNut(n.id), 0) + KHE_NUT * (ds.length - 1) };
    });
    if (huong === 'ngang') {
      const caoNhat = Math.max(...kichNhom.map((k) => k.cao));
      kichNhom.forEach(({ g, ds, cao }, i) => {
        const x = i * (rong() + KHE_NHOM);
        let y = Math.round((caoNhat - cao) / 2 / LUOI) * LUOI;
        if (tg.has(g.ma)) kq[`nhom-${g.ma}`] = { x, y };
        for (const n of ds) { kq[n.id] = { x, y }; y += caoNut(n.id) + KHE_NUT; }
      });
    } else {
      // Điện thoại: nhóm xếp chồng từ trên xuống, trong nhóm hai cột; nhóm gọn nằm giữa.
      const giua = (RONG_DOC * 2 + KHE_NUT - RONG_DOC) / 2;
      let y = 0;
      for (const { g, ds } of kichNhom) {
        if (tg.has(g.ma)) { kq[`nhom-${g.ma}`] = { x: 0, y }; y += CAO_NHOM_GON + 90; continue; }
        const mot = ds.length === 1;
        for (let i = 0; i < ds.length; i += 2) {
          const hang = ds.slice(i, i + 2);
          hang.forEach((n, j) => { kq[n.id] = { x: mot ? giua : j * (RONG_DOC + KHE_NUT), y }; });
          y += Math.max(...hang.map((n) => caoNut(n.id))) + KHE_NUT + 8;
        }
        y += 90 - KHE_NUT - 8;
      }
    }
    return kq;
  }

  function napViTri() {
    const tu = boCucTuDong();
    const luu = boCuc[huong].vi_tri;
    viTri.clear();
    for (const [id, p] of Object.entries(tu)) viTri.set(id, luu[id] ? { x: luu[id][0], y: luu[id][1] } : p);
    // Nút mới thêm vào nhóm đã được kéo sắp: đặt nối tiếp dưới nút thấp nhất của nhóm để không chồng lên.
    for (const g of NHOM) {
      const ds = NUT.filter((n) => n.nhom === g.ma && viTri.has(n.id));
      const daLuu = ds.filter((n) => luu[n.id]);
      if (!daLuu.length || daLuu.length === ds.length) continue;
      let y = Math.max(...daLuu.map((n) => viTri.get(n.id).y + caoNut(n.id))) + KHE_NUT;
      const x = viTri.get(daLuu[0].id).x;
      for (const n of ds.filter((m) => !luu[m.id])) { viTri.set(n.id, { x, y }); y += caoNut(n.id) + KHE_NUT; }
    }
    // Nhóm thu gọn chưa có vị trí lưu thì đặt ở chỗ nút đầu tiên của nhóm.
    for (const g of NHOM) {
      const id = `nhom-${g.ma}`;
      if (viTri.has(id) && !luu[id]) {
        const dau = NUT.find((n) => n.nhom === g.ma);
        if (luu[dau.id]) viTri.set(id, { x: luu[dau.id][0], y: luu[dau.id][1] });
      }
    }
  }

  // ---------- Vẽ nút, khung nhóm, đường nối ----------
  function dungNut() {
    lopNut.replaceChildren();
    lopKhung.replaceChildren();
    cacNut.clear();
    cacKhung.clear();
    for (const g of NHOM) {
      if (thuGon().has(g.ma)) {
        const id = `nhom-${g.ma}`;
        const el = h('div', { class: 'nut-so-do nut-nhom-gon', role: 'button', tabindex: '0', dataset: { id }, 'aria-label': `Nhóm ${g.ten}, đang thu gọn` });
        cacNut.set(id, el);
        lopNut.append(el);
      } else {
        const nutMo = h('button', { class: 'nut-thu-gon', type: 'button', 'aria-label': `Thu gọn nhóm ${g.ten}`, title: 'Thu gọn nhóm', onclick: (e) => { e.stopPropagation(); doiThuGon(g.ma); } }, '−');
        const dau = h('div', { class: 'dau-khung', dataset: { nhom: g.ma } }, h('span', { text: g.ten }), h('em', { text: String(NUT.filter((n) => n.nhom === g.ma).length) }), nutMo);
        const el = h('div', { class: 'khung-nhom', dataset: { nhom: g.ma } }, dau);
        cacKhung.set(g.ma, el);
        lopKhung.append(el);
        for (const n of NUT.filter((x) => x.nhom === g.ma)) {
          const nut = h('div', { class: `nut-so-do${n.ai ? ' nut-ai' : ''}`, role: 'button', tabindex: '0', dataset: { id: n.id }, 'aria-label': n.ten });
          cacNut.set(n.id, nut);
          lopNut.append(nut);
        }
      }
    }
    veNoiDungNut();
    datViTriNut();
    dungCanh();
  }

  function veNoiDungNut() {
    for (const [id, el] of cacNut) {
      el.classList.toggle('chon', id === chon);
      if (id.startsWith('nhom-')) {
        const g = NHOM.find((x) => x.ma === id.slice(5));
        const ds = NUT.filter((n) => n.nhom === g.ma);
        const bat = ds.filter((n) => trangThai(n).den === 'xanh').length;
        const loi = ds.some((n) => trangThai(n).den === 'do');
        el.dataset.den = loi ? 'do' : bat ? 'xanh' : 'tat';
        el.replaceChildren(
          h('span', { class: 'cong cong-vao', 'aria-hidden': 'true' }), h('span', { class: 'cong cong-ra', 'aria-hidden': 'true' }),
          h('span', { class: 'chong-bieu', 'aria-hidden': 'true' }, ...ds.slice(0, 3).map((n) => h('span', { class: 'bieu-nut' }, icon(n.icon)))),
          h('div', { class: 'chu-nut' }, h('strong', { text: g.ten }), h('span', { text: `${ds.length} khâu, ${bat} đang chạy${loi ? ', có lỗi' : ''}` })),
          h('button', { class: 'nut-thu-gon mo', type: 'button', 'aria-label': `Mở rộng nhóm ${g.ten}`, title: 'Mở rộng nhóm', onclick: (e) => { e.stopPropagation(); doiThuGon(g.ma); } }, '+'),
          h('span', { class: 'the-ket-qua', 'aria-hidden': 'true' }), h('span', { class: 'vong-chay', 'aria-hidden': 'true' }));
        continue;
      }
      const n = NUT.find((x) => x.id === id);
      const t = trangThai(n);
      el.dataset.den = t.den;
      el.classList.toggle('tat', t.den === 'tat');
      const con = [
        h('span', { class: 'cong cong-vao', 'aria-hidden': 'true' }), h('span', { class: 'cong cong-ra', 'aria-hidden': 'true' }),
        h('span', { class: 'bieu-nut' }, icon(n.icon)),
        h('div', { class: 'chu-nut', title: `${n.ten}: ${t.chu}` }, h('strong', { text: n.ten }), h('span', { text: t.chu })),
      ];
      if (n.ma_tv && !n.ai) con.push(congTac(lg.bat[n.ma_tv] !== false, `Bật tắt ${n.ten}`, (v) => dat({ bat: { [n.ma_tv]: v } })));
      else con.push(h('span', { class: 'den-nut', 'aria-hidden': 'true' }));
      con.push(h('span', { class: 'the-ket-qua', 'aria-hidden': 'true' }), h('span', { class: 'vong-chay', 'aria-hidden': 'true' }));
      el.replaceChildren(...con);
    }
  }

  function datViTriNut() {
    for (const [id, el] of cacNut) {
      const p = viTri.get(id);
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    }
    datKhung();
  }

  function datKhung() {
    for (const [ma, el] of cacKhung) {
      const ds = NUT.filter((n) => n.nhom === ma).map((n) => ({ ...viTri.get(n.id), c: caoNut(n.id) }));
      const x0 = Math.min(...ds.map((p) => p.x)) - DEM;
      const y0 = Math.min(...ds.map((p) => p.y)) - DEM - DAU_NHOM;
      const x1 = Math.max(...ds.map((p) => p.x)) + rong() + DEM;
      const y1 = Math.max(...ds.map((p) => p.y + p.c)) + DEM;
      el.style.transform = `translate3d(${x0}px, ${y0}px, 0)`;
      el.style.width = `${x1 - x0}px`;
      el.style.height = `${y1 - y0}px`;
    }
  }

  // Cạnh đang hiện: nút trong nhóm thu gọn thay bằng nút nhóm, bỏ cạnh trùng và cạnh tự nối.
  function dungCanh() {
    const doi = (id) => (hien(id) ? id : `nhom-${nhomCua(id)}`);
    const da = new Set();
    canhHien = [];
    for (const [a, b] of LIEN_KET) {
      const tu = doi(a), den = doi(b);
      const khoa = `${tu}>${den}`;
      if (tu === den || da.has(khoa)) continue;
      da.add(khoa);
      const thuTu = (id) => NHOM.findIndex((g) => g.ma === nhomCua(id));
      const nguoc = thuTu(b) < thuTu(a);
      const el = s('path', { class: `canh${nguoc ? ' nguoc' : ''}` });
      canhHien.push({ tu, den, nguoc, el, a, b });
    }
    lopDay.replaceChildren(...canhHien.map((c) => c.el));
    const dung = new Set(canhHien.flatMap((c) => (c.nguoc ? [`${c.tu}:vao`, `${c.den}:ra`] : [`${c.tu}:ra`, `${c.den}:vao`])));
    for (const [id, el] of cacNut) { el.classList.toggle('co-vao', dung.has(`${id}:vao`)); el.classList.toggle('co-ra', dung.has(`${id}:ra`)); }
    veCanh();
    batChamNen();
  }

  // Tọa độ theo trục luồng: u là chiều tin chảy (ngang: x, dọc: y), v là chiều vuông góc.
  const uv = (x, y) => (huong === 'ngang' ? [x, y] : [y, x]);
  const xy = (u, v) => (huong === 'ngang' ? [u, v] : [v, u]);
  function hop(id) {
    const p = viTri.get(id);
    const c = caoNut(id);
    const [u0, v0] = uv(p.x, p.y);
    const [du, dv] = huong === 'ngang' ? [rongCua(id), c] : [c, rongCua(id)];
    return { u0, u1: u0 + du, v0, v1: v0 + dv, vm: v0 + dv / 2 };
  }

  function duongCanh(c) {
    const A = hop(c.tu), B = hop(c.den);
    // Cạnh xuôi: từ cổng ra (cuối A) tới cổng vào (đầu B). Cạnh ngược (ghi nhớ quay về AI): từ đầu A về cuối B.
    const u1 = c.nguoc ? A.u0 : A.u1, v1 = A.vm;
    const u2 = c.nguoc ? B.u1 : B.u0, v2 = B.vm;
    const huongDi = c.nguoc ? -1 : 1;
    const du = Math.max(48, Math.abs(u2 - u1) * 0.45) * huongDi;
    const cong = (a, b, c2, d) => { const [x, y] = xy(a, b); const [x2, y2] = xy(c2, d); return `${x},${y} ${x2},${y2}`; };
    const diem = (a, b) => xy(a, b).join(',');
    // Né: nếu đường cong thẳng cắt nút khác thì đi vòng qua hành lang trên hoặc dưới các nút cản.
    if (!c.nguoc && u2 - u1 > 40) {
      const can = [];
      for (const [id] of cacNut) {
        if (id === c.tu || id === c.den) continue;
        const R = hop(id);
        if (R.u1 > u1 + 8 && R.u0 < u2 - 8) can.push(R);
      }
      const cat = can.some((R) => {
        for (let i = 1; i < 24; i++) {
          const t = i / 24, m = 1 - t;
          const u = m * m * m * u1 + 3 * m * m * t * (u1 + du) + 3 * m * t * t * (u2 - du) + t * t * t * u2;
          const v = m * m * m * v1 + 3 * m * m * t * v1 + 3 * m * t * t * v2 + t * t * t * v2;
          if (u > R.u0 - 6 && u < R.u1 + 6 && v > R.v0 - 6 && v < R.v1 + 6) return true;
        }
        return false;
      });
      if (cat) {
        const tren = Math.min(...can.map((R) => R.v0)) - 36;
        const duoi = Math.max(...can.map((R) => R.v1)) + 36;
        const vc = Math.abs(tren - v1) + Math.abs(tren - v2) <= Math.abs(duoi - v1) + Math.abs(duoi - v2) ? tren : duoi;
        const r = 56;
        return `M${diem(u1, v1)} C${cong(u1 + r, v1, u1 + r, vc)} ${diem(u1 + r * 2, vc)} L${diem(u2 - r * 2, vc)} C${cong(u2 - r, vc, u2 - r, v2)} ${diem(u2, v2)}`;
      }
    }
    return `M${diem(u1, v1)} C${cong(u1 + du, v1, u2 - du, v2)} ${diem(u2, v2)}`;
  }

  function veCanh(chiCua) {
    for (const c of canhHien) {
      if (chiCua && c.tu !== chiCua && c.den !== chiCua && !chiCua.startsWith?.('*')) continue;
      c.el.setAttribute('d', duongCanh(c));
      const nTu = NUT.find((n) => n.id === c.tu), nDen = NUT.find((n) => n.id === c.den);
      const song = (!nTu || trangThai(nTu).den === 'xanh') && (!nDen || !tatHet(nDen));
      c.el.classList.toggle('song', song);
      c.el.classList.toggle('noi-bat', Boolean(chon) && (c.tu === chon || c.den === chon));
    }
    lopDay.classList.toggle('co-chon', Boolean(chon));
  }

  // Chấm sáng chạy chậm trên các đường đang sống, dùng animateMotion của SVG (trình duyệt tự dời, không tốn JS mỗi khung).
  function batChamNen() {
    lopCham.querySelectorAll('.cham-nen').forEach((c) => c.remove());
    if (GIAM_CHUYEN_DONG) return;
    canhHien.forEach((c, i) => {
      if (!c.el.classList.contains('song') || c.nguoc) return;
      c.el.id = c.el.id || `canh-${Math.random().toString(36).slice(2, 9)}`;
      const cham = s('circle', { r: '2.6', class: 'cham-nen' });
      const am = s('animateMotion', { dur: '3.6s', repeatCount: 'indefinite', begin: `${(i * 0.37) % 3.6}s`, rotate: 'auto' });
      const mp = s('mpath', {});
      mp.setAttribute('href', `#${c.el.id}`);
      am.append(mp);
      cham.append(am);
      lopCham.append(cham);
    });
  }

  // ---------- Nhìn: dời và phóng ----------
  let choKhung = 0;
  function apNhin() {
    if (choKhung) return;
    choKhung = requestAnimationFrame(() => {
      choKhung = 0;
      theGioi.style.transform = `translate3d(${nhin.x}px, ${nhin.y}px, 0) scale(${nhin.k})`;
      const o = LUOI * nhin.k;
      if (luoi.dataset.o !== String(o)) { luoi.style.backgroundSize = `${o}px ${o}px`; luoi.style.inset = `${-o}px auto auto ${-o}px`; luoi.style.width = `calc(100% + ${o * 2}px)`; luoi.style.height = `calc(100% + ${o * 2}px)`; luoi.dataset.o = String(o); }
      luoi.style.transform = `translate3d(${((nhin.x % o) + o) % o}px, ${((nhin.y % o) + o) % o}px, 0)`;
      nhanMuc.textContent = `${Math.round(nhin.k * 100)}%`;
    });
  }
  const KMIN = 0.3, KMAX = 1.8;
  function phongTai(k, cx, cy) {
    const k2 = Math.min(KMAX, Math.max(KMIN, k));
    nhin.x = cx - (cx - nhin.x) * (k2 / nhin.k);
    nhin.y = cy - (cy - nhin.y) * (k2 / nhin.k);
    nhin.k = k2;
    apNhin();
  }
  function phongQuanh(he) {
    const r = khung.getBoundingClientRect();
    phongMuot(nhin.k * he, r.width / 2, r.height / 2);
  }
  // Phóng có chuyển tiếp ngắn (chỉ đổi transform qua rAF).
  function phongMuot(kDich, cx, cy, xDich, yDich) {
    const k2 = Math.min(KMAX, Math.max(KMIN, kDich));
    const bd = { ...nhin };
    const dich = xDich == null ? { x: cx - (cx - bd.x) * (k2 / bd.k), y: cy - (cy - bd.y) * (k2 / bd.k), k: k2 } : { x: xDich, y: yDich, k: k2 };
    if (GIAM_CHUYEN_DONG) { Object.assign(nhin, dich); apNhin(); return; }
    const t0 = performance.now();
    const buoc = (t) => {
      const p = Math.min(1, (t - t0) / 260);
      const e = 1 - (1 - p) ** 3;
      nhin.x = bd.x + (dich.x - bd.x) * e;
      nhin.y = bd.y + (dich.y - bd.y) * e;
      nhin.k = bd.k + (dich.k - bd.k) * e;
      theGioi.style.transform = `translate3d(${nhin.x}px, ${nhin.y}px, 0) scale(${nhin.k})`;
      nhanMuc.textContent = `${Math.round(nhin.k * 100)}%`;
      if (p < 1) requestAnimationFrame(buoc); else apNhin();
    };
    requestAnimationFrame(buoc);
  }
  function bienNoiDung() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [id] of cacNut) {
      const p = viTri.get(id);
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y - (id.startsWith('nhom-') ? 0 : DAU_NHOM + DEM));
      x1 = Math.max(x1, p.x + rongCua(id)); y1 = Math.max(y1, p.y + caoNut(id));
    }
    return { x0: x0 - DEM, y0: y0 - DEM, x1: x1 + DEM, y1: y1 + DEM };
  }
  function vuaManHinh(muot) {
    const r = khung.getBoundingClientRect();
    if (!r.width) return;
    const b = bienNoiDung();
    const chuaTren = 64, chuaDuoi = 60;
    const W = r.width - 32, H = r.height - chuaTren - chuaDuoi;
    let k = huong === 'ngang' ? Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0), 1.1) : Math.min(W / (b.x1 - b.x0), 1.1);
    k = Math.min(KMAX, Math.max(KMIN, k));
    const x = (r.width - (b.x1 - b.x0) * k) / 2 - b.x0 * k;
    const y = huong === 'ngang' ? chuaTren + (H - (b.y1 - b.y0) * k) / 2 - b.y0 * k : chuaTren - b.y0 * k;
    if (muot) phongMuot(k, 0, 0, x, y);
    else { Object.assign(nhin, { x, y, k }); apNhin(); }
  }

  // ---------- Kéo, dời, phóng bằng con trỏ ----------
  const conTro = new Map(); // pointerId -> {x, y}
  let thaoTac = null; // { loai: 'nen'|'nut'|'nhom', ... }
  let chumBd = null;
  const diemCua = (e) => { const r = khung.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  khung.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('.thanh-so-do, .bang-so-do, .nhat-ky-thu, button, input, select, a, .cong-tac')) return;
    const p = diemCua(e);
    conTro.set(e.pointerId, p);
    if (conTro.size === 2) {
      const [a, b] = [...conTro.values()];
      chumBd = { d: Math.hypot(a.x - b.x, a.y - b.y), k: nhin.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, x: nhin.x, y: nhin.y };
      thaoTac = { loai: 'chum' };
      return;
    }
    const nut = e.target.closest('.nut-so-do');
    const dau = e.target.closest('.dau-khung');
    if (nut) {
      const id = nut.dataset.id;
      thaoTac = { loai: 'nut', id, bd: p, goc: { ...viTri.get(id) }, keo: false, el: nut };
    } else if (dau) {
      const ma = dau.dataset.nhom;
      const ids = NUT.filter((n) => n.nhom === ma).map((n) => n.id);
      thaoTac = { loai: 'nhom', ma, ids, bd: p, goc: ids.map((id) => ({ ...viTri.get(id) })), keo: false };
    } else {
      thaoTac = { loai: 'nen', bd: p, x: nhin.x, y: nhin.y, keo: false };
    }
    khung.setPointerCapture(e.pointerId);
  });

  let choVe = 0;
  khung.addEventListener('pointermove', (e) => {
    if (!conTro.has(e.pointerId) || !thaoTac) return;
    const p = diemCua(e);
    conTro.set(e.pointerId, p);
    if (thaoTac.loai === 'chum' && conTro.size >= 2) {
      const [a, b] = [...conTro.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const k = Math.min(KMAX, Math.max(KMIN, chumBd.k * (d / chumBd.d)));
      nhin.x = cx - (chumBd.cx - chumBd.x) * (k / chumBd.k);
      nhin.y = cy - (chumBd.cy - chumBd.y) * (k / chumBd.k);
      nhin.k = k;
      apNhin();
      return;
    }
    const dx = p.x - thaoTac.bd.x, dy = p.y - thaoTac.bd.y;
    if (!thaoTac.keo && Math.hypot(dx, dy) < 5) return;
    if (!thaoTac.keo) { thaoTac.keo = true; khung.classList.add(thaoTac.loai === 'nen' ? 'dang-doi' : 'dang-keo'); thaoTac.el?.classList.add('dang-keo'); }
    if (thaoTac.loai === 'nen') {
      nhin.x = thaoTac.x + dx; nhin.y = thaoTac.y + dy;
      apNhin();
      return;
    }
    const lam = (v) => Math.round(v / 8) * 8;
    if (thaoTac.loai === 'nut') {
      viTri.set(thaoTac.id, { x: lam(thaoTac.goc.x + dx / nhin.k), y: lam(thaoTac.goc.y + dy / nhin.k) });
    } else {
      thaoTac.ids.forEach((id, i) => viTri.set(id, { x: lam(thaoTac.goc[i].x + dx / nhin.k), y: lam(thaoTac.goc[i].y + dy / nhin.k) }));
    }
    if (choVe) return;
    choVe = requestAnimationFrame(() => {
      choVe = 0;
      const ids = thaoTac?.loai === 'nut' ? [thaoTac.id] : thaoTac?.ids || [];
      for (const id of ids) { const q = viTri.get(id); const el = cacNut.get(id); if (el) el.style.transform = `translate3d(${q.x}px, ${q.y}px, 0)`; }
      datKhung();
      veCanh();
    });
  });

  function thaTay(e) {
    if (!conTro.has(e.pointerId)) return;
    conTro.delete(e.pointerId);
    if (thaoTac?.loai === 'chum') { if (conTro.size === 0) thaoTac = null; return; }
    const t = thaoTac;
    thaoTac = null;
    khung.classList.remove('dang-doi', 'dang-keo');
    if (!t) return;
    t.el?.classList.remove('dang-keo');
    if (t.keo && (t.loai === 'nut' || t.loai === 'nhom')) {
      for (const id of t.loai === 'nut' ? [t.id] : t.ids) { const q = viTri.get(id); boCuc[huong].vi_tri[id] = [q.x, q.y]; }
      luuBoCuc();
    } else if (!t.keo && t.loai === 'nut' && e.type === 'pointerup') {
      datChon(t.id);
    } else if (!t.keo && t.loai === 'nen' && e.type === 'pointerup' && chon) {
      datChon(null);
    }
  }
  khung.addEventListener('pointerup', thaTay);
  khung.addEventListener('pointercancel', thaTay);

  khung.addEventListener('wheel', (e) => {
    if (e.target.closest('.bang-so-do, .nhat-ky-thu')) return;
    e.preventDefault();
    const p = diemCua(e);
    if (e.ctrlKey || e.metaKey) {
      phongTai(nhin.k * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004), p.x, p.y);
    } else {
      nhin.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      nhin.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      apNhin();
    }
  }, { passive: false });

  khung.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const nutDangFocus = e.target.closest?.('.nut-so-do');
    if ((e.key === 'Enter' || e.key === ' ') && nutDangFocus) { e.preventDefault(); datChon(nutDangFocus.dataset.id); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); phongQuanh(1.2); }
    else if (e.key === '-') { e.preventDefault(); phongQuanh(1 / 1.2); }
    else if (e.key === '0') { e.preventDefault(); vuaManHinh(true); }
    else if (e.key === 'Escape') { datChon(null); }
    else if (chon && e.key.startsWith('Arrow') && cacNut.has(chon)) {
      e.preventDefault();
      const b = e.shiftKey ? 48 : 8;
      const q = viTri.get(chon);
      const n = { x: q.x + (e.key === 'ArrowLeft' ? -b : e.key === 'ArrowRight' ? b : 0), y: q.y + (e.key === 'ArrowUp' ? -b : e.key === 'ArrowDown' ? b : 0) };
      viTri.set(chon, n);
      boCuc[huong].vi_tri[chon] = [n.x, n.y];
      datViTriNut();
      veCanh();
      luuBoCuc();
    }
  });

  // ---------- Lưu bố cục ----------
  let henLuu;
  function luuBoCuc() {
    clearTimeout(henLuu);
    trangLuu.textContent = 'Đang lưu bố cục…';
    henLuu = setTimeout(async () => {
      try {
        await api('/api/luong', { method: 'PATCH', body: JSON.stringify({ bo_cuc: boCuc }) });
        trangLuu.textContent = 'Đã lưu bố cục';
      } catch (e) {
        trangLuu.textContent = '';
        bao(e.message, { loi: true });
      }
    }, 500);
  }
  function xepGon() {
    boCuc[huong].vi_tri = {};
    napViTri();
    datViTriNut();
    veCanh();
    vuaManHinh(true);
    luuBoCuc();
  }
  function doiThuGon(ma) {
    const tg = thuGon();
    if (tg.has(ma)) tg.delete(ma); else tg.add(ma);
    boCuc[huong].thu_gon = [...tg];
    // Giữ vị trí các nút đã kéo; nút chưa kéo theo bố cục tự động mới để không chồng lên nhau.
    napViTri();
    if (chon && !cacNut.has(chon)) chon = null;
    dungNut();
    if (chon && !cacNut.has(chon)) datChon(null);
    capNhatNutGon();
    luuBoCuc();
  }
  function doiGonHet() {
    const dangGon = boCuc[huong].thu_gon.length === NHOM.length;
    boCuc[huong].thu_gon = dangGon ? [] : NHOM.map((g) => g.ma);
    napViTri();
    chon = null;
    bang.classList.remove('mo');
    dungNut();
    capNhatNutGon();
    vuaManHinh(true);
    luuBoCuc();
  }
  function capNhatNutGon() {
    nutGon.textContent = boCuc[huong].thu_gon.length === NHOM.length ? 'Mở rộng hết' : 'Thu gọn hết';
  }

  // ---------- Chọn nút, bảng bên ----------
  function congTac(bat, nhan, khiDoi) {
    return h('button', { class: 'cong-tac', type: 'button', role: 'switch', 'aria-checked': String(bat), 'aria-label': nhan, onclick: (e) => { e.stopPropagation(); khiDoi(!bat); } }, h('span'));
  }

  async function dat(thanDu) {
    try {
      const kq = await api('/api/luong', { method: 'PATCH', body: JSON.stringify(thanDu) });
      lg = { ...lg, ...kq, bo_cuc: lg.bo_cuc };
    } catch (e) {
      bao(e.message, { loi: true });
    }
    veNoiDungNut();
    veCanh();
    batChamNen();
    if (chon) veBang();
  }

  function datChon(id) {
    chon = id;
    for (const [k, el] of cacNut) el.classList.toggle('chon', k === id);
    veCanh();
    if (!id) { bang.classList.remove('mo'); return; }
    veBang();
    bang.classList.add('mo');
    if (!nhatKy) {
      api('/api/nhat-ky?so_dong=300').then((kq) => { nhatKy = kq.dong; if (chon) veBang(); }).catch(() => { nhatKy = []; });
    }
  }

  function oSo(khoa) {
    const [nhan, donVi] = NHAN_NGUONG[khoa];
    const g = lg.gioi_han[khoa];
    const o = h('input', { type: 'number', min: String(g.min), max: String(g.max), step: '1', value: String(lg.nguong[khoa]), inputmode: 'numeric', 'aria-label': `${nhan} (${g.min} đến ${g.max})` });
    let hen;
    o.addEventListener('change', () => { clearTimeout(hen); hen = setTimeout(() => dat({ nguong: { [khoa]: Number(o.value) } }), 150); });
    return h('label', { class: 'o-nguong' }, h('span', { text: nhan }), h('div', {}, o, h('em', { text: donVi })), h('small', { text: `Từ ${g.min} đến ${g.max}, mặc định ${g.mac_dinh}` }));
  }

  function khuNhatKy(maTv) {
    if (!nhatKy) return h('p', { class: 'lan-chay', text: 'Đang tải nhật ký…' });
    const dong = nhatKy.filter((d) => d.tac_vu === maTv).slice(0, 5);
    if (!dong.length) return h('p', { class: 'lan-chay', text: 'Chưa có lần chạy nào trong nhật ký.' });
    return h('ol', { class: 'ds-lan-chay' }, ...dong.map((d) => h('li', { class: d.trang_thai === 'loi' ? 'loi' : '' },
      h('span', { class: 'cham-trang-thai', 'aria-hidden': 'true' }),
      h('time', { text: luc(d.ket_thuc || d.bat_dau) }),
      h('span', { text: d.ghi_chu || (d.trang_thai === 'loi' ? 'Lỗi' : d.trang_thai === 'dang_chay' ? 'Đang chạy' : `Xong${d.so_muc ? `, ${d.so_muc} mục` : ''}`) }))));
  }

  function veBang() {
    const dong = h('button', { class: 'nut-icon dong-bang', type: 'button', 'aria-label': 'Đóng chi tiết', onclick: () => datChon(null) }, icon('dong'));
    if (chon.startsWith('nhom-')) {
      const g = NHOM.find((x) => x.ma === chon.slice(5));
      const ds = NUT.filter((n) => n.nhom === g.ma);
      bang.replaceChildren(dong,
        h('div', { class: 'dau-bang-luong' }, h('div', {}, h('h2', { text: g.ten }), h('p', { class: 'lan-chay', text: `${ds.length} khâu đang thu gọn` }))),
        h('div', { class: 'khu-luong' }, ...ds.map((n) => {
          const t = trangThai(n);
          return h('div', { class: 'hang-cong-tac' },
            h('button', { class: 'nut-chu', type: 'button', onclick: () => { doiThuGon(g.ma); datChon(n.id); } }, h('span', { class: `cham-den den-${t.den}`, 'aria-hidden': 'true' }), n.ten),
            n.ma_tv && !n.ai ? congTac(lg.bat[n.ma_tv] !== false, `Bật tắt ${n.ten}`, (v) => dat({ bat: { [n.ma_tv]: v } })) : null);
        })),
        h('button', { class: 'nut nut-phu', type: 'button', text: 'Mở rộng nhóm', onclick: () => doiThuGon(g.ma) }));
      return;
    }
    const n = NUT.find((x) => x.id === chon);
    const t = trangThai(n);
    const phan = [dong, h('div', { class: 'dau-bang-luong' }, h('span', { class: 'bieu-nut lon' }, icon(n.icon)), h('div', {}, h('h2', { text: n.ten }), h('p', { class: `trang-thai den-${t.den}` }, h('span', { class: 'den-nut' }), t.chu || DEN_TEN[t.den])))];
    phan.push(h('p', { class: 'mo-ta-luong', text: n.mo_ta }));
    const khuTv = (tv, nhan, dsNguong) => {
      const bat = lg.bat[tv] !== false;
      phan.push(h('div', { class: 'khu-luong' },
        h('div', { class: 'hang-cong-tac' }, h('span', { text: nhan }), congTac(bat, nhan, (v) => dat({ bat: { [tv]: v } }))),
        ...dsNguong.map(oSo),
        h('strong', { class: 'tieu-de-nho', text: 'Lần chạy gần đây' }),
        khuNhatKy(tv),
        h('button', { class: 'nut nut-phu', type: 'button', text: 'Chạy ngay', onclick: async (ev) => {
          ev.target.disabled = true;
          ev.target.textContent = 'Đang chạy…';
          const kq = await chayNgay(tv);
          if (kq) {
            const [tt2, nk] = await Promise.all([api('/api/tinh-trang').catch(() => null), api('/api/nhat-ky?so_dong=300').catch(() => null)]);
            if (tt2) for (const x of tt2.tac_vu) lanCuoi[x.ma] = x.lan_cuoi;
            if (nk) nhatKy = nk.dong;
          }
          veNoiDungNut();
          veCanh();
          veBang();
        } })));
    };
    if (n.theo_tv) phan.push(h('div', { class: 'khu-luong' }, h('strong', { class: 'tieu-de-nho', text: 'Lần đồng bộ gần đây' }), khuNhatKy(n.theo_tv)));
    if (n.ma_tv) khuTv(n.ma_tv, n.bat_nhan, n.nguong || []);
    else if (n.nguong?.length) phan.push(h('div', { class: 'khu-luong' }, ...n.nguong.map(oSo)));
    if (n.phu) khuTv(n.phu.ma_tv, n.phu.bat_nhan, n.phu.nguong || []);
    if (n.ai) phan.push(khuKhoaAi());
    const vao = LIEN_KET.filter(([, b]) => b === n.id).map(([a]) => NUT.find((x) => x.id === a).ten);
    const ra = LIEN_KET.filter(([a]) => a === n.id).map(([, b]) => NUT.find((x) => x.id === b).ten);
    phan.push(h('div', { class: 'khu-noi' },
      vao.length ? h('p', {}, h('strong', { text: 'Nhận từ: ' }), [...new Set(vao)].join(', ')) : null,
      ra.length ? h('p', {}, h('strong', { text: 'Gửi tới: ' }), [...new Set(ra)].join(', ')) : null));
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
        veNoiDungNut();
        veBang();
      } catch (err) {
        bao(err.message, { loi: true });
        luu.disabled = false;
        luu.textContent = 'Kiểm tra và lưu';
      }
    });
    return form;
  }

  // ---------- Chạy thử: chấm sáng đi theo thứ tự thật ----------
  let dangChay = false;
  async function chayThu() {
    if (dangChay) return;
    dangChay = true;
    nutChay.disabled = true;
    nutChay.lastChild.textContent = 'Đang chạy thử…';
    khung.classList.add('dang-chay-thu');
    for (const el of cacNut.values()) { el.classList.remove('da-chay', 'bo-qua'); const the = el.querySelector('.the-ket-qua'); if (the) { the.textContent = ''; the.className = 'the-ket-qua'; } }
    const dsNhatKy = h('ol', {});
    thay(nhatKyThu,
      h('div', { class: 'dau-nhat-ky-thu' }, h('strong', { text: 'Chạy thử' }), h('button', { class: 'nut-icon', type: 'button', 'aria-label': 'Đóng nhật ký chạy thử', onclick: () => { nhatKyThu.hidden = true; } }, icon('dong'))),
      h('p', { class: 'lan-chay', text: 'Chỉ mô phỏng, không gửi tin hay sửa dữ liệu. Số liệu lấy từ lần chạy thật gần nhất.' }),
      dsNhatKy);
    nhatKyThu.hidden = false;
    const t0 = performance.now();
    const ghi = (ten, kq) => {
      const giay = ((performance.now() - t0) / 1000).toFixed(1);
      dsNhatKy.append(h('li', { class: kq.loai }, h('time', { text: `${giay}s` }), h('strong', { text: ten }), h('span', { text: kq.chu })));
    };
    const nutCua = (id) => NUT.find((n) => n.id === id);
    const ketQua = (id) => {
      if (!id.startsWith('nhom-')) return ketQuaThu(nutCua(id));
      const ds = NUT.filter((n) => n.nhom === id.slice(5));
      const kq = ds.map(ketQuaThu);
      const loi = kq.filter((k) => k.loai === 'loi').length;
      const chay = kq.filter((k) => k.loai === 'on').length;
      return { chu: `${chay}/${ds.length} khâu có kết quả${loi ? `, ${loi} lỗi` : ''}`, loai: loi ? 'loi' : 'on' };
    };
    const tenCua = (id) => (id.startsWith('nhom-') ? NHOM.find((g) => g.ma === id.slice(5)).ten : nutCua(id).ten);
    const boQua = (id) => !id.startsWith('nhom-') && tatHet(nutCua(id));
    const sang = (id) => {
      const el = cacNut.get(id);
      const kq = ketQua(id);
      el.classList.add(boQua(id) ? 'bo-qua' : 'da-chay');
      const the = el.querySelector('.the-ket-qua');
      the.textContent = kq.chu;
      the.className = `the-ket-qua hien ${kq.loai}`;
      ghi(tenCua(id), kq);
    };
    const cho = (ms) => new Promise((r) => setTimeout(r, GIAM_CHUYEN_DONG ? Math.min(ms, 120) : ms));

    // Đi theo tầng: nguồn đang có tín hiệu, rồi lần lượt các nút nhận được.
    const daSang = new Set();
    const nguon = [...cacNut.keys()].filter((id) => !canhHien.some((c) => c.den === id && !c.nguoc));
    let tang = nguon.filter((id) => id.startsWith('nhom-') || (!boQua(id) && trangThai(nutCua(id)).den !== 'xam'));
    if (!tang.length) tang = [hien('ai') ? 'ai' : 'nhom-ai'];
    for (const id of nguon) if (!tang.includes(id)) { sang(id); daSang.add(id); }
    for (const id of tang) { sang(id); daSang.add(id); }
    await cho(500);
    while (tang.length) {
      const toi = new Map();
      const bay = [];
      for (const c of canhHien) {
        if (!tang.includes(c.tu) || boQua(c.tu)) continue;
        if (c.nguoc) { bay.push(bayCham(c, true)); continue; }
        if (daSang.has(c.den)) { bay.push(bayCham(c)); continue; }
        bay.push(bayCham(c, boQua(c.den)));
        toi.set(c.den, true);
      }
      await Promise.all(bay);
      tang = [...toi.keys()].filter((id) => !daSang.has(id));
      for (const id of tang) { sang(id); daSang.add(id); }
      if (tang.length) await cho(260);
    }
    for (const id of cacNut.keys()) if (!daSang.has(id)) { sang(id); }
    ghi('Xong', { chu: `Đi qua ${daSang.size} khâu`, loai: 'on' });
    khung.classList.remove('dang-chay-thu');
    nutChay.disabled = false;
    nutChay.lastChild.textContent = 'Chạy thử lại';
    dangChay = false;
  }

  // Một chấm sáng chạy hết một đường nối, dùng animateMotion (trình duyệt tự dời chấm).
  function bayCham(c, mo) {
    return new Promise((xong) => {
      const thoiGian = GIAM_CHUYEN_DONG ? 1 : 820;
      c.el.id = c.el.id || `canh-${Math.random().toString(36).slice(2, 9)}`;
      c.el.classList.add('dang-chay');
      const cham = s('circle', { r: '5', class: `cham-chay${mo ? ' mo' : ''}` });
      const am = s('animateMotion', { dur: `${thoiGian}ms`, begin: 'indefinite', fill: 'freeze', calcMode: 'spline', keyTimes: '0;1', keyPoints: '0;1', keySplines: '.45 0 .25 1' });
      const mp = s('mpath', {});
      mp.setAttribute('href', `#${c.el.id}`);
      am.append(mp);
      cham.append(am);
      lopCham.append(cham);
      am.beginElement();
      setTimeout(() => {
        cham.classList.add('tat-dan');
        c.el.classList.remove('dang-chay');
        setTimeout(() => cham.remove(), 260);
        xong();
      }, thoiGian);
    });
  }

  function s(ten, tt) { const el = document.createElementNS(NS, ten); for (const [k, v] of Object.entries(tt)) el.setAttribute(k, v); return el; }

  // ---------- Khởi động và đổi khổ màn ----------
  const huongTheoKho = () => (khung.clientWidth < 720 ? 'doc' : 'ngang');
  function dungLai() {
    huong = huongTheoKho();
    khung.dataset.huong = huong;
    napViTri();
    if (chon && !viTri.has(chon)) chon = null;
    dungNut();
    capNhatNutGon();
    vuaManHinh(false);
  }
  dungLai();
  let khoTruoc = khung.clientWidth;
  const ro = new ResizeObserver(() => {
    if (!khung.isConnected) { ro.disconnect(); return; }
    const w = khung.clientWidth;
    if (Math.abs(w - khoTruoc) < 2) return;
    khoTruoc = w;
    if (huongTheoKho() !== huong) dungLai(); else vuaManHinh(false);
  });
  ro.observe(khung);
}
