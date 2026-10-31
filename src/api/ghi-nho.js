// API giao diện: Tổng hợp, hồ sơ và ghi nhớ.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { LOAI_GHI_NHO, TOI_DA_HO_SO, docHoSo, luuHoSo, truyVanFts } from '../ghi-nho.js';
import { json, loi } from '../tien-ich.js';
import { docGoiYLoiDan, quyetGoiYLoiDan } from '../loi-dan-tuan.js';
import { docTongHopCuoi, tongHopChoToChuc } from '../tong-hop.js';
import { laChu } from './chung.js';

// ---- Ghi nhớ ----

async function dsGhiNho(env, tc, url) {
  const loai = url.searchParams.get('loai');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const moi = url.searchParams.get('moi') === '1';
  const dieuKien = ['to_chuc_id = ?1'];
  const thamSo = [tc];
  if (LOAI_GHI_NHO.includes(loai)) { thamSo.push(loai); dieuKien.push(`loai = ?${thamSo.length}`); }
  if (moi) dieuKien.push('da_duyet = 0 AND nguon = \'ai\'');
  if (q) {
    // Tìm bằng FTS5 (không dấu, nhiều từ); không ra hoặc lỗi thì rơi về LIKE như cũ.
    let idKhop = [];
    const mq = truyVanFts(q);
    if (mq) {
      try {
        const { results } = await env.CSDL.prepare('SELECT rowid AS id FROM ghi_nho_fts WHERE ghi_nho_fts MATCH ?1 LIMIT 500').bind(mq).all();
        idKhop = results.map((r) => Number(r.id));
      } catch (e) {
        console.error('FTS ghi nhớ lỗi, dùng LIKE', e?.message);
      }
    }
    if (idKhop.length) {
      dieuKien.push(`id IN (${idKhop.join(',')})`);
    } else {
      thamSo.push(`%${q.replace(/[%_]/g, '')}%`);
      dieuKien.push(`(tieu_de LIKE ?${thamSo.length} OR noi_dung LIKE ?${thamSo.length})`);
    }
  }
  const [ds, dem] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT id, loai, tieu_de, noi_dung, nguon, do_tin_cay, ghim, da_duyet, tao_luc, cap_nhat_luc FROM ghi_nho WHERE ${dieuKien.join(' AND ')} ORDER BY ghim DESC, cap_nhat_luc DESC LIMIT 200`).bind(...thamSo),
    env.CSDL.prepare(`SELECT COUNT(*) AS tong, SUM(CASE WHEN da_duyet = 0 AND nguon = 'ai' THEN 1 ELSE 0 END) AS moi FROM ghi_nho WHERE to_chuc_id = ?1`).bind(tc),
  ]);
  return { ghi_nho: ds.results, tong: dem.results[0].tong || 0, moi: dem.results[0].moi || 0 };
}

async function taoGhiNho(env, tc, du) {
  const loai = String(du.loai || '');
  const tieuDe = String(du.tieu_de || '').trim().slice(0, 120);
  const noiDung = String(du.noi_dung || '').trim().slice(0, 600);
  if (!LOAI_GHI_NHO.includes(loai) || !tieuDe || !noiDung) return loi(400, 'Chọn loại, nhập tiêu đề và nội dung.');
  const bayGio = new Date().toISOString();
  const kq = await env.CSDL.prepare(
    `INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, nguon, da_duyet, tao_luc, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, 'tay', 1, ?5, ?5)
     ON CONFLICT (to_chuc_id, loai, tieu_de) DO UPDATE SET noi_dung = excluded.noi_dung, nguon = 'tay', da_duyet = 1, cap_nhat_luc = excluded.cap_nhat_luc RETURNING id`,
  ).bind(tc, loai, tieuDe, noiDung, bayGio).first();
  return json({ id: kq.id });
}

// Sửa nội dung hoặc tiêu đề thì thành mục "tay" (AI không ghi đè nữa); ghim và duyệt giữ nguyên nguồn.
async function suaGhiNho(env, tc, id, du) {
  const dat = [];
  const thamSo = [id, tc];
  const them = (cot, gt) => { thamSo.push(gt); dat.push(`${cot} = ?${thamSo.length}`); };
  if (typeof du.noi_dung === 'string') {
    const nd = du.noi_dung.trim().slice(0, 600);
    if (!nd) return loi(400, 'Nội dung không được để trống.');
    them('noi_dung', nd);
    dat.push(`nguon = 'tay'`, 'da_duyet = 1');
  }
  if (typeof du.tieu_de === 'string') {
    const td = du.tieu_de.trim().slice(0, 120);
    if (!td) return loi(400, 'Tiêu đề không được để trống.');
    them('tieu_de', td);
    dat.push(`nguon = 'tay'`, 'da_duyet = 1');
  }
  if (du.ghim === true || du.ghim === false) them('ghim', du.ghim ? 1 : 0);
  if (du.da_duyet === true) dat.push('da_duyet = 1');
  if (!dat.length) return loi(400, 'Không có gì để sửa.');
  them('cap_nhat_luc', new Date().toISOString());
  try {
    const kq = await env.CSDL.prepare(`UPDATE ghi_nho SET ${[...new Set(dat)].join(', ')} WHERE id = ?1 AND to_chuc_id = ?2`).bind(...thamSo).run();
    if (!kq.meta.changes) return loi(404, 'Không thấy mục ghi nhớ này.');
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) return loi(409, 'Đã có mục cùng loại và tiêu đề này.');
    throw e;
  }
  return json({ ok: true });
}

export async function xuLyGhiNho(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/tong-hop' && m === 'GET') return json({ cuoi: await docTongHopCuoi(env, tc) });
  if (p === '/api/tong-hop' && m === 'POST') {
    try { return json({ cuoi: await tongHopChoToChuc(env, tc) }); } catch (e) { return loi(502, `Chưa tổng hợp được: ${String(e.message || e).slice(0, 150)}`); }
  }
  if (p === '/api/ho-so' && m === 'GET') return json({ noi_dung: await docHoSo(env, tc), toi_da: TOI_DA_HO_SO });
  if (p === '/api/ho-so' && m === 'PUT') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức sửa được hồ sơ.');
    const e = await luuHoSo(env, tc, (await yeuCau.json().catch(() => ({}))).noi_dung);
    return e ? loi(400, e) : json({ noi_dung: await docHoSo(env, tc), toi_da: TOI_DA_HO_SO });
  }
  if (p === '/api/goi-y-loi-dan' && m === 'GET') return json(await docGoiYLoiDan(env, tc));
  if (p === '/api/goi-y-loi-dan' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức duyệt được lời dặn.');
    const b = await yeuCau.json().catch(() => ({}));
    const kq = await quyetGoiYLoiDan(env, tc, Number(b.chi_so), b.quyet);
    return kq.loi ? loi(400, kq.loi) : json(kq);
  }
  if (p === '/api/ghi-nho' && m === 'GET') return json(await dsGhiNho(env, tc, url));
  if (p === '/api/ghi-nho' && m === 'POST') return taoGhiNho(env, tc, await yeuCau.json().catch(() => ({})));
  if (p === '/api/ghi-nho' && m === 'DELETE') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức xóa toàn bộ được.');
    const kq = await env.CSDL.prepare('DELETE FROM ghi_nho WHERE to_chuc_id = ?1').bind(tc).run();
    return json({ da_xoa: kq.meta.changes || 0 });
  }
  if ((khop = p.match(/^\/api\/ghi-nho\/(\d+)$/)) && m === 'PATCH') return suaGhiNho(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/ghi-nho\/(\d+)$/)) && m === 'DELETE') {
    await env.CSDL.prepare('DELETE FROM ghi_nho WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    return json({ ok: true });
  }

  return null;
}
