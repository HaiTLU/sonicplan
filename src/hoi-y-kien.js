// Ô hỏi ý kiến: khi AI chưa chắc một chi tiết của việc (giờ, hạn, người, dự án, loại việc, có phải việc không) thì
// gửi một tin Telegram kèm nút bấm cho người dùng. Câu trả lời sửa luôn việc và được ghi nhớ để AI rút kinh nghiệm:
// lần sửa vào lịch sử việc (cùng chỗ với PR #110, tuần sau AI đề xuất lời dặn từ đó) và một dòng trong Ghi nhớ.
// Không gọi thêm AI: AI báo "chua_chac" ngay trong lượt tách việc vẫn chạy.

import { NHOM_THEO_SO } from './ai.js';
import { ghiSuKien } from './du-an.js';
import { nhayCam } from './ghi-nho.js';
import { docNgayGio, ngayChoGio } from './ngay-viet.js';
import { cat, chuanHoa } from './tien-ich.js';

export const TOI_DA_MOI_LUOT = 3; // ô hỏi tối đa cho một lượt tách việc
export const TOI_DA_DANG_CHO = 8; // chưa trả lời quá số này thì không hỏi thêm
const HET_HAN_NGAY = 3;

export const TEN_LOAI = { gio: 'giờ hẹn', han: 'hạn', nguoi: 'tên người', du_an: 'dự án', nhom: 'loại việc', viec: 'có phải việc không', them: 'có thêm việc không' };
const CO_DINH = { viec: ['Đúng là việc', 'Không phải việc'], nhom: ['Claude tự làm', 'Claude chuẩn bị', 'Tôi tự làm'], them: ['Thêm', 'Không'] };
const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;
const NGAY = /^\d{4}-\d{2}-\d{2}$/;

const ddmm = (n) => `${n.slice(8, 10)}/${n.slice(5, 7)}`;
export const nhanLuaChon = (loai, v) => (loai === 'han' && NGAY.test(v) ? ddmm(v) : v);

// Lựa chọn hiện trên nút. Giờ, hạn, dự án phải đúng dạng; viec và nhom do code đặt sẵn nên AI không bịa được.
export function chonLuaChon(chuaChac, tenDuAn = []) {
  const { loai, lua_chon: ds = [] } = chuaChac;
  if (CO_DINH[loai]) return CO_DINH[loai];
  if (loai === 'gio') return ds.filter((x) => GIO.test(x));
  if (loai === 'han') return ds.filter((x) => NGAY.test(x));
  if (loai === 'du_an') return ds.map((x) => tenDuAn.find((t) => chuanHoa(t) === chuanHoa(x))).filter(Boolean);
  return ds;
}

// Ghi một ô hỏi mới (chờ gửi). Trả id, hoặc null nếu đã hỏi việc này, đang chờ quá nhiều, hoặc câu hỏi không hợp lệ.
export async function taoCauHoi(env, tc, { viecId, chuaChac, tenDuAn = [], boiCanh = '', tinTrich = '' }, bayGio = new Date().toISOString()) {
  if (!chuaChac?.cau_hoi || !TEN_LOAI[chuaChac.loai]) return null;
  if (chuaChac.loai === 'them') return null; // ô thêm việc đi đường taoCauHoiThem
  const luaChon = chonLuaChon(chuaChac, tenDuAn);
  if (['gio', 'han', 'du_an'].includes(chuaChac.loai) && !luaChon.length) return null;
  if (!(await conCho(env, tc, bayGio))) return null;
  const trung = await env.CSDL.prepare('SELECT 1 AS x FROM cau_hoi_ai WHERE to_chuc_id = ?1 AND viec_id = ?2 AND loai = ?3').bind(tc, viecId, chuaChac.loai).first();
  if (trung) return null;
  const dong = await env.CSDL.prepare(
    `INSERT INTO cau_hoi_ai (to_chuc_id, viec_id, loai, cau_hoi, lua_chon, boi_canh, tin_trich, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id`,
  ).bind(tc, viecId, chuaChac.loai, cat(chuaChac.cau_hoi, 200), JSON.stringify(luaChon), cat(boiCanh, 80), cat(String(tinTrich || '').replace(/\s+/g, ' '), 200), bayGio).first();
  return dong.id;
}

