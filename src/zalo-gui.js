// Gửi tin Zalo từ Sonicplan. Chỉ chủ tổ chức bấm gửi trong giao diện mới tạo lệnh; chương trình Zalo trên máy Mac
// lấy lệnh bằng mã riêng của nó và gửi thật bằng tài khoản Zalo của chủ. Không có lệnh nào được tạo tự động:
// thợ Claude và các tác vụ hẹn giờ không gọi hàm tạo lệnh ở đây.

import { luuTep, TEP_TOI_DA } from './hop-tin.js';
import { json, loi } from './tien-ich.js';

export const TOI_DA_CHU = 2000;
export const TOI_DA_TEP = 5;
const HET_HAN_CHO_MS = 3 * 60_000; // máy Mac không lấy lệnh trong 3 phút thì bỏ, không gửi muộn bất ngờ
const HET_HAN_DANG_MS = 3 * 60_000; // đã lấy mà không báo kết quả: không rõ đã gửi chưa, để chủ tự kiểm trong Zalo
const TOI_DA_MOI_10_PHUT = 20;
const RE_KHOA = /^(nhom|ca-nhan):(\d{1,30})$/;

async function donQuaHan(env, tc, bayGio = Date.now()) {
  const cho = new Date(bayGio - HET_HAN_CHO_MS).toISOString();
  const dang = new Date(bayGio - HET_HAN_DANG_MS).toISOString();
  const luc = new Date(bayGio).toISOString();
  await env.CSDL.prepare(`UPDATE zalo_gui SET trang_thai = 'loi', loi = ?1, cap_nhat_luc = ?2 WHERE to_chuc_id = ?3 AND trang_thai = 'cho' AND tao_luc < ?4`)
    .bind('Máy Mac không nhận lệnh trong 3 phút nên tin chưa được gửi. Kiểm chương trình Zalo ở trang Kết nối.', luc, tc, cho).run();
  await env.CSDL.prepare(`UPDATE zalo_gui SET trang_thai = 'loi', loi = ?1, cap_nhat_luc = ?2 WHERE to_chuc_id = ?3 AND trang_thai = 'dang' AND cap_nhat_luc < ?4`)
    .bind('Máy Mac đã nhận lệnh nhưng không báo kết quả. Mở Zalo xem tin đã gửi chưa trước khi gửi lại.', luc, tc, dang).run();
}

// Giao diện: tạo một lệnh gửi (multipart: khoa, noi_dung, tep). Trả { id }.
export async function taoLenhGui(env, tc, phien, yeuCau) {
  if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức gửi được tin Zalo.');
  const form = await yeuCau.formData().catch(() => null);
  if (!form) return loi(400, 'Thiếu dữ liệu tin cần gửi.');
  const khoa = String(form.get('khoa') || '').slice(0, 60);
  const kieu = khoa.match(RE_KHOA);
  if (!kieu) return loi(400, 'Cuộc trò chuyện này chưa có mã Zalo nên chưa gửi được. Chờ tin mới về hoặc gửi từ Zalo.');
  const chu = String(form.get('noi_dung') || '').replace(/\r\n?/g, '\n').trim();
  if (chu.length > TOI_DA_CHU) return loi(400, `Tin dài quá ${TOI_DA_CHU} ký tự, chia làm hai tin.`);
  const tepGui = form.getAll('tep').filter((t) => t && typeof t !== 'string' && t.size > 0);
  if (!chu && !tepGui.length) return loi(400, 'Chưa có chữ hay tệp để gửi.');
  if (tepGui.length > TOI_DA_TEP) return loi(400, `Mỗi lần gửi tối đa ${TOI_DA_TEP} tệp.`);
  if (tepGui.some((t) => t.size > TEP_TOI_DA)) return loi(413, 'Có tệp lớn quá 25 MB.');
  await donQuaHan(env, tc);
  const gan = await env.CSDL.prepare('SELECT COUNT(*) AS n FROM zalo_gui WHERE to_chuc_id = ?1 AND tao_luc > ?2').bind(tc, new Date(Date.now() - 10 * 60_000).toISOString()).first();
  if ((gan?.n ?? 0) >= TOI_DA_MOI_10_PHUT) return loi(429, 'Gửi nhiều quá trong 10 phút, chờ một lát rồi gửi tiếp (Zalo dễ khóa tài khoản gửi dồn dập).');
  const tepIds = [];
  for (const t of tepGui) {
    const id = await luuTep(env, tc, { ten: t.name || 'tep', loai: t.type || 'application/octet-stream', kich_thuoc: t.size, du_lieu: await t.arrayBuffer(), nguon: 'zalo-gui', nguoi_gui: 'Tôi', nhom: '', tin_nhan_id: null });
    if (!id) return loi(507, 'Kho tệp đã đầy, chưa gửi được tệp.');
    tepIds.push(id);
  }
  const luc = new Date().toISOString();
  const dong = await env.CSDL.prepare(
    `INSERT INTO zalo_gui (to_chuc_id, khoa, thread_id, loai, noi_dung, tep_ids, trang_thai, tao_luc, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'cho', ?7, ?7) RETURNING id`,
  ).bind(tc, khoa, kieu[2], kieu[1], chu, JSON.stringify(tepIds), luc).first();
  return json({ id: dong.id });
}

