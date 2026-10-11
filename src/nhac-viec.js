// Nhắc việc theo giờ hẹn, chạy mỗi 5 phút: nhắc trước 30 phút và nhắc đúng giờ, mỗi lời một lần.
// Giờ yên lặng (chỉnh ở trang Luồng): không gửi, hết giờ yên lặng các lời nhắc còn trong hạn được gửi gộp một tin.

import { dangYenLang, docLuong } from './luong.js';
import { baoToChucNut, nutNhacViec } from './telegram.js';
import { gioVN, sangUTC } from './tien-ich.js';

const TRUOC_PHUT_MAC_DINH = 30;
const QUA_GIO_TOI_DA = 3; // nhắc "đến giờ" muộn nhất 3 tiếng sau giờ hẹn
const TOI_DA_MOI_LUOT = 5;

// Quyết định lời nhắc cho một việc tại thời điểm bayGio (ms). Trả 'truoc', 'dung' hoặc null.
export function loaiNhac(hanNgay, gioHen, bayGio, truocPhut = TRUOC_PHUT_MAC_DINH) {
  if (!hanNgay || !gioHen) return null;
  const den = sangUTC(hanNgay, gioHen).getTime();
  if (bayGio >= den && bayGio < den + QUA_GIO_TOI_DA * 3600000) return 'dung';
  if (bayGio >= den - truocPhut * 60000 && bayGio < den) return 'truoc';
  return null;
}

export async function nhacViec(env, bayGio) {
  const gio = gioVN(bayGio);
  const bay = Date.parse(bayGio);
  const { results } = await env.CSDL.prepare(
    `SELECT id, to_chuc_id, tieu_de, han_ngay, gio_hen FROM viec
     WHERE trang_thai = 'mo' AND gio_hen IS NOT NULL AND han_ngay IS NOT NULL
       AND han_ngay >= ?1 AND han_ngay <= ?2 ORDER BY han_ngay, gio_hen`,
  ).bind(new Date(bay - 86400000).toISOString().slice(0, 10), new Date(bay + 86400000).toISOString().slice(0, 10)).all();

  const theoToChuc = new Map();
  const luongTheoToChuc = new Map();
  for (const v of results) {
    if (!luongTheoToChuc.has(v.to_chuc_id)) luongTheoToChuc.set(v.to_chuc_id, await docLuong(env, v.to_chuc_id));
    const lg = luongTheoToChuc.get(v.to_chuc_id);
    if (!lg.bat['nhac-viec'] || dangYenLang(gio, lg.nguong)) continue;
    const loai = loaiNhac(v.han_ngay, v.gio_hen, bay, lg.nguong.nhac_truoc_phut);
    if (!loai) continue;
    const them = await env.CSDL.prepare('INSERT OR IGNORE INTO nhac_da_gui (viec_id, loai, luc) VALUES (?1, ?2, ?3)').bind(v.id, loai, bayGio).run();
    if (!them.meta.changes) continue; // đã nhắc rồi
    if (!theoToChuc.has(v.to_chuc_id)) theoToChuc.set(v.to_chuc_id, []);
    theoToChuc.get(v.to_chuc_id).push({ ...v, loai });
  }

  let soNhac = 0;
  for (const [tc, ds] of theoToChuc) {
    // Mỗi việc một tin kèm nút Xong, Dời mai, Dời tuần sau, Bỏ; quá 5 việc thì phần còn lại gom một dòng.
    for (const v of ds.slice(0, TOI_DA_MOI_LUOT)) {
      const dong = `Nhắc việc: ${v.gio_hen} ${v.tieu_de}${v.loai === 'truoc' ? ` (còn ${Math.max(1, Math.round((sangUTC(v.han_ngay, v.gio_hen).getTime() - bay) / 60000))} phút)` : ' (đến giờ)'}`;
      if (await baoToChucNut(env, tc, dong, nutNhacViec(v.id))) soNhac++;
    }
    if (ds.length > TOI_DA_MOI_LUOT) await baoToChucNut(env, tc, `... và ${ds.length - TOI_DA_MOI_LUOT} việc nữa đến giờ, xem trang Việc.`, []).catch(() => {});
  }
  return soNhac ? { so_muc: soNhac, ghi_chu: `Nhắc ${soNhac} việc` } : { bo_qua: true };
}