// Dọn ô quá hạn rồi cho biết còn được hỏi thêm không (chưa trả lời quá TOI_DA_DANG_CHO thì thôi).
async function conCho(env, tc, bayGio) {
  await env.CSDL.prepare(`UPDATE cau_hoi_ai SET trang_thai = 'het_han' WHERE to_chuc_id = ?1 AND trang_thai = 'cho' AND tao_luc < ?2`)
    .bind(tc, new Date(Date.parse(bayGio) - HET_HAN_NGAY * 86400000).toISOString()).run();
  await env.CSDL.prepare(`UPDATE cau_hoi_ai SET trang_thai = 'bo' WHERE to_chuc_id = ?1 AND trang_thai = 'moi' AND tao_luc < ?2`)
    .bind(tc, new Date(Date.parse(bayGio) - 86400000).toISOString()).run();
  const dang = await env.CSDL.prepare(`SELECT COUNT(*) AS n FROM cau_hoi_ai WHERE to_chuc_id = ?1 AND trang_thai IN ('moi', 'cho')`).bind(tc).first();
  return (dang?.n || 0) < TOI_DA_DANG_CHO;
}

// Ô "Có thêm việc này không?": AI phân vân một tin trong hộp tin. Chưa tạo việc; đề xuất giữ trong de_xuat tới khi bấm Thêm.
// Mỗi tin chỉ hỏi một lần, kể cả khi đã trả lời hay bỏ qua. Trả id, hoặc null khi không hỏi.
export async function taoCauHoiThem(env, tc, { tinNhanId, deXuat, boiCanh = '', tinTrich = '' }, bayGio = new Date().toISOString()) {
  if (!tinNhanId || !deXuat?.tieu_de) return null;
  if (!(await conCho(env, tc, bayGio))) return null;
  const trung = await env.CSDL.prepare(`SELECT 1 AS x FROM cau_hoi_ai WHERE to_chuc_id = ?1 AND loai = 'them' AND tin_nhan_id = ?2`).bind(tc, tinNhanId).first();
  if (trung) return null;
  const dong = await env.CSDL.prepare(
    `INSERT INTO cau_hoi_ai (to_chuc_id, viec_id, loai, cau_hoi, lua_chon, boi_canh, tin_trich, tao_luc, de_xuat, tin_nhan_id) VALUES (?1, 0, 'them', 'Có thêm việc này không?', ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id`,
  ).bind(tc, JSON.stringify(CO_DINH.them), cat(boiCanh, 80), cat(String(tinTrich || '').replace(/\s+/g, ' '), 200), bayGio, JSON.stringify(deXuat), tinNhanId).first();
  return dong.id;
}

const docDeXuat = (chu) => { try { const d = JSON.parse(chu); return d && typeof d === 'object' ? d : {}; } catch { return {}; } };
const docLuaChon = (chu) => { try { const d = JSON.parse(chu); return Array.isArray(d) ? d : []; } catch { return []; } };

// Các ô hỏi chờ gửi kèm việc liên quan, cũ nhất trước.
export async function docCauHoiMoi(env, tc) {
  const { results } = await env.CSDL.prepare(
    `SELECT c.id, c.loai, c.cau_hoi, c.lua_chon, c.tin_trich, c.de_xuat, v.tieu_de, v.han_ngay, v.gio_hen FROM cau_hoi_ai c LEFT JOIN viec v ON v.id = c.viec_id AND v.to_chuc_id = c.to_chuc_id
     WHERE c.to_chuc_id = ?1 AND c.trang_thai = 'moi' AND (c.loai = 'them' OR v.id IS NOT NULL) ORDER BY c.id LIMIT ?2`,
  ).bind(tc, TOI_DA_MOI_LUOT).all();
  return results.map((r) => {
    if (r.loai !== 'them') return { ...r, lua_chon: docLuaChon(r.lua_chon) };
    const dx = docDeXuat(r.de_xuat);
    return { ...r, lua_chon: docLuaChon(r.lua_chon), tieu_de: dx.tieu_de || '', han_ngay: dx.han_ngay || null, gio_hen: dx.gio_hen || null };
  });
}

