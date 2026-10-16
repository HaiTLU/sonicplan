// Ảnh đại diện Zalo: chương trình trên máy Mac gửi kèm địa chỉ ảnh của cuộc trò chuyện và của người gửi.
// Tải về một lần, lưu vào kho tệp rồi phục vụ qua /api/anh/<mã>; đổi ảnh trên Zalo thì địa chỉ đổi và ảnh được tải lại.

import { choPhepMayChu } from './zalo-ngoai.js';

const TOI_DA_BYTE = 2 * 1024 * 1024;
const TOI_DA_MOI_LO = 30;
const KIEU_ANH = { 'image/jpeg': 1, 'image/jpg': 1, 'image/png': 1, 'image/gif': 1, 'image/webp': 1 };
export const RE_MA_ANH = /^(nhom|ca-nhan|nguoi):[0-9A-Za-z_.-]{1,100}$/;

// Gom từ một lô tin các ảnh cần lưu: ảnh cuộc trò chuyện (theo mã hội thoại) và ảnh người gửi trong nhóm.
export function gomAnhTuLo(tin) {
  const gom = new Map();
  for (const t of Array.isArray(tin) ? tin : []) {
    if (!t || typeof t !== 'object') continue;
    if (t.thread_id && t.thread_avatar) {
      const ma = `${t.type === 'nhom' ? 'nhom' : 'ca-nhan'}:${String(t.thread_id).slice(0, 100)}`;
      gom.set(ma, { ma, ten: t.thread, url: t.thread_avatar });
    }
    if (t.sender_id && t.sender_avatar && t.sender && t.sender !== 'Tôi') {
      const ma = `nguoi:${String(t.sender_id).slice(0, 100)}`;
      gom.set(ma, { ma, ten: t.sender, url: t.sender_avatar });
    }
  }
  return [...gom.values()].filter((a) => RE_MA_ANH.test(a.ma)).slice(0, TOI_DA_MOI_LO);
}

// Lưu một ảnh. Đã có cùng địa chỉ thì bỏ qua. Trả 'moi', 'co-san' hoặc ném lỗi chữ cho nhật ký.
export async function luuAnhDaiDien(env, toChucId, { ma, ten, url }) {
  if (!RE_MA_ANH.test(ma) || !choPhepMayChu(url)) throw new Error(`Địa chỉ ảnh đại diện không hợp lệ: ${String(url).slice(0, 80)}`);
  const cu = await env.CSDL.prepare('SELECT url_goc, r2_khoa FROM anh_dai_dien WHERE to_chuc_id = ?1 AND ma = ?2').bind(toChucId, ma).first();
  const bayGio = new Date().toISOString();
  if (cu?.r2_khoa && cu.url_goc === url) {
    if (ten) await env.CSDL.prepare('UPDATE anh_dai_dien SET ten = ?1 WHERE to_chuc_id = ?2 AND ma = ?3 AND COALESCE(ten, \'\') <> ?1').bind(String(ten).slice(0, 200), toChucId, ma).run();
    return 'co-san';
  }
  const ph = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 Sonicplan' } });
  if (!ph.ok) throw new Error(`Zalo không cho tải ảnh đại diện (mã ${ph.status}).`);
  const loai = (ph.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!KIEU_ANH[loai]) throw new Error('Địa chỉ ảnh đại diện không trả về ảnh.');
  const du = await ph.arrayBuffer();
  if (!du.byteLength || du.byteLength > TOI_DA_BYTE) throw new Error('Ảnh đại diện rỗng hoặc lớn quá 2 MB.');
  const khoa = `anh-dai-dien/${toChucId}/${ma.replace(':', '-')}`;
  await env.TEP.put(khoa, du, { httpMetadata: { contentType: loai } });
  await env.CSDL.prepare(
    `INSERT INTO anh_dai_dien (to_chuc_id, ma, ten, url_goc, r2_khoa, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (to_chuc_id, ma) DO UPDATE SET ten = excluded.ten, url_goc = excluded.url_goc, r2_khoa = excluded.r2_khoa, cap_nhat_luc = excluded.cap_nhat_luc`,
  ).bind(toChucId, ma, String(ten || '').slice(0, 200) || null, url, khoa, bayGio).run();
  return 'moi';
}

// Lưu nhiều ảnh, từng ảnh lỗi thì bỏ qua (ảnh đại diện không đáng làm hỏng việc nhận tin).
export async function luuAnhTuLo(env, toChucId, tin) {
  let moi = 0;
  for (const a of gomAnhTuLo(tin)) {
    try { if ((await luuAnhDaiDien(env, toChucId, a)) === 'moi') moi++; } catch (e) { console.error('Ảnh đại diện lỗi', a.ma, e.message); }
  }
  return moi;
}

const duongAnh = (ma, luc) => `/api/anh/${encodeURIComponent(ma)}?v=${encodeURIComponent(luc)}`;

// Mã -> địa chỉ ảnh (có số phiên bản để trình duyệt tải lại khi ảnh đổi) cho các mã đã có ảnh.
export async function anhCoSan(env, toChucId, kieu) {
  const { results } = await env.CSDL.prepare(
    `SELECT ma, ten, cap_nhat_luc FROM anh_dai_dien WHERE to_chuc_id = ?1 AND r2_khoa IS NOT NULL AND ma LIKE ?2`,
  ).bind(toChucId, `${kieu}:%`).all();
  return results.map((r) => ({ ma: r.ma, ten: r.ten, url: duongAnh(r.ma, r.cap_nhat_luc) }));
}

export async function phucVuAnh(env, toChucId, ma) {
  if (!RE_MA_ANH.test(ma)) return new Response('Không có ảnh.', { status: 404 });
  const dong = await env.CSDL.prepare('SELECT r2_khoa FROM anh_dai_dien WHERE to_chuc_id = ?1 AND ma = ?2').bind(toChucId, ma).first();
  const vat = dong?.r2_khoa ? await env.TEP.get(dong.r2_khoa) : null;
  if (!vat) return new Response('Không có ảnh.', { status: 404, headers: { 'cache-control': 'private, max-age=300' } });
  return new Response(vat.body, { headers: { 'content-type': vat.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, max-age=604800', 'x-content-type-options': 'nosniff' } });
}
