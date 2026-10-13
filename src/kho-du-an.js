// Kho Drive theo dự án: mỗi dự án bật lên có một thư mục "Sonicplan kho/Dự án/<tên>" gồm Thu, Zalo, Tep, Claude, Lich, LichSu
// và tệp Tong-quan.md. Thư thật, tin Zalo, tệp đính kèm, kết quả Claude, lịch và lịch sử dự án cùng về một chỗ.
// Chỉ ghi thêm hoặc ghi đè đúng tệp do mình tạo, không xóa gì trên Drive. Quyền drive.file nên không ghi vào thư mục người dùng tự dán.

import { goiGoogle, taoThuMuc } from './google.js';
import { goiNgoai } from './goi-ngoai.js';
import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { cat } from './tien-ich.js';

const LECH_VN_MS = 7 * 3600000;
const TEN_CON = ['Thu', 'Zalo', 'Tep', 'Claude', 'Lich', 'LichSu'];
const TOI_DA_GHI = 12; // số tệp chữ ghi mỗi lượt cho một dự án
const TOI_DA_TEP = 6; // số tệp đính kèm tải lên mỗi lượt
const KHOA_NHO = 'kho_du_an_thu_muc';
const ngayVN = (iso) => new Date(Date.parse(iso) + LECH_VN_MS).toISOString().slice(0, 10);
const gioVN = (iso) => new Date(Date.parse(iso) + LECH_VN_MS).toISOString().slice(11, 16);
const tenSach = (s) => String(s || 'Du an').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'Du an';
export const linkThuMuc = (id) => `https://drive.google.com/drive/folders/${id}`;

// ---- Phần thuần (kiểm thử được) ----

const NHAN_SK = { tao: 'Thêm việc', tien_do: 'Tiến độ', xong: 'Xong việc', mo_lai: 'Mở lại việc', huy: 'Hủy việc', doi_du_an: 'Đổi dự án' };

export function vanBanTongQuan(duAn, viec) {
  const dong = [`# ${duAn.ten}`, '', 'Lưu tự động từ Sonicplan.', ''];
  const tk = (() => { try { return JSON.parse(duAn.tu_khoa || '[]'); } catch { return []; } })();
  if (tk.length) dong.push(`Từ khóa: ${tk.join(', ')}`, '');
  for (const [ma, nhan] of [['mo', 'Đang mở'], ['xong', 'Đã xong'], ['huy', 'Đã hủy']]) {
    const m = viec.filter((v) => v.trang_thai === ma);
    if (!m.length) continue;
    dong.push(`## ${nhan} (${m.length})`, '');
    for (const v of m) dong.push(`- ${v.tieu_de}${v.han_ngay ? ` - hạn ${v.han_ngay}${v.gio_hen ? ` ${v.gio_hen}` : ''}` : ''}${v.ghi_chu ? `\n  ${String(v.ghi_chu).replace(/\s*\n\s*/g, '\n  ')}` : ''}`);
    dong.push('');
  }
  return dong.join('\n');
}

// Lịch của dự án: các việc có hạn, xếp theo ngày; cùng nội dung Sonicplan đẩy lên Google Lịch.
export function vanBanLich(duAn, viec) {
  const co = viec.filter((v) => v.han_ngay).sort((a, b) => `${a.han_ngay}${a.gio_hen || ''}`.localeCompare(`${b.han_ngay}${b.gio_hen || ''}`));
  const dong = [`# Lịch dự án ${duAn.ten}`, '', 'Việc có hạn, xếp theo ngày. Lưu tự động từ Sonicplan.', ''];
  if (!co.length) dong.push('(chưa có việc nào có hạn)');
  for (const v of co) dong.push(`- ${v.han_ngay}${v.gio_hen ? ` ${v.gio_hen}` : ''}: ${v.tieu_de}${v.trang_thai !== 'mo' ? ` (${v.trang_thai === 'xong' ? 'đã xong' : 'đã hủy'})` : ''}`);
  return dong.join('\n');
}

export function vanBanLichSuNgay(duAn, ngay, suKien) {
  const dong = [`# ${duAn.ten} - ngày ${ngay}`, '', `${suKien.length} sự kiện, giờ Việt Nam. Lưu tự động từ Sonicplan.`, ''];
  for (const e of suKien) {
    dong.push(`- ${gioVN(e.luc)} ${NHAN_SK[e.loai] || e.loai}: ${e.tieu_de || e.noi_dung || ''}${e.noi_dung && e.tieu_de && e.noi_dung !== e.tieu_de ? `\n  ${String(e.noi_dung).replace(/\s*\n\s*/g, '\n  ')}` : ''}`);
  }
  return dong.join('\n');
}

