import { chuanMau, MAU_HOP_LE } from './mau.js';
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

// Gán dự án cho tệp chưa có dự án: theo từ khóa trong tên nhóm, thư mục và tên tệp; rồi theo dự án của việc
// sinh ra từ cùng tin nhắn; rồi theo dự án phổ biến nhất của các tệp khác trong cùng nhóm hay người gửi.
// Tệp người dùng đã chọn tay (du_an_nguon = 'tay') không bao giờ bị đổi.
export async function phanDuAnChoTep(env, tc) {
  const duAn = await docDuAn(env, tc);
  if (!duAn.length) return 0;
  const { results } = await env.CSDL.prepare(
    `SELECT t.id, t.ten, t.thu_muc, t.nguoi_gui, t.du_an_id, t.du_an_nguon, m.nhom,
       (SELECT v.du_an_id FROM viec v WHERE v.tin_nhan_id = t.tin_nhan_id AND v.du_an_id IS NOT NULL LIMIT 1) AS du_an_viec
     FROM tep t LEFT JOIN tin_nhan m ON m.id = t.tin_nhan_id
     WHERE t.to_chuc_id = ?1 ORDER BY t.id DESC LIMIT 600`,
  ).bind(tc).all();
  const khoaNhom = (r) => (r.nhom || r.nguoi_gui || '').trim();
  const dem = new Map(); // nhóm -> (dự án -> số tệp)
  for (const r of results) {
    const k = khoaNhom(r);
    if (!k || !r.du_an_id) continue;
    const m = dem.get(k) || new Map();
    m.set(r.du_an_id, (m.get(r.du_an_id) || 0) + 1);
    dem.set(k, m);
  }
  const cau = [];
  for (const r of results) {
    if (r.du_an_id || r.du_an_nguon === 'tay') continue;
    let id = chonDuAn(duAn, null, `${r.nhom || ''} ${r.thu_muc || ''} ${r.ten}`) || r.du_an_viec;
    if (!id) {
      const m = dem.get(khoaNhom(r));
      if (m) id = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    if (id) cau.push(env.CSDL.prepare("UPDATE tep SET du_an_id = ?1, du_an_nguon = 'tu_dong' WHERE id = ?2 AND to_chuc_id = ?3 AND du_an_id IS NULL").bind(id, r.id, tc));
  }
  if (cau.length) { if (env.CSDL.batch) await env.CSDL.batch(cau); else for (const c of cau) await c.run(); }
  return cau.length;
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
    'SELECT id, ten, tu_khoa, thu_tu, mau, sao, drive_link, drive_duong_dan, drive_kho_id FROM du_an WHERE to_chuc_id = ?1 ORDER BY sao DESC, thu_tu, id',
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
  if ('mau' in than) {
    const m = chuanMau(than.mau);
    if (m === undefined) return { loi: 'Màu không hợp lệ.' };
    ra.mau = m;
  }
  if ('sao' in than) ra.sao = than.sao ? 1 : 0;
  if ('drive_link' in than) {
    const l = chuanLinkDrive(than.drive_link);
    if (l === undefined) return { loi: 'Link thư mục Drive phải bắt đầu bằng https://drive.google.com/ hoặc https://docs.google.com/.' };
    ra.drive_link = l;
  }
  if ('drive_duong_dan' in than) {
    const d = chuanDuongDanDrive(than.drive_duong_dan);
    if (d === undefined) return { loi: 'Đường dẫn trong Drive không hợp lệ: dùng dạng 01_Projects/IPSOS, không bắt đầu bằng dấu /, không có "..".' };
    ra.drive_duong_dan = d;
  }
  return { duAn: ra };
}

// Trả null nếu để trống, undefined nếu sai, chuỗi nếu đúng.
export function chuanLinkDrive(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.length > 300 || !/^https:\/\/(drive|docs)\.google\.com\/[^\s]+$/.test(s)) return undefined;
  return s;
}

// Đường dẫn tương đối, các đoạn cách nhau dấu /, không đoạn nào là "." hoặc "..", không ký tự điều khiển hay dấu \.
export function chuanDuongDanDrive(v) {
  const s = String(v ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (!s) return null;
  if (s.length > 200 || /[\\\u0000-\u001f]/.test(s)) return undefined;
  if (s.split('/').some((d) => !d.trim() || d === '.' || d === '..')) return undefined;
  return s;
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
  // Không chọn màu thì lấy màu chưa dùng đầu tiên, hết thì quay vòng.
  let mau = k.duAn.mau;
  if (mau === undefined) {
    const { results } = await env.CSDL.prepare('SELECT mau FROM du_an WHERE to_chuc_id = ?1').bind(tc).all();
    const dung = new Set(results.map((r) => r.mau));
    mau = MAU_HOP_LE.find((m) => !dung.has(m)) ?? MAU_HOP_LE[dem.so % MAU_HOP_LE.length];
  }
  try {
    const d = await env.CSDL.prepare(
      'INSERT INTO du_an (to_chuc_id, ten, tu_khoa, thu_tu, tao_luc, mau, drive_link, drive_duong_dan) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id',
    ).bind(tc, k.duAn.ten, JSON.stringify(k.duAn.tu_khoa || []), dem.cuoi + 1, new Date().toISOString(), mau, k.duAn.drive_link ?? null, k.duAn.drive_duong_dan ?? null).first();
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
  if ('mau' in k.duAn) { gt.push(k.duAn.mau); gan.push(`mau = ?${gt.length + 2}`); }
  if ('sao' in k.duAn) { gt.push(k.duAn.sao); gan.push(`sao = ?${gt.length + 2}`); }
  if ('drive_link' in k.duAn) { gt.push(k.duAn.drive_link); gan.push(`drive_link = ?${gt.length + 2}`); }
  if ('drive_duong_dan' in k.duAn) { gt.push(k.duAn.drive_duong_dan); gan.push(`drive_duong_dan = ?${gt.length + 2}`); }
  if (!gan.length) return { loi: 'Không có gì để sửa.' };
  try {
    const kq = await env.CSDL.prepare(`UPDATE du_an SET ${gan.join(', ')} WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc, ...gt).run();
    // Đổi màu dự án thì các sự kiện Lịch của việc theo màu này cần đổi màu theo.
    if (kq.meta.changes && 'mau' in k.duAn) await env.CSDL.prepare("UPDATE viec SET can_dong_bo = 1 WHERE to_chuc_id = ?1 AND du_an_id = ?2 AND mau IS NULL AND lich_event_id IS NOT NULL AND trang_thai = 'mo'").bind(tc, id).run();
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
  const d = await env.CSDL.prepare('SELECT id, ten, tu_khoa, mau, drive_link, drive_duong_dan FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
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

// Lưu thứ tự các dự án (kéo cột ở trang Việc): ids từ đầu tới cuối.
export async function sapXepDuAn(env, tc, ids) {
  const ds = Array.isArray(ids) ? ids.map(Number) : [];
  if (!ds.length || ds.length > DU_AN_TOI_DA || ds.some((x) => !Number.isInteger(x) || x <= 0)) return { loi: 'Danh sách dự án không hợp lệ.' };
  const cau = ds.map((id, i) => env.CSDL.prepare('UPDATE du_an SET thu_tu = ?1 WHERE id = ?2 AND to_chuc_id = ?3').bind(i + 1, id, tc));
  if (env.CSDL.batch) await env.CSDL.batch(cau);
  else for (const c of cau) await c.run();
  return {};
}
