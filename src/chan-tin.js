// Nút "Spam" trong Hộp tin: chặn một nhóm Zalo, một người gửi Zalo hoặc một địa chỉ thư.
// Tin của nguồn bị chặn vẫn lưu (cột spam = 1) để bỏ chặn được, nhưng không hiện, không đếm,
// không đưa cho AI tách việc. Việc đang mở sinh từ các tin đó bị hủy; bỏ chặn thì mở lại.
import { ghiSuKien } from './du-an.js';

// Hội thoại Zalo: nhóm theo tên nhóm; tin riêng theo tên người đối diện (tieu_de), thiếu thì người gửi.
export const TEN_TIN_ZALO = `CASE WHEN COALESCE(nhom, '') <> '' THEN nhom ELSE COALESCE(NULLIF(tieu_de, ''), NULLIF(nguoi_gui, ''), 'Không rõ') END`;
export const LOAI_TIN_ZALO = `CASE WHEN COALESCE(nhom, '') <> '' THEN 'nhom' ELSE 'ca-nhan' END`;
// Địa chỉ thư trong "Tên <dia@chi>", viết thường. Phải khớp với diaChiThu() bên dưới.
const THU_GUI = `lower(trim(CASE WHEN instr(COALESCE(nguoi_gui, ''), '<') > 0 THEN substr(nguoi_gui, instr(nguoi_gui, '<') + 1) ELSE COALESCE(nguoi_gui, '') END, ' >'))`;

export function diaChiThu(nguoiGui) {
  let s = String(nguoiGui || '');
  const i = s.indexOf('<');
  if (i >= 0) s = s.slice(i + 1);
  return s.replace(/^[ >]+|[ >]+$/g, '').toLowerCase();
}

// Khóa chặn của một tin: { nguon, loai, ten }.
export function khoaChan(tin) {
  if (tin.nguon === 'gmail') return { nguon: 'gmail', loai: 'thu', ten: diaChiThu(tin.nguoi_gui) };
  if (tin.nhom) return { nguon: 'zalo', loai: 'nhom', ten: tin.nhom };
  return { nguon: 'zalo', loai: 'ca-nhan', ten: tin.tieu_de || tin.nguoi_gui || 'Không rõ' };
}

// Điều kiện SQL chọn mọi tin thuộc một khóa chặn. Tham số ?1 = tổ chức, ?2 = loai, ?3 = ten.
function khopKhoa(k) {
  return k.nguon === 'gmail'
    ? `to_chuc_id = ?1 AND nguon = 'gmail' AND ?2 = 'thu' AND ${THU_GUI} = ?3`
    : `to_chuc_id = ?1 AND nguon = 'zalo' AND ${LOAI_TIN_ZALO} = ?2 AND ${TEN_TIN_ZALO} = ?3`;
}

export async function laTinBiChan(env, toChucId, tin) {
  const k = khoaChan(tin);
  if (!k.ten) return false;
  const r = await env.CSDL.prepare('SELECT 1 AS x FROM chan_tin WHERE to_chuc_id = ?1 AND nguon = ?2 AND loai = ?3 AND ten = ?4')
    .bind(toChucId, k.nguon, k.loai, k.ten).first();
  return Boolean(r);
}

const TEN_LOAI = { nhom: 'nhóm Zalo', 'ca-nhan': 'người gửi Zalo', thu: 'địa chỉ thư' };

