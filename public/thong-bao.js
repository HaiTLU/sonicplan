// Thông báo trên trang: chuông ở thanh trên (số chưa đọc, danh sách, bấm mở đúng việc)
// và thẻ "Thông báo trên trình duyệt" ở Cài đặt (xin quyền, đăng ký Web Push, công tắc từng loại).

const HOI_MOI_MS = 30000;

// d: { h, icon, api, bao, luc, moDuongDan(duong_dan, tb) }
export function batChuong(d) {
  const { h, icon, api, luc } = d;
  const nut = document.getElementById('nut-chuong');
  const dem = document.getElementById('dem-chuong');
  if (!nut) return { lamMoi: () => {} };
  const bang = h('div', { class: 'bang-thong-bao', id: 'bang-thong-bao', role: 'dialog', 'aria-label': 'Thông báo', hidden: true });
  nut.after(bang);
  nut.setAttribute('aria-controls', 'bang-thong-bao');
  let moiNhat = 0;
  let ds = [];
  let chuaDoc = 0;

  const datDem = (n) => {
    chuaDoc = n;
    dem.textContent = n > 99 ? '99+' : String(n);
    dem.hidden = !n;
    nut.setAttribute('aria-label', n ? `Thông báo, ${n} chưa đọc` : 'Thông báo');
    nut.title = n ? `${n} thông báo chưa đọc` : 'Thông báo';
  };

  const ICON = { viec_moi: 'viec', doi_han: 'lich', gio_hen: 'dong-ho', claude: 'ai', thu: 'chuong' };
  const ve = () => {
    const dau = h('header', {},
      h('h2', { text: 'Thông báo' }),
      chuaDoc ? h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: docHet }, 'Đánh dấu đã đọc hết') : null);
    const than = ds.length
      ? h('ul', { class: 'ds-thong-bao' }, ...ds.map((tb) => h('li', {},
        h('button', { type: 'button', class: tb.da_doc_luc ? 'tb' : 'tb chua-doc', onclick: () => moTb(tb) },
          h('span', { class: 'tb-icon', 'aria-hidden': 'true' }, icon(ICON[tb.loai] || 'chuong')),
          h('span', { class: 'tb-chu' }, h('b', { text: tb.tieu_de }), tb.noi_dung ? h('small', { text: tb.noi_dung }) : null),
          h('time', { datetime: tb.tao_luc, text: luc(tb.tao_luc) }),
          tb.da_doc_luc ? null : h('span', { class: 'cham-moi' }, h('span', { class: 'chu-an', text: 'Chưa đọc' }))))))
      : h('p', { class: 'tb-trong', text: 'Chưa có thông báo. Việc mới từ Hộp tin, giờ hẹn và Claude sẽ hiện ở đây.' });
    const chan = h('footer', {}, h('a', { href: '#ket-noi/thong-bao', onclick: dong, text: 'Cài đặt thông báo' }));
    bang.replaceChildren(dau, than, chan);
  };

  async function lamMoi({ ep = false } = {}) {
    try {
      const kq = await api(`/api/thong-bao${!ep && moiNhat ? `?sau=${moiNhat}` : ''}`);
      datDem(kq.chua_doc);
      if (kq.ds) {
        ds = kq.ds;
        moiNhat = kq.moi_nhat;
        if (!bang.hidden) ve();
      }
    } catch { /* mất mạng: thử lại lần sau */ }
  }

  async function docMot(tb) {
    if (tb.da_doc_luc) return;
    tb.da_doc_luc = new Date().toISOString();
    datDem(Math.max(0, chuaDoc - 1));
    try { datDem((await api('/api/thong-bao/doc', { method: 'POST', body: JSON.stringify({ id: tb.id }) })).chua_doc); } catch { /* bỏ qua */ }
  }
  async function docHet() {
    for (const tb of ds) tb.da_doc_luc ||= new Date().toISOString();
    datDem(0);
    ve();
    try { await api('/api/thong-bao/doc', { method: 'POST', body: JSON.stringify({ tat_ca: true }) }); } catch { /* bỏ qua */ }
  }
  function moTb(tb) {
    dong();
    docMot(tb);
    d.moDuongDan(tb.duong_dan || '#tong-quan');
  }

  function mo() {
    ve();
    bang.hidden = false;
    nut.setAttribute('aria-expanded', 'true');
    bang.querySelector('button, a')?.focus({ preventScroll: true });
    lamMoi({ ep: true });
  }
  function dong() {
    if (bang.hidden) return;
    bang.hidden = true;
    nut.setAttribute('aria-expanded', 'false');
  }
  nut.addEventListener('click', () => (bang.hidden ? mo() : dong()));
  document.addEventListener('pointerdown', (e) => { if (!bang.hidden && !bang.contains(e.target) && !nut.contains(e.target)) dong(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bang.hidden) { dong(); nut.focus(); } });

  // Trang đang mở: hỏi máy chủ mỗi 30 giây (chỉ khi thẻ đang hiện) và ngay khi quay lại thẻ.
  // Có thông báo đẩy thì trình duyệt báo trang làm mới tức thì, không phải đợi.
  setInterval(() => { if (!document.hidden) lamMoi(); }, HOI_MOI_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) lamMoi(); });
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.loai === 'thong-bao') lamMoi();
    if (e.data?.loai === 'mo-thong-bao') { lamMoi({ ep: true }); d.moDuongDan(e.data.duong_dan || '#tong-quan'); }
  });
  lamMoi();
  return { lamMoi };
}

