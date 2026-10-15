// API giao diện: Việc cần làm và việc giao cho Claude.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { chayAi } from '../ai.js';
import { danhGiaLuot, dsLuot, giaoClaude, hoiTruoc } from '../claude-code.js';
import { ghiSuKien } from '../du-an.js';
import { docHoSo } from '../ghi-nho.js';
import { chuanMau } from '../mau.js';
import { docTichHop } from '../tich-hop.js';
import { cat, json, loi, ngayVN } from '../tien-ich.js';
import { themViec } from '../viec.js';
import { laChu } from './chung.js';

const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

// ---- Việc ----

async function dsViec(env, tc, url) {
  const trangThai = url.searchParams.get('trang_thai') === 'xong' ? 'xong' : 'mo';
  const thuTu = trangThai === 'xong' ? 'xong_luc DESC' : 'sao DESC, han_ngay IS NULL, han_ngay, thu_tu IS NULL, thu_tu, gio_hen IS NULL, gio_hen, id DESC';
  const { results } = await env.CSDL.prepare(
    `SELECT v.id, v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.trang_thai, v.tin_nhan_id, v.tao_luc, v.xong_luc,
       t.nguon AS tin_nguon, t.nguoi_gui AS tin_nguoi_gui, t.nhom AS tin_nhom,
       v.du_an_id, v.nguon, v.mau, v.sao, v.do_nang, v.han_goc, v.so_lan_doi, d.ten AS du_an_ten, d.mau AS du_an_mau, d.icon AS du_an_icon, d.anh_khoa AS du_an_anh,
       (SELECT CASE WHEN l.trang_thai = 'xong' AND l.cau_hoi IS NOT NULL AND l.danh_gia IS NULL THEN 'hoi' ELSE l.trang_thai END FROM luot_claude l WHERE l.to_chuc_id = v.to_chuc_id AND l.viec_id = v.id ORDER BY l.id DESC LIMIT 1) AS claude_trang_thai
     FROM viec v LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id LEFT JOIN du_an d ON d.id = v.du_an_id
     WHERE v.to_chuc_id = ?1 AND v.trang_thai = ?2 ORDER BY ${thuTu.replace(/\b(xong_luc|han_ngay|gio_hen|thu_tu|sao|id)\b/g, 'v.$1')} LIMIT 300`,
  ).bind(tc, trangThai).all();
  return { viec: results, hom_nay: ngayVN() };
}

export function kiemViec(than, { batBuocTieuDe }) {
  const ra = {};
  if ('tieu_de' in than || batBuocTieuDe) {
    const t = String(than.tieu_de || '').trim();
    if (!t) return { loi: 'Nhập tên việc.' };
    if (t.length > 200) return { loi: 'Tên việc dài quá 200 ký tự.' };
    ra.tieu_de = t;
  }
  if ('ghi_chu' in than) ra.ghi_chu = cat(String(than.ghi_chu || '').trim(), 2000) || null;
  if ('han_ngay' in than) {
    if (than.han_ngay && !NGAY.test(than.han_ngay)) return { loi: 'Ngày hạn sai dạng.' };
    ra.han_ngay = than.han_ngay || null;
  }
  if ('gio_hen' in than) {
    if (than.gio_hen && !GIO.test(than.gio_hen)) return { loi: 'Giờ hẹn sai dạng, ví dụ 14:30.' };
    ra.gio_hen = than.gio_hen || null;
  }
  if ('trang_thai' in than) {
    if (!['mo', 'xong', 'huy'].includes(than.trang_thai)) return { loi: 'Trạng thái không hợp lệ.' };
    ra.trang_thai = than.trang_thai;
  }
  if ('du_an_id' in than) {
    const d = than.du_an_id;
    if (d !== null && d !== '' && !Number.isInteger(Number(d))) return { loi: 'Dự án không hợp lệ.' };
    ra.du_an_id = d === null || d === '' ? null : Number(d);
  }
  if ('mau' in than) {
    const m = chuanMau(than.mau);
    if (m === undefined) return { loi: 'Màu không hợp lệ.' };
    ra.mau = m;
  }
  if ('sao' in than) ra.sao = than.sao ? 1 : 0;
  if ('nhom' in than) {
    if (than.nhom !== null && !['claude_tu_lam', 'claude_chuan_bi', 'anh_tu_lam'].includes(than.nhom)) return { loi: 'Nhóm việc không hợp lệ.' };
    ra.nhom = than.nhom;
  }
  return { viec: ra };
}

async function taoViec(env, tc, than) {
  const k = kiemViec(than, { batBuocTieuDe: true });
  if (k.loi) return loi(400, k.loi);
  const kq = await themViec(env, tc, k.viec, { boQuaTrung: true, duAnId: k.viec.du_an_id ?? null, nguon: 'tay' });
  if (k.viec.mau && kq.id) await env.CSDL.prepare('UPDATE viec SET mau = ?1 WHERE id = ?2 AND to_chuc_id = ?3').bind(k.viec.mau, kq.id, tc).run();
  return json({ id: kq.id }, 201);
}

// Lưu thứ tự tay của các thẻ trong một cột: ids theo thứ tự từ trên xuống.
export async function sapXepViec(env, tc, than) {
  const ids = Array.isArray(than.ids) ? than.ids.map(Number) : [];
  if (!ids.length || ids.length > 150 || ids.some((x) => !Number.isInteger(x) || x <= 0)) return loi(400, 'Danh sách việc không hợp lệ.');
  const cau = ids.map((id, i) => env.CSDL.prepare("UPDATE viec SET thu_tu = ?1 WHERE id = ?2 AND to_chuc_id = ?3 AND trang_thai = 'mo'").bind(i + 1, id, tc));
  if (env.CSDL.batch) await env.CSDL.batch(cau);
  else for (const c of cau) await c.run();
  return json({ ok: true });
}

