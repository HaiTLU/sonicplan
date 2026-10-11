// Việc: thêm việc (có chống trùng), tách việc từ tin bằng AI.

import { tachViec } from './ai.js';
import { ghiTinHieu } from './hop-tin.js';
import { baoSuKien, dangViecMoi, docTichHop } from './tich-hop.js';
import { doGiong, ngayVN } from './tien-ich.js';

// Tiêu đề giống từ 80% với một việc đang mở trong 14 ngày gần đây thì coi là trùng.
export const NGUONG_TRUNG = 0.8;

export function timTrung(tieuDe, cacViec) {
  return cacViec.find((v) => doGiong(v.tieu_de, tieuDe) >= NGUONG_TRUNG) || null;
}

export async function themViec(env, toChucId, viec, { tinNhanId = null, boQuaTrung = false } = {}) {
  if (!boQuaTrung) {
    const han = new Date(Date.now() - 14 * 86400000).toISOString();
    const { results } = await env.CSDL.prepare(
      `SELECT id, tieu_de FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tao_luc >= ?2`,
    ).bind(toChucId, han).all();
    const trung = timTrung(viec.tieu_de, results);
    if (trung) return { id: trung.id, trung: true };
  }
  const bayGio = new Date().toISOString();
  const dong = await env.CSDL.prepare(
    `INSERT INTO viec (to_chuc_id, tieu_de, ghi_chu, han_ngay, gio_hen, trang_thai, tin_nhan_id, tao_luc, cap_nhat_luc)
     VALUES (?1, ?2, ?3, ?4, ?5, 'mo', ?6, ?7, ?7) RETURNING id`,
  ).bind(toChucId, viec.tieu_de, viec.ghi_chu || null, viec.han_ngay || null, viec.gio_hen || null, tinNhanId, bayGio).first();
  await baoSuKien(env, toChucId, dangViecMoi({ ...viec, id: dong.id }));
  return { id: dong.id, trung: false };
}

// Lấy tối đa 20 tin chưa tách của một tổ chức, đánh dấu "đang xử lý" để hai lượt chạy không làm trùng.
export async function tachViecChoToChuc(env, toChucId) {
  const bayGio = new Date().toISOString();
  const { results: tin } = await env.CSDL.prepare(
    `UPDATE tin_nhan SET da_tach = 2, tach_luc = ?2
     WHERE id IN (SELECT id FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 0 ORDER BY id LIMIT 20)
     RETURNING id, nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem`,
  ).bind(toChucId, bayGio).all();
  if (!tin.length) return { so_tin: 0, so_viec: 0 };
  tin.sort((a, b) => a.id - b.id);

  const ten = await env.CSDL.prepare(
    `SELECT n.ten FROM thanh_vien v JOIN nguoi_dung n ON n.id = v.nguoi_dung_id WHERE v.to_chuc_id = ?1 AND v.vai_tro = 'chu' LIMIT 1`,
  ).bind(toChucId).first();

  let ketQua;
  try {
    const ngoai = await docTichHop(env, toChucId, 'ai');
    ketQua = await tachViec(env, tin.map((t, i) => ({ ...t, so: i + 1 })), ngayVN(), ten?.ten, {
      ngoai,
      baoLoi: (thongBao) => ghiTinHieu(env, toChucId, 'ai', `Dịch vụ AI ngoài lỗi, đã dùng AI có sẵn: ${thongBao}`),
    });
  } catch (e) {
    // Lỗi AI: trả tin về hàng chờ để lượt sau thử lại; tin đã nằm chờ quá 6 giờ thì bỏ qua.
    await env.CSDL.prepare(
      `UPDATE tin_nhan SET da_tach = CASE WHEN tao_luc < ?2 THEN 3 ELSE 0 END
       WHERE to_chuc_id = ?1 AND da_tach = 2`,
    ).bind(toChucId, new Date(Date.now() - 6 * 3600000).toISOString()).run();
    throw e;
  }

  let soViec = 0;
  for (const v of ketQua) {
    const nguon = v.tin_so && tin[v.tin_so - 1];
    const r = await themViec(env, toChucId, v, { tinNhanId: nguon ? nguon.id : null });
    if (!r.trung) soViec++;
  }
  await env.CSDL.prepare(
    `UPDATE tin_nhan SET da_tach = 1 WHERE to_chuc_id = ?1 AND da_tach = 2 AND id IN (${tin.map((_, i) => `?${i + 2}`).join(',')})`,
  ).bind(toChucId, ...tin.map((t) => t.id)).run();
  return { so_tin: tin.length, so_viec: soViec };
}
