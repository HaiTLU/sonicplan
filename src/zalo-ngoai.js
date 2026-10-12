// Ảnh và tệp Zalo chỉ về dạng đường dẫn trên máy chủ Zalo ("[chat.photo] <url>", "[share.file] <tên> - <url>").
// Tải về một lần, lưu vào kho tệp để xem trước được và không mất khi đường dẫn hết hạn.

import { luuTep, TEP_TOI_DA } from './hop-tin.js';

const MAY_CHU_ZALO = ['zdn.vn', 'dlfl.vn', 'zadn.vn', 'zalo.me'];
const DUOI_THEO_LOAI = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

export function choPhepMayChu(diaChi) {
  try {
    const u = new URL(diaChi);
    return u.protocol === 'https:' && MAY_CHU_ZALO.some((m) => u.hostname === m || u.hostname.endsWith(`.${m}`));
  } catch {
    return false;
  }
}

// Đọc nội dung tin: trả { kieu: 'anh' | 'tep', url, ten } hoặc null khi không phải ảnh hay tệp trên máy chủ Zalo.
export function docDiaChiNgoai(noiDung) {
  const nd = String(noiDung || '').trim();
  let m = nd.match(/^\[chat\.photo\]\s+(https:\/\/\S+)/);
  if (m) return { kieu: 'anh', url: m[1], ten: '' };
  m = nd.match(/^\[share\.file\]\s+([\s\S]+?)\s+-\s+(https:\/\/\S+)\s*$/);
  if (m) return { kieu: 'tep', url: m[2], ten: m[1].trim() };
  return null;
}

// Tải tệp của một tin Zalo về kho. Trả dòng tep (id, ten, loai, kich_thuoc) hoặc ném lỗi có chữ cho người đọc.
export async function napTepNgoai(env, toChucId, tinId) {
  const tin = await env.CSDL.prepare(`SELECT id, nguoi_gui, nhom, noi_dung, thoi_diem FROM tin_nhan WHERE id = ?1 AND to_chuc_id = ?2 AND nguon = 'zalo'`).bind(tinId, toChucId).first();
  if (!tin) throw Object.assign(new Error('Không thấy tin này.'), { trangThai: 404 });
  const co = await env.CSDL.prepare('SELECT id, ten, loai, kich_thuoc FROM tep WHERE to_chuc_id = ?1 AND tin_nhan_id = ?2 ORDER BY id LIMIT 1').bind(toChucId, tinId).first();
  if (co) return co;
  const ngoai = docDiaChiNgoai(tin.noi_dung);
  if (!ngoai || !choPhepMayChu(ngoai.url)) throw Object.assign(new Error('Tin này không có ảnh hay tệp để tải.'), { trangThai: 400 });
  let ph;
  try {
    ph = await fetch(ngoai.url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 Sonicplan' } });
  } catch {
    throw Object.assign(new Error('Máy chủ Zalo không trả lời, thử lại sau.'), { trangThai: 502 });
  }
  if (!ph.ok) throw Object.assign(new Error(`Zalo không cho tải (mã ${ph.status}). Có thể đường dẫn đã hết hạn.`), { trangThai: 502 });
  const loai = (ph.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ngoai.kieu === 'anh' && !DUOI_THEO_LOAI[loai]) throw Object.assign(new Error('Đường dẫn không trả về ảnh.'), { trangThai: 502 });
  const du = await ph.arrayBuffer();
  if (!du.byteLength || du.byteLength > TEP_TOI_DA) throw Object.assign(new Error('Tệp rỗng hoặc lớn quá 25 MB.'), { trangThai: 413 });
  const ten = ngoai.kieu === 'anh' ? `anh-zalo-${tin.id}.${DUOI_THEO_LOAI[loai]}` : ngoai.ten;
  const id = await luuTep(env, toChucId, { ten, loai: ngoai.kieu === 'anh' ? loai : loai || 'application/octet-stream', kich_thuoc: du.byteLength, du_lieu: du, nguon: 'zalo', nguoi_gui: tin.nguoi_gui, nhom: tin.nhom || '', tin_nhan_id: tin.id });
  if (!id) throw Object.assign(new Error('Kho tệp đã đầy.'), { trangThai: 507 });
  return { id, ten, loai, kich_thuoc: du.byteLength };
}