async function suaViec(env, tc, id, than) {
  const k = kiemViec(than, { batBuocTieuDe: false });
  if (k.loi) return loi(400, k.loi);
  const cot = Object.keys(k.viec);
  if (!cot.length) return loi(400, 'Không có gì để sửa.');
  if (k.viec.du_an_id != null && !(await env.CSDL.prepare('SELECT 1 AS x FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(k.viec.du_an_id, tc).first())) return loi(400, 'Dự án không tồn tại.');
  const truoc = k.viec.trang_thai || 'du_an_id' in k.viec ? await env.CSDL.prepare('SELECT trang_thai, du_an_id, tieu_de FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first() : null;
  const bayGio = new Date().toISOString();
  const gan = cot.map((c, i) => `${c} = ?${i + 3}`);
  // Đổi tên, hạn hoặc giờ thì báo cho lượt đồng bộ cập nhật Google Tasks và Lịch.
  if (['tieu_de', 'han_ngay', 'gio_hen', 'ghi_chu', 'mau', 'du_an_id'].some((c) => c in k.viec)) gan.push('can_dong_bo = 1');
  // Người dùng tự đặt hạn mới: bỏ đếm số lần tự dời.
  if ('han_ngay' in k.viec) gan.push('so_lan_doi = 0');
  const giaTri = cot.map((c) => k.viec[c]);
  if (k.viec.trang_thai) gan.push(`xong_luc = ${k.viec.trang_thai === 'xong' ? `?${cot.length + 3}` : 'NULL'}`);
  const kq = await env.CSDL.prepare(
    `UPDATE viec SET ${gan.join(', ')}, cap_nhat_luc = ?${cot.length + 3} WHERE id = ?1 AND to_chuc_id = ?2`,
  ).bind(id, tc, ...giaTri, bayGio).run();
  if (!kq.meta.changes) return loi(404, 'Không tìm thấy việc này.');
  if (truoc) {
    if (k.viec.trang_thai && k.viec.trang_thai !== truoc.trang_thai) {
      const loaiSk = k.viec.trang_thai === 'xong' ? 'xong' : k.viec.trang_thai === 'mo' ? 'mo_lai' : 'huy';
      await ghiSuKien(env, tc, id, loaiSk, truoc.tieu_de).catch(() => {});
    }
    if ('du_an_id' in k.viec && k.viec.du_an_id !== truoc.du_an_id) {
      const ten = k.viec.du_an_id ? (await env.CSDL.prepare('SELECT ten FROM du_an WHERE id = ?1').bind(k.viec.du_an_id).first())?.ten : null;
      await ghiSuKien(env, tc, id, 'doi_du_an', ten ? `Chuyển vào dự án ${ten}` : 'Gỡ khỏi dự án').catch(() => {});
    }
  }
  // Đổi hạn hoặc giờ thì cho phép nhắc lại theo mốc mới.
  if ('han_ngay' in k.viec || 'gio_hen' in k.viec) await env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id = ?1').bind(id).run();
  return json({ ok: true });
}

export async function xuLyViec(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/viec' && m === 'GET') return json(await dsViec(env, tc, url));
  if (p === '/api/viec/sap-xep' && m === 'POST') return sapXepViec(env, tc, await yeuCau.json().catch(() => ({})));
  if (p === '/api/viec' && m === 'POST') return taoViec(env, tc, await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/viec\/(\d+)\/claude$/)) && m === 'GET') return json({ luot: await dsLuot(env, tc, Number(khop[1])), da_noi: Boolean(await docTichHop(env, tc, 'github')) });
  if (((khop = p.match(/^\/api\/viec\/(\d+)\/claude$/)) || p === '/api/claude/giao') && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức giao việc cho Claude được.');
    const b = await yeuCau.json().catch(() => ({}));
    const r = await giaoClaude(env, tc, khop ? [Number(khop[1])] : b.viec_ids, { dan: b.dan, traLoi: b.tra_loi, cach: b.cach, tiepLuot: b.tiep_luot }, url.origin);
    return r.loi ? loi(r.ma, r.loi) : json(r, 201);
  }
  if (p === '/api/claude/hoi-truoc' && m === 'POST') {
    const b = await yeuCau.json().catch(() => ({}));
    const r = await hoiTruoc(env, tc, b.viec_ids, chayAi, { ngoai: await docTichHop(env, tc, 'ai'), hoSo: await docHoSo(env, tc) });
    return r.loi ? loi(r.ma, r.loi) : json(r);
  }
  if ((khop = p.match(/^\/api\/claude\/(\d+)\/danh-gia$/)) && m === 'POST') {
    const r = await danhGiaLuot(env, tc, Number(khop[1]), (await yeuCau.json().catch(() => ({}))).danh_gia);
    return r.loi ? loi(r.ma, r.loi) : json(r);
  }
  // Một việc theo mã: trang mở thẳng việc khi bấm thông báo.
  if ((khop = p.match(/^\/api\/viec\/(\d+)$/)) && m === 'GET') {
    const v = await env.CSDL.prepare('SELECT * FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).first();
    return v ? json({ viec: v }) : loi(404, 'Việc này không còn.');
  }
  if ((khop = p.match(/^\/api\/viec\/(\d+)$/)) && m === 'PATCH') return suaViec(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));

  return null;
}
