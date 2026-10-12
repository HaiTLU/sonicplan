// Trang Hiệu suất: việc xong theo ngày, so trung bình, đúng hạn, quá tải, dự án, nguồn, giờ hiệu quả,
// độ nặng do AI chấm (sửa tay được), đo thời gian thật bằng nút Bắt đầu. Kèm dải nhỏ trên Tổng quan.

const TEN_DN = { nhe: 'Nhẹ', vua: 'Vừa', nang: 'Nặng', rat_nang: 'Rất nặng' };
const PHUT_DN = { nhe: 15, vua: 45, nang: 120, rat_nang: 300 };
const TEN_NGUON = { zalo: 'Zalo', gmail: 'Gmail', tay: 'Tự thêm', telegram: 'Telegram', ngoai: 'Bên ngoài' };
export const tenNguon = (v) => TEN_NGUON[v.nguon] || v.nguon || 'Không rõ';

// Phần giải thích dưới tên việc: cờ ghi chưa rõ, lý do AI chấm, ghi chú (bấm để mở hết).
export function giaiThichViec(h, v) {
  const phan = [];
  if (v.chua_ro) phan.push(h('span', { class: 'hs-chua-ro', text: 'Ghi chưa rõ, nên sửa tên việc' }));
  if (v.ly_do) phan.push(h('small', { class: 'hs-ly-do', text: `AI chấm: ${v.ly_do}` }));
  if (v.ghi_chu) {
    const dong = v.ghi_chu.replace(/^\[Gợi ý\]\s*/, '').split('\n')[0];
    phan.push(h('details', { class: 'hs-ghi' }, h('summary', { text: `Ghi chú: ${dong}` }), h('p', { text: v.ghi_chu })));
  }
  return phan.length ? h('div', { class: 'hs-giai' }, ...phan) : null;
}
const TEN_MUC = { on: 'Vừa sức', day: 'Gần kín', qua_tai: 'Quá tải', chua_ro: 'Chưa rõ' };
const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const NS = 'http://www.w3.org/2000/svg';
const so = new Intl.NumberFormat('vi-VN');

function s(the, tt = {}, ...con) {
  const el = document.createElementNS(NS, the);
  for (const [k, v] of Object.entries(tt)) if (v != null) el.setAttribute(k, v);
  for (const c of con.flat()) if (c) el.append(c);
  return el;
}
export const gioPhut = (p) => (p == null ? '-' : p < 60 ? `${p} phút` : `${so.format(Math.round((p / 60) * 10) / 10)} giờ`);
const ngayNgan = (n) => (n ? `${n.slice(8, 10)}/${n.slice(5, 7)}` : '');

function soSanh(h, nay, tb) {
  if (tb == null || !tb) return h('span', { class: 'hs-ss', text: 'chưa đủ dữ liệu' });
  const lech = Math.round(((nay - tb) / tb) * 100);
  const cls = lech > 5 ? 'len' : lech < -5 ? 'xuong' : 'ngang';
  return h('span', { class: `hs-ss ${cls}`, text: `${lech > 0 ? '+' : ''}${lech}% so với TB ${so.format(tb)}` });
}

