// Bảng 11 màu của Google Lịch: mã trùng colorId để sự kiện trên Lịch cùng màu với thẻ việc.
export const BANG_MAU = [
  { ma: '1', ten: 'Oải hương', hex: '#a4bdfc' },
  { ma: '2', ten: 'Xanh bạc hà', hex: '#7ae7bf' },
  { ma: '3', ten: 'Tím nho', hex: '#dbadff' },
  { ma: '4', ten: 'Hồng san hô', hex: '#ff887c' },
  { ma: '5', ten: 'Vàng chuối', hex: '#fbd75b' },
  { ma: '6', ten: 'Cam', hex: '#ffb878' },
  { ma: '7', ten: 'Xanh ngọc', hex: '#46d6db' },
  { ma: '8', ten: 'Xám', hex: '#c9c9d1' },
  { ma: '9', ten: 'Xanh dương', hex: '#5484ed' },
  { ma: '10', ten: 'Xanh lá', hex: '#51b749' },
  { ma: '11', ten: 'Đỏ cà chua', hex: '#dc2127' },
];
export const hexMau = (ma) => BANG_MAU.find((m) => m.ma === String(ma))?.hex || null;
// Màu hiệu lực của việc: màu riêng, không có thì màu dự án.
export const mauViec = (v) => hexMau(v.mau) || hexMau(v.du_an_mau);

// Hàng ô chọn màu. chon(ma|null) được gọi khi bấm; coKhong thêm ô "không màu".
export function oChonMau(h, hienTai, chon, { coKhong = false, nhan = 'Màu' } = {}) {
  const ds = h('div', { class: 'chon-mau', role: 'radiogroup', 'aria-label': nhan });
  const ve = (ma) => {
    ds.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.ma || '') === (ma || ''))));
  };
  if (coKhong) ds.append(h('button', { type: 'button', class: 'o-mau khong', role: 'radio', title: 'Theo dự án', dataset: { ma: '' }, onclick: () => { ve(null); chon(null); } }, '×'));
  for (const m of BANG_MAU) ds.append(h('button', { type: 'button', class: 'o-mau', role: 'radio', title: m.ten, 'aria-label': m.ten, style: `--mau:${m.hex}`, dataset: { ma: m.ma }, onclick: () => { ve(m.ma); chon(m.ma); } }));
  ve(hienTai || null);
  return ds;
}
