// Giao diện Sonicplan, Mục Kết nối.
import { trangThaiThongBao, veTheThongBao } from '../thong-bao.js';
import { S, api, bao, h, icon, luc, oChep, thay, trang, xuong } from './chung.js';
import { khoiNhanGoogle, linkKhoDrive } from './tep.js';
import { tomTat } from './tong-quan.js';
import { noiDungThoClaude, trangThaiThoClaude } from './claude-may.js';

// =====================================================================
// Kết nối
// =====================================================================
// Trang Kết nối hiện ngay bản đã lưu lần trước (sessionStorage), rồi lấy bản mới và vẽ lại nếu có khác.
// Sau mỗi thao tác (ve) luôn lấy bản mới, không dùng bản lưu, để không hiện trạng thái cũ.
const KHOA_LUU_KN = 'sonicplan-ket-noi';
function layLuuKn() {
  try { return JSON.parse(sessionStorage.getItem(KHOA_LUU_KN) || 'null'); } catch { return null; }
}
function ghiLuuKn(kn) {
  try { sessionStorage.setItem(KHOA_LUU_KN, JSON.stringify(kn)); } catch {}
}

export async function veKetNoi(goc, { moi = false } = {}) {
  const ve = () => veKetNoi(goc, { moi: true }).catch((e) => bao(e.message, { loi: true }));
  const luu = moi ? null : layLuuKn();
  if (!luu) thay(goc, h('div', { class: 'ds-kn' }, ...[1, 2, 3, 4].map(() => h('div', { class: 'bang the-kn' }, xuong(44, '44px'), xuong(16, '60%'), xuong(80)))));
  const kn = luu || await api('/api/ket-noi');
  if (luu) {
    api('/api/ket-noi').then((moiKn) => {
      const doi = JSON.stringify(moiKn) !== JSON.stringify(luu);
      ghiLuuKn(moiKn);
      if (doi && location.hash.slice(1).split('/')[0] === 'ket-noi') ve();
    }).catch(() => {});
  } else ghiLuuKn(kn);
  const [tho, kbMap] = await Promise.all([api('/api/tho-claude').catch(() => null), api('/api/kb/du-an').catch(() => null)]);
  const daoTrangThai = (den, chu) => h('span', { class: `trang-thai-kn ${den}`, text: chu });
  const dau = (ten, tieuDe, moTa, den, chu) => h('header', {}, h('span', { class: 'tp-icon', dataset: { den } }, icon(ten)), h('div', {}, h('h2', { text: tieuDe }), h('p', { text: moTa })), daoTrangThai(den, chu));

  // Google: đăng nhập một lần cho Gmail, Lịch, Tasks
  const gg = kn.google;
  const laChuGg = kn.tich_hop.vai_tro === 'chu';
  const ketQuaGg = new URLSearchParams(location.search).get('google');
  if (ketQuaGg) {
    history.replaceState(null, '', `${location.pathname}#ket-noi`);
    if (ketQuaGg === 'ok') bao('Đã nối Google. Thư mới, việc và lịch sẽ đồng bộ mỗi 5 phút.');
    else bao(ketQuaGg, { loi: true });
  }
  const oIdGg = h('input', { type: 'text', placeholder: 'Client ID (….apps.googleusercontent.com)', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Client ID' });
  const oBiMatGg = h('input', { type: 'password', placeholder: 'Client Secret', autocomplete: 'off', 'aria-label': 'Client Secret' });
  if (gg.client_id) oIdGg.value = gg.client_id;
  // Đổi khóa Google khi Google báo Client Secret sai: giữ nguyên tài khoản đã nối, chỉ thay khóa.
  const nhapLaiKhoaGoogle = () => h('details', { class: 'nhap-lai-khoa', open: gg.lan_cuoi?.ghi_chu?.includes('Client Secret') ? '' : null },
    h('summary', { text: 'Nhập lại khóa Google' }),
    h('p', { class: 'mo-ta', text: 'Dùng khi Google báo Client Secret sai. Mở console.cloud.google.com, Credentials, chọn OAuth client của Sonicplan, chép Client Secret mới dán vào đây. Tài khoản đã nối giữ nguyên, tin và thư đang chờ sẽ được lưu lại ở lượt kế tiếp.' }),
    h('div', { class: 'luoi-nhap' }, oIdGg, oBiMatGg, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
      ev.target.disabled = true;
      try {
        await api('/api/ket-noi/google', { method: 'POST', body: JSON.stringify({ client_id: oIdGg.value, client_secret: oBiMatGg.value }) });
        bao('Đã lưu khóa Google mới. Hệ thống sẽ thử lại ở lượt đồng bộ kế tiếp.');
        ve();
      } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
    } }, 'Lưu khóa')));
  const khoiGg = [];
  if (gg.da_noi) {
    khoiGg.push(
      hangTaiKhoan(gg.da_noi.email || 'Tài khoản Google', gg.lan_cuoi ? `${gg.lan_cuoi.ghi_chu}, ${luc(gg.lan_cuoi.lan_cuoi)}` : 'Chờ lượt đồng bộ đầu tiên'),
      h('p', { class: 'ghi-nho-kn', text: `Thư mới vào hộp tin; việc mới sang Google Tasks, việc có ngày sang Lịch; việc bấm xong bên Tasks sẽ xong ở đây.${gg.da_noi.co_drive ? ' Tệp đính kèm lưu thêm vào thư mục Sonicplan trên Drive.' : ''}` }),
      gg.da_noi.email ? h('div', { class: 'hang-nut' }, ...[['Mở Gmail', 'https://mail.google.com/mail/'], ['Mở Lịch', 'https://calendar.google.com/calendar/r'], ['Mở Tasks', 'https://tasks.google.com/tasks/'], ['Mở Drive', 'https://drive.google.com/drive/my-drive']].map(([ten, dia]) => h('a', { class: 'chip', href: `${dia}?authuser=${encodeURIComponent(gg.da_noi.email)}`, target: '_blank', rel: 'noopener noreferrer', title: `Mở bằng tài khoản ${gg.da_noi.email}` }, ten))) : null,
      laChuGg ? khoiNhanGoogle() : null,
      laChuGg ? nhapLaiKhoaGoogle() : null,
      gg.da_noi.co_drive ? null : h('p', { class: 'canh-bao-nho', text: 'Chưa có quyền Drive nên tệp đính kèm mới chỉ nằm ở kho của hệ thống. Bật Google Drive API trong dự án Google Cloud, rồi bấm Đăng nhập lại và tick quyền Drive.' }),
      laChuGg && !gg.da_noi.co_drive ? h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: '/api/google/bat-dau' }, icon('thu'), 'Đăng nhập lại để thêm Drive')) : null,
      laChuGg ? h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/google', { method: 'DELETE' }); bao('Đã gỡ kết nối Google.'); ve(); } }, 'Gỡ kết nối Google')) : null,
    );
  } else if (gg.co_client) {
    khoiGg.push(
      h('p', { class: 'mo-ta', text: 'Đã có Client ID. Bấm nút để chọn tài khoản Google và đồng ý các quyền Gmail, Lịch, Tasks, Drive. Nhớ tick đủ quyền.' }),
      laChuGg ? h('div', { class: 'hang-nut' },
        h('a', { class: 'nut nut-chinh', href: '/api/google/bat-dau' }, icon('thu'), 'Đăng nhập Google'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/google?het=1', { method: 'DELETE' }); ve(); } }, 'Đổi Client ID')) : null,
    );
  } else {
    khoiGg.push(
      h('p', { class: 'mo-ta', text: 'Làm một lần, khoảng 5 phút, rồi chỉ cần bấm Đăng nhập Google:' }),
      h('ol', { class: 'buoc' },
        h('li', {}, 'Vào console.cloud.google.com, tạo một dự án mới, rồi ở mục APIs & Services bật bốn API: Gmail API, Google Calendar API, Google Tasks API, Google Drive API.'),
        h('li', {}, 'Mục OAuth consent screen: chọn External, đặt tên ứng dụng, để chế độ Testing và thêm email của bạn vào Test users.'),
        h('li', {}, 'Mục Credentials, Create credentials, OAuth client ID, loại Web application. Ở Authorized redirect URIs dán địa chỉ bên dưới.'),
        h('li', {}, 'Chép Client ID và Client Secret dán vào hai ô dưới đây.'),
      ),
      oChep(gg.dia_chi_goi_lai),
      laChuGg ? h('div', { class: 'luoi-nhap' }, oIdGg, oBiMatGg, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api('/api/ket-noi/google', { method: 'POST', body: JSON.stringify({ client_id: oIdGg.value, client_secret: oBiMatGg.value }) });
          bao('Đã lưu. Bấm Đăng nhập Google để chọn tài khoản.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Lưu')) : null,
    );
  }
  const lanCuoiLoiGg = gg.lan_cuoi?.ghi_chu?.startsWith('Lỗi');
  // Kho Drive: tài khoản Google Drive riêng để giữ bản lưu tin nhắn, thư, tệp, bộ nhớ AI
  const kho = kn.kho_drive || { da_noi: null, lan_cuoi: null };
  const ketQuaKho = new URLSearchParams(location.search).get('kho');
  if (ketQuaKho) {
    history.replaceState(null, '', `${location.pathname}#ket-noi`);
    if (ketQuaKho === 'ok') bao('Đã nối Drive kho. Tin nhắn, thư, tệp và bộ nhớ AI sẽ được lưu sang đó mỗi 5 phút.');
    else bao(ketQuaKho, { loi: true });
  }
  const khoiKho = [];
  const loiKho = kho.lan_cuoi?.ghi_chu?.startsWith('Lỗi');
  if (kho.da_noi) {
    khoiKho.push(
      hangTaiKhoan(kho.da_noi.email || 'Tài khoản Drive', kho.lan_cuoi ? `${kho.lan_cuoi.ghi_chu}, ${luc(kho.lan_cuoi.lan_cuoi)}` : 'Chờ lượt lưu đầu tiên'),
      h('p', { class: 'ghi-nho-kn', text: 'Tin và thư gom thành một tệp mỗi ngày; Bộ nhớ AI và Việc ghi đè đúng một tệp. Hệ thống không bao giờ xóa gì trên Drive.' }),
      linkKhoDrive(kho),
      laChuGg ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
          ev.target.disabled = true;
          try { const r = await api('/api/kho-drive/luu-ngay', { method: 'POST' }); bao(r.loi.length ? r.loi.join('; ') : `Đã lưu: ${r.tep} tệp, ${r.tin} ngày tin và thư, ${r.bo_nho + r.viec} danh sách.`, r.loi.length ? { loi: true } : undefined); ve(); }
          catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
        } }, icon('kho'), 'Lưu ngay'),
        h('a', { class: 'nut nut-phu', href: '/api/kho-drive/bat-dau' }, 'Đổi tài khoản Drive'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/kho-drive', { method: 'DELETE' }); bao('Đã gỡ Drive kho. Tệp đã lưu vẫn còn trên Drive.'); ve(); } }, 'Gỡ kết nối')) : null,
    );
  } else if (!gg.co_client) {
    khoiKho.push(h('p', { class: 'mo-ta', text: 'Khai Client ID và Secret ở thẻ Google bên trên trước. Drive kho dùng chung chúng, không cần tạo thêm gì ở Google Cloud.' }));
  } else {
    khoiKho.push(
      h('p', { class: 'mo-ta', text: 'Bấm nút, chọn tài khoản Google có Drive muốn dùng làm kho (có thể khác tài khoản đã nối ở trên) và tick quyền Drive. Hệ thống chỉ thấy thư mục và tệp do chính nó tạo ra.' }),
      h('p', { class: 'canh-bao-nho', text: 'Nếu ứng dụng Google Cloud đang ở chế độ Testing, thêm email của tài khoản đó vào Test users ở mục OAuth consent screen trước, nếu không Google sẽ chặn.' }),
      laChuGg ? h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: '/api/kho-drive/bat-dau' }, icon('kho'), 'Chọn tài khoản Drive kho')) : null,
    );
  }
  const theKho = h('section', { class: 'bang the-kn rong' },
    dau('kho', 'Drive kho: nơi lưu lại tin nhắn, thư, bộ nhớ AI', 'Một Google Drive riêng giữ bản lưu của tin Zalo, thư, tệp đính kèm, bộ nhớ AI và danh sách việc, phòng khi cần tra lại hoặc đổi hệ thống.', kho.da_noi ? (loiKho ? 'do' : 'xanh') : 'xam', kho.da_noi ? (loiKho ? 'Đang lỗi' : 'Đã nối') : 'Chưa nối'),
    loiKho ? h('p', { class: 'canh-bao-nho', text: kho.lan_cuoi.ghi_chu }) : null,
    ...khoiKho,
  );
  // Ghi âm và biên bản họp: một thư mục Drive (có thể ở tài khoản khác), mỗi cuộc họp thành một tin trong Hộp tin.
  const hop = kn.hop || { da_noi: null, thu_muc: null, lan_cuoi: null };
  const ketQuaHop = new URLSearchParams(location.search).get('hop');
  if (ketQuaHop) {
    history.replaceState(null, '', `${location.pathname}#ket-noi`);
    if (ketQuaHop === 'ok') bao('Đã đăng nhập. Dán liên kết thư mục ghi âm và biên bản họp rồi bấm Nối thư mục.');
    else bao(ketQuaHop, { loi: true });
  }
  const loiHop = hop.lan_cuoi?.ghi_chu?.startsWith('Lỗi');
  const oLinkHop = h('input', { type: 'url', placeholder: 'https://drive.google.com/drive/folders/…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Liên kết thư mục Drive' });
  const nutNoiHop = h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
    ev.target.disabled = true;
    try {
      const r = await api('/api/ket-noi/hop', { method: 'POST', body: JSON.stringify({ link: oLinkHop.value }) });
      bao(`Đã nối thư mục "${r.ten}": thấy ${r.ghi_am} ghi âm, ${r.bien_ban} biên bản. Cuộc họp trong 30 ngày gần đây sẽ vào Hộp tin sau ít phút.`);
      ve();
    } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
  } }, 'Nối thư mục');
  const oChonThuMuc = h('div', { class: 'luoi-nhap' }, oLinkHop, nutNoiHop);
  const khoiHop = [];
  if (hop.da_noi && hop.thu_muc) {
    khoiHop.push(
      hangTaiKhoan(hop.da_noi.email || 'Tài khoản Google', hop.lan_cuoi ? `${hop.lan_cuoi.ghi_chu}, ${luc(hop.lan_cuoi.lan_cuoi)}` : 'Chờ lượt quét đầu tiên'),
      h('p', { class: 'ghi-nho-kn' }, 'Đang đọc thư mục ', h('a', { href: `https://drive.google.com/drive/folders/${encodeURIComponent(hop.thu_muc.id)}${hop.da_noi.email ? `?authuser=${encodeURIComponent(hop.da_noi.email)}` : ''}`, target: '_blank', rel: 'noopener noreferrer', text: hop.thu_muc.ten || 'trên Drive' }), '. Mỗi 5 phút, cuộc họp mới (ghi âm, biên bản) vào Hộp tin; AI đọc biên bản và chỉ ghi việc được giao cho bạn. Hệ thống chỉ đọc, không sửa hay xóa gì trong thư mục.'),
      laChuGg ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
          ev.target.disabled = true;
          try { const r = await api('/api/hop/quet-ngay', { method: 'POST' }); bao(r.loi.length ? r.loi.join('; ') : `Đã quét: ${r.moi} cuộc họp mới${r.bo_sung ? `, ${r.bo_sung} cuộc họp có thêm tệp` : ''}.`, r.loi.length ? { loi: true } : undefined); ve(); }
          catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
        } }, icon('ghi-am'), 'Quét ngay'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: (ev) => { ev.target.closest('.hang-nut').after(oChonThuMuc); ev.target.remove(); oLinkHop.focus(); } }, 'Đổi thư mục'),
        h('a', { class: 'nut nut-phu', href: '/api/hop/bat-dau' }, 'Đổi tài khoản'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/hop', { method: 'DELETE' }); bao('Đã gỡ thư mục họp. Cuộc họp đã có trong Hộp tin vẫn giữ nguyên.'); ve(); } }, 'Gỡ kết nối')) : null,
    );
  } else if (hop.da_noi) {
    khoiHop.push(
      hangTaiKhoan(hop.da_noi.email || 'Tài khoản Google', 'Đã đăng nhập, chưa chọn thư mục'),
      h('ol', { class: 'buoc' },
        h('li', {}, 'Mở thư mục chứa ghi âm và biên bản họp trên Google Drive.'),
        h('li', {}, 'Chép địa chỉ trên thanh trình duyệt (có chữ /folders/), dán vào ô dưới, bấm Nối thư mục.'),
      ),
      laChuGg ? oChonThuMuc : null,
    );
  } else if (!gg.co_client) {
    khoiHop.push(h('p', { class: 'mo-ta', text: 'Khai Client ID và Secret ở thẻ Google trước. Thư mục họp dùng chung chúng, không cần tạo thêm gì ở Google Cloud.' }));
  } else {
    khoiHop.push(
      h('ol', { class: 'buoc' },
        h('li', {}, 'Bấm nút, chọn tài khoản Google có thư mục ghi âm (có thể khác tài khoản ở trên), tick quyền xem tệp Drive.'),
        h('li', {}, 'Quay lại đây, dán liên kết thư mục, bấm Nối thư mục.'),
      ),
      h('p', { class: 'canh-bao-nho', text: 'Ứng dụng Google Cloud đang ở chế độ Testing thì thêm email của tài khoản đó vào Test users ở mục OAuth consent screen trước, nếu không Google sẽ chặn.' }),
      laChuGg ? h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: '/api/hop/bat-dau' }, icon('ghi-am'), 'Chọn tài khoản có thư mục')) : null,
    );
  }
  const theHop = h('section', { class: 'bang the-kn rong' },
    dau('ghi-am', 'Ghi âm và biên bản họp', 'Thư mục Drive chứa các cuộc ghi âm kèm biên bản. Mỗi cuộc họp thành một tin trong Hộp tin, nghe lại và đọc biên bản ngay tại đó.',
      hop.da_noi && hop.thu_muc ? (loiHop ? 'do' : 'xanh') : hop.da_noi ? 'vang' : 'xam',
      hop.da_noi && hop.thu_muc ? (loiHop ? 'Đang lỗi' : 'Đã nối') : hop.da_noi ? 'Chờ chọn thư mục' : 'Chưa nối'),
    loiHop ? h('p', { class: 'canh-bao-nho', text: hop.lan_cuoi.ghi_chu }) : null,
    ...khoiHop,
  );
  const theGoogle = h('section', { class: 'bang the-kn rong' },
    dau('thu', 'Google: Gmail, Lịch, Tasks, Drive', 'Đăng nhập một lần, hệ thống đọc thư, ghi việc sang Tasks và Lịch, lưu tệp đính kèm vào Drive giúp bạn.', gg.da_noi ? (lanCuoiLoiGg ? 'do' : 'xanh') : gg.co_client ? 'vang' : 'xam', gg.da_noi ? (lanCuoiLoiGg ? 'Đang lỗi' : 'Đã nối') : gg.co_client ? 'Chờ đăng nhập' : 'Chưa nối'),
    lanCuoiLoiGg ? h('p', { class: 'canh-bao-nho', text: gg.lan_cuoi.ghi_chu }) : null,
    ...khoiGg,
  );

  // Zalo
  const oLenhZalo = h('div');
  const theZalo = h('section', { class: 'bang the-kn' },
    dau('zalo', 'Zalo trên máy Mac', 'Tin và tệp Zalo cá nhân tự về hộp tin.',
      !kn.zalo.khoa ? 'xam' : !kn.zalo.lan_cuoi ? 'vang' : Date.now() - Date.parse(kn.zalo.lan_cuoi.lan_cuoi) > 6 * 3600000 ? 'do' : 'xanh',
      !kn.zalo.khoa ? 'Chưa nối' : !kn.zalo.lan_cuoi ? 'Chờ máy Mac' : `Tín hiệu ${luc(kn.zalo.lan_cuoi.lan_cuoi)}`),
    h('ol', { class: 'buoc' },
      h('li', {}, 'Bấm Tạo lệnh, rồi bấm nút chép.'),
      h('li', {}, 'Trên máy Mac, mở ứng dụng Terminal, dán lệnh, nhấn Enter.'),
    ),
    oLenhZalo,
    h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
      if (kn.zalo.khoa && !confirm('Tạo lệnh mới thì máy Mac đang nối sẽ ngừng gửi cho đến khi chạy lệnh mới. Tiếp tục?')) return;
      try {
        const kq = await api('/api/ket-noi/zalo', { method: 'POST' });
        thay(oLenhZalo, oChep(kq.lenh, { lo: true }), h('p', { class: 'canh-bao-nho', style: 'margin-top:10px', text: 'Lệnh này chỉ hiện một lần, đừng gửi cho người khác.' }));
      } catch (e) { bao(e.message, { loi: true }); }
    } }, icon('lap'), kn.zalo.khoa ? 'Tạo lệnh mới' : 'Tạo lệnh')),
  );

  // Lịch
  const oLich = h('div');
  const theLich = h('section', { class: 'bang the-kn' },
    dau('lich', 'Lịch', 'Việc có hạn hiện trên Google Lịch (hoặc lịch iPhone, Outlook), tự cập nhật.', kn.lich.khoa ? 'xanh' : 'xam', kn.lich.khoa ? (kn.lich.khoa.dung_luc ? `Đọc ${luc(kn.lich.khoa.dung_luc)}` : 'Chờ lịch đọc') : 'Chưa nối'),
    oLich,
    h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async () => {
      if (kn.lich.khoa && !confirm('Nối lại thì lịch cũ ngừng cập nhật, phải thêm lại vào Google Lịch. Tiếp tục?')) return;
      try {
        const kq = await api('/api/ket-noi/lich', { method: 'POST' });
        thay(oLich,
          h('div', { class: 'hang-nut' }, h('a', { class: 'nut nut-chinh', href: kq.google, target: '_blank', rel: 'noopener' }, icon('lich'), 'Thêm vào Google Lịch')),
          h('p', { class: 'canh-bao-nho', style: 'margin-top:10px', text: 'Lịch khác (iPhone, Outlook): chép đường dẫn dưới rồi thêm lịch theo đường dẫn.' }),
          oChep(kq.duong_dan));
      } catch (e) { bao(e.message, { loi: true }); }
    } }, icon('lich'), kn.lich.khoa ? 'Nối lại' : 'Nối lịch')),
  );

  // Thông báo trên trình duyệt: đèn theo máy đang xem (đã cho phép chưa), phần thân tự đọc cài đặt.
  const ttTb = trangThaiThongBao();
  const theTb = h('section', { class: 'bang the-kn' },
    dau('chuong', 'Thông báo trên trình duyệt', 'Việc mới, giờ hẹn, Claude hỏi lại hiện ngay trên máy tính và điện thoại, kể cả khi đã đóng trang.', ttTb.den, ttTb.chu),
  );
  veTheThongBao(theTb, { h, icon, api, bao, sauKhiThu: () => S.chuong?.lamMoi({ ep: true }) });

  // Telegram
  const theTele = h('section', { class: 'bang the-kn' },
    dau('telegram', 'Báo qua Telegram', 'Nhắn thường để tạo việc, lệnh /viec /nho /hoi /tomtat; báo việc mới và cảnh báo khi máy Zalo im lặng.', kn.telegram.da_noi ? 'xanh' : 'xam', kn.telegram.da_noi ? 'Đã nối' : kn.telegram.co_bot ? 'Chưa nối' : 'Chưa cài bot'),
  );
  if (kn.telegram.co_bot) {
    theTele.append(
      h('ol', { class: 'buoc' }, h('li', {}, 'Bấm Nối Telegram, Telegram mở ra.'), h('li', {}, 'Bấm Start. Bot trả lời "Đã nối" là xong.')),
      h('div', { class: 'hang-nut' },
        h('a', { class: 'nut nut-chinh', href: kn.telegram.duong_dan, target: '_blank', rel: 'noopener' }, icon('telegram'), kn.telegram.da_noi ? 'Nối lại Telegram' : 'Nối Telegram'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: () => ve() }, icon('lap'), 'Kiểm tra lại'),
      ),
    );
  }
  if (kn.telegram.quan_tri) {
    const oMa = h('input', { type: 'password', placeholder: 'Dán mã bot @BotFather gửi', autocomplete: 'off', 'aria-label': 'Mã bot Telegram', style: 'flex:1;min-width:0' });
    theTele.append(
      h('p', { class: 'canh-bao-nho', style: 'margin-top:12px', text: kn.telegram.co_bot ? `Bot chung đang dùng: @${kn.telegram.ten_bot}. Dán mã khác nếu muốn đổi bot.` : 'Cài bot chung một lần: trong Telegram nhắn @BotFather, gõ /newbot, đặt tên, rồi dán mã nó gửi vào ô dưới.' }),
      h('div', { class: 'hang-nut' }, oMa, h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => {
        try {
          const kq = await api('/api/ket-noi/telegram/bot', { method: 'POST', body: JSON.stringify({ token: oMa.value }) });
          bao(`Đã cài bot @${kq.ten}.`);
          ve();
        } catch (e) { bao(e.message, { loi: true }); }
      } }, 'Lưu bot')),
    );
  } else if (!kn.telegram.co_bot) {
    theTele.append(h('p', { class: 'canh-bao-nho', text: 'Hệ thống đang chuẩn bị bot Telegram.' }));
  }

  // API: AI của riêng bạn và địa chỉ nhận việc mới
  const th = kn.tich_hop;
  const laChu = th.vai_tro === 'chu';
  const oLoaiAi = h('select', { 'aria-label': 'Loại dịch vụ AI' }, h('option', { value: 'claude', text: 'Claude (Anthropic)' }), h('option', { value: 'openai', text: 'Loại tương thích OpenAI' }));
  const oKhoaAi = h('input', { type: 'password', placeholder: 'Dán khóa API', autocomplete: 'off', 'aria-label': 'Khóa API' });
  const oMoHinh = h('input', { type: 'text', placeholder: 'Mô hình (bỏ trống để dùng mặc định)', autocomplete: 'off', 'aria-label': 'Mô hình' });
  const oDiaChiAi = h('input', { type: 'url', placeholder: 'Địa chỉ dịch vụ, ví dụ https://api.openai.com/v1', autocomplete: 'off', 'aria-label': 'Địa chỉ dịch vụ', hidden: true });
  const oWorkspace = h('input', { type: 'text', placeholder: 'Workspace ID (chỉ điền khi khóa báo thiếu Workspace)', autocomplete: 'off', 'aria-label': 'Workspace ID của Anthropic' });
  oLoaiAi.addEventListener('change', () => { oDiaChiAi.hidden = oLoaiAi.value !== 'openai'; oWorkspace.hidden = oLoaiAi.value !== 'claude'; });
  const aiNut = h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
    ev.target.disabled = true;
    try {
      await api('/api/ket-noi/ai', { method: 'POST', body: JSON.stringify({ loai: oLoaiAi.value, khoa: oKhoaAi.value, mo_hinh: oMoHinh.value, dia_chi: oDiaChiAi.value, workspace_id: oWorkspace.value }) });
      bao('Đã nối dịch vụ AI. Từ lượt tách việc sau sẽ dùng dịch vụ này.');
      ve();
    } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
  } }, icon('ai'), 'Kiểm tra và lưu');
  // Nhà cung cấp AI của máy chủ: chọn Claude hay FPT AI, có hiệu lực từ lượt gọi AI kế tiếp
  const ncc = kn.nha_cung_cap_ai;
  let khoiNcc = null;
  if (ncc) {
    const chon = (_, coChung) => h('select', { 'aria-label': 'Nhà cung cấp AI' }, ...(coChung ? [h('option', { value: 'chung', text: 'Theo ô chung' })] : []), h('option', { value: 'claude', text: 'Claude' }), h('option', { value: 'fpt', text: 'FPT AI' }));
    const oChung = chon(); const oTach = chon(null, true); const oSoan = chon(null, true);
    const oTat = h('input', { type: 'checkbox', 'aria-label': 'Tắt hẳn Claude' }); oTat.checked = Boolean(ncc.lua_chon.tat_claude);
    oChung.value = ncc.lua_chon.chung; oTach.value = ncc.lua_chon.tach_viec || 'chung'; oSoan.value = ncc.lua_chon.soan_prompt || 'chung';
    const nhan = (chu, o) => h('label', { class: 'hang-nhan' }, h('span', { text: chu }), o);
    khoiNcc = h('div', { class: 'khoi-api' },
      h('h3', { text: 'Nhà cung cấp AI' }),
      h('p', { class: 'mo-ta', text: `Chọn Claude hoặc FPT AI cho AI tách việc, tóm tắt, ghi nhớ và soạn prompt. Có hiệu lực từ lượt gọi AI kế tiếp, không cần khởi động lại. ${ncc.co_fpt ? `FPT AI đã có khóa (${ncc.khoa_fpt?.nguon === 'giao_dien' ? 'nhập ở đây' : 'từ biến môi trường trên máy chủ'}), việc thường dùng ${ncc.khoa_fpt?.model}, việc khó dùng ${ncc.khoa_fpt?.model_manh}.` : 'FPT AI chưa có khóa, chọn FPT lúc này sẽ tự dùng Claude. Nhập khóa ở ô bên dưới.'}` }),
      laChu ? h('div', { class: 'luoi-nhap' }, nhan('Chung', oChung), nhan('Tách việc', oTach), nhan('Soạn prompt', oSoan), h('label', { class: 'hang-nhan' }, h('span', { text: 'Tắt hẳn Claude (chỉ dùng FPT AI, FPT lỗi thì báo lỗi, không quay về Claude)' }), oTat),
        h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            await api('/api/ket-noi/nha-cung-cap-ai', { method: 'POST', body: JSON.stringify({ chung: oChung.value, tach_viec: oTach.value, soan_prompt: oSoan.value, tat_claude: oTat.checked }) });
            bao('Đã đổi nhà cung cấp AI.');
            ve();
          } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
        } }, icon('ai'), 'Lưu lựa chọn')) : null,
      laChu ? ((() => {
        const oKhoa = h('input', { type: 'password', placeholder: 'Dán khóa FPT AI (chỉ hiện một lần, không hiện lại)', autocomplete: 'off', 'aria-label': 'Khóa FPT AI' });
        const oDc = h('input', { type: 'url', placeholder: `Địa chỉ gateway (bỏ trống: ${ncc.khoa_fpt?.dia_chi || ''})`, autocomplete: 'off', 'aria-label': 'Địa chỉ gateway FPT AI' });
        const oNhe = h('input', { type: 'text', placeholder: `Model việc thường (bỏ trống: ${ncc.khoa_fpt?.model || ''})`, autocomplete: 'off', 'aria-label': 'Model việc thường' });
        const oManh = h('input', { type: 'text', placeholder: `Model việc khó (bỏ trống: ${ncc.khoa_fpt?.model_manh || ''})`, autocomplete: 'off', 'aria-label': 'Model việc khó' });
        return h('div', { class: 'luoi-nhap', style: 'margin-top:12px' }, h('strong', { text: 'Khóa FPT AI' }), oKhoa, oDc, oNhe, oManh,
          h('div', { class: 'hang-nut' },
            h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
              ev.target.disabled = true;
              try {
                await api('/api/ket-noi/khoa-fpt', { method: 'POST', body: JSON.stringify({ khoa: oKhoa.value, dia_chi: oDc.value, model: oNhe.value, model_manh: oManh.value }) });
                bao('Đã kiểm khóa và lưu. Chọn FPT AI ở trên để dùng.');
                ve();
              } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
            } }, icon('ai'), 'Kiểm tra và lưu khóa'),
            ncc.khoa_fpt?.nguon === 'giao_dien' ? h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/khoa-fpt', { method: 'DELETE' }); bao('Đã gỡ khóa FPT AI.'); ve(); } }, 'Gỡ khóa') : null));
      })()) : null,
    );
  }

  const khoiAi = h('div', { class: 'khoi-api' },
    h('h3', { text: 'AI của bạn' }),
    h('p', { class: 'mo-ta', text: th.ai ? `Đang dùng ${th.ai.loai === 'claude' ? 'Claude' : 'dịch vụ tương thích OpenAI'}, mô hình ${th.ai.mo_hinh}. Gặp lỗi thì tự quay về AI có sẵn.` : 'Mặc định tách việc bằng AI có sẵn của hệ thống. Dán khóa API của bạn nếu muốn dùng mô hình mạnh hơn.' }),
    th.ai?.loi ? h('p', { class: 'canh-bao-nho', text: th.ai.loi.ghi_chu }) : null,
    laChu ? (th.ai
      ? h('div', { class: 'hang-nut' }, h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/ai', { method: 'DELETE' }); bao('Đã gỡ, quay về AI có sẵn.'); ve(); } }, 'Gỡ dịch vụ này'))
      : h('div', { class: 'luoi-nhap' }, oLoaiAi, oKhoaAi, oMoHinh, oDiaChiAi, oWorkspace, aiNut)) : null,
  );

  const oDiaChiNhan = h('input', { type: 'url', placeholder: 'https://… địa chỉ nhận việc mới', autocomplete: 'off', 'aria-label': 'Địa chỉ nhận việc mới' });
  const khoiNhan = h('div', { class: 'khoi-api' },
    h('h3', { text: 'Báo việc mới tới dịch vụ khác' }),
    h('p', { class: 'mo-ta', text: th.webhook ? `Mỗi việc mới gửi tới ${th.webhook.host}. ${th.webhook.lan_cuoi ? `${th.webhook.lan_cuoi.ghi_chu}, ${luc(th.webhook.lan_cuoi.lan_cuoi)}.` : 'Chưa có việc nào được gửi.'}` : 'Mỗi việc mới (AI tách từ tin, hoặc bạn tự thêm) được gửi dạng JSON tới địa chỉ này. Dùng được với Zapier, Make, Google Apps Script, Slack, Notion và mọi dịch vụ có địa chỉ nhận (webhook).' }),
    laChu ? (th.webhook
      ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { try { await api('/api/ket-noi/webhook/thu', { method: 'POST' }); bao('Đã gửi một việc thử.'); } catch (e) { bao(e.message, { loi: true }); } } }, 'Gửi thử'),
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/webhook', { method: 'DELETE' }); bao('Đã gỡ địa chỉ.'); ve(); } }, 'Gỡ'))
      : h('div', { class: 'luoi-nhap' }, oDiaChiNhan, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api('/api/ket-noi/webhook', { method: 'POST', body: JSON.stringify({ url: oDiaChiNhan.value }) });
          bao('Đã nối. Em vừa gửi một tin thử tới địa chỉ này.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Kiểm tra và lưu'))) : null,
  );
  const nv = kn.nhan_viec;
  const khungMa = h('div');
  const khoiVao = h('div', { class: 'khoi-api' },
    h('h3', { text: 'Nhận việc từ dịch vụ khác' }),
    h('p', { class: 'mo-ta', text: nv.co ? `Đã có mã nhận việc. ${nv.lan_cuoi ? `${nv.lan_cuoi.ghi_chu}, ${luc(nv.lan_cuoi.lan_cuoi)}.` : 'Chưa nhận việc nào.'} Mã chỉ hiện một lần lúc tạo, mất thì tạo mã mới.` : 'Zapier, Make, Apps Script, biểu mẫu gửi việc vào đây. Gửi tieu_de để tạo việc ngay, hoặc noi_dung (văn bản tự do) để AI đọc và tách việc.' }),
    laChu ? h('div', { class: 'hang-nut' },
      h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          const kq = await api('/api/ket-noi/nhan-viec', { method: 'POST' });
          khungMa.replaceChildren(
            h('p', { class: 'canh-bao-nho', text: 'Chép mã ngay, sẽ không hiện lại. Gửi POST tới địa chỉ dưới, kèm Authorization: Bearer <mã>.' }),
            oChep(kq.ma),
            oChep(`curl -X POST ${kq.dia_chi} -H "Authorization: Bearer ${kq.ma}" -H "content-type: application/json" -d '{"tieu_de":"Nộp báo cáo","han_ngay":"2026-10-15"}'`),
          );
        } catch (e) { bao(e.message, { loi: true }); }
        ev.target.disabled = false;
      } }, nv.co ? 'Tạo mã mới' : 'Tạo mã nhận việc'),
      nv.co ? h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/nhan-viec', { method: 'DELETE' }); bao('Đã gỡ mã.'); ve(); } }, 'Gỡ mã') : null) : null,
    khungMa,
  );
  const gh = kn.github;
  const oTokenGh = h('input', { type: 'password', placeholder: 'Token GitHub (github_pat_…)', autocomplete: 'off', 'aria-label': 'Token GitHub' });
  const oKhoGh = h('input', { type: 'text', placeholder: 'Kho làm việc, ví dụ ten-ban/sonicplan-viec', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Kho GitHub' });
  const khoiGit = h('div', { class: 'khoi-api' },
    h('h3', { text: 'Kho GitHub' }),
    h('p', { class: 'mo-ta', text: gh ? `Đã nối kho ${gh.repo}. ${gh.lan_cuoi ? `Lần gần nhất: ${gh.lan_cuoi.ghi_chu}, ${luc(gh.lan_cuoi.lan_cuoi)}.` : ''} Claude không còn chạy trên kho này: nút "Soạn prompt" ở việc chỉ soạn prompt để bạn dán sang Claude khác.` : 'Nối kho GitHub để Sonicplan tạo issue cho việc cần theo dõi. Tạo token ở github.com/settings/personal-access-tokens, chọn đúng một kho, cấp quyền đọc ghi Issues.' }),
    laChu ? (gh
      ? h('div', { class: 'hang-nut' },
        h('button', { class: 'nut nut-phu', type: 'button', onclick: async () => { await api('/api/ket-noi/github', { method: 'DELETE' }); bao('Đã gỡ GitHub.'); ve(); } }, 'Gỡ GitHub'))
      : h('div', { class: 'luoi-nhap' }, oKhoGh, oTokenGh, h('button', { class: 'nut nut-chinh', type: 'button', onclick: async (ev) => {
        ev.target.disabled = true;
        try {
          await api('/api/ket-noi/github', { method: 'POST', body: JSON.stringify({ token: oTokenGh.value, repo: oKhoGh.value }) });
          bao('Đã nối GitHub.');
          ve();
        } catch (e) { bao(e.message, { loi: true }); ev.target.disabled = false; }
      } }, 'Kiểm tra và lưu'))) : null,
  );
  const theApi = h('section', { class: 'bang the-kn rong' },
    dau('ai', 'API trong luồng việc', 'Tin về, AI đọc, việc mới ra, rồi báo tiếp tới dịch vụ bạn dùng.', th.ai || th.webhook || nv.co || gh ? 'xanh' : 'xam', th.ai || th.webhook || nv.co || gh ? 'Đã nối' : 'Chưa nối'),
    h('div', { class: 'luoi-api' }, ...(khoiNcc ? [khoiNcc] : []), khoiAi, khoiNhan, khoiVao, khoiGit),
  );

  const theNen = h('section', { class: 'bang the-kn rong' },
    dau('ai', 'AI và kho tệp', 'Workers AI đọc tin mới mỗi 5 phút để tách việc; tệp và bản sao lưu hằng đêm nằm trong kho R2.', kn.ai.co && kn.tep.co ? 'xanh' : 'vang', kn.ai.co && kn.tep.co ? 'Sẵn sàng' : 'Thiếu cấu hình'),
    h('div', { class: 'luoi-tp', style: 'padding:0' },
      h('div', { class: 'tp' }, h('span', { class: 'tp-icon', dataset: { den: kn.ai.co ? 'xanh' : 'do' } }, icon('ai')), h('div', {}, h('strong', { text: 'Workers AI' }), h('span', { text: kn.ai.co ? 'Đã gắn, không cần khóa riêng' : 'Chưa gắn' }))),
      h('div', { class: 'tp' }, h('span', { class: 'tp-icon', dataset: { den: kn.tep.co ? 'xanh' : 'do' } }, icon('kho')), h('div', {}, h('strong', { text: 'Kho tệp R2' }), h('span', { text: kn.tep.co ? 'Đã gắn, sao lưu lúc 23h' : 'Chưa bật R2' }))),
      h('div', { class: 'tp' }, h('span', { class: 'tp-icon', dataset: { den: 'xanh' } }, icon('he-thong')), h('div', {}, h('strong', { text: 'Địa chỉ trang' }), h('span', { translate: 'no', text: kn.goc }))),
    ),
  );

  const ttTho = trangThaiThoClaude(tho);
  const theTho = h('section', { class: 'bang the-kn rong' },
    dau('ai', 'Claude làm việc ở máy', 'Claude Code tự làm việc nhóm Claude, kết quả vào ThangLong_KB và Drive.', ttTho.den, ttTho.chu),
    noiDungThoClaude({ h, api, bao, tho, kb: kbMap, laChu: kn.tich_hop.vai_tro === 'chu', ve }));

  const nhomThe = [
    ['Tài khoản Google', [['google', theGoogle], ['kho', theKho]]],
    ['Tin vào', [['zalo', theZalo], ['hop', theHop], ['telegram', theTele]]],
    ['Gửi ra', [['thong-bao', theTb], ['lich', theLich], ['api', theApi]]],
    ['Hệ thống', [['claude-may', theTho], ['nen', theNen]]],
  ];
  const cacThe = nhomThe.map(([ten, ds]) => [ten, ds.map(([ma, the]) => gapTheKn(the, ma))]);
  const tomTat = h('div', { class: 'tom-tat-kn', role: 'list' }, ...cacThe.flatMap(([, ds]) => ds).map((t) => h('button', { type: 'button', class: 'o-kn', role: 'listitem', dataset: { den: t.den }, onclick: () => {
    t.the.open = true;
    t.the.scrollIntoView({ behavior: 'smooth', block: 'start' });
    t.the.querySelector('summary').focus({ preventScroll: true });
  } }, t.bieuTuong, h('span', { class: 'o-kn-chu' }, h('b', { text: t.ten }), h('small', { text: t.trangThai })))));
  thay(goc, tomTat, ...cacThe.map(([ten, ds]) => h('section', { class: 'nhom-kn', 'aria-label': ten }, h('h2', { class: 'tieu-nhom-kn', text: ten }), h('div', { class: 'ds-kn' }, ...ds.map((t) => t.the)))));
  // Đến từ liên kết "Cài đặt thông báo" trong chuông: mở sẵn thẻ đó.
  if (location.hash === '#ket-noi/thong-bao') {
    const t = document.getElementById('kn-thong-bao');
    if (t) { t.open = true; t.scrollIntoView({ block: 'start' }); }
  }
}

// Hàng tài khoản đã nối: chữ cái đầu, email, dòng trạng thái lần chạy cuối.
function hangTaiKhoan(email, dong) {
  return h('div', { class: 'tai-khoan-kn' }, h('span', { class: 'dau-tk', 'aria-hidden': 'true', text: String(email).trim().charAt(0).toUpperCase() }), h('div', {}, h('b', { translate: 'no', text: email }), h('small', { text: dong })));
}

// Biến thẻ kết nối thành thẻ gập: tiêu đề luôn thấy, phần chi tiết mở khi cần làm gì (chưa nối, lỗi), gập khi đã ổn.
function gapTheKn(the, ma) {
  const dau = the.querySelector(':scope > header');
  const bieuTuong = dau.querySelector('.tp-icon');
  const den = bieuTuong.dataset.den;
  const ten = dau.querySelector('h2').textContent;
  const trangThai = dau.querySelector('.trang-thai-kn')?.textContent || '';
  const ct = h('details', { class: the.className, id: `kn-${ma}` });
  ct.open = den !== 'xanh';
  const tomTat = h('summary', {}, ...dau.children, h('span', { class: 'mui-kn', 'aria-hidden': 'true' }));
  ct.append(tomTat, h('div', { class: 'than-kn' }, ...[...the.children].filter((c) => c !== dau)));
  return { the: ct, ma, ten: ten.split(':')[0], den, trangThai, bieuTuong: bieuTuong.cloneNode(true) };
}
