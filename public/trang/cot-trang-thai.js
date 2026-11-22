// Kiểu xem "Theo trạng thái" của trang Việc: suy cột cho từng việc từ dữ liệu sẵn có.
// Không chạm DOM, không gọi mạng, để kiểm thử thẳng bằng node --test.
export const COT_TRANG_THAI = [
  { ma: 'tt-chua-lam', ten: 'Chưa làm', trong: 'Không còn việc chưa bắt đầu.' },
  { ma: 'tt-dang-lam', ten: 'Đang làm', trong: 'Kéo việc đang làm vào đây.' },
  { ma: 'tt-cho-duyet', ten: 'Chờ anh duyệt', trong: 'Không có việc chờ duyệt.' },
  { ma: 'tt-xong', ten: 'Xong', trong: 'Chưa xong việc nào trong 7 ngày qua.' },
];
export const SO_NGAY_XONG = 7;
const CUA_TIEN_DO = { chua_lam: 'tt-chua-lam', dang_lam: 'tt-dang-lam', cho_duyet: 'tt-cho-duyet' };
const TIEN_DO_CUA_COT = { 'tt-chua-lam': 'chua_lam', 'tt-dang-lam': 'dang_lam', 'tt-cho-duyet': 'cho_duyet' };

// Mốc "7 ngày gần nhất" cho cột Xong, dạng ISO để so thẳng với xong_luc (ISO UTC).
export function mocXong(bayGio = Date.now()) {
  return new Date(bayGio - SO_NGAY_XONG * 86400000).toISOString();
}

// Cột của một việc, hoặc null nếu không hiện (đã hủy, xong quá 7 ngày).
// Thứ tự: xong > tiến độ người dùng tự đặt khi kéo thẻ > ô hỏi AI đang chờ trả lời (Chờ anh duyệt) > Chưa làm.
export function suyTrangThai(x, { tuLuc = null } = {}) {
  if (!x || x.trang_thai === 'huy') return null;
  if (x.trang_thai === 'xong') return !tuLuc || (x.xong_luc && x.xong_luc >= tuLuc) ? 'tt-xong' : null;
  if (CUA_TIEN_DO[x.tien_do]) return CUA_TIEN_DO[x.tien_do];
  return x.hoi_cho ? 'tt-cho-duyet' : 'tt-chua-lam';
}

// Thả thẻ vào cột trạng thái: trả thân PATCH /api/viec/:id, hoặc null khi không cần đổi gì.
export function suaKhiThaTrangThai(x, denCot) {
  if (denCot === 'tt-xong') return x.trang_thai === 'xong' ? null : { trang_thai: 'xong' };
  const tienDo = TIEN_DO_CUA_COT[denCot];
  if (!tienDo) return null;
  const sua = {};
  // Mở lại việc thì luôn gửi kèm tiến độ: máy chủ xóa tiến độ khi mở lại mà không nêu.
  if (x.trang_thai !== 'mo') Object.assign(sua, { trang_thai: 'mo', tien_do: tienDo });
  else if ((x.tien_do || null) !== tienDo) sua.tien_do = tienDo;
  return Object.keys(sua).length ? sua : null;
}

// Chia danh sách việc (đã gộp việc mở và việc xong) vào 4 cột, giữ nguyên thứ tự đầu vào trong mỗi cột.
export function chiaCotTrangThai(ds, { tuLuc = null } = {}) {
  const ra = Object.fromEntries(COT_TRANG_THAI.map((c) => [c.ma, []]));
  for (const x of ds) {
    const c = suyTrangThai(x, { tuLuc });
    if (c) ra[c].push(x);
  }
  return ra;
}
