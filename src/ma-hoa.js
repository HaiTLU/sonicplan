// Mã hóa khóa và mã truy cập của khách trước khi lưu vào D1 (AES-GCM 256).
// KHOA_MA_HOA là biến bí mật của Worker: 32 byte viết dạng base64 (README bước 4).
// Kết quả dạng "v1.<iv>.<dữ liệu>" để sau này đổi cách mã hóa vẫn đọc được bản cũ.

export async function maHoa(duLieu, khoaB64) {
  const khoa = await nhapKhoa(khoaB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const banMa = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, khoa, new TextEncoder().encode(JSON.stringify(duLieu)));
  return `v1.${sangB64(iv)}.${sangB64(new Uint8Array(banMa))}`;
}

export async function giaiMa(chuoi, khoaB64) {
  const [phienBan, ivB64, banMaB64] = String(chuoi).split('.');
  if (phienBan !== 'v1' || !ivB64 || !banMaB64) throw new Error('Dữ liệu mã hóa sai dạng');
  const khoa = await nhapKhoa(khoaB64);
  const ro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: tuB64(ivB64) }, khoa, tuB64(banMaB64));
  return JSON.parse(new TextDecoder().decode(ro));
}

// Giải mã bằng khóa hiện tại, không được thì thử khóa cũ (KHOA_MA_HOA_CU) trong lúc đang xoay khóa.
// Xoay khóa: đặt khóa mới vào KHOA_MA_HOA, khóa cũ vào KHOA_MA_HOA_CU, chạy may-chu/xoay-khoa.js, rồi gỡ KHOA_MA_HOA_CU.
export async function giaiMaEnv(chuoi, env) {
  try {
    return await giaiMa(chuoi, env.KHOA_MA_HOA);
  } catch (e) {
    if (!env.KHOA_MA_HOA_CU) throw e;
    return giaiMa(chuoi, env.KHOA_MA_HOA_CU);
  }
}

async function nhapKhoa(khoaB64) {
  const byte = tuB64(khoaB64 || '');
  if (byte.length !== 32) throw new Error('KHOA_MA_HOA phải dài đúng 32 byte');
  return crypto.subtle.importKey('raw', byte, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function sangB64(byte) {
  return btoa(String.fromCharCode(...byte));
}

function tuB64(chuoi) {
  return Uint8Array.from(atob(chuoi), (c) => c.charCodeAt(0));
}