export async function danhDauSpam(env, tc, tinId) {
  const tin = await env.CSDL.prepare('SELECT id, nguon, nguoi_gui, nhom, tieu_de FROM tin_nhan WHERE id = ?1 AND to_chuc_id = ?2').bind(tinId, tc).first();
  if (!tin) return { loi: 'Không tìm thấy tin này.', ma: 404 };
  const k = khoaChan(tin);
  if (!k.ten) return { loi: 'Tin này không có người gửi để chặn.', ma: 400 };
  const bayGio = new Date().toISOString();
  const dk = khopKhoa(k);
  await env.CSDL.prepare(
    `INSERT INTO chan_tin (to_chuc_id, nguon, loai, ten, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT (to_chuc_id, nguon, loai, ten) DO NOTHING`,
  ).bind(tc, k.nguon, k.loai, k.ten, bayGio).run();
  // Tin chưa tách thì coi như đã xử lý để AI không lấy ra làm việc.
  const { results: tinAn } = await env.CSDL.prepare(
    `UPDATE tin_nhan SET spam = 1, da_xem = 1, da_tach = CASE WHEN da_tach IN (0, 3) THEN 1 ELSE da_tach END WHERE ${dk} RETURNING id`,
  ).bind(tc, k.loai, k.ten).all();
  const { results: viecHuy } = await env.CSDL.prepare(
    `UPDATE viec SET trang_thai = 'huy', xong_luc = NULL, cap_nhat_luc = ?4
     WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tin_nhan_id IN (SELECT id FROM tin_nhan WHERE spam = 1 AND ${dk})
     RETURNING id`,
  ).bind(tc, k.loai, k.ten, bayGio).all();
  for (const v of viecHuy) await ghiSuKien(env, tc, v.id, 'huy', `Hủy vì ${TEN_LOAI[k.loai]} "${k.ten}" bị đánh dấu spam`).catch(() => {});
  const cu = await env.CSDL.prepare('SELECT id, viec_huy FROM chan_tin WHERE to_chuc_id = ?1 AND nguon = ?2 AND loai = ?3 AND ten = ?4')
    .bind(tc, k.nguon, k.loai, k.ten).first();
  const ids = [...new Set([...docDs(cu?.viec_huy), ...viecHuy.map((v) => v.id)])];
  await env.CSDL.prepare('UPDATE chan_tin SET so_tin = (SELECT COUNT(*) FROM tin_nhan WHERE spam = 1 AND ' + dk + '), viec_huy = ?4 WHERE id = ?5')
    .bind(tc, k.loai, k.ten, JSON.stringify(ids), cu.id).run();
  return { chan: { id: cu.id, ...k, ten_loai: TEN_LOAI[k.loai] }, so_tin: tinAn.length, so_viec_huy: viecHuy.length };
}

export async function dsChan(env, tc) {
  const { results } = await env.CSDL.prepare('SELECT id, nguon, loai, ten, so_tin, viec_huy, tao_luc FROM chan_tin WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
  return results.map((r) => ({ id: r.id, nguon: r.nguon, loai: r.loai, ten: r.ten, ten_loai: TEN_LOAI[r.loai], so_tin: r.so_tin, so_viec_huy: docDs(r.viec_huy).length, tao_luc: r.tao_luc }));
}

export async function boChan(env, tc, id) {
  const r = await env.CSDL.prepare('SELECT * FROM chan_tin WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  if (!r) return { loi: 'Không tìm thấy mục chặn này.', ma: 404 };
  const k = { nguon: r.nguon, loai: r.loai, ten: r.ten };
  const bayGio = new Date().toISOString();
  const { results: tin } = await env.CSDL.prepare(`UPDATE tin_nhan SET spam = 0 WHERE spam = 1 AND ${khopKhoa(k)} RETURNING id`).bind(tc, k.loai, k.ten).all();
  // Chỉ mở lại việc do chính lần chặn này hủy và vẫn còn ở trạng thái hủy.
  let soMoLai = 0;
  for (const viecId of docDs(r.viec_huy)) {
    const kq = await env.CSDL.prepare(`UPDATE viec SET trang_thai = 'mo', cap_nhat_luc = ?3 WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai = 'huy'`).bind(viecId, tc, bayGio).run();
    if (kq.meta?.changes) {
      soMoLai++;
      await ghiSuKien(env, tc, viecId, 'mo_lai', `Mở lại vì bỏ chặn ${TEN_LOAI[k.loai]} "${k.ten}"`).catch(() => {});
    }
  }
  await env.CSDL.prepare('DELETE FROM chan_tin WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
  return { ok: true, so_tin: tin.length, so_viec_mo_lai: soMoLai };
}

function docDs(s) {
  try {
    const a = JSON.parse(s || '[]');
    return Array.isArray(a) ? a.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}