// Giao diện: trạng thái các lệnh gửi gần đây của một cuộc trò chuyện.
export async function trangThaiGui(env, tc, url) {
  await donQuaHan(env, tc);
  const khoa = String(url.searchParams.get('khoa') || '').slice(0, 60);
  const { results } = await env.CSDL.prepare(
    `SELECT id, trang_thai, loi, noi_dung, tao_luc FROM zalo_gui WHERE to_chuc_id = ?1 AND khoa = ?2 AND tao_luc > ?3 ORDER BY id DESC LIMIT 10`,
  ).bind(tc, khoa, new Date(Date.now() - 15 * 60_000).toISOString()).all();
  return json({ ds: results });
}

// ---- Phía máy Mac (mã riêng của chương trình Zalo) ----

// Lấy lệnh cũ nhất đang chờ và đánh dấu đang gửi; không có thì trả {}.
export async function layLenhGui(env, tc) {
  await donQuaHan(env, tc);
  const luc = new Date().toISOString();
  const dong = await env.CSDL.prepare(
    `UPDATE zalo_gui SET trang_thai = 'dang', cap_nhat_luc = ?2 WHERE id = (SELECT id FROM zalo_gui WHERE to_chuc_id = ?1 AND trang_thai = 'cho' ORDER BY id LIMIT 1) AND trang_thai = 'cho'
     RETURNING id, thread_id, loai, noi_dung, tep_ids`,
  ).bind(tc, luc).first();
  if (!dong) return json({});
  const ids = JSON.parse(dong.tep_ids || '[]').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  let tep = [];
  if (ids.length) tep = (await env.CSDL.prepare(`SELECT id, ten, loai, kich_thuoc FROM tep WHERE to_chuc_id = ?1 AND nguon = 'zalo-gui' AND id IN (${ids.join(',')}) ORDER BY id`).bind(tc).all()).results;
  return json({ id: dong.id, thread_id: dong.thread_id, type: dong.loai, text: dong.noi_dung, files: tep });
}

// Tải tệp của một lệnh đang gửi (chỉ tệp thuộc lệnh ở trạng thái đang gửi).
export async function taiTepGui(env, tc, url) {
  const lenh = Number(url.searchParams.get('lenh')) || 0;
  const tepId = Number(url.searchParams.get('id')) || 0;
  const dong = await env.CSDL.prepare(`SELECT tep_ids FROM zalo_gui WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai = 'dang'`).bind(lenh, tc).first();
  if (!dong || !JSON.parse(dong.tep_ids || '[]').includes(tepId)) return loi(404, 'Không có tệp này trong lệnh đang gửi.');
  const tep = await env.CSDL.prepare(`SELECT r2_khoa, loai FROM tep WHERE id = ?1 AND to_chuc_id = ?2 AND nguon = 'zalo-gui'`).bind(tepId, tc).first();
  const vat = tep?.r2_khoa ? await env.TEP.get(tep.r2_khoa) : null;
  if (!vat) return loi(404, 'Tệp không còn trong kho.');
  return new Response(vat.body, { headers: { 'content-type': tep.loai || 'application/octet-stream', 'cache-control': 'no-store' } });
}

export async function ketThucGui(env, tc, du) {
  const id = Number(du?.id) || 0;
  const ok = du?.ok === true;
  const luc = new Date().toISOString();
  const kq = await env.CSDL.prepare(`UPDATE zalo_gui SET trang_thai = ?1, loi = ?2, cap_nhat_luc = ?3 WHERE id = ?4 AND to_chuc_id = ?5 AND trang_thai = 'dang' RETURNING id`)
    .bind(ok ? 'xong' : 'loi', ok ? null : String(du?.loi || 'Zalo từ chối gửi.').slice(0, 300), luc, id, tc).first();
  return json({ ok: Boolean(kq) });
}