export function vanBanKetQuaClaude(luot) {
  const dong = [`# Claude làm: ${luot.tieu_de || 'việc'}`, '', `Lượt ${luot.id}, cập nhật ${ngayVN(luot.cap_nhat_luc)} ${gioVN(luot.cap_nhat_luc)}. Lưu tự động từ Sonicplan.`, ''];
  if (luot.dan) dong.push('## Yêu cầu', '', cat(luot.dan, 3000), '');
  dong.push('## Kết quả', '', luot.ket_qua ? cat(luot.ket_qua, 12000) : '(chưa có)', '');
  if (luot.pr) dong.push(`PR: ${luot.pr}`);
  if (luot.nhanh) dong.push(`Nhánh: ${luot.nhanh}`);
  return dong.join('\n');
}

// Gom tin theo nguồn và ngày (giờ Việt Nam): { 'gmail|2026-10-13': [tin...] }.
export function gomTinTheoNgay(tins) {
  const m = new Map();
  for (const t of tins) {
    const k = `${t.nguon}|${ngayVN(t.thoi_diem)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return m;
}

// ---- Thư mục ----

async function docNho(env, tc) {
  try { return JSON.parse((await docCaiDat(env, tc, KHOA_NHO)) || '{}'); } catch { return {}; }
}
const ghiNho = (env, tc, nho) => ghiCaiDat(env, tc, KHOA_NHO, JSON.stringify(nho));

// Tạo (hoặc dùng lại) cây thư mục của một dự án. Trả về { goc, Thu, Zalo, Tep, Claude, Lich, LichSu }.
async function cayThuMuc(env, tc, token, dc, duAn) {
  const nho = await docNho(env, tc);
  if (!nho.du_an) nho.du_an = await taoThuMuc(token, 'Dự án', await dc.thuMucGocKho(token));
  const cay = nho[duAn.id] || {};
  if (!cay.goc) cay.goc = duAn.drive_kho_id || (await taoThuMuc(token, tenSach(duAn.ten), nho.du_an));
  for (const ten of TEN_CON) if (!cay[ten]) cay[ten] = await taoThuMuc(token, ten, cay.goc);
  nho[duAn.id] = cay;
  await ghiNho(env, tc, nho);
  return cay;
}

export async function batDriveKho(env, tc, token, dc, duAnId) {
  const d = await env.CSDL.prepare('SELECT id, ten, drive_link, drive_kho_id FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(duAnId, tc).first();
  if (!d) return { loi: 'Không tìm thấy dự án.', ma: 404 };
  const cay = await cayThuMuc(env, tc, token, dc, d);
  const link = linkThuMuc(cay.goc);
  await env.CSDL.prepare('UPDATE du_an SET drive_kho_id = ?1, drive_link = COALESCE(drive_link, ?2) WHERE id = ?3 AND to_chuc_id = ?4').bind(cay.goc, link, duAnId, tc).run();
  return { drive_kho_id: cay.goc, link };
}

export async function tatDriveKho(env, tc, duAnId) {
  const kq = await env.CSDL.prepare('UPDATE du_an SET drive_kho_id = NULL WHERE id = ?1 AND to_chuc_id = ?2').bind(duAnId, tc).run();
  return kq.meta.changes ? {} : { loi: 'Không tìm thấy dự án.', ma: 404 };
}

// Quên mọi dấu đã lưu của dự án để lượt sau lưu lại toàn bộ (thư mục vẫn dùng lại).
export async function datLaiDuAn(env, tc, duAnId) {
  await env.CSDL.prepare(`DELETE FROM kho_da_luu WHERE to_chuc_id = ?1 AND loai LIKE ?2 ESCAPE '\\'`).bind(tc, `da${duAnId}\\_%`).run();
}

// ---- Ghi lên Drive ----

async function luuChu(env, tc, token, dc, { loai, ma, ten, thuMuc, noiDung }) {
  const moc = await dc.dauVan(noiDung);
  const cu = await env.CSDL.prepare('SELECT drive_id, moc FROM kho_da_luu WHERE to_chuc_id = ?1 AND loai = ?2 AND ma = ?3').bind(tc, loai, ma).first();
  if (cu?.drive_id && cu.moc === moc) return false;
  const chu = new TextEncoder().encode(noiDung);
  let id = cu?.drive_id || null;
  if (id) {
    const ph = await goiNgoai(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id`, {
      method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'text/markdown; charset=UTF-8' }, body: chu,
    }, { hetGioMs: 30000 });
    if (ph.status === 404) id = null;
    else if (!ph.ok) throw new Error(`drive ${ph.status}`);
  }
  if (!id) id = await dc.taoTepDrive(token, ten, thuMuc, chu, 'text/markdown');
  await dc.ghiNhoDaLuu(env, tc, loai, ma, id, moc);
  return true;
}

