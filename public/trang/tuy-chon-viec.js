// Cách hiển thị trang Việc được nhớ trên trình duyệt này: kiểu xem, ẩn cột trống và các bộ lọc phụ.
const KHOA_TUY_VIEC = 'sp.viec.tuy';
const GIA_TRI_HOP_LE = { xem: ['han', 'du-an'], nguon: ['tat-ca', 'zalo', 'gmail', 'hop', 'tay'], han: ['tat-ca', 'qua-han', 'hom-nay', 'tuan', 'khong'], nang: ['tat-ca', 'nhe', 'vua', 'nang', 'rat_nang'], gio: ['tat-ca', 'co-gio', 'chua-gio'], claude: ['tat-ca', 'chua-giao', 'dang-chay', 'hoi', 'xong'], sapXep: ['tay', 'han', 'moi', 'ten'] };
export function docTuyChonViec() {
  const ra = { xem: 'du-an', anTrong: false, nguon: 'tat-ca', han: 'tat-ca', nang: 'tat-ca', gio: 'tat-ca', claude: 'tat-ca', sapXep: 'tay', anNhan: false, chiSao: false };
  try {
    const da = JSON.parse(localStorage.getItem(KHOA_TUY_VIEC) || 'null') || {};
    if (!da.xem && localStorage.getItem('sp.viec.xem') === 'han') da.xem = 'han'; // khóa cũ chỉ nhớ kiểu xem
    for (const k of Object.keys(GIA_TRI_HOP_LE)) if (GIA_TRI_HOP_LE[k].includes(da[k])) ra[k] = da[k];
    ra.anTrong = da.anTrong === true;
    ra.chiSao = da.chiSao === true;
    ra.anNhan = da.anNhan === true;
  } catch { /* trình duyệt chặn lưu trữ: dùng mặc định */ }
  return ra;
}
export function luuTuyChonViec(v) {
  try { localStorage.setItem(KHOA_TUY_VIEC, JSON.stringify({ xem: v.xem, anTrong: v.anTrong, nguon: v.nguon, han: v.han, nang: v.nang, gio: v.gio, claude: v.claude, sapXep: v.sapXep, anNhan: v.anNhan, chiSao: v.chiSao })); } catch { /* không lưu được thì thôi */ }
}