// ---------- Thẻ Cài đặt ----------
const coDay = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const laIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const daCaiManHinh = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function khoaUng(b64) {
  const c = b64.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(c + '='.repeat((4 - (c.length % 4)) % 4)), (x) => x.charCodeAt(0));
}

async function dangKyHienTai() {
  if (!coDay()) return null;
  const dk = await navigator.serviceWorker.getRegistration();
  return dk ? dk.pushManager.getSubscription() : null;
}

// Trạng thái để thẻ gập ở Cài đặt hiện đèn: xanh khi máy này đã bật, vàng khi chưa, xám khi trình duyệt không hỗ trợ.
export function trangThaiThongBao() {
  if (!coDay()) return laIos() && !daCaiManHinh() ? { den: 'vang', chu: 'Cần thêm vào màn hình chính' } : { den: 'xam', chu: 'Trình duyệt không hỗ trợ' };
  if (Notification.permission === 'denied') return { den: 'do', chu: 'Trình duyệt đang chặn' };
  if (Notification.permission === 'granted') return { den: 'xanh', chu: 'Đã bật trên máy này' };
  return { den: 'vang', chu: 'Chưa bật' };
}

// Phần thân của thẻ: vẽ ngay khung, rồi đọc cài đặt từ máy chủ.
export function veTheThongBao(the, d) {
  const { h, api, bao } = d;
  const vung = h('div', { class: 'khoi-thong-bao' }, h('p', { class: 'mo-ta', text: 'Đang đọc cài đặt…' }));
  the.append(vung);

  const ve = async () => {
    let cai;
    try { cai = await api('/api/thong-bao/cai'); } catch (e) { vung.replaceChildren(h('p', { class: 'canh-bao-nho', text: e.message })); return; }
    const dk = await dangKyHienTai().catch(() => null);
    const quyen = coDay() ? Notification.permission : 'khong';
    const dangBat = Boolean(dk) && quyen === 'granted';
    const phan = [];

    if (!coDay()) {
      phan.push(h('p', { class: 'canh-bao-nho', text: laIos() && !daCaiManHinh()
        ? 'Trên iPhone, iPad: mở Sonicplan bằng Safari, bấm nút Chia sẻ, chọn "Thêm vào màn hình chính", rồi mở Sonicplan từ biểu tượng đó và bật ở đây.'
        : 'Trình duyệt này không nhận được thông báo đẩy. Chuông ở thanh trên vẫn chạy khi trang đang mở.' }));
    } else if (quyen === 'denied') {
      phan.push(h('p', { class: 'canh-bao-nho', text: 'Trình duyệt đang chặn thông báo của trang này. Bấm biểu tượng ổ khóa cạnh địa chỉ trang, cho phép Thông báo, rồi tải lại trang.' }));
    } else {
      phan.push(
        h('p', { class: 'mo-ta', text: dangBat
          ? 'Máy này đã bật. Việc mới hiện lên góc màn hình (điện thoại: màn hình khóa) kể cả khi đã đóng trang. Giờ yên lặng ở trang Luồng thì chỉ ghi vào chuông, không báo.'
          : 'Bấm Bật thông báo, trình duyệt hỏi thì chọn Cho phép. Mỗi máy (máy tính, điện thoại) bật một lần.' }),
        h('div', { class: 'hang-nut' },
          dangBat
            ? h('button', { class: 'nut nut-phu', type: 'button', onclick: tatMayNay }, 'Tắt trên máy này')
            : h('button', { class: 'nut nut-chinh', type: 'button', onclick: (e) => batMayNay(e, cai.khoa_cong_khai) }, d.icon('chuong'), 'Bật thông báo'),
          h('button', { class: 'nut nut-phu', type: 'button', onclick: guiThu }, 'Gửi thử')),
      );
    }

    // Công tắc từng loại: áp cho cả chuông và thông báo đẩy.
    phan.push(h('fieldset', { class: 'cong-tac-tb' }, h('legend', { text: 'Báo những gì' }),
      ...Object.entries(cai.loai).map(([ma, ten]) => {
        const o = h('input', { type: 'checkbox', checked: cai.bat[ma] });
        o.addEventListener('change', async () => {
          try { await api('/api/thong-bao/cai', { method: 'PUT', body: JSON.stringify({ bat: { [ma]: o.checked } }) }); bao(o.checked ? `Đã bật: ${ten}.` : `Đã tắt: ${ten}.`); }
          catch (e) { o.checked = !o.checked; bao(e.message, { loi: true }); }
        });
        return h('label', { class: 'hang-cong-tac' }, o, h('span', { text: ten }));
      })));
    if (cai.thiet_bi.length) phan.push(h('p', { class: 'ghi-nho-kn', text: `Đang nhận trên ${cai.thiet_bi.length} máy: ${[...new Set(cai.thiet_bi.map((t) => t.thiet_bi))].join(', ')}.` }));
    vung.replaceChildren(...phan);
  };

  async function batMayNay(e, khoa) {
    e.currentTarget.disabled = true;
    try {
      const quyen = await Notification.requestPermission();
      if (quyen !== 'granted') { bao('Chưa được phép hiện thông báo. Bấm lại và chọn Cho phép.', { loi: true }); return ve(); }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      let dk = await reg.pushManager.getSubscription();
      // Khóa máy chủ đổi (cài lại) thì đăng ký cũ không dùng được nữa: gỡ rồi đăng ký lại.
      if (dk && dk.options?.applicationServerKey) {
        const cu = new Uint8Array(dk.options.applicationServerKey);
        const moi = khoaUng(khoa);
        if (cu.length !== moi.length || cu.some((b, i) => b !== moi[i])) { await dk.unsubscribe(); dk = null; }
      }
      dk ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: khoaUng(khoa) });
      await api('/api/thong-bao/dang-ky', { method: 'POST', body: JSON.stringify(dk.toJSON()) });
      bao('Đã bật thông báo trên máy này.');
    } catch (err) {
      bao(err.message || 'Không bật được thông báo.', { loi: true });
    }
    d.sauKhiDoi?.();
    ve();
  }
  async function tatMayNay() {
    const dk = await dangKyHienTai().catch(() => null);
    if (dk) {
      await api('/api/thong-bao/dang-ky', { method: 'DELETE', body: JSON.stringify({ endpoint: dk.endpoint }) }).catch(() => {});
      await dk.unsubscribe().catch(() => {});
    }
    bao('Đã tắt thông báo trên máy này. Chuông trong trang vẫn chạy.');
    d.sauKhiDoi?.();
    ve();
  }
  async function guiThu(e) {
    e.currentTarget.disabled = true;
    const nutBam = e.currentTarget;
    try {
      const kq = await api('/api/thong-bao/thu', { method: 'POST' });
      bao(kq.day?.ok ? `Đã gửi thử tới ${kq.day.ok} máy. Thông báo sẽ hiện trong vài giây.` : 'Đã ghi một thông báo thử vào chuông. Chưa có máy nào bật thông báo đẩy.');
      d.sauKhiThu?.();
    } catch (err) { bao(err.message, { loi: true }); }
    nutBam.disabled = false;
  }
  ve();
}
