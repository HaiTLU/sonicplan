// Lưu tin nhắn, tệp và mốc tín hiệu của từng tổ chức. Dùng chung cho thư, Zalo và Telegram.

import { cat } from './tien-ich.js';
import { khoaChan } from './chan-tin.js';

export const TEP_TOI_DA = 25 * 1024 * 1024;

// Gói miễn phí của R2 là 10 GB mỗi tháng. Chặn ở 9 GB để chừa chỗ cho bản sao lưu và sai số đếm.
export const KHO_TOI_DA = 9 * 1000 * 1000 * 1000;

// Ghi một tin; tin trùng mã gốc trong cùng tổ chức thì bỏ qua. Trả id tin mới hoặc null nếu trùng.
export async function luuTin(env, toChucId, tin) {
  const bayGio = new Date().toISOString();
  const nguoiGui = cat(tin.nguoi_gui || '', 200) || null;
  const nhom = cat(tin.nhom || '', 200) || null;
  const tieuDe = cat(tin.tieu_de || '', 300) || null;
  // Nguồn đã bị đánh dấu spam: vẫn lưu nhưng ẩn, coi như đã xem và đã tách việc.
  const k = khoaChan({ nguon: tin.nguon, nguoi_gui: nguoiGui, nhom, tieu_de: tieuDe });
  const kq = await env.CSDL.prepare(
    `INSERT INTO tin_nhan (to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem, tao_luc, spam, da_xem, da_tach)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, b, b, b
     FROM (SELECT EXISTS (SELECT 1 FROM chan_tin WHERE to_chuc_id = ?1 AND nguon = ?2 AND loai = ?10 AND ten = ?11) AS b)
     WHERE true
     ON CONFLICT (to_chuc_id, nguon, ma_goc) DO NOTHING
     RETURNING id`,
  ).bind(
    toChucId,
    tin.nguon,
    cat(tin.ma_goc, 300),
    nguoiGui,
    nhom,
    tieuDe,
    cat(tin.noi_dung || '', 20000),
    tin.thoi_diem || bayGio,
    bayGio,
    k.loai,
    k.ten,
  ).first();
  return kq ? kq.id : null;
}

// Lưu tệp vào R2 và ghi một dòng vào bảng tep. duLieu là ArrayBuffer, Uint8Array hoặc ReadableStream.
// Trả id dòng mới, hoặc null khi kho đã đầy (tin nhắn chữ vẫn được lưu, chỉ bỏ tệp).
export async function luuTep(env, toChucId, tep) {
  const daDung = (await env.CSDL.prepare('SELECT COALESCE(SUM(kich_thuoc), 0) AS tong FROM tep').first())?.tong ?? 0;
  if (daDung + (tep.kich_thuoc ?? TEP_TOI_DA) > KHO_TOI_DA) {
    console.warn(`Kho tệp đã dùng ${daDung} byte, chạm mức ${KHO_TOI_DA}, bỏ tệp ${tep.ten}`);
    return null;
  }
  const bayGio = new Date();
  const tenAnToan = String(tep.ten || 'tep').replace(/[\\/\u0000-\u001f]/g, '_').slice(-150);
  const khoa = `${toChucId}/${bayGio.toISOString().slice(0, 7)}/${crypto.randomUUID()}-${tenAnToan}`;
  await env.TEP.put(khoa, tep.du_lieu, { httpMetadata: { contentType: tep.loai || 'application/octet-stream' } });
  const kq = await env.CSDL.prepare(
    `INSERT INTO tep (to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, r2_khoa, nguon, nguoi_gui, thu_muc, tao_luc)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING id`,
  ).bind(
    toChucId,
    tep.tin_nhan_id || null,
    tenAnToan,
    tep.loai || null,
    tep.kich_thuoc ?? null,
    khoa,
    tep.nguon || null,
    cat(tep.nguoi_gui || '', 200) || null,
    cat(tep.nhom || '', 200) || null,
    bayGio.toISOString(),
  ).first();
  return kq.id;
}

export function ghiTinHieu(env, toChucId, nguon, ghiChu = null) {
  return env.CSDL.prepare(
    `INSERT INTO tin_hieu (to_chuc_id, nguon, lan_cuoi, ghi_chu) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (to_chuc_id, nguon) DO UPDATE SET lan_cuoi = excluded.lan_cuoi, ghi_chu = excluded.ghi_chu`,
  ).bind(toChucId, nguon, new Date().toISOString(), ghiChu).run();
}

export async function docCaiDat(env, toChucId, khoa) {
  const dong = await env.CSDL.prepare('SELECT gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = ?2').bind(toChucId, khoa).first();
  return dong ? dong.gia_tri : null;
}

export function ghiCaiDat(env, toChucId, khoa, giaTri) {
  return env.CSDL.prepare(
    `INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, ?2, ?3)
     ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`,
  ).bind(toChucId, khoa, giaTri).run();
}
