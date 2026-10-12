// Dự án: nhãn gom việc theo mảng, và lịch sử (dòng thời gian) của từng dự án.

import { chuanHoa } from './tien-ich.js';

export const DU_AN_TOI_DA = 30;

// Việc thuộc dự án nào: ưu tiên tên AI đưa ra (khớp tên dự án), nếu không thì dò từ khóa trong chữ cho trước.
// duAn: [{ id, ten, tu_khoa: string[] | json }]. Trả id hoặc null.
export function chonDuAn(duAn, tenAi, chu) {
  const ds = (duAn || []).map((d) => ({ ...d, kw: docTuKhoa(d.tu_khoa) }));
  const ai = chuanHoa(tenAi);
  if (ai) {
    const khop = ds.find((d) => chuanHoa(d.ten) === ai);
    if (khop) return khop.id;
  }
  const van = ` ${chuanHoa(chu)} `;
  let tot = null;
  for (const d of ds) {
    const diem = [d.ten, ...d.kw].map(chuanHoa).filter((k) => k.length >= 2 && van.includes(` ${k} `)).length;
    if (diem && (!tot || diem > tot.diem)) tot = { id: d.id, diem };
  }
  return tot ? tot.id : null;
}

export function docTuKhoa(v) {
  if (Array.isArray(v)) return v.map(String);
  try {
    const m = JSON.parse(v || '[]');
    return Array.isArray(m) ? m.map(String) : [];
  } catch {
    return [];
  }
}

export async function docDuAn(env, tc) {
  const { results } = await env.CSDL.prepare(
    'SELECT id, ten, tu_khoa, thu_tu FROM du_an WHERE to_chuc_id = ?1 ORDER BY thu_tu, id',
  ).bind(tc).all();
  return results.map((d) => ({ ...d, tu_khoa: docTuKhoa(d.tu_khoa) }));
}

// Ghi một sự kiện vào lịch sử của việc: tao, tien_do, xong, mo_lai, doi_du_an.
export async function ghiSuKien(env, tc, viecId, loai, noiDung, tinNhanId = null) {
  await env.CSDL.prepare(
    'INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, tin_nhan_id, luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  ).bind(tc, viecId, loai, noiDung ? String(noiDung).slice(0, 500) : null, tinNhanId, new Date().toISOString()).run();
}

export function kiemDuAn(than, { batBuoc }) {
  const ra = {};
  if ('ten' in than || batBuoc) {
    const t = String(than.ten || '').trim();
    if (!t) return { loi: 'Nhập tên dự án.' };
    if (t.length > 60) return { loi: 'Tên dự án dài quá 60 ký tự.' };
    ra.ten = t;
  }
  if ('tu_khoa' in than) {
    const ds = Array.isArray(than.tu_khoa) ? than.tu_khoa : String(than.tu_khoa || '').split(/[,\n]/);
    ra.tu_khoa = [...new Set(ds.map((x) => String(x).trim()).filter(Boolean))].slice(0, 20).map((x) => x.slice(0, 40));
  }
  return { duAn: ra };
}

export async function dsDuAnKemSo(env, tc) {
  const ds = await docDuAn(env, tc);
  const { results } = await env.CSDL.prepare(
    `SELECT du_an_id, trang_thai, COUNT(*) AS so FROM viec WHERE to_chuc_id = ?1 AND du_an_id IS NOT NULL GROUP BY du_an_id, trang_thai`,
  ).bind(tc).all();
  return ds.map((d) => ({
    ...d,
    dang_mo: results.filter((r) => r.du_an_id === d.id && r.trang_thai === 'mo').reduce((a, r) => a + r.so, 0),
    da_xong: results.filter((r) => r.du_an_id === d.id && r.trang_thai === 'xong').reduce((a, r) => a + r.so, 0),
  }));
}

export async function taoDuAn(env, tc, than) {
  const k = kiemDuAn(than, { batBuoc: true });
  if (k.loi) return { loi: k.loi };
  const dem = await env.CSDL.prepare('SELECT COUNT(*) AS so, COALESCE(MAX(thu_tu), 0) AS cuoi FROM du_an WHERE to_chuc_id = ?1').bind(tc).first();
  if (dem.so >= DU_AN_TOI_DA) return { loi: `Tối đa ${DU_AN_TOI_DA} dự án.` };
  try {
    const d = await env.CSDL.prepare(
      'INSERT INTO du_an (to_chuc_id, ten, tu_khoa, thu_tu, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id',
    ).bind(tc, k.duAn.ten, JSON.stringify(k.duAn.tu_khoa || []), dem.cuoi + 1, new Date().toISOString()).first();
    return { id: d.id };
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) return { loi: 'Đã có dự án tên này.' };
    throw e;
  }
}

