// Tổng hợp một lần: gom hồ sơ, ghi nhớ, việc, tin gần đây đưa AI viết bản tổng hợp, lưu bản cuối để xem lại.

import { tongHopAi } from './ai.js';
import { chonGhiNho, docHoSo } from './ghi-nho.js';
import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { docTichHop } from './tich-hop.js';
import { ngayVN } from './tien-ich.js';

const CAT = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function docTongHopCuoi(env, tc) {
  try { return JSON.parse((await docCaiDat(env, tc, 'tong_hop_cuoi')) || 'null'); } catch { return null; }
}

export async function tongHopChoToChuc(env, tc, bayGio = new Date().toISOString()) {
  const cu = await docTongHopCuoi(env, tc);
  if (cu && Date.parse(bayGio) - Date.parse(cu.luc) < 20000) return { ...cu, tu_bo_nho: true };
  const homNay = ngayVN(bayGio);
  const tuan = new Date(Date.parse(bayGio) - 7 * 86400000).toISOString();
  const hai48 = new Date(Date.parse(bayGio) - 48 * 3600000).toISOString();
  const [mo, xong, tin, nho] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT tieu_de, han_ngay, gio_hen, uu_tien, nhom, substr(ghi_chu, 1, 200) AS ghi_chu FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' ORDER BY han_ngay IS NULL, han_ngay, gio_hen LIMIT 60`).bind(tc),
    env.CSDL.prepare(`SELECT tieu_de FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'xong' AND xong_luc >= ?2 ORDER BY xong_luc DESC LIMIT 15`).bind(tc, tuan),
    env.CSDL.prepare(`SELECT nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem FROM tin_nhan WHERE to_chuc_id = ?1 AND an = 0 AND tao_luc >= ?2 ORDER BY id DESC LIMIT 40`).bind(tc, hai48),
    env.CSDL.prepare('SELECT loai, tieu_de, noi_dung, ghim FROM ghi_nho WHERE to_chuc_id = ?1 ORDER BY ghim DESC, cap_nhat_luc DESC LIMIT 300').bind(tc),
  ]);
  const viecMo = mo.results.map((v) => ({ ...v, ghi_chu: CAT(v.ghi_chu, 160) || undefined }));
  const du = {
    homNay,
    viecMo,
    viecQuaHan: viecMo.filter((v) => v.han_ngay && v.han_ngay < homNay).map((v) => v.tieu_de),
    viecXongTuan: xong.results.map((v) => v.tieu_de),
    tin: tin.results.reverse().map((t) => ({ nguon: t.nguon, tu: t.nguoi_gui, nhom: t.nhom || undefined, luc: t.thoi_diem, noi_dung: CAT(`${t.tieu_de ? `${t.tieu_de}: ` : ''}${t.noi_dung}`, 350) })),
    ghiNho: chonGhiNho(nho.results, `${viecMo.map((v) => v.tieu_de).join(' ')} ${tin.results.map((t) => `${t.nguoi_gui} ${t.nhom || ''}`).join(' ')}`),
  };
  if (!du.viecMo.length && !du.tin.length) return { luc: bayGio, noi_dung: 'Chưa có việc đang mở hay tin gần đây để tổng hợp.', trong: true };
  const noiDung = await tongHopAi(env, du, { ngoai: await docTichHop(env, tc, 'ai'), hoSo: await docHoSo(env, tc) });
  if (!noiDung) throw new Error('AI không trả nội dung, thử lại sau.');
  const ket = { luc: bayGio, noi_dung: noiDung };
  await ghiCaiDat(env, tc, 'tong_hop_cuoi', JSON.stringify(ket));
  return ket;
}