const SQL_TIN = `(SELECT tin_nhan_id FROM viec WHERE to_chuc_id = ?1 AND du_an_id = ?2 AND tin_nhan_id IS NOT NULL
                  UNION SELECT tin_nhan_id FROM tep WHERE to_chuc_id = ?1 AND du_an_id = ?2 AND tin_nhan_id IS NOT NULL)`;

// Dấu thay đổi của dự án: một truy vấn gộp, giống dấu lần trước thì bỏ qua cả dự án.
async function dauDuAn(env, tc, id) {
  const r = await env.CSDL.prepare(
    `SELECT
       (SELECT COUNT(*) || ':' || COALESCE(MAX(cap_nhat_luc), '') FROM viec WHERE to_chuc_id = ?1 AND du_an_id = ?2) AS v,
       (SELECT COUNT(*) || ':' || COALESCE(MAX(id), 0) FROM tin_nhan WHERE an = 0 AND id IN ${SQL_TIN}) AS t,
       (SELECT COUNT(*) || ':' || COALESCE(MAX(id), 0) FROM tep WHERE to_chuc_id = ?1 AND du_an_id = ?2) AS f,
       (SELECT COUNT(*) || ':' || COALESCE(MAX(cap_nhat_luc), '') FROM luot_claude WHERE to_chuc_id = ?1 AND trang_thai = 'xong' AND viec_id IN (SELECT id FROM viec WHERE to_chuc_id = ?1 AND du_an_id = ?2)) AS c,
       (SELECT COUNT(*) || ':' || COALESCE(MAX(id), 0) FROM viec_su_kien WHERE to_chuc_id = ?1 AND du_an_id = ?2) AS s`,
  ).bind(tc, id).first();
  return `${r.v}|${r.t}|${r.f}|${r.c}|${r.s}`;
}

