// Việc từng tác vụ hẹn giờ làm. Tác vụ chạy cho mọi tổ chức một lượt, ghi một dòng nhật ký chung.

import { docLuong, dangYenLang } from './luong.js';
import { chamViecMoi } from './hieu-suat.js';
import { banTinNgay, baoCaoTuan, cacToChuc, goiYMoi, gioDayDuVN } from './ban-tin.js';
import { taoIssue } from './github.js';
import { dongBoGoogle } from './google.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { dongBoKho } from './kho.js';
import { nhacViec } from './nhac-viec.js';
import { bamNutDuocChua, baoToChuc } from './telegram.js';
import { docTichHop } from './tich-hop.js';
import { cat, congNgay, gioVN, ngayVN } from './tien-ich.js';
import { tachViecChoToChuc } from './viec.js';


export const CAC_TAC_VU = {
  'tu-kiem': async (env, bayGio) => {
    await env.CSDL.prepare(
      `INSERT INTO tin_hieu (to_chuc_id, nguon, lan_cuoi, ghi_chu) VALUES ('', 'hen-gio', ?1, 'Tự kiểm mỗi giờ')
       ON CONFLICT (to_chuc_id, nguon) DO UPDATE SET lan_cuoi = excluded.lan_cuoi`,
    ).bind(bayGio).run();
    // Bảo đảm Telegram gửi cả lượt bấm nút (đăng ký lại một lần sau khi nâng cấp); lỗi thì bỏ qua.
    await bamNutDuocChua(env).catch((e) => console.error('Đăng ký nút Telegram lỗi', e));
    return { so_muc: 1, ghi_chu: 'Hẹn giờ chạy bình thường' };
  },

  'dong-bo-google': async (env) => {
    const { results } = await env.CSDL.prepare(`SELECT DISTINCT to_chuc_id FROM cai_dat WHERE khoa = 'tich_hop_google'`).all();
    if (!results.length) return { bo_qua: true };
    let thu = 0;
    let viec = 0;
    const loi = [];
    for (const { to_chuc_id: id } of results) {
      if (!(await docLuong(env, id)).bat['dong-bo-google']) continue;
      try {
        const kq = await dongBoGoogle(env, id);
        if (!kq) continue;
        thu += kq.thu;
        viec += kq.day_len + kq.ve_lai;
        loi.push(...kq.loi);
      } catch (e) {
        await ghiTinHieu(env, id, 'google', `Lỗi ${String(e.message).slice(0, 120)}`);
        loi.push(String(e.message).slice(0, 80));
      }
    }
    if (loi.length && !thu && !viec) throw new Error(loi.join('; '));
    return { so_muc: thu + viec, ghi_chu: `${thu} thư mới, ${viec} việc đồng bộ${loi.length ? `, ${loi.length} lỗi` : ''}` };
  },

  'luu-kho': async (env) => {
    const { results } = await env.CSDL.prepare(`SELECT DISTINCT to_chuc_id FROM cai_dat WHERE khoa = 'tich_hop_kho_drive'`).all();
    if (!results.length) return { bo_qua: true };
    let muc = 0;
    const loi = [];
    for (const { to_chuc_id: id } of results) {
      if (!(await docLuong(env, id)).bat['luu-kho']) continue;
      try {
        const kq = await dongBoKho(env, id);
        if (!kq) continue;
        muc += kq.tep + kq.tin + kq.bo_nho + kq.viec;
        loi.push(...kq.loi);
      } catch (e) {
        await ghiTinHieu(env, id, 'kho', `Lỗi ${String(e.message).slice(0, 120)}`);
        loi.push(String(e.message).slice(0, 80));
      }
    }
    if (loi.length && !muc) throw new Error(loi.join('; '));
    return { so_muc: muc, ghi_chu: `Lưu ${muc} mục vào Drive kho${loi.length ? `, ${loi.length} lỗi` : ''}` };
  },

  'giao-github': async (env) => {
    const { results } = await env.CSDL.prepare(`SELECT DISTINCT to_chuc_id FROM cai_dat WHERE khoa = 'tich_hop_github'`).all();
    if (!results.length) return { bo_qua: true };
    let soViec = 0;
    const loi = [];
    for (const { to_chuc_id: id } of results) {
      if (!(await docLuong(env, id)).bat['giao-github']) continue;
      const cauHinh = await docTichHop(env, id, 'github');
      if (!cauHinh) continue;
      const { results: viec } = await env.CSDL.prepare(
        `SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND nhom = 'claude_tu_lam' AND github_issue IS NULL ORDER BY id LIMIT 5`,
      ).bind(id).all();
      const giao = [];
      for (const v of viec) {
        try {
          const kq = await taoIssue(cauHinh, v);
          await env.CSDL.prepare('UPDATE viec SET github_issue = ?1 WHERE id = ?2 AND to_chuc_id = ?3').bind(kq.so, v.id, id).run();
          giao.push(`- #${kq.so} ${v.tieu_de}`);
        } catch (e) {
          loi.push(String(e.message).slice(0, 100));
          break; // lỗi token hoặc kho thì các việc sau cũng lỗi, lượt sau thử lại
        }
      }
      await ghiTinHieu(env, id, 'github', loi.length ? `Lỗi ${loi[0]}` : giao.length ? `Giao ${giao.length} việc` : 'Không có việc mới để giao');
      if (giao.length) {
        soViec += giao.length;
        await baoToChuc(env, id, `Đã giao ${giao.length} việc cho Claude trên ${cauHinh.repo}:\n${giao.join('\n')}`);
      }
    }
    if (loi.length && !soViec) throw new Error(loi.join('; '));
    return { so_muc: soViec, ghi_chu: soViec ? `Giao ${soViec} việc sang GitHub` : 'Không có việc mới để giao' };
  },

  'tach-viec': async (env) => {
    const { results } = await env.CSDL.prepare('SELECT DISTINCT to_chuc_id FROM tin_nhan WHERE da_tach = 0').all();
    // Tin kẹt ở trạng thái "đang xử lý" quá 15 phút (lượt trước bị ngắt) thì trả về hàng chờ.
    await env.CSDL.prepare(`UPDATE tin_nhan SET da_tach = 0 WHERE da_tach = 2 AND tach_luc < ?1`)
      .bind(new Date(Date.now() - 15 * 60000).toISOString())
      .run();
    let soTin = 0;
    let soViec = 0;
    let soAi = 0;
    let soTrung = 0;
    let soLienKet = 0;
    let duPhong = false;
    for (const { to_chuc_id: id } of results) {
      if (!(await docLuong(env, id)).bat['tach-viec']) continue;
      const kq = await tachViecChoToChuc(env, id);
      soTin += kq.so_tin;
      soViec += kq.so_viec;
      soAi += kq.so_ai || 0;
      soTrung += kq.so_trung || 0;
      soLienKet += kq.so_lien_ket || 0;
      duPhong ||= Boolean(kq.du_phong);
    }
    const chiTiet = `AI thấy ${soAi} việc, trùng ${soTrung}, gắn vào việc cũ ${soLienKet}${duPhong ? ', dùng AI dự phòng' : ''}`;
    return { so_muc: soViec, ghi_chu: soTin ? `Đọc ${soTin} tin, thêm ${soViec} việc (${chiTiet})` : 'Không có tin mới' };
  },

  'bao-viec-moi': async (env, bayGio) => {
    const gio = gioVN(bayGio);
    let soBao = 0;
    for (const tc of await cacToChuc(env)) {
      const lg = await docLuong(env, tc.id);
      // Giờ yên lặng: không báo, mốc không tiến nên buổi sáng gộp thành một tin.
      if (!lg.bat['bao-viec-moi'] || dangYenLang(gio, lg.nguong)) continue;
      const moc = (await docCaiDat(env, tc.id, 'bao_viec_luc')) || new Date(Date.now() - 3600000).toISOString();
      const { results } = await env.CSDL.prepare(
        `SELECT tieu_de, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tao_luc > ?2 ORDER BY id LIMIT 15`,
      ).bind(tc.id, moc).all();
      if (!results.length) continue;
      const dong = results.map((v) => `- ${v.tieu_de}${v.han_ngay ? ` (hạn ${v.han_ngay.slice(8, 10)}/${v.han_ngay.slice(5, 7)}${v.gio_hen ? ` ${v.gio_hen}` : ''})` : ''}`);
      const dau = gio === lg.nguong.yen_den ? `Trong đêm có ${results.length} việc mới từ tin nhắn:` : `${results.length} việc mới từ tin nhắn:`;
      if (await baoToChuc(env, tc.id, `${dau}\n${dong.join('\n')}`)) soBao++;
      await ghiCaiDat(env, tc.id, 'bao_viec_luc', bayGio);
    }
    if (!soBao) return { bo_qua: true };
    return { so_muc: soBao, ghi_chu: `Báo ${soBao} tổ chức` };
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
      const lg = await docLuong(env, r.to_chuc_id);
      const gioIm = (Date.parse(bayGio) - Date.parse(r.lan_cuoi)) / 3600000;
      if (!lg.bat['canh-zalo'] || gioIm < lg.nguong.zalo_im_gio || dangYenLang(gio, lg.nguong)) continue;
      // Mỗi lần mất tín hiệu chỉ báo một lần: nhớ mốc đã báo.
      if ((await docCaiDat(env, r.to_chuc_id, 'zalo_da_bao')) === r.lan_cuoi) continue;
      await baoToChuc(env, r.to_chuc_id, `Cảnh báo: ${Math.floor(gioIm)} tiếng không nhận được tin Zalo (lần cuối ${gioDayDuVN(r.lan_cuoi)}). Kiểm tra máy Mac và phiên Zalo (có mã QR chờ quét không).`);
      await ghiCaiDat(env, r.to_chuc_id, 'zalo_da_bao', r.lan_cuoi);
      soBao++;
    }
    return { so_muc: soBao, ghi_chu: soBao ? `Báo mất tín hiệu ${soBao} máy` : 'Tín hiệu ổn' };
  },

  'canh-viec': async (env, bayGio) => {
    // So danh sách việc với lần trước: việc biến mất (xóa hoặc hủy) từ 10 việc, hoặc từ 5 việc chưa xong, thì báo.
    let soBao = 0;
    for (const tc of await cacToChuc(env)) {
      const lg = await docLuong(env, tc.id);
      if (!lg.bat['canh-viec']) continue;
      const { results } = await env.CSDL.prepare(`SELECT id, tieu_de, trang_thai FROM viec WHERE to_chuc_id = ?1 AND trang_thai != 'huy'`).bind(tc.id).all();
      const khoa = `canh-viec/${tc.id}/gan-nhat.json`;
      const cu = await env.TEP.get(khoa);
      const truoc = cu ? await cu.json().catch(() => null) : null;
      if (Array.isArray(truoc)) {
        const con = new Set(results.map((v) => v.id));
        const mat = truoc.filter((v) => !con.has(v.id));
        const matMo = mat.filter((v) => v.trang_thai === 'mo');
        if (mat.length >= lg.nguong.mat_viec || matMo.length >= lg.nguong.mat_viec_mo) {
          // Giữ danh sách trước khi mất để khôi phục.
          await env.TEP.put(`canh-viec/${tc.id}/truoc-${bayGio.slice(0, 13).replace('T', '-')}.json`, JSON.stringify(truoc), { httpMetadata: { contentType: 'application/json' } });
          const ten = mat.slice(0, 15).map((v) => `- ${v.tieu_de}`).join('\n');
          await baoToChuc(env, tc.id, `Cảnh báo: ${mat.length} việc biến mất trong một giờ (${matMo.length} chưa xong). Nếu không phải bạn tự hủy, xem lại trang Việc.\n${ten}${mat.length > 15 ? `\n... và ${mat.length - 15} việc nữa` : ''}\nDanh sách trước khi mất đã được lưu trong kho tệp.`);
          soBao++;
        }
      }
      await env.TEP.put(khoa, JSON.stringify(results), { httpMetadata: { contentType: 'application/json' } });
    }
    return { so_muc: soBao, ghi_chu: soBao ? `Cảnh báo ${soBao} tổ chức` : 'Không có việc nào mất bất thường' };
  },

  'nhac-viec': nhacViec,
  'ban-tin': banTinNgay,
  'goi-y': goiYMoi,
  'cham-viec': chamViecMoi,
  'bao-cao-tuan': baoCaoTuan,

  'don-cuoi-ngay': async (env, bayGio) => {
    const homNay = ngayVN(bayGio);
    const mai = congNgay(homNay, 1);
    let so = 0;
    for (const tc of await cacToChuc(env)) {
      if (!(await docLuong(env, tc.id)).bat['don-cuoi-ngay']) continue;
      const kq = await env.CSDL.prepare(
        `UPDATE viec SET han_ngay = ?1, cap_nhat_luc = ?2 WHERE to_chuc_id = ?4 AND trang_thai = 'mo' AND han_ngay IS NOT NULL AND han_ngay <= ?3`,
      ).bind(mai, bayGio, homNay, tc.id).run();
      so += kq.meta.changes || 0;
    }
    return { so_muc: so, ghi_chu: so ? `Dời ${so} việc sang ${mai}` : 'Không có việc nào phải dời' };
  },

  'sao-luu': async (env, bayGio) => {
    let soToChuc = 0;
    for (const tc of await cacToChuc(env)) {
      if (!(await docLuong(env, tc.id)).bat['sao-luu']) continue;
      const [viec, tin, tep, caiDat, ghiNho] = await env.CSDL.batch([
        env.CSDL.prepare('SELECT * FROM viec WHERE to_chuc_id = ?1').bind(tc.id),
        env.CSDL.prepare('SELECT * FROM tin_nhan WHERE to_chuc_id = ?1 AND thoi_diem >= ?2').bind(tc.id, new Date(Date.now() - 90 * 86400000).toISOString()),
        env.CSDL.prepare('SELECT * FROM tep WHERE to_chuc_id = ?1').bind(tc.id),
        env.CSDL.prepare(`SELECT khoa, gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa NOT LIKE '%ma_noi%' AND khoa NOT LIKE 'tich_hop%' AND khoa <> 'google_state'`).bind(tc.id),
        env.CSDL.prepare('SELECT * FROM ghi_nho WHERE to_chuc_id = ?1').bind(tc.id),
      ]);
      const banSao = { to_chuc: tc, luc: bayGio, viec: viec.results, tin_nhan: tin.results, tep: tep.results, cai_dat: caiDat.results, ghi_nho: ghiNho.results };
      await env.TEP.put(`sao-luu/${tc.id}/${ngayVN(bayGio)}.json`, JSON.stringify(banSao), {
        httpMetadata: { contentType: 'application/json' },
      });
      soToChuc++;
    }
    return { so_muc: soToChuc, ghi_chu: cat(`Sao lưu ${soToChuc} tổ chức vào kho tệp`, 200) };
  },
};

// Tác vụ lỗi thì nhắn Telegram, mỗi tác vụ nhiều nhất một lần trong 6 giờ để khỏi dồn tin.
export async function baoLoiTacVu(env, tv, bayGio, thongBao) {
  const khoa = `loi_bao_${tv.ma}`;
  const truoc = await docCaiDat(env, '', khoa);
  if (truoc && Date.parse(bayGio) - Date.parse(truoc) < 6 * 3600000) return;
  await ghiCaiDat(env, '', khoa, bayGio);
  for (const tc of await cacToChuc(env)) {
    await baoToChuc(env, tc.id, `Tác vụ "${tv.ten}" bị lỗi lúc ${gioDayDuVN(bayGio)}.\nLỗi: ${String(thongBao).slice(0, 300)}`).catch(() => {});
  }
}
