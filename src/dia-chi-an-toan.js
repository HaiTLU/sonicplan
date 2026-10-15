// Chặn địa chỉ do người dùng nhập biến máy chủ thành nơi gọi vào mạng nội bộ (SSRF):
// webhook nhận việc mới và địa chỉ dịch vụ AI tương thích OpenAI.
// Kiểm tên máy ghi thẳng trong địa chỉ (đồng bộ, dùng lúc lưu) và, trên máy chủ Node, kiểm cả địa chỉ IP tên đó trỏ tới (lúc gọi).

const TEN_NOI_BO = /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/i;

function laIpv4Rieng(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

export function laIpRieng(ip) {
  const s = String(ip).toLowerCase().replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return laIpv4Rieng(s);
  if (!s.includes(':')) return false;
  const nhung = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/); // IPv4 nhúng trong IPv6
  if (nhung) return laIpv4Rieng(nhung[1]);
  const nhungHex = s.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (nhungHex) {
    const so = (parseInt(nhungHex[1], 16) << 16) | parseInt(nhungHex[2], 16);
    return laIpv4Rieng([so >>> 24, (so >>> 16) & 255, (so >>> 8) & 255, so & 255].join('.'));
  }
  return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s);
}

// Tên máy ghi sẵn trong địa chỉ có phải của mạng nội bộ không (chưa phân giải DNS).
export function laTenMayNoiBo(tenMay) {
  const t = String(tenMay).toLowerCase().replace(/\.$/, '');
  if (TEN_NOI_BO.test(t)) return true;
  if (/^\[.*\]$/.test(t) || t.includes(':')) return laIpRieng(t);
  // Dạng số thập phân/hex/bát phân của IPv4 (2130706433, 0x7f.1...) cũng bị chặn: tên máy toàn số thì không phải tên miền thật.
  if (/^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+))*$/i.test(t) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(t) && laIpv4Rieng(t);
}

// Dùng lúc lưu cấu hình: ném lỗi nếu địa chỉ rõ ràng trỏ vào mạng nội bộ.
export function kiemTenMayCongKhai(chuoi) {
  const u = new URL(chuoi);
  if (u.username || u.password) throw new Error('Địa chỉ không được kèm tên đăng nhập.');
  if (laTenMayNoiBo(u.hostname)) throw new Error('Địa chỉ trỏ vào mạng nội bộ, không được dùng.');
}

async function phanGiaiMacDinh(tenMay) {
  let dns;
  try { dns = await import('node:dns/promises'); } catch { return null; } // Worker: Cloudflare tự chặn mạng riêng
  return (await dns.lookup(tenMay, { all: true })).map((x) => x.address);
}

// Dùng ngay trước khi gọi: phân giải tên máy, từ chối nếu có địa chỉ nội bộ. Tên không phân giải được thì để fetch tự báo lỗi.
export async function kiemDiaChiTruocGoi(chuoi, { phanGiai = phanGiaiMacDinh } = {}) {
  kiemTenMayCongKhai(chuoi);
  const { hostname } = new URL(chuoi);
  if (/^\[.*\]$/.test(hostname) || /^[\d.]+$/.test(hostname)) return;
  let dsIp;
  try { dsIp = await phanGiai(hostname); } catch { return; }
  if (dsIp?.some(laIpRieng)) throw new Error('Địa chỉ trỏ vào mạng nội bộ, không được dùng.');
}
