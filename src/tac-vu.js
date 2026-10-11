// Việc từng tác vụ hẹn giờ làm. Tác vụ chạy cho mọi tổ chức một lượt, ghi một dòng nhật ký chung.

import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { baoToChuc } from './telegram.js';
import { cat, congNgay, gioVN, ngayVN } from './tien-ich.js';
import { tachViecChoToChuc } from './viec.js';

const ZALO_IM_GIO = 6;
const MAT_VIEC_TOI_THIEU = 10;

async function cacToChuc(env) {
  const { results } = await env.CSDL.prepare('SELECT id, ten FROM to_chuc').all();
  return results;
}

export const CAC_TAC_VU = {
  'tu-kiem': async (env, bayGio) => {
    await env.CSDL.prepare(
      `INSERT INTO tin_hieu (to_chuc_id, nguon, lan_cuoi, ghi_chu) VALUES ('', 'hen-gio', ?1, 'Tự kiểm mỗi giờ')
       ON CONFLICT (to_chuc_id, nguon) DO UPDATE SET lan_cuoi = excluded.lan_cuoi`,
    ).bind(bayGio).run();
    return { so_muc: 1, ghi_chu: 'Hẹn giờ chạy bình thường' };
  },

  'tach-viec': async (env) => {
    const { results } = await env.CSDL.prepare('SELECT DISTINCT to_chuc_id FROM tin_nhan WHERE da_tach = 0').all();
    // Tin kẹt ở trạng thái "đang xử lý" quá 15 phút (lượt trước bị ngắt) thì trả về hàng chờ.
    await env.CSDL.prepare(`UPDATE tin_nhan SET da_tach = 0 WHERE da_tach = 2 AND tach_luc < ?1`)
      .bind(new Date(Date.now() - 15 * 60000).toISOString())
      .run();
    let soTin = 0;
    let soViec = 0;
    for (const { to_chuc_id: id } of results) {
      const kq = await tachViecChoToChuc(env, id);
      soTin += kq.so_tin;
      soViec += kq.so_viec;
    }
    return { so_muc: soViec, ghi_chu: soTin ? `Đọc ${soTin} tin, thêm ${soViec} việc` : 'Không có tin mới' };
  },

  'bao-viec-moi': async (env, bayGio) => {
    const gio = gioVN(bayGio);
    if (gio >= 22 || gio < 7) return { so_muc: 0, ghi_chu: 'Giờ yên lặng, để sáng mai báo' };
    let soBao = 0;
    for (const tc of await cacToChuc(env)) {
      const moc = (await docCaiDat(env, tc.id, 'bao_viec_luc')) || new Date(Date.now() - 3600000).toISOString();
      const { results } = await env.CSDL.prepare(
        `SELECT tieu_de, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tao_luc > ?2 ORDER BY id LIMIT 15`,
      ).bind(tc.id, moc).all();
      if (!results.length) continue;
      const dong = results.map((v) => `- ${v.tieu_de}${v.han_ngay ? ` (hạn ${v.han_ngay.slice(8, 10)}/${v.han_ngay.slice(5, 7)}${v.gio_hen ? ` ${v.gio_hen}` : ''})` : ''}`);
      if (await baoToChuc(env, tc.id, `${results.length} việc mới từ tin nhắn:\n${dong.join('\n')}`)) soBao++;
      await ghiCaiDat(env, tc.id, 'bao_viec_luc', bayGio);
    }
    return { so_muc: soBao, ghi_chu: soBao ? `Báo ${soBao} tổ chức` : 'Không có việc mới' };
  },

  'canh-zalo': async (env, bayGio) => {
    const gio = gioVN(bayGio);
    const { results } = await env.CSDL.prepare(
      `SELECT k.to_chuc_id, h.lan_cuoi FROM (SELECT DISTINCT to_chuc_id FROM khoa_truy_cap WHERE loai = 'zalo') k
       LEFT JOIN tin_hieu h ON h.to_chuc_id = k.to_chuc_id AND h.nguon = 'zalo'`,
    ).all();
    let soBao = 0;
    for (const r of results) {
      if (!r.lan_cuoi) continue;
      const gioIm = (Date.parse(bayGio) - Date.parse(r.lan_cuoi)) / 3600000;
      if (gioIm < ZALO_IM_GIO || gio < 8 || gio >= 22) continue;
      // Mỗi lần mất tín hiệu chỉ báo một lần: nhớ mốc đã báo.
      if ((await docCaiDat(env, r.to_chuc_id, 'zalo_da_bao')) === r.lan_cuoi) continue;
      await baoToChuc(env, r.to_chuc_id, `Máy Mac gửi Zalo đã im ${Math.floor(gioIm)} giờ (lần cuối ${r.lan_cuoi.slice(11, 16)} UTC). Kiểm tra máy còn bật, còn mạng và Zalo còn đăng nhập.`);
      await ghiCaiDat(env, r.to_chuc_id, 'zalo_da_bao', r.lan_cuoi);
      soBao++;
    }
    return { so_muc: soBao, ghi_chu: soBao ? `Báo mất tín hiệu ${soBao} máy` : 'Tín hiệu ổn' };
  },

  'canh-viec': async (env) => {
    let soBao = 0;
    for (const tc of await cacToChuc(env)) {
      const { n } = await env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai != 'huy'`).bind(tc.id).first();
      const truoc = Number(await docCaiDat(env, tc.id, 'so_viec'));
      if (Number.isFinite(truoc) && truoc - n >= MAT_VIEC_TOI_THIEU) {
        await baoToChuc(env, tc.id, `Số việc giảm từ ${truoc} xuống ${n} trong một giờ. Nếu không phải anh/chị tự hủy, xem lại trang Việc; bản sao lưu đêm qua nằm trong kho tệp.`);
        soBao++;
      }
      await ghiCaiDat(env, tc.id, 'so_viec', String(n));
    }
    return { so_muc: soBao, ghi_chu: soBao ? `Cảnh báo ${soBao} tổ chức` : 'Không có việc nào mất bất thường' };
  },

  'don-cuoi-ngay': async (env, bayGio) => {
    const homNay = ngayVN(bayGio);
    const mai = congNgay(homNay, 1);
    const kq = await env.CSDL.prepare(
      `UPDATE viec SET han_ngay = ?1, cap_nhat_luc = ?2 WHERE trang_thai = 'mo' AND han_ngay IS NOT NULL AND han_ngay <= ?3`,
    ).bind(mai, bayGio, homNay).run();
    const so = kq.meta.changes || 0;
    return { so_muc: so, ghi_chu: so ? `Dời ${so} việc sang ${mai}` : 'Không có việc nào phải dời' };
  },

  'sao-luu': async (env, bayGio) => {
    let soToChuc = 0;
    for (const tc of await cacToChuc(env)) {
      const [viec, tin, tep, caiDat] = await env.CSDL.batch([
        env.CSDL.prepare('SELECT * FROM viec WHERE to_chuc_id = ?1').bind(tc.id),
        env.CSDL.prepare('SELECT * FROM tin_nhan WHERE to_chuc_id = ?1 AND thoi_diem >= ?2').bind(tc.id, new Date(Date.now() - 90 * 86400000).toISOString()),
        env.CSDL.prepare('SELECT * FROM tep WHERE to_chuc_id = ?1').bind(tc.id),
        env.CSDL.prepare(`SELECT khoa, gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa NOT LIKE '%ma_noi%'`).bind(tc.id),
      ]);
      const banSao = { to_chuc: tc, luc: bayGio, viec: viec.results, tin_nhan: tin.results, tep: tep.results, cai_dat: caiDat.results };
      await env.TEP.put(`sao-luu/${tc.id}/${ngayVN(bayGio)}.json`, JSON.stringify(banSao), {
        httpMetadata: { contentType: 'application/json' },
      });
      soToChuc++;
    }
    return { so_muc: soToChuc, ghi_chu: cat(`Sao lưu ${soToChuc} tổ chức vào kho tệp`, 200) };
  },
};
