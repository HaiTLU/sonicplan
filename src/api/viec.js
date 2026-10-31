// API giao diện: Việc cần làm và soạn prompt cho Claude.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { chayAi } from '../ai.js';
import { dsPrompt, soanPrompt } from '../soan-prompt.js';
import { ghiSuKien } from '../du-an.js';
import { docHoSo } from '../ghi-nho.js';
import { chuanMau } from '../mau.js';
import { docTichHop } from '../tich-hop.js';
import { cat, json, loi, ngayVN } from '../tien-ich.js';
import { themViec } from '../viec.js';
import { laChu } from './chung.js';
import { chuanTepTuy, dsDinhKemTuDong } from '../tho-claude.js';
import { hoiAi } from '../luong-thu.js';
import { luuTep, TEP_TOI_DA } from '../hop-tin.js';

const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

// ---- Việc ----

async function dsViec(env, tc, url) {
  const trangThai = url.searchParams.get('trang_thai') === 'xong' ? 'xong' : 'mo';
  const thuTu = trangThai === 'xong' ? 'xong_luc DESC' : 'sao DESC, han_ngay IS NULL, han_ngay, thu_tu IS NULL, thu_tu, gio_hen IS NULL, gio_hen, id DESC';
  const { results } = await env.CSDL.prepare(
    `SELECT v.id, v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.trang_thai, v.tin_nhan_id, v.tao_luc, v.xong_luc,
       t.nguon AS tin_nguon, t.nguoi_gui AS tin_nguoi_gui, t.nhom AS tin_nhom,
       v.du_an_id, v.nhom, v.nguon, v.mau, v.sao, v.do_nang, v.han_goc, v.so_lan_doi, d.ten AS du_an_ten, d.mau AS du_an_mau, d.icon AS du_an_icon, d.anh_khoa AS du_an_anh
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
  if ('ly_do' in than) ra.ly_do = cat(String(than.ly_do || '').trim(), 200) || null;
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
  if ('uu_tien' in than) {
    if (!['cao', 'vua', 'thap'].includes(than.uu_tien)) return { loi: 'Mức ưu tiên không hợp lệ.' };
    ra.uu_tien = than.uu_tien;
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

export async function suaViec(env, tc, id, than) {
  const k = kiemViec(than, { batBuocTieuDe: false });
  if (k.loi) return loi(400, k.loi);
  const lyDo = k.viec.ly_do; // lý do sửa hoặc hủy: chỉ ghi vào lịch sử (cột ly_do của viec_su_kien) để AI học, không phải cột của việc
  delete k.viec.ly_do;
  const cot = Object.keys(k.viec);
  if (!cot.length) return loi(400, 'Không có gì để sửa.');
  if (k.viec.du_an_id != null && !(await env.CSDL.prepare('SELECT 1 AS x FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(k.viec.du_an_id, tc).first())) return loi(400, 'Dự án không tồn tại.');
  const doiTay = ['trang_thai', 'du_an_id', 'nhom', 'tieu_de', 'han_ngay'].some((c) => c in k.viec);
  const truoc = doiTay ? await env.CSDL.prepare('SELECT trang_thai, du_an_id, tieu_de, nhom, han_ngay FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first() : null;
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
      await ghiSuKien(env, tc, id, loaiSk, loaiSk === 'huy' && lyDo ? `${truoc.tieu_de} | lý do: ${lyDo}` : truoc.tieu_de, null, loaiSk === 'huy' ? lyDo : null).catch(() => {});
    }
    // Ghi lý do sau khi đã hủy (nút trên thông báo): gắn vào sự kiện hủy gần nhất thay vì ghi thêm sự kiện.
    if (lyDo && k.viec.trang_thai === 'huy' && truoc.trang_thai === 'huy') {
      await env.CSDL.prepare(`UPDATE viec_su_kien SET noi_dung = ?3, ly_do = ?4 WHERE id = (SELECT MAX(id) FROM viec_su_kien WHERE to_chuc_id = ?1 AND viec_id = ?2 AND loai = 'huy') AND noi_dung NOT LIKE 'Gỡ vì%'`)
        .bind(tc, id, `${truoc.tieu_de} | lý do: ${lyDo}`, lyDo).run().catch(() => {});
    }
    if ('du_an_id' in k.viec && k.viec.du_an_id !== truoc.du_an_id) {
      const ten = k.viec.du_an_id ? (await env.CSDL.prepare('SELECT ten FROM du_an WHERE id = ?1').bind(k.viec.du_an_id).first())?.ten : null;
      await ghiSuKien(env, tc, id, 'doi_du_an', ten ? `Chuyển vào dự án ${ten}` : 'Gỡ khỏi dự án', null, lyDo).catch(() => {});
    }
    // Các lần người dùng sửa việc: dữ liệu để đo AI tách việc đúng hay sai (xem src/danh-gia-tach-viec.js).
    if ('nhom' in k.viec && (k.viec.nhom || null) !== (truoc.nhom || null)) await ghiSuKien(env, tc, id, 'doi_nhom', `${truoc.nhom || 'trống'} -> ${k.viec.nhom || 'trống'}`, null, lyDo).catch(() => {});
    if ('tieu_de' in k.viec && k.viec.tieu_de !== truoc.tieu_de) await ghiSuKien(env, tc, id, 'sua_ten', `${truoc.tieu_de} -> ${k.viec.tieu_de}`, null, lyDo).catch(() => {});
    if ('han_ngay' in k.viec && (k.viec.han_ngay || null) !== (truoc.han_ngay || null)) await ghiSuKien(env, tc, id, 'sua_han', `${truoc.han_ngay || 'trống'} -> ${k.viec.han_ngay || 'trống'}`, null, lyDo).catch(() => {});
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
  // Thợ Claude chỉ soạn prompt (PM dặn 19/10/2026): mỗi lần bấm một lần gọi AI, prompt lưu lại để sao chép lại. Không có đường nào tự soạn.
  if ((khop = p.match(/^\/api\/viec\/(\d+)\/prompt$/)) && m === 'GET') return json({ prompt: await dsPrompt(env, tc, Number(khop[1])) });
  if (p === '/api/claude/soan-prompt' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức soạn prompt được.');
    const b = await yeuCau.json().catch(() => ({}));
    const tuy = { ngoai: await docTichHop(env, tc, 'ai'), hoSo: await docHoSo(env, tc) };
    const r = await soanPrompt(env, tc, b.viec_ids, {
      dan: b.dan, goc: url.origin, tepTuy: chuanTepTuy({ them: b.tep_them, bo: b.tep_bo, da_chon: b.tep_da_chon === true }),
    }, (messages, opts, mo) => chayAi(env, { ...tuy, model: mo.model }, messages, opts));
    return r.loi ? loi(r.ma, r.loi) : json(r, 201);
  }
  // Tệp đi kèm khi giao Claude: liệt kê tệp tự tìm được quanh các việc, và nhận tệp người dùng tự thêm (lưu ở kho tệp, nguon 'giao-claude').
  if (p === '/api/claude/dinh-kem' && m === 'GET') {
    const ids = [...new Set(String(url.searchParams.get('viec_ids') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 20);
    if (!ids.length) return json({ tep: [] });
    const { results: viec } = await env.CSDL.prepare(`SELECT id, tieu_de, tin_nhan_id FROM viec WHERE to_chuc_id = ?1 AND id IN (${ids.map((_, i) => `?${i + 2}`).join(',')})`).bind(tc, ...ids).all();
    return json({ tep: await dsDinhKemTuDong(env, tc, viec, hoiAi(env, tc)) });
  }
  if (p === '/api/claude/dinh-kem' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức giao việc cho Claude được.');
    const form = await yeuCau.formData().catch(() => null);
    const ds = (form?.getAll('tep') || []).filter((t) => t && typeof t !== 'string' && t.size > 0);
    if (!ds.length) return loi(400, 'Chưa chọn tệp nào.');
    if (ds.length > 10) return loi(400, 'Mỗi lần thêm tối đa 10 tệp.');
    if (ds.some((t) => t.size > TEP_TOI_DA)) return loi(413, 'Có tệp lớn quá 25 MB.');
    const ra = [];
    for (const t of ds) {
      const id = await luuTep(env, tc, { ten: t.name || 'tep', loai: t.type || 'application/octet-stream', kich_thuoc: t.size, du_lieu: await t.arrayBuffer(), nguon: 'giao-claude', nguoi_gui: 'Tôi', nhom: '', tin_nhan_id: null });
      if (!id) return loi(507, 'Kho tệp đã đầy, chưa thêm được tệp.');
      ra.push({ id, ten: t.name || 'tep', kich_thuoc: t.size });
    }
    return json({ tep: ra }, 201);
  }
  // Một việc theo mã: trang mở thẳng việc khi bấm thông báo.
  if ((khop = p.match(/^\/api\/viec\/(\d+)$/)) && m === 'GET') {
    const v = await env.CSDL.prepare('SELECT * FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).first();
    return v ? json({ viec: v }) : loi(404, 'Việc này không còn.');
  }
  if ((khop = p.match(/^\/api\/viec\/(\d+)$/)) && m === 'PATCH') return suaViec(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));

  return null;
}