export async function suaDuAn(env, tc, id, than) {
  const k = kiemDuAn(than, { batBuoc: false });
  if (k.loi) return { loi: k.loi };
  const gan = [];
  const gt = [];
  if ('ten' in k.duAn) { gt.push(k.duAn.ten); gan.push(`ten = ?${gt.length + 2}`); }
  if ('tu_khoa' in k.duAn) { gt.push(JSON.stringify(k.duAn.tu_khoa)); gan.push(`tu_khoa = ?${gt.length + 2}`); }
  if (!gan.length) return { loi: 'Không có gì để sửa.' };
  try {
    const kq = await env.CSDL.prepare(`UPDATE du_an SET ${gan.join(', ')} WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc, ...gt).run();
    return kq.meta.changes ? {} : { loi: 'Không tìm thấy dự án.', ma: 404 };
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) return { loi: 'Đã có dự án tên này.' };
    throw e;
  }
}

// Xóa dự án chỉ gỡ nhãn khỏi các việc, không xóa việc nào.
export async function xoaDuAn(env, tc, id) {
  await env.CSDL.prepare('UPDATE viec SET du_an_id = NULL WHERE to_chuc_id = ?1 AND du_an_id = ?2').bind(tc, id).run();
  const kq = await env.CSDL.prepare('DELETE FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
  return kq.meta.changes ? {} : { loi: 'Không tìm thấy dự án.', ma: 404 };
}

// Dòng thời gian của dự án: sự kiện của mọi việc đang thuộc dự án, cùng các tệp đi kèm tin của những việc đó.
export async function lichSuDuAn(env, tc, id) {
  const d = await env.CSDL.prepare('SELECT id, ten, tu_khoa FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  if (!d) return null;
  const [sk, tep, viec] = await Promise.all([
    env.CSDL.prepare(
      `SELECT e.id, e.viec_id, e.loai, e.noi_dung, e.luc, e.tin_nhan_id, v.tieu_de, v.trang_thai, v.nguon
       FROM viec_su_kien e JOIN viec v ON v.id = e.viec_id AND v.to_chuc_id = e.to_chuc_id
       WHERE e.to_chuc_id = ?1 AND v.du_an_id = ?2 ORDER BY e.luc DESC, e.id DESC LIMIT 200`,
    ).bind(tc, id).all(),
    env.CSDL.prepare(
      `SELECT t.id, t.ten, t.nguon, t.nguoi_gui, t.tao_luc FROM tep t
       WHERE t.to_chuc_id = ?1 AND t.tin_nhan_id IN (
         SELECT tin_nhan_id FROM viec WHERE to_chuc_id = ?1 AND du_an_id = ?2 AND tin_nhan_id IS NOT NULL
         UNION SELECT e.tin_nhan_id FROM viec_su_kien e JOIN viec v ON v.id = e.viec_id WHERE e.to_chuc_id = ?1 AND v.du_an_id = ?2 AND e.tin_nhan_id IS NOT NULL)
       ORDER BY t.id DESC LIMIT 50`,
    ).bind(tc, id).all(),
    env.CSDL.prepare('SELECT trang_thai, COUNT(*) AS so FROM viec WHERE to_chuc_id = ?1 AND du_an_id = ?2 GROUP BY trang_thai').bind(tc, id).all(),
  ]);
  const dem = (t) => viec.results.find((r) => r.trang_thai === t)?.so || 0;
  return { du_an: { ...d, tu_khoa: docTuKhoa(d.tu_khoa) }, dang_mo: dem('mo'), da_xong: dem('xong'), su_kien: sk.results, tep: tep.results };
}
