// Việc: thêm việc (có chống trùng), tách việc từ tin bằng AI.

import { NHOM_THEO_SO, tachViec } from './ai.js';
import { ghiChuKeHoach } from './ai.js';
import { docHoSo, ghiNhoChoAi, luuGhiNho } from './ghi-nho.js';
import { ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { docLuong } from './luong.js';
import { baoSuKien, dangViecMoi, docTichHop } from './tich-hop.js';
import { doGiong, ngayVN } from './tien-ich.js';

// Tiêu đề giống từ 80% với một việc đang mở trong 14 ngày gần đây thì coi là trùng.
export const NGUONG_TRUNG = 0.8;

// Vài tin đã xử lý cùng nhóm (Zalo) hoặc cùng người gửi, trong 3 ngày, để AI hiểu câu trả lời ngắn như "ok", "đồng ý".
export async function tinTruocChoLo(env, toChucId, tin) {
  const ids = tin.map((t) => t.id).filter(Boolean);
  const nhom = [...new Set(tin.map((t) => t.nhom).filter(Boolean))].slice(0, 5);
  const nguoi = [...new Set(tin.filter((t) => !t.nhom && t.nguoi_gui).map((t) => t.nguoi_gui))].slice(0, 5);
  if (!ids.length || (!nhom.length && !nguoi.length)) return [];
  const tham = [toChucId, Math.min(...ids), new Date(Date.now() - 3 * 86400000).toISOString(), ...nhom, ...nguoi];
  const dk = [];
  if (nhom.length) dk.push(`nhom IN (${nhom.map((_, i) => `?${4 + i}`).join(',')})`);
  if (nguoi.length) dk.push(`(nhom IS NULL AND nguoi_gui IN (${nguoi.map((_, i) => `?${4 + nhom.length + i}`).join(',')}))`);
  const { results } = await env.CSDL.prepare(
    `SELECT nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem FROM tin_nhan
     WHERE to_chuc_id = ?1 AND da_tach = 1 AND id < ?2 AND tao_luc >= ?3 AND (${dk.join(' OR ')}) ORDER BY id DESC LIMIT 8`,
  ).bind(...tham).all();
  return results.reverse().map((t) => `[${t.thoi_diem?.slice(0, 16) || ''}${t.nhom ? ` nhóm "${t.nhom}"` : ''} từ ${t.nguoi_gui || 'không rõ'}] ${t.tieu_de ? `${t.tieu_de}: ` : ''}${String(t.noi_dung || '').replace(/\s+/g, ' ').slice(0, 300)}`);
}

// Việc đủ rõ để làm: tên có từ 3 chữ, hoặc 2 chữ kèm hạn hoặc ghi chú. Tên một chữ hay mơ hồ ("Hơi", "Vote") không phải việc.
export function laViecRo(v) {
  const chu = String(v?.tieu_de || '').trim().split(/\s+/).filter(Boolean).length;
  const ghiChu = String(v?.ghi_chu || '').trim().length;
  return chu >= 3 || (chu === 2 && Boolean(v?.han_ngay || ghiChu >= 20));
}

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
    `INSERT INTO viec (to_chuc_id, tieu_de, ghi_chu, han_ngay, gio_hen, trang_thai, tin_nhan_id, tao_luc, cap_nhat_luc, nhom, uu_tien)
     VALUES (?1, ?2, ?3, ?4, ?5, 'mo', ?6, ?7, ?7, ?8, ?9) RETURNING id`,
  ).bind(toChucId, viec.tieu_de, viec.ghi_chu || null, viec.han_ngay || null, viec.gio_hen || null, tinNhanId, bayGio, NHOM_THEO_SO[viec.nhom] || null, viec.uu_tien || null).first();
  await baoSuKien(env, toChucId, dangViecMoi({ ...viec, id: dong.id }));
  return { id: dong.id, trung: false };
}

