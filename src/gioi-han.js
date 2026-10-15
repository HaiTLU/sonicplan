// Giới hạn tần suất cho các địa chỉ máy móc gọi vào (/nhan/*, /lich/*), tính theo địa chỉ IP gọi tới.
// Đếm trong bộ nhớ của tiến trình: đủ chặn đoán mã và đốt hạn mức AI trên máy chủ riêng; trên Worker mỗi nhóm máy có bộ đếm riêng nên chỉ giảm nhẹ.

const CUA_SO_MS = 60 * 1000;
const dem = new Map(); // khóa -> { bat_dau, so }

// Trả { duoc, cho_giay }. toiDa lần mỗi phút cho mỗi (nhóm, IP).
export function gioiHanTanSuat(nhom, ip, toiDa, bayGio = Date.now()) {
  if (dem.size > 5000) for (const [k, v] of dem) if (bayGio - v.bat_dau >= CUA_SO_MS) dem.delete(k);
  const khoa = `${nhom}|${ip}`;
  let o = dem.get(khoa);
  if (!o || bayGio - o.bat_dau >= CUA_SO_MS) {
    o = { bat_dau: bayGio, so: 0 };
    dem.set(khoa, o);
  }
  o.so++;
  return o.so <= toiDa ? { duoc: true, cho_giay: 0 } : { duoc: false, cho_giay: Math.max(1, Math.ceil((o.bat_dau + CUA_SO_MS - bayGio) / 1000)) };
}

export function diaChiIp(yeuCau) {
  return (yeuCau.headers.get('cf-connecting-ip') || yeuCau.headers.get('x-forwarded-for') || 'khong-ro').split(',')[0].trim();
}

// Hạn mức theo đường dẫn: nhận việc từ ngoài có thể kích hoạt AI nên chặt nhất.
export function hanMucDuongDan(duongDan) {
  if (duongDan === '/nhan/viec') return { nhom: 'nhan-viec', toiDa: 20 };
  if (duongDan.startsWith('/nhan/')) return { nhom: 'nhan', toiDa: 300 };
  if (duongDan.startsWith('/lich/')) return { nhom: 'lich', toiDa: 60 };
  return null;
}
