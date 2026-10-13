// Chặn nguồn tin (Spam): tin thuộc nguồn bị chặn bị ẩn (tin_nhan.an = 1), không qua AI tách việc,
// và việc chưa xong đã sinh ra từ nguồn đó được gỡ (chuyển sang 'huy').

import { ghiSuKien } from './du-an.js';
import { cat } from './tien-ich.js';

const LOAI = ['nhom', 'nguoi', 'dia_chi'];

// Điều kiện "tin này thuộc một nguồn đã chặn". Dùng trong UPDATE nên cột viết rõ tên bảng tin_nhan.
const KHOP_CHAN = `EXISTS (SELECT 1 FROM nguon_chan c WHERE c.to_chuc_id = tin_nhan.to_chuc_id AND c.nguon = tin_nhan.nguon AND (
  (c.loai = 'nhom' AND c.gia_tri = tin_nhan.nhom)
  OR (c.loai = 'nguoi' AND COALESCE(tin_nhan.nhom, '') = '' AND c.gia_tri = CASE WHEN tin_nhan.nguon = 'zalo'
        THEN COALESCE(NULLIF(tin_nhan.tieu_de, ''), NULLIF(tin_nhan.nguoi_gui, ''), 'Không rõ')
        ELSE COALESCE(tin_nhan.nguoi_gui, '') END)
  OR (c.loai = 'dia_chi' AND (lower(tin_nhan.nguoi_gui) = c.gia_tri OR lower(tin_nhan.nguoi_gui) LIKE '%<' || c.gia_tri || '>'))))`;

export function diaChiTuNguoiGui(chu) {
  const s = String(chu || '');
  const trongNgoac = s.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1];
  const tran = s.match(/^[^\s<>]+@[^\s<>]+$/)?.[0];
  return (trongNgoac || tran || '').toLowerCase() || null;
}

// Các cách chặn có thể áp cho một tin, để giao diện cho người dùng chọn.
export function tuyChonChan(tin) {
  if (tin.nguon === 'zalo') {
    if (tin.nhom) return [{ loai: 'nhom', gia_tri: tin.nhom, nhan: tin.nhom }];
    const ten = tin.tieu_de || tin.nguoi_gui || 'Không rõ';
    return [{ loai: 'nguoi', gia_tri: ten, nhan: ten }];
  }
  const ra = [];
  const diaChi = diaChiTuNguoiGui(tin.nguoi_gui);
  const ten = String(tin.nguoi_gui || '').trim();
  if (ten) ra.push({ loai: 'nguoi', gia_tri: ten, nhan: ten.split('<')[0].trim() || ten });
  if (diaChi) ra.push({ loai: 'dia_chi', gia_tri: diaChi, nhan: diaChi });
  return ra;
}

export function kiemChan(than) {
  const nguon = than.nguon;
  const loai = than.loai;
  const giaTri = cat(String(than.gia_tri || '').trim(), 300);
  if (nguon !== 'zalo' && nguon !== 'gmail') return { loi: 'Nguồn không hợp lệ.' };
  if (!LOAI.includes(loai) || (loai === 'dia_chi' && nguon !== 'gmail') || (loai === 'nhom' && nguon !== 'zalo')) return { loi: 'Kiểu chặn không hợp lệ.' };
  if (!giaTri) return { loi: 'Thiếu tên cần chặn.' };
  const nhan = cat(String(than.nhan || giaTri).trim(), 200);
  return { chan: { nguon, loai, gia_tri: loai === 'dia_chi' ? giaTri.toLowerCase() : giaTri, nhan } };
}

// Tin mới về mà thuộc nguồn đã chặn thì ẩn ngay và đánh dấu đã tách, để không qua AI. Trả true nếu bị ẩn.
export async function anTinNeuBiChan(env, toChucId, tinId) {
  if (!tinId) return false;
  const kq = await env.CSDL.prepare(
    `UPDATE tin_nhan SET an = 1, da_xem = 1, da_tach = 1 WHERE id = ?1 AND to_chuc_id = ?2 AND ${KHOP_CHAN}`,
  ).bind(tinId, toChucId).run();
  return Boolean(kq.meta.changes);
}

export async function danhSachChan(env, toChucId) {
  const { results } = await env.CSDL.prepare(
    'SELECT id, nguon, loai, gia_tri, nhan, tao_luc FROM nguon_chan WHERE to_chuc_id = ?1 ORDER BY id DESC',
  ).bind(toChucId).all();
  return results;
}

export async function chanNguon(env, toChucId, chan) {
  const bayGio = new Date().toISOString();
  const dong = await env.CSDL.prepare(
    `INSERT INTO nguon_chan (to_chuc_id, nguon, loai, gia_tri, nhan, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (to_chuc_id, nguon, loai, gia_tri) DO UPDATE SET nhan = excluded.nhan RETURNING id`,
  ).bind(toChucId, chan.nguon, chan.loai, chan.gia_tri, chan.nhan, bayGio).first();
  // Gỡ việc chưa xong sinh từ các tin sắp bị ẩn, rồi mới ẩn tin (thứ tự này giữ được danh sách tin cần ẩn).
  const { results: viec } = await env.CSDL.prepare(
    `UPDATE viec SET trang_thai = 'huy', xong_luc = NULL, can_dong_bo = 1, cap_nhat_luc = ?2
     WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tin_nhan_id IN (
       SELECT id FROM tin_nhan WHERE to_chuc_id = ?1 AND an = 0 AND ${KHOP_CHAN})
     RETURNING id, tieu_de`,
  ).bind(toChucId, bayGio).all();
  for (const v of viec) await ghiSuKien(env, toChucId, v.id, 'huy', `Gỡ vì đã chặn ${chan.nhan}`).catch(() => {});
  const an = await env.CSDL.prepare(`UPDATE tin_nhan SET an = 1, da_xem = 1 WHERE to_chuc_id = ?1 AND an = 0 AND ${KHOP_CHAN}`).bind(toChucId).run();
  return { id: dong.id, an_tin: an.meta.changes, go_viec: viec.length };
}

export async function boChan(env, toChucId, id) {
  const xoa = await env.CSDL.prepare('DELETE FROM nguon_chan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, toChucId).run();
  if (!xoa.meta.changes) return null;
  const hien = await env.CSDL.prepare(`UPDATE tin_nhan SET an = 0 WHERE to_chuc_id = ?1 AND an = 1 AND NOT ${KHOP_CHAN}`).bind(toChucId).run();
  return { hien_tin: hien.meta.changes };
}
