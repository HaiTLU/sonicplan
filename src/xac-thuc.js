// Kiểm đăng nhập Cloudflare Access. Access đứng trước Worker và gắn một vé (JWT)
// vào mỗi yêu cầu; Worker tự kiểm lại vé để không ai vào thẳng được mà không qua Access.

import { goiNgoai } from './goi-ngoai.js';

const KHOA_LUU_MS = 60 * 60 * 1000;
let khoaDaLuu = { mien: '', luc: 0, khoa: [] };

export async function kiemDangNhap(yeuCau, env, { layKhoa = layKhoaAccess, bayGio = Date.now() } = {}) {
  const ve = yeuCau.headers.get('cf-access-jwt-assertion');
  if (!ve) return { duoc: false, ly_do: 'Không có vé đăng nhập' };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { duoc: false, ly_do: 'Chưa cấu hình Access' };

  const phan = ve.split('.');
  if (phan.length !== 3) return { duoc: false, ly_do: 'Vé sai dạng' };
  let dau, than;
  try {
    dau = JSON.parse(giaiBase64Url(phan[0]));
    than = JSON.parse(giaiBase64Url(phan[1]));
  } catch {
    return { duoc: false, ly_do: 'Vé sai dạng' };
  }
  if (dau.alg !== 'RS256') return { duoc: false, ly_do: 'Thuật toán vé không hợp lệ' };

  const dsKhoa = await layKhoa(env.ACCESS_TEAM_DOMAIN, bayGio);
  const jwk = dsKhoa.find((k) => k.kid === dau.kid);
  if (!jwk) return { duoc: false, ly_do: 'Không tìm thấy khóa của vé' };

  const khoa = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const dungChuKy = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    khoa,
    giaiBase64UrlByte(phan[2]),
    new TextEncoder().encode(`${phan[0]}.${phan[1]}`),
  );
  if (!dungChuKy) return { duoc: false, ly_do: 'Chữ ký vé sai' };

  const aud = Array.isArray(than.aud) ? than.aud : [than.aud];
  if (!aud.includes(env.ACCESS_AUD)) return { duoc: false, ly_do: 'Vé không dành cho ứng dụng này' };
  if (than.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return { duoc: false, ly_do: 'Nơi cấp vé không đúng' };
  if (!than.exp || than.exp * 1000 < bayGio) return { duoc: false, ly_do: 'Vé đã hết hạn' };

  const email = String(than.email || '').toLowerCase();
  if (!email) return { duoc: false, ly_do: 'Vé không có email' };

  // Email đúng là người thật đã qua Access; được dùng tổ chức nào thì do bảng thanh_vien quyết (src/phien.js).
  return { duoc: true, email };
}

async function layKhoaAccess(mien, bayGio) {
  if (khoaDaLuu.mien === mien && bayGio - khoaDaLuu.luc < KHOA_LUU_MS) return khoaDaLuu.khoa;
  const phanHoi = await goiNgoai(`https://${mien}/cdn-cgi/access/certs`);
  if (!phanHoi.ok) throw new Error(`Không lấy được khóa Access (${phanHoi.status})`);
  const { keys = [] } = await phanHoi.json();
  khoaDaLuu = { mien, luc: bayGio, khoa: keys };
  return keys;
}

function giaiBase64Url(chuoi) {
  return new TextDecoder().decode(giaiBase64UrlByte(chuoi));
}

function giaiBase64UrlByte(chuoi) {
  const b64 = chuoi.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(chuoi.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