export function dungTinHoi(r) {
  const han = [r.gio_hen, r.han_ngay ? ddmm(r.han_ngay) : ''].filter(Boolean).join(' ');
  if (r.loai === 'them') return ['Em phân vân tin này có phải việc không:', r.tin_trich ? `"${r.tin_trich}"` : '', `Nếu thêm: ${r.tieu_de}${han ? ` (${han})` : ''}`, r.cau_hoi, 'Bấm một nút, hoặc nhắn trả lời tin này.'].filter(Boolean).join('\n');
  return [`Em chưa chắc về ${TEN_LOAI[r.loai]}:`, `${r.tieu_de}${han ? ` (${han})` : ''}`, r.cau_hoi, 'Bấm một nút, hoặc nhắn trả lời tin này.'].join('\n');
}

// Dữ liệu nút dạng "h:<id>:<số thứ tự lựa chọn>" hoặc "h:<id>:bo", đủ ngắn so với giới hạn 64 byte của Telegram.
export function nutHoi(r) {
  const hang = r.lua_chon.map((x, i) => ({ text: nhanLuaChon(r.loai, x), callback_data: `h:${r.id}:${i}` }));
  if (r.loai === 'them') return [hang]; // Thêm / Không, không thêm nút Bỏ qua
  return [...(hang.length ? [hang] : []), [{ text: 'Bỏ qua', callback_data: `h:${r.id}:bo` }]];
}

export function phanTichNutHoi(du) {
  const m = String(du || '').match(/^h:(\d+):(\d|bo)$/);
  return m ? { cau_hoi_id: Number(m[1]), chon: m[2] === 'bo' ? 'bo' : Number(m[2]) } : null;
}

export async function danhDauDaGui(env, id, tgTinId) {
  await env.CSDL.prepare(`UPDATE cau_hoi_ai SET trang_thai = 'cho', tg_tin_id = ?2 WHERE id = ?1 AND trang_thai = 'moi'`).bind(id, tgTinId).run();
}

export async function boCauHoi(env, tc, ids) {
  for (const id of ids) await env.CSDL.prepare(`UPDATE cau_hoi_ai SET trang_thai = 'bo' WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai IN ('moi', 'cho')`).bind(id, tc).run();
}

export async function timCauHoiTheoTin(env, tc, tgTinId) {
  const r = await env.CSDL.prepare(`SELECT id FROM cau_hoi_ai WHERE to_chuc_id = ?1 AND tg_tin_id = ?2 AND trang_thai = 'cho'`).bind(tc, tgTinId).first();
  return r?.id ?? null;
}

// Chữ người dùng gõ khớp với một lựa chọn (bỏ dấu, chứa nhau) thì lấy lựa chọn đó.
function khopLuaChon(chu, ds) {
  const c = chuanHoa(chu);
  return c ? ds.find((x) => chuanHoa(x) === c) ?? ds.find((x) => chuanHoa(x).includes(c) || c.includes(chuanHoa(x))) ?? null : null;
}

// Gom các lần trả lời cùng loại, cùng bối cảnh (nhóm Zalo hoặc người gửi) vào một mục Ghi nhớ, giữ 3 lần mới nhất.
async function luuBaiHoc(env, tc, r, tra, khac, bayGio) {
  const dong = r.loai === 'them'
    ? `- Tin kiểu "${cat(r.tin_trich, 80)}" (AI phân vân việc "${cat(docDeXuat(r.de_xuat).tieu_de, 80)}"): anh chọn ${khac ? 'THÊM việc' : 'KHÔNG thêm'}`
    : `- Tin kiểu "${cat(r.tin_trich, 80)}": AI băn khoăn "${cat(r.cau_hoi, 100)}", anh chọn "${cat(tra, 80)}"${khac === false ? ' (đúng như AI đoán)' : ''}`;
  if (nhayCam(dong)) return;
  const tieuDe = cat(`Anh trả lời ô hỏi ${TEN_LOAI[r.loai]}: ${r.boi_canh || 'chung'}`, 120);
  const cu = await env.CSDL.prepare(`SELECT noi_dung FROM ghi_nho WHERE to_chuc_id = ?1 AND loai = 'quyet_dinh' AND tieu_de = ?2`).bind(tc, tieuDe).first();
  const noiDung = [...String(cu?.noi_dung || '').split('\n').filter(Boolean), dong].slice(-3).join('\n').slice(-600);
  await env.CSDL.prepare(
    `INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, nguon, da_duyet, tao_luc, cap_nhat_luc) VALUES (?1, 'quyet_dinh', ?2, ?3, 'tay', 1, ?4, ?4)
     ON CONFLICT (to_chuc_id, loai, tieu_de) DO UPDATE SET noi_dung = excluded.noi_dung, nguon = 'tay', da_duyet = 1, cap_nhat_luc = excluded.cap_nhat_luc`,
  ).bind(tc, tieuDe, noiDung, bayGio).run();
}

