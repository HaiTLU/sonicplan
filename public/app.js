// Giao diện: chuyển mục theo dấu # và đọc dữ liệu từ /api.

const MUI_GIO = 'Asia/Ho_Chi_Minh';
const dinhDangGio = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: MUI_GIO });
const dinhDangGioNgan = new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short', timeZone: MUI_GIO });
const dinhDangNgay = new Intl.DateTimeFormat('en-CA', { timeZone: MUI_GIO });
const dinhDangSoGio = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: MUI_GIO });
const gio = (iso) => (iso ? dinhDangGio.format(new Date(iso)) : '');
const KET_QUA = { xong: 'Xong', loi: 'Lỗi', dang_chay: 'Đang chạy' };
const TEN_DEN = { xanh: 'ổn', vang: 'đang chờ', do: 'lỗi', xam: 'chưa dùng' };
const HE_THONG = new Set(['may-chu', 'csdl', 'hen-gio']);

async function lay(duongDan) {
  const ph = await fetch(duongDan, { headers: { accept: 'application/json' } });
  const duLieu = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(duLieu.loi || 'Không đọc được dữ liệu. Tải lại trang để thử lại.');
  return duLieu;
}

function baoLoi(thongBao) {
  const o = document.getElementById('bao-loi');
  o.textContent = thongBao || '';
  o.hidden = !thongBao;
}

function o(the, lop, chu) {
  const el = document.createElement(the);
  if (lop) el.className = lop;
  if (chu !== undefined) el.textContent = chu;
  return el;
}

function lich(chuoi) {
  const td = o('td', 'lich', chuoi);
  td.translate = false;
  return td;
}

// Câu tóm tắt đầu trang: nói thẳng có gì hỏng hay không.
function tomTat(thanhPhan) {
  const loi = thanhPhan.filter((p) => p.den === 'do');
  const cho = thanhPhan.filter((p) => p.den === 'vang');
  const chuaNoi = thanhPhan.filter((p) => p.den === 'xam').length;
  const phu = chuaNoi ? `${chuaNoi} kết nối chưa nối, sẽ mở dần ở các giai đoạn sau.` : '';
  if (loi.length) return { den: 'do', cau: loi.length === 1 ? `${loi[0].ten} đang lỗi.` : `${loi.length} phần đang lỗi.`, phu: loi.map((p) => `${p.ten}: ${p.mo_ta}`).join('. ') + '.' };
  if (cho.length) return { den: 'vang', cau: 'Đang chờ lần chạy đầu tiên.', phu: cho.map((p) => p.mo_ta).join('. ') + '.' };
  return { den: 'xanh', cau: 'Mọi thứ đang chạy.', phu };
}

function dongThanhPhan(p) {
  const li = o('li');
  const den = o('span', `den ${p.den}`);
  den.setAttribute('role', 'img');
  den.setAttribute('aria-label', TEN_DEN[p.den] || p.den);
  li.append(den, o('strong', '', p.ten), o('span', 'mo-ta', p.mo_ta));
  return li;
}

// Dải 24 giờ của hôm nay theo giờ Việt Nam: giờ đã qua có vạch nếu có lần chạy.
function veNhip(dong, bayGio) {
  const homNay = dinhDangNgay.format(bayGio);
  const gioHienTai = Number(dinhDangSoGio.format(bayGio));
  const theoGio = Array.from({ length: 24 }, () => []);
  for (const d of dong) {
    const t = new Date(d.bat_dau);
    if (dinhDangNgay.format(t) === homNay) theoGio[Number(dinhDangSoGio.format(t))].push(d);
  }
  const dai = document.getElementById('dai');
  dai.replaceChildren(...theoGio.map((cac, h) => {
    const cot = o('div', 'gio-o');
    if (h < gioHienTai) cot.classList.add('qua');
    if (h === gioHienTai) cot.classList.add('bay-gio');
    if (cac.length) {
      cot.classList.add('qua');
      const xau = cac.find((d) => d.trang_thai === 'loi') || cac.find((d) => d.trang_thai === 'dang_chay') || cac[0];
      const vach = o('span', `vach-chay ${xau.trang_thai}`);
      vach.style.animationDelay = `${h * 18}ms`;
      cot.title = cac.map((d) => `${dinhDangGioNgan.format(new Date(d.bat_dau))} ${d.tac_vu}: ${KET_QUA[d.trang_thai] || d.trang_thai}`).join('\n');
      cot.append(vach);
    }
    return cot;
  }));
  document.getElementById('thuoc').replaceChildren(...Array.from({ length: 24 }, (_, h) => o('span', '', `${h}h`)));

  const homNayDong = theoGio.flat();
  const soLoi = homNayDong.filter((d) => d.trang_thai === 'loi').length;
  const camNhan = homNayDong.length
    ? `${homNayDong.length} lần chạy hôm nay${soLoi ? `, ${soLoi} lần lỗi` : ', không lần nào lỗi'}`
    : 'Hôm nay chưa có lần chạy nào';
  document.getElementById('nhip-tom-tat').textContent = camNhan;
  dai.setAttribute('aria-label', `${camNhan}. Bây giờ là ${dinhDangGioNgan.format(bayGio)}.`);
}