// Lõi xử lý một lô tin: AI đọc cùng ghi nhớ, tạo việc, lưu ghi nhớ. Dùng cho tin trong hộp tin và cho tin nhắn trực tiếp.
// tin: [{ id (hoặc null), nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem }]. Trả { soViec, viec: [{ id, tieu_de, han_ngay, gio_hen, trung }] }.
async function chayLoTin(env, toChucId, tin, bayGio) {
  const ten = await env.CSDL.prepare(
    `SELECT n.ten FROM thanh_vien v JOIN nguoi_dung n ON n.id = v.nguoi_dung_id WHERE v.to_chuc_id = ?1 AND v.vai_tro = 'chu' LIMIT 1`,
  ).bind(toChucId).first();

  // Việc đang mở và việc vừa xong 3 ngày qua, đưa cho AI để khỏi trích lại việc đã có.
  const { results: daCoDong } = await env.CSDL.prepare(
    `SELECT tieu_de, han_ngay, trang_thai FROM viec
     WHERE to_chuc_id = ?1 AND (trang_thai = 'mo' OR (trang_thai = 'xong' AND xong_luc >= ?2)) ORDER BY id DESC LIMIT 80`,
  ).bind(toChucId, new Date(Date.now() - 3 * 86400000).toISOString()).all();
  const daCo = daCoDong.map((v) => `${v.trang_thai === 'xong' ? '[đã xong] ' : ''}${v.tieu_de}${v.han_ngay ? ` (hạn ${v.han_ngay})` : ''}`);

  const ghiNho = await ghiNhoChoAi(env, toChucId, tin.map((t) => `${t.nguoi_gui || ''} ${t.nhom || ''} ${t.tieu_de || ''} ${t.noi_dung || ''}`).join(' '));

  let ketQua;
  const tuyChon = {};
  try {
    const ngoai = await docTichHop(env, toChucId, 'ai');
    tuyChon.ngoai = ngoai;
    tuyChon.hoSo = await docHoSo(env, toChucId);
    tuyChon.tinTruoc = await tinTruocChoLo(env, toChucId, tin).catch(() => []);
    ketQua = await tachViec(env, tin.map((t, i) => ({ ...t, so: i + 1 })), ngayVN(), ten?.ten, Object.assign(tuyChon, {
      daCo,
      ghiNho,
      baoLoi: (thongBao) => ghiTinHieu(env, toChucId, 'ai', `Dịch vụ AI ngoài lỗi, đã dùng AI có sẵn: ${thongBao}`),
    }));
  } catch (e) {
    // Lỗi AI: trả tin về hàng chờ để lượt sau thử lại; tin đã nằm chờ quá 6 giờ thì bỏ qua.
    if (tin.some((t) => t.id)) await env.CSDL.prepare(
      `UPDATE tin_nhan SET da_tach = CASE WHEN tao_luc < ?2 THEN 3 ELSE 0 END
       WHERE to_chuc_id = ?1 AND da_tach = 2`,
    ).bind(toChucId, new Date(Date.now() - 6 * 3600000).toISOString()).run();
    throw e;
  }

  let soViec = 0;
  const viecRa = [];
  for (const v of ketQua.viec.filter((x) => laViecRo(x) || String(x?.tieu_de || '').trim().split(/\s+/).length >= 2 && x.han_ngay).slice(0, 10)) {
    const nguon = v.tin_so && tin[v.tin_so - 1];
    const keHoach = ghiChuKeHoach(v);
    const ghiChu = [v.ghi_chu, keHoach].filter(Boolean).join('\n\n') || null;
    const r = await themViec(env, toChucId, { ...v, ghi_chu: ghiChu }, { tinNhanId: nguon ? nguon.id : null });
    if (!r.trung) soViec++;
    viecRa.push({ id: r.id, tieu_de: v.tieu_de, han_ngay: v.han_ngay || null, gio_hen: v.gio_hen || null, trung: r.trung });
  }
  // Ghi nhớ và phân tích: lỗi ở đây không được làm hỏng việc đã tạo.
  try {
    await luuGhiNho(env, toChucId, ketQua.ghi_nho, { tinNhanId: tin[0]?.id ?? null, doTinCay: tuyChon.duPhong ? 'thap' : 'cao' });
    if (ketQua.phan_tich) await ghiCaiDat(env, toChucId, 'phan_tich_cuoi', JSON.stringify({ luc: bayGio, noi_dung: ketQua.phan_tich }));
  } catch (e) {
    console.error('Lưu ghi nhớ lỗi', e);
  }
  return { soViec, viec: viecRa };
}

// Lấy tối đa 20 tin chưa tách của một tổ chức, đánh dấu "đang xử lý" để hai lượt chạy không làm trùng.
export async function tachViecChoToChuc(env, toChucId) {
  if (!(await docLuong(env, toChucId)).bat['tach-viec']) return { so_tin: 0, so_viec: 0 };
  const bayGio = new Date().toISOString();
  const { results: tin } = await env.CSDL.prepare(
    `UPDATE tin_nhan SET da_tach = 2, tach_luc = ?2
     WHERE id IN (SELECT id FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 0 ORDER BY id LIMIT 20)
     RETURNING id, nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem`,
  ).bind(toChucId, bayGio).all();
  if (!tin.length) return { so_tin: 0, so_viec: 0 };
  tin.sort((a, b) => a.id - b.id);

  const { soViec } = await chayLoTin(env, toChucId, tin, bayGio);
  await env.CSDL.prepare(
    `UPDATE tin_nhan SET da_tach = 1 WHERE to_chuc_id = ?1 AND da_tach = 2 AND id IN (${tin.map((_, i) => `?${i + 2}`).join(',')})`,
  ).bind(toChucId, ...tin.map((t) => t.id)).run();
  return { so_tin: tin.length, so_viec: soViec };
}

// Tin nhắn trực tiếp (Telegram, dịch vụ ngoài): đi qua cùng lõi AI như tin Zalo nhưng không nằm trong hộp tin.
// Trả { tat: true } nếu người dùng đã tắt khâu tách việc, hoặc { viec: [...] } (rỗng nếu AI không thấy việc nào).
export async function xuLyVanBanTrucTiep(env, toChucId, { nguon, nguoi_gui: nguoiGui, noi_dung: noiDung }) {
  if (!(await docLuong(env, toChucId)).bat['tach-viec']) return { tat: true };
  const bayGio = new Date().toISOString();
  const tin = [{ id: null, nguon, nguoi_gui: nguoiGui || 'Tôi', nhom: null, tieu_de: null, noi_dung: String(noiDung || '').slice(0, 3000), thoi_diem: bayGio }];
  const { viec } = await chayLoTin(env, toChucId, tin, bayGio);
  return { viec };
}