// Áp câu trả lời: tra = { chi_so } (bấm nút) hoặc { chu } (nhắn trả lời). Trả { thongbao } khi xong,
// { loi } khi chưa hiểu (ô hỏi vẫn mở), hoặc null khi ô hỏi không còn chờ.
export async function apDungTraLoi(env, tc, id, tra, bayGio = new Date().toISOString()) {
  const r = await env.CSDL.prepare(`SELECT * FROM cau_hoi_ai WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai = 'cho'`).bind(id, tc).first();
  if (!r) return null;
  const luaChon = docLuaChon(r.lua_chon);
  const chu = tra.chu != null ? String(tra.chu).trim().slice(0, 200) : '';
  if (chu && nhayCam(chu)) return { loi: 'Em không lưu mật khẩu, mã xác nhận, số thẻ hay số giấy tờ.' };
  const v = await env.CSDL.prepare('SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen, nhom, du_an_id, trang_thai FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(r.viec_id, tc).first();
  const hieuLuc = v && v.trang_thai === 'mo';
  const chon = tra.chi_so != null ? luaChon[tra.chi_so] : undefined;
  if (tra.chi_so != null && chon === undefined) return null;
  let dapAn = chon ?? chu;
  let khac = null; // true: khác điều AI đã điền, false: đúng như AI đoán, null: không biết
  let thongbao;
  const suKien = (loai, nd) => ghiSuKien(env, tc, r.viec_id, loai, `${nd} | lý do: anh trả lời ô hỏi`).catch(() => {});
  const capNhat = (cot, ...gt) => env.CSDL.prepare(`UPDATE viec SET ${cot}, cap_nhat_luc = ?${gt.length + 3} WHERE id = ?1 AND to_chuc_id = ?2`).bind(r.viec_id, tc, ...gt, bayGio).run();

  if (r.loai === 'gio' || r.loai === 'han') {
    const doc = docNgayGio(dapAn, new Date(bayGio));
    const gio = r.loai === 'gio' ? (GIO.test(dapAn) ? dapAn : doc.gio_hen) : null;
    const han = r.loai === 'han' ? (NGAY.test(dapAn) ? dapAn : doc.han_ngay) : null;
    if (!(gio || han)) return { loi: r.loai === 'gio' ? 'Em chưa hiểu giờ này, anh nhắn dạng 17:30 hoặc 5h30 chiều nhé.' : 'Em chưa hiểu ngày này, anh nhắn dạng 25/10 hoặc "thứ Sáu" nhé.' };
    dapAn = gio || han;
    if (hieuLuc) {
      if (gio) {
        khac = gio !== v.gio_hen;
        if (khac) {
          await capNhat('gio_hen = ?3, han_ngay = COALESCE(han_ngay, ?4), can_dong_bo = 1', gio, ngayChoGio(gio, new Date(bayGio)));
          await suKien('sua_han', `giờ ${v.gio_hen || 'trống'} -> ${gio}`);
        }
      } else {
        khac = han !== v.han_ngay;
        if (khac) {
          await capNhat('han_ngay = ?3, so_lan_doi = 0, can_dong_bo = 1', han);
          await suKien('sua_han', `${v.han_ngay || 'trống'} -> ${han}`);
        }
      }
      if (khac) await env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id = ?1').bind(r.viec_id).run();
    }
    thongbao = khac === false ? 'Đã ghi nhớ, giữ nguyên.' : r.loai === 'gio' ? `Đã đặt giờ ${gio}.` : `Đã đặt hạn ${ddmm(han)}.`;
  } else if (r.loai === 'them') {
    const lc = chon ?? khopLuaChon(chu, CO_DINH.them) ?? (/^(co|ok|dong y|duoc)$/.test(chuanHoa(chu)) ? CO_DINH.them[0] : /^(ko|k)$/.test(chuanHoa(chu)) ? CO_DINH.them[1] : null);
    if (!lc) return { loi: 'Anh bấm Thêm hoặc Không, hoặc nhắn "có" / "không" giúp em nhé.' };
    dapAn = lc;
    khac = lc === CO_DINH.them[0];
    if (khac) {
      const dx = docDeXuat(r.de_xuat);
      const { themViec } = await import('./viec.js'); // viec.js nạp file này nên nạp lúc dùng
      const kq = await themViec(env, tc, dx, { tinNhanId: r.tin_nhan_id, duAnId: dx.du_an_id ?? null, nguon: dx.nguon || null });
      thongbao = kq.trung ? 'Việc này đã có sẵn nên em không thêm lại.' : `Đã thêm việc: ${dx.tieu_de}.`;
    } else {
      thongbao = 'Đã bỏ qua tin này.';
    }
  } else if (r.loai === 'viec') {
    const lc = chon ?? khopLuaChon(chu, CO_DINH.viec);
    if (lc) dapAn = lc;
    khac = lc ? lc === CO_DINH.viec[1] : null;
    if (khac && hieuLuc) {
      await capNhat('trang_thai = ?3', 'huy');
      await suKien('huy', `${v.tieu_de}`);
    }
    thongbao = khac ? 'Đã bỏ việc này.' : 'Đã ghi nhớ.';
  } else if (r.loai === 'nhom') {
    const lc = chon ?? khopLuaChon(chu, CO_DINH.nhom);
    if (lc) dapAn = lc;
    const moi = lc ? NHOM_THEO_SO[CO_DINH.nhom.indexOf(lc) + 1] : null;
    khac = moi ? moi !== v?.nhom : null;
    if (khac && hieuLuc) {
      await capNhat('nhom = ?3', moi);
      await suKien('doi_nhom', `${v.nhom || 'trống'} -> ${moi}`);
    }
    thongbao = khac ? `Đã đổi sang "${dapAn}".` : 'Đã ghi nhớ.';
  } else if (r.loai === 'du_an') {
    const { results: ds } = await env.CSDL.prepare('SELECT id, ten FROM du_an WHERE to_chuc_id = ?1').bind(tc).all();
    const ten = khopLuaChon(dapAn, ds.map((d) => d.ten));
    const da = ds.find((d) => d.ten === ten);
    if (ten) dapAn = ten;
    khac = da ? da.id !== v?.du_an_id : null;
    if (khac && hieuLuc) {
      await capNhat('du_an_id = ?3, can_dong_bo = 1', da.id);
      await suKien('doi_du_an', `Chuyển vào dự án ${da.ten}`);
    }
    thongbao = khac ? `Đã chuyển vào dự án ${dapAn}.` : 'Đã ghi nhớ.';
  } else {
    // nguoi: chỉ ghi vào ghi chú của việc, tên người không có chỗ riêng.
    if (!dapAn) return { loi: 'Anh nhắn tên người giúp em nhé.' };
    if (hieuLuc) {
      await capNhat('ghi_chu = ?3', cat([v.ghi_chu, `Người liên quan (anh xác nhận): ${dapAn}`].filter(Boolean).join('\n'), 4000));
    }
    thongbao = 'Đã ghi vào ghi chú của việc.';
  }
  if (!dapAn) return { loi: 'Anh bấm một nút hoặc nhắn câu trả lời giúp em nhé.' };

  await env.CSDL.prepare(`UPDATE cau_hoi_ai SET trang_thai = 'xong', tra_loi = ?2, tra_loi_luc = ?3 WHERE id = ?1`).bind(id, dapAn, bayGio).run();
  await luuBaiHoc(env, tc, r, nhanLuaChon(r.loai, dapAn), khac, bayGio).catch((e) => console.error('Lưu bài học từ ô hỏi lỗi', e));
  return { thongbao: `${thongbao} Em ghi nhớ để lần sau hỏi ít hơn.` };
}