// Đồng hồ tải: cung 240 độ, kim theo tỉ lệ (tối đa 150%).
function dongHoTai(h, tai) {
  const tl = tai.ty_le ?? 0;
  const r = 54;
  const goc = (p) => (-210 + (Math.min(p, 150) / 150) * 240) * (Math.PI / 180);
  const diem = (p, rr = r) => [70 + rr * Math.cos(goc(p)), 70 + rr * Math.sin(goc(p))];
  const cung = (a, b) => { const [x1, y1] = diem(a); const [x2, y2] = diem(b); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${(b - a) / 150 * 240 > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  const [kx, ky] = diem(tl, r - 24);
  const el = h('div', { class: `hs-dong-ho muc-${tai.muc}`, role: 'img', 'aria-label': `Tải hôm nay ${tl}% sức làm, ${TEN_MUC[tai.muc]}` });
  el.append(
    s('svg', { viewBox: '0 0 140 100' },
      s('path', { class: 'nen', d: cung(0, 150) }),
      s('path', { class: 'vung-on', d: cung(0, 80) }),
      s('path', { class: 'vung-day', d: cung(80, 110) }),
      s('path', { class: 'vung-qua', d: cung(110, 150) }),
      s('line', { class: 'kim', x1: 70, y1: 70, x2: kx.toFixed(1), y2: ky.toFixed(1) }),
      s('circle', { class: 'tam', cx: 70, cy: 70, r: 5 }),
    ),
    h('div', { class: 'hs-dong-ho-chu' }, h('b', { text: `${tl}%` }), h('small', { text: TEN_MUC[tai.muc] })),
  );
  return el;
}

// Cột 30 ngày, kèm vạch trung bình 7 ngày.
function cot30(h, chuoi, tb7) {
  const W = 600, H = 150, pad = 22;
  const max = Math.max(1, ...chuoi.map((o) => o.so), tb7 || 0);
  const w = (W - pad) / chuoi.length;
  const yy = (v) => H - 20 - (v / max) * (H - 36);
  const svg = s('svg', { class: 'hs-cot30', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Việc xong 30 ngày qua, hôm nay ${chuoi.at(-1).so}` });
  chuoi.forEach((o, i) => {
    const x = pad + i * w + w * 0.18;
    const g = s('g', { class: i === chuoi.length - 1 ? 'nay' : '' },
      s('rect', { x: x.toFixed(1), y: yy(o.so).toFixed(1), width: (w * 0.64).toFixed(1), height: Math.max(o.so ? 2 : 1, H - 20 - yy(o.so)).toFixed(1), rx: 2.5 }),
      s('title', {}, document.createTextNode(`${ngayNgan(o.ngay)}: ${o.so} việc, khoảng ${gioPhut(o.phut)}`)));
    svg.append(g);
    if (i % 7 === 2 || i === chuoi.length - 1) svg.append(s('text', { x: (x + w * 0.32).toFixed(1), y: H - 4, 'text-anchor': 'middle' }, document.createTextNode(ngayNgan(o.ngay))));
  });
  if (tb7) svg.append(s('line', { class: 'tb', x1: pad, x2: W, y1: yy(tb7).toFixed(1), y2: yy(tb7).toFixed(1) }), s('text', { class: 'tb-chu', x: 2, y: (yy(tb7) + 4).toFixed(1) }, document.createTextNode(String(tb7))));
  return svg;
}

function cotNgang(h, ds, { nhan, gt, phu, mau }) {
  const max = Math.max(1, ...ds.map(gt));
  return h('ul', { class: 'hs-ngang' }, ...ds.map((o) => h('li', {},
    h('span', { class: 'ten', text: nhan(o) }),
    h('span', { class: 'hs-ray' }, h('i', { style: `width:${(gt(o) / max) * 100}%;${mau?.(o) ? `background:${mau(o)}` : ''}` })),
    h('span', { class: 'so', text: phu(o) }),
  )));
}

function cotGio(h, theoGio, khung) {
  const max = Math.max(1, ...theoGio);
  return h('div', { class: 'hs-gio', role: 'img', 'aria-label': `Việc xong theo giờ trong ngày${khung ? `, nhiều nhất ${khung.tu}h-${khung.den}h` : ''}` },
    ...theoGio.map((n, g) => h('div', { class: `c${khung && g >= khung.tu && g < khung.den ? ' dinh' : ''}`, title: `${g}h: ${n} việc` },
      h('i', { style: `height:${Math.max(n ? 6 : 2, (n / max) * 100)}%` }),
      g % 3 === 0 ? h('small', { text: `${g}h` }) : h('small', { text: '' }))));
}

// Việc con đứng ngay dưới việc cha (nếu việc cha còn mở).
function xepCha(ds) {
  const coCha = new Set(ds.map((v) => v.id));
  const con = new Map();
  for (const v of ds) if (v.viec_cha_id && coCha.has(v.viec_cha_id)) con.set(v.viec_cha_id, [...(con.get(v.viec_cha_id) || []), v]);
  return ds.filter((v) => !(v.viec_cha_id && coCha.has(v.viec_cha_id))).flatMap((v) => [v, ...(con.get(v.id) || []).sort((a, b) => a.id - b.id)]);
}

function chipDoNang(h, v, luu) {
  const chon = h('select', { class: `hs-chip dn-${v.do_nang || 'chua'}`, 'aria-label': `Độ nặng của việc ${v.tieu_de}` },
    h('option', { value: '', text: v.do_nang ? '' : 'Chưa chấm', disabled: true, selected: !v.do_nang }),
    ...Object.entries(TEN_DN).map(([k, t]) => h('option', { value: k, text: t, selected: v.do_nang === k })));
  if (!v.do_nang) chon.firstChild.textContent = 'Chưa chấm';
  else chon.firstChild.remove();
  chon.addEventListener('change', () => luu(chon.value));
  return chon;
}

// Bảng duyệt việc con: AI đề xuất, anh bỏ chọn hay sửa tên, số phút rồi bấm Tạo. Dùng ở trang Hiệu suất và màn game.
export async function moBangChia(v, li, nut, t, napLai) {
  const { h, icon, api, bao, thay, xuong } = t;
  nut.disabled = true;
  const khung = h('div', { class: 'hs-chia', 'aria-live': 'polite' }, xuong(14, '70%'), xuong(14, '85%'), xuong(14, '60%'));
  li.after(khung);
  let ds;
  try { ds = (await api(`/api/hieu-suat/viec/${v.id}/chia`, { method: 'POST' })).viec_con; } catch (e) { bao(e.message, { loi: true }); khung.remove(); nut.disabled = false; return; }
  const hang = ds.map((c) => {
    const chon = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Tạo việc con này' });
    const ten = h('input', { class: 'hs-chia-ten', type: 'text', value: c.tieu_de, maxlength: '200', 'aria-label': 'Tên việc con' });
    const phut = h('input', { class: 'hs-phut', type: 'number', min: '5', max: '480', step: '5', value: c.phut, 'aria-label': 'Số phút', inputmode: 'numeric' });
    return { el: h('li', {}, chon, ten, h('label', { class: 'hs-phut-o' }, phut, h('span', { text: 'phút' }))), lay: () => (chon.checked && ten.value.trim() ? { tieu_de: ten.value.trim(), phut: Number(phut.value) || 30 } : null) };
  });
  const tong = () => hang.map((x) => x.lay()).filter(Boolean);
  const nutTao = h('button', { class: 'nut nut-chinh nut-nho', type: 'button' }, icon('xong'), `Tạo ${ds.length} việc con`);
  const capNhat = () => { const t = tong(); nutTao.lastChild.textContent = `Tạo ${t.length} việc con`; nutTao.disabled = !t.length; };
  hang.forEach((x) => x.el.addEventListener('input', capNhat));
  nutTao.addEventListener('click', async () => {
    nutTao.disabled = true;
    try { const r = await api(`/api/hieu-suat/viec/${v.id}/tao-con`, { method: 'POST', body: JSON.stringify({ viec_con: tong() }) }); bao(`Đã tạo ${r.ids.length} việc con.`); napLai(); } catch (e) { bao(e.message, { loi: true }); nutTao.disabled = false; }
  });
  thay(khung,
    h('p', { class: 'mo-ta', text: `AI đề xuất chia "${v.tieu_de}" thành ${ds.length} việc. Bỏ chọn hoặc sửa tên, số phút rồi bấm Tạo. Chưa bấm thì chưa có gì thêm vào danh sách hay Google Tasks.` }),
    h('ul', {}, ...hang.map((x) => x.el)),
    h('div', { class: 'hs-chia-nut' }, h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => { khung.remove(); nut.disabled = false; } }, 'Bỏ qua'), nutTao),
  );
  khung.querySelector('.hs-chia-ten')?.focus();
}

export async function veHieuSuat(goc, t) {
  const { h, icon, api, bao, thay, khungLoi, xuong } = t;
  thay(goc, h('div', { class: 'hs' }, h('div', { class: 'bang' }, xuong(20, '30%'), h('div', { style: 'height:12px' }), xuong(120))));
  let hs;
  try { hs = await api('/api/hieu-suat'); } catch (e) { thay(goc, khungLoi(e, () => veHieuSuat(goc, t))); return; }
  const napLai = () => veHieuSuat(goc, t);
  const x = hs.xong;
  const tai = hs.tai;

  const dauTrang = h('section', { class: 'bang hs-dau' },
    h('div', { class: 'hs-dau-trai' },
      h('p', { class: 'chao', text: `Dữ liệu ${hs.so_ngay_du_lieu} ngày${hs.so_ngay_du_lieu < 14 ? ', các số trung bình sẽ đáng tin hơn sau 2 tuần' : ''}.` }),
      h('h2', { class: 'tom-tat', text: tai.muc === 'qua_tai' ? 'Hôm nay đang quá tải.' : tai.muc === 'day' ? 'Hôm nay gần kín việc.' : x.hom_nay ? `Đã xong ${x.hom_nay} việc hôm nay.` : 'Hôm nay còn dư sức.' }),
      h('p', { class: 'tom-tat-phu', text: `Việc có hạn đến hôm nay: ${tai.so_viec_hom_nay} việc, khoảng ${gioPhut(tai.phut_hom_nay)}. Sức làm trung bình ${gioPhut(tai.suc_lam)} mỗi ngày${tai.suc_lam_uoc ? ' (ước, chưa đủ 5 việc xong)' : ''}. Toàn bộ việc đang mở cần khoảng ${so.format(tai.ngay_de_xong ?? 0)} ngày làm.` }),
      tai.canh_bao ? h('p', { class: `hs-canh-bao muc-${tai.muc}`, role: 'alert', text: tai.canh_bao }) : null,
    ),
    dongHoTai(h, tai),
  );

  const daiSo = h('dl', { class: 'bang dai-so hs-so' },
    h('div', { class: 'o-so' }, h('dt', {}, icon('xong'), 'Xong hôm nay'), h('dd', {}, h('div', {}, h('span', { class: 'so-lon', text: so.format(x.hom_nay) }), soSanh(h, x.hom_nay, x.tb7.so)))),
    h('div', { class: 'o-so' }, h('dt', {}, icon('lich'), 'Tuần này'), h('dd', {}, h('div', {}, h('span', { class: 'so-lon', text: so.format(x.tuan) }), h('span', { class: 'hs-ss', text: `Cùng kỳ tuần trước ${x.tuan_truoc}. Tháng này ${x.thang}` })))),
    h('div', { class: 'o-so' }, h('dt', {}, icon('dong-ho'), 'Đúng hạn 30 ngày'), h('dd', {}, h('div', {}, h('span', { class: 'so-lon', text: hs.dung_han.ty_le == null ? '-' : `${hs.dung_han.ty_le}%` }), h('span', { class: 'hs-ss', text: hs.dung_han.co_han ? `${hs.dung_han.dung} đúng, ${hs.dung_han.tre} trễ. ${hs.dung_han.qua_han_mo} việc mở đã quá hạn` : 'Chưa có việc xong nào có hạn' })))),
    h('div', { class: 'o-so' }, h('dt', {}, icon('nhat-ky'), 'Nhận đến xong'), h('dd', {}, h('div', {}, h('span', { class: 'so-lon', text: hs.xu_ly.gio_trung_vi == null ? '-' : gioPhut(Math.round(hs.xu_ly.gio_trung_vi * 60)) }), h('span', { class: 'hs-ss', text: 'Trung vị, tính cả thời gian chờ' })))),
  );

  const bang30 = h('section', { class: 'bang hs-30' },
    h('div', { class: 'bang-dau' }, h('h2', {}, icon('tong-quan'), 'Việc xong 30 ngày'), h('span', { class: 'phu', text: `TB 7 ngày ${so.format(x.tb7.so)} việc, TB 30 ngày ${so.format(x.tb30.so)} việc mỗi ngày` })),
    h('div', { class: 'hs-than' }, cot30(h, hs.chuoi_30, x.tb7.so)),
  );

  // Nhận xét AI
  const khungNx = h('div', { class: 'hs-than', 'aria-live': 'polite' }, h('p', { class: 'mo-ta', text: 'Bấm nút để AI đọc các con số trên và nói ngắn gọn: có quá tải không, nên làm gì trước, việc nào nên chia nhỏ.' }));
  const nutNx = h('button', { class: 'nut nut-chinh nut-nho', type: 'button' }, icon('ai'), 'AI nhận xét');
  nutNx.addEventListener('click', async () => {
    nutNx.disabled = true;
    thay(khungNx, xuong(14, '80%'), xuong(14, '90%'), xuong(14, '60%'));
    try { const r = await api('/api/hieu-suat/nhan-xet', { method: 'POST' }); thay(khungNx, h('pre', { class: 'van-ban-tong-hop', text: r.noi_dung })); } catch (e) { bao(e.message, { loi: true }); thay(khungNx, h('p', { class: 'mo-ta', text: 'Chưa nhận xét được, thử lại sau.' })); }
    nutNx.disabled = false;
  });
  const bangNx = h('section', { class: 'bang hs-nx' }, h('div', { class: 'bang-dau' }, h('h2', {}, icon('ai'), 'Nhận xét'), nutNx), khungNx);

  const bangDn = h('section', { class: 'bang hs-dn' },
    h('div', { class: 'bang-dau' }, h('h2', {}, icon('he-thong'), 'Theo độ nặng'), h('span', { class: 'phu', text: 'AI chấm, học dần từ thời gian thật' })),
    h('div', { class: 'bang-cuon' }, h('table', { class: 'hs-bang' },
      h('thead', {}, h('tr', {}, ...['Độ nặng', 'Đang mở', 'Xong 90 ngày', 'Nhận đến xong', 'Làm thật'].map((c) => h('th', { text: c })))),
      h('tbody', {}, ...hs.xu_ly.theo_do_nang.map((d) => h('tr', {},
        h('td', {}, h('span', { class: `hs-nhan dn-${d.do_nang}`, text: TEN_DN[d.do_nang] })),
        h('td', { text: d.mo }), h('td', { text: d.xong }),
        h('td', { text: d.gio_xu_ly == null ? '-' : gioPhut(Math.round(d.gio_xu_ly * 60)) }),
        h('td', { text: d.phut_thuc == null ? `ước ${gioPhut(PHUT_DN[d.do_nang])}` : `${gioPhut(d.phut_thuc)} (${d.so_do_thuc} lần đo)` }),
      ))),
    )),
  );

  const bangDuAn = h('section', { class: 'bang hs-da' },
    h('div', { class: 'bang-dau' }, h('h2', {}, icon('du-an'), 'Theo dự án'), h('span', { class: 'phu', text: 'Xong 30 ngày và đang mở' })),
    h('div', { class: 'hs-than' }, hs.du_an.length ? cotNgang(h, hs.du_an.slice(0, 8), { nhan: (o) => o.ten, gt: (o) => o.xong + o.mo, phu: (o) => `${o.xong} xong, ${o.mo} mở`, mau: (o) => o.mau }) : h('p', { class: 'mo-ta', text: 'Chưa có việc.' })),
  );
  const bangNguon = h('section', { class: 'bang hs-ng' },
    h('div', { class: 'bang-dau' }, h('h2', {}, icon('hop-tin'), 'Theo nguồn')),
    h('div', { class: 'hs-than' }, hs.nguon.length ? cotNgang(h, hs.nguon, { nhan: (o) => TEN_NGUON[o.khoa] || o.khoa, gt: (o) => o.xong + o.mo, phu: (o) => `${o.xong} xong, ${o.mo} mở` }) : h('p', { class: 'mo-ta', text: 'Chưa có việc.' })),
  );

  const g = hs.gio;
  const thuMax = Math.max(1, ...g.theo_thu);
  const bangGio = h('section', { class: 'bang hs-g' },
    h('div', { class: 'bang-dau' }, h('h2', {}, icon('dong-ho'), 'Giờ làm hiệu quả'), h('span', { class: 'phu', text: g.khung ? `Xong nhiều nhất ${g.khung.tu}h-${g.khung.den}h` : 'Chưa có việc xong' })),
    h('div', { class: 'hs-than' }, cotGio(h, g.theo_gio, g.khung),
      h('div', { class: 'hs-thu' }, ...g.theo_thu.map((n, i) => h('div', { title: `${THU[i]}: ${n} việc` }, h('i', { style: `opacity:${0.15 + (n / thuMax) * 0.85}` }), h('small', { text: THU[i] }), h('b', { text: n }))))),
  );

  // Việc đang mở: độ nặng, thời lượng, Bắt đầu, Xong.
  const sua = async (id, than, thongBao) => {
    try { await api(`/api/hieu-suat/viec/${id}`, { method: 'PATCH', body: JSON.stringify(than) }); if (thongBao) bao(thongBao); napLai(); } catch (e) { bao(e.message, { loi: true }); }
  };
  const xongViec = async (v) => {
    try { await api(`/api/viec/${v.id}`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'xong' }) }); bao(`Đã xong: ${v.tieu_de}`); napLai(); } catch (e) { bao(e.message, { loi: true }); }
  };
  const dongMo = (v) => {
    const dangLam = Boolean(v.bat_dau_luc);
    const oPhut = h('input', { class: 'hs-phut', type: 'number', min: '5', max: '960', step: '5', value: v.phut_uoc ?? '', placeholder: '-', 'aria-label': `Số phút ước tính của ${v.tieu_de}`, inputmode: 'numeric' });
    oPhut.addEventListener('change', () => { if (v.do_nang || oPhut.value) sua(v.id, { hanh_dong: 'cham', do_nang: v.do_nang || 'vua', phut_uoc: oPhut.value }, 'Đã lưu thời lượng.'); });
    const li = h('li', { class: `hs-viec${dangLam ? ' dang-lam' : ''}${v.viec_cha_id ? ' la-con' : ''}` });
    const coTheChia = ['nang', 'rat_nang'].includes(v.do_nang) && !v.con && !v.viec_cha_id;
    const tienDo = v.con ? h('div', { class: 'hs-tien-do', role: 'img', 'aria-label': `${v.con.xong} trên ${v.con.tong} việc con đã xong` },
      h('span', { class: 'hs-ray' }, h('i', { style: `width:${(v.con.xong / v.con.tong) * 100}%` })),
      h('small', { text: v.con.xong === v.con.tong ? `Xong cả ${v.con.tong} việc con, bấm Xong để đóng việc này` : `${v.con.xong}/${v.con.tong} việc con, còn ${gioPhut(v.con.phut_con_lai)}` })) : null;
    const nutChia = coTheChia ? h('button', { class: 'hs-nut-chu', type: 'button', onclick: () => moChia(v, li, nutChia) }, icon('ai'), 'AI chia nhỏ việc này') : null;
    li.append(
      h('div', { class: 'ten' }, h('strong', { text: v.tieu_de }),
        h('small', { text: [v.han_ngay ? `hạn ${ngayNgan(v.han_ngay)}${v.han_ngay < hs.hom_nay ? ' (trễ)' : ''}` : 'không hạn', tenNguon(v), v.do_nang_nguon === 'tay' ? 'bạn chấm' : v.do_nang ? 'AI chấm' : '', dangLam ? `đang làm từ ${new Date(v.bat_dau_luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}` : ''].filter(Boolean).join(' · ') })),
      h('div', { class: 'dk' },
        chipDoNang(h, v, (dn) => sua(v.id, { hanh_dong: 'cham', do_nang: dn, phut_uoc: PHUT_DN[dn] }, 'Đã lưu độ nặng.')),
        h('label', { class: 'hs-phut-o' }, oPhut, h('span', { text: 'phút' })),
        dangLam
          ? h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => sua(v.id, { hanh_dong: 'dung' }) }, 'Dừng')
          : h('button', { class: 'nut nut-phu nut-nho', type: 'button', onclick: () => sua(v.id, { hanh_dong: 'bat_dau' }, 'Đã bắt đầu tính giờ.') }, 'Bắt đầu'),
        h('button', { class: 'nut nut-chinh nut-nho', type: 'button', onclick: () => xongViec(v) }, icon('xong'), 'Xong'),
      ));
    const giai = giaiThichViec(h, v);
    if (giai) li.querySelector('.ten').append(giai);
    if (tienDo || nutChia) li.querySelector('.ten').append(tienDo || nutChia);
    return li;
  };
  const moChia = (v, li, nut) => moBangChia(v, li, nut, t, napLai);
  const nutCham = h('button', { class: 'nut nut-phu nut-nho', type: 'button' }, icon('ai'), hs.chua_cham ? `AI chấm ${hs.chua_cham} việc` : 'AI chấm lại');
  nutCham.hidden = !hs.chua_cham;
  nutCham.addEventListener('click', async () => {
    nutCham.disabled = true;
    try { const r = await api('/api/hieu-suat/cham-ngay', { method: 'POST' }); bao(r.so ? `AI đã chấm ${r.so} việc.` : 'Không còn việc nào cần chấm.'); napLai(); } catch (e) { bao(e.message, { loi: true }); nutCham.disabled = false; }
  });
  const bangMo = h('section', { class: 'bang hs-mo' },
    h('div', { class: 'bang-dau' }, h('h2', {}, icon('viec'), `Việc đang mở (${hs.mo.length})`), nutCham),
    h('p', { class: 'mo-ta hs-than', text: 'Bấm Bắt đầu khi bắt tay làm và Xong khi làm xong, Sonicplan đo được thời gian thật và AI ước lượng sát dần. Sửa độ nặng hay số phút thì AI không ghi đè.' }),
    hs.mo.length ? h('ul', { class: 'hs-ds' }, ...xepCha(hs.mo).map(dongMo)) : h('p', { class: 'mo-ta hs-than', text: 'Không còn việc nào mở.' }),
  );

  const khuGame = h('div', { class: 'hs-game' });
  import('./game-ui.js').then((m) => m.veKhuGame(khuGame, t, napLai)).catch((e) => console.error('Chế độ game lỗi', e));
  thay(goc, h('div', { class: 'hs vao' }, khuGame, dauTrang, daiSo, bang30, bangNx, bangMo, bangDn, bangGio, bangDuAn, bangNguon));
}

// Dải nhỏ trên Tổng quan: tự nạp, lỗi thì ẩn để không làm hỏng trang.
export function dongHieuSuat(t) {
  const { h, icon, api } = t;
  const el = h('a', { class: 'bang hs-dai', href: '#hieu-suat', 'aria-label': 'Xem trang Hiệu suất' });
  el.append(h('span', { class: 'hs-dai-nhan' }, icon('tong-quan'), 'Hiệu suất'), h('span', { class: 'mo-ta', text: 'Đang tính…' }));
  api('/api/hieu-suat').then((hs) => {
    const x = hs.xong;
    const tai = hs.tai;
    el.replaceChildren(
      h('span', { class: 'hs-dai-nhan' }, icon('tong-quan'), 'Hiệu suất'),
      h('span', { class: 'hs-dai-o' }, h('b', { text: `${x.hom_nay} xong` }), soSanh(h, x.hom_nay, x.tb7.so)),
      h('span', { class: 'hs-dai-o' }, h('b', { text: hs.dung_han.ty_le == null ? 'Đúng hạn -' : `Đúng hạn ${hs.dung_han.ty_le}%` }), h('span', { class: 'hs-ss', text: `${hs.dung_han.qua_han_mo} việc quá hạn` })),
      h('span', { class: `hs-dai-o muc-${tai.muc}` }, h('b', { text: `Tải ${tai.ty_le ?? 0}%` }), h('span', { class: 'hs-ss', text: `${TEN_MUC[tai.muc]}, ${gioPhut(tai.phut_hom_nay)} việc hôm nay` })),
      icon('mui-ten'),
    );
  }).catch(() => el.remove());
  return el;
}