// Lưu một dự án; trả về số mục mới ghi. Chưa xong hết (còn tệp chờ) thì không ghi dấu, lượt sau làm tiếp.
export async function dongBoMotDuAn(env, tc, token, dc, duAn) {
  const dau = await dauDuAn(env, tc, duAn.id);
  const daDau = await env.CSDL.prepare('SELECT moc FROM kho_da_luu WHERE to_chuc_id = ?1 AND loai = ?2 AND ma = ?3').bind(tc, `da${duAn.id}_dau`, 'dau').first();
  if (daDau?.moc === dau) return 0;
  const cay = await cayThuMuc(env, tc, token, dc, duAn);
  let ghi = 0;
  let conDo = false;
  const luu = async (cauHinh) => {
    if (ghi >= TOI_DA_GHI) { conDo = true; return; }
    if (await luuChu(env, tc, token, dc, cauHinh)) ghi++;
  };

  const viec = (await env.CSDL.prepare('SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen, trang_thai FROM viec WHERE to_chuc_id = ?1 AND du_an_id = ?2 ORDER BY han_ngay IS NULL, han_ngay, id').bind(tc, duAn.id).all()).results;
  await luu({ loai: `da${duAn.id}_tq`, ma: 'tong-quan', ten: 'Tong-quan.md', thuMuc: cay.goc, noiDung: vanBanTongQuan(duAn, viec) });
  await luu({ loai: `da${duAn.id}_lich`, ma: 'lich', ten: 'Lich.md', thuMuc: cay.Lich, noiDung: vanBanLich(duAn, viec) });

  const tins = (await env.CSDL.prepare(
    `SELECT nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem FROM tin_nhan WHERE an = 0 AND id IN ${SQL_TIN} ORDER BY thoi_diem, id LIMIT 600`,
  ).bind(tc, duAn.id).all()).results;
  for (const [k, ds] of gomTinTheoNgay(tins)) {
    const [nguon, ngay] = k.split('|');
    await luu({ loai: `da${duAn.id}_tin`, ma: k, ten: `${ngay}_${nguon === 'gmail' ? 'Thu' : 'Zalo'}.md`, thuMuc: nguon === 'gmail' ? cay.Thu : cay.Zalo, noiDung: dc.vanBanTinNgay(nguon, ngay, ds) });
  }

  const luot = (await env.CSDL.prepare(
    `SELECT l.id, l.dan, l.ket_qua, l.pr, l.nhanh, l.cap_nhat_luc, v.tieu_de FROM luot_claude l JOIN viec v ON v.id = l.viec_id
     WHERE l.to_chuc_id = ?1 AND l.trang_thai = 'xong' AND v.du_an_id = ?2 ORDER BY l.id DESC LIMIT 40`,
  ).bind(tc, duAn.id).all()).results;
  for (const l of luot) await luu({ loai: `da${duAn.id}_claude`, ma: String(l.id), ten: `${ngayVN(l.cap_nhat_luc)}_Claude_${l.id}.md`, thuMuc: cay.Claude, noiDung: vanBanKetQuaClaude(l) });

  const sk = (await env.CSDL.prepare(
    `SELECT e.loai, e.noi_dung, e.luc, v.tieu_de FROM viec_su_kien e LEFT JOIN viec v ON v.id = e.viec_id
     WHERE e.to_chuc_id = ?1 AND e.du_an_id = ?2 ORDER BY e.luc LIMIT 800`,
  ).bind(tc, duAn.id).all()).results;
  const theoNgay = new Map();
  for (const e of sk) { const n = ngayVN(e.luc); if (!theoNgay.has(n)) theoNgay.set(n, []); theoNgay.get(n).push(e); }
  for (const [ngay, ds] of theoNgay) await luu({ loai: `da${duAn.id}_ls`, ma: ngay, ten: `${ngay}.md`, thuMuc: cay.LichSu, noiDung: vanBanLichSuNgay(duAn, ngay, ds) });

  // Tệp đính kèm của dự án: chép một bản vào thư mục Tep, đã chép rồi thì bỏ qua.
  if (env.TEP) {
    const teps = (await env.CSDL.prepare(
      `SELECT t.id, t.ten, t.loai, t.r2_khoa, k.drive_id FROM tep t LEFT JOIN kho_da_luu k ON k.to_chuc_id = t.to_chuc_id AND k.loai = ?3 AND k.ma = CAST(t.id AS TEXT)
       WHERE t.to_chuc_id = ?1 AND t.du_an_id = ?2 AND t.r2_khoa IS NOT NULL AND k.drive_id IS NULL ORDER BY t.id DESC LIMIT 40`,
    ).bind(tc, duAn.id, `da${duAn.id}_tep`).all()).results;
    let len = 0;
    for (const t of teps) {
      if (len >= TOI_DA_TEP) { conDo = true; break; }
      const vat = await env.TEP.get(t.r2_khoa);
      if (!vat) { await dc.ghiNhoDaLuu(env, tc, `da${duAn.id}_tep`, String(t.id), '', 'mat'); continue; }
      const id = await dc.taoTepDrive(token, t.ten, cay.Tep, await vat.arrayBuffer(), t.loai);
      await dc.ghiNhoDaLuu(env, tc, `da${duAn.id}_tep`, String(t.id), id, 'da-chep');
      len++; ghi++;
    }
  }

  if (!conDo) await dc.ghiNhoDaLuu(env, tc, `da${duAn.id}_dau`, 'dau', '', dau);
  return ghi;
}

// Lượt định kỳ: mọi dự án đã bật. Lỗi một dự án không chặn dự án khác.
export async function dongBoDuAn(env, tc, token, dc) {
  const ds = (await env.CSDL.prepare('SELECT id, ten, tu_khoa, drive_link, drive_kho_id FROM du_an WHERE to_chuc_id = ?1 AND drive_kho_id IS NOT NULL').bind(tc).all()).results;
  let tong = 0;
  const loi = [];
  for (const d of ds) {
    try { tong += await dongBoMotDuAn(env, tc, token, dc, d); } catch (e) {
      loi.push(`${d.ten}: ${String(e.message).slice(0, 80)}`);
      if (e.trangThai === 404) { await datLaiDuAn(env, tc, d.id); const nho = await docNho(env, tc); delete nho[d.id]; await ghiNho(env, tc, nho); }
    }
  }
  return { so: tong, loi };
}