async function veTinhTrang() {
  const [kq, nk] = await Promise.all([lay('/api/tinh-trang'), lay('/api/nhat-ky?so_dong=200')]);
  const bayGio = new Date(kq.luc);
  const tt = tomTat(kq.thanh_phan);
  const tieuDe = document.getElementById('tom-tat');
  tieuDe.textContent = tt.cau;
  tieuDe.dataset.den = tt.den;
  document.getElementById('dong-phu').textContent = `${tt.phu} Cập nhật lúc ${dinhDangGioNgan.format(bayGio)}.`.trim();

  veNhip(nk.dong, bayGio);

  document.getElementById('tp-he-thong').replaceChildren(...kq.thanh_phan.filter((p) => HE_THONG.has(p.ma)).map(dongThanhPhan));
  document.getElementById('tp-ket-noi').replaceChildren(...kq.thanh_phan.filter((p) => !HE_THONG.has(p.ma)).map(dongThanhPhan));

  const than = document.querySelector('#bang-tac-vu tbody');
  than.replaceChildren(...kq.tac_vu.map((t) => {
    const dong = o('tr');
    const kqCuoi = t.lan_cuoi;
    dong.append(
      o('td', '', t.ten),
      lich(t.lich),
      o('td', 'gio', !t.bat ? `Mở ở giai đoạn ${t.giai_doan}` : kqCuoi ? gio(kqCuoi.bat_dau) : 'Chưa chạy'),
      o('td', `nhan-ket-qua ${kqCuoi?.trang_thai || 'mo'}`, kqCuoi ? KET_QUA[kqCuoi.trang_thai] : '-'),
    );
    return dong;
  }));
}

async function veNhatKy() {
  const { dong } = await lay('/api/nhat-ky?so_dong=100');
  const than = document.querySelector('#bang-nhat-ky tbody');
  if (!dong.length) {
    const tr = o('tr');
    const td = o('td', 'mo', 'Chưa có lần chạy nào. Hẹn giờ chạy lần đầu vào đầu giờ kế tiếp.');
    td.colSpan = 5;
    tr.append(td);
    than.replaceChildren(tr);
    return;
  }
  than.replaceChildren(...dong.map((d) => {
    const tr = o('tr');
    tr.append(
      o('td', 'gio', gio(d.bat_dau)),
      o('td', '', d.tac_vu),
      o('td', `nhan-ket-qua ${d.trang_thai}`, KET_QUA[d.trang_thai] || d.trang_thai),
      o('td', 'so', String(d.so_muc)),
      o('td', 'ghi-chu', d.ghi_chu || ''),
    );
    return tr;
  }));
}

const VE = { 'tinh-trang': veTinhTrang, 'nhat-ky': veNhatKy };

async function moMuc() {
  const muc = location.hash.slice(1) || 'tinh-trang';
  const coMuc = document.querySelector(`[data-trang="${CSS.escape(muc)}"]`) ? muc : 'tinh-trang';
  document.querySelectorAll('[data-trang]').forEach((s) => { s.hidden = s.dataset.trang !== coMuc; });
  document.querySelectorAll('[data-muc]').forEach((a) => {
    if (a.dataset.muc === coMuc) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  baoLoi('');
  try {
    await VE[coMuc]?.();
  } catch (e) {
    baoLoi(e.message);
  }
}

async function batDau() {
  try {
    const toi = await lay('/api/toi');
    const nd = document.getElementById('nguoi-dung');
    nd.replaceChildren(o('strong', '', toi.to_chuc.ten), o('span', '', toi.email));
  } catch (e) {
    baoLoi(e.message);
  }
  window.addEventListener('hashchange', moMuc);
  moMuc();
}

batDau();
