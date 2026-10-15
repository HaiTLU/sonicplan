// API giao diện: Claude làm việc ở máy riêng (thợ Claude) và ghép dự án với thư mục ThangLong_KB.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { GOC_DU_AN, goiYThuMuc, kiemThuMucKb } from '../kb.js';
import { demTuDongHomNay, docCauHinhTho, luuCauHinhTho } from '../tho-claude.js';
import { json, loi } from '../tien-ich.js';
import { laChu } from './chung.js';

export async function xuLyClaudeMay(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/tho-claude' && m === 'GET') {
    const cau = await docCauHinhTho(env, tc);
    const [dangLam, hangCho] = await Promise.all([
      env.CSDL.prepare(`SELECT l.id, v.tieu_de, l.bat_dau_luc FROM luot_claude l JOIN viec v ON v.id = l.viec_id WHERE l.to_chuc_id = ?1 AND l.noi_chay = 'may' AND l.trang_thai = 'dang_lam' AND l.lo_id IS NULL`).bind(tc).all(),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM luot_claude WHERE to_chuc_id = ?1 AND noi_chay = 'may' AND trang_thai = 'cho' AND lo_id IS NULL`).bind(tc).first(),
    ]);
    return json({
      co_may: Boolean(env.THO_CLAUDE),
      cau_hinh: cau,
      hom_nay: await demTuDongHomNay(env, tc, new Date()),
      dang_lam: dangLam.results,
      hang_cho: hangCho?.n || 0,
      kb: env.THO_CLAUDE?.thongTinKb ? await env.THO_CLAUDE.thongTinKb() : null,
    });
  }
  if (p === '/api/tho-claude' && m === 'PUT') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức chỉnh được thợ Claude.');
    if (!env.THO_CLAUDE) return loi(400, 'Máy chủ này không chạy thợ Claude (chỉ có trên máy riêng).');
    return json({ cau_hinh: await luuCauHinhTho(env, tc, await yeuCau.json().catch(() => ({}))) });
  }
  if (p === '/api/tho-claude/chay-ngay' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    if (!env.THO_CLAUDE) return loi(400, 'Máy chủ này không chạy thợ Claude.');
    env.THO_CLAUDE.chayNgay?.();
    return json({ ok: true });
  }

  if (p === '/api/kb/du-an' && m === 'GET') {
    const { results } = await env.CSDL.prepare('SELECT id, ten, kb_thu_muc, kb_duyet FROM du_an WHERE to_chuc_id = ?1 ORDER BY thu_tu, id').bind(tc).all();
    const dsKb = env.THO_CLAUDE?.lietKeThuMucKb ? await env.THO_CLAUDE.lietKeThuMucKb() : [];
    return json({
      du_an: results.map((d) => ({ ...d, goi_y: goiYThuMuc(d.ten, dsKb) ? `${GOC_DU_AN}/${goiYThuMuc(d.ten, dsKb)}` : null })),
      thu_muc_kb: dsKb.map((t) => `${GOC_DU_AN}/${t}`),
    });
  }
  if ((khop = p.match(/^\/api\/kb\/du-an\/(\d+)$/)) && m === 'PUT') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức ghép được dự án với thư mục KB.');
    const than = await yeuCau.json().catch(() => ({}));
    const thuMuc = than.kb_thu_muc ? kiemThuMucKb(than.kb_thu_muc) : null;
    if (than.kb_thu_muc && !thuMuc) return loi(400, 'Thư mục phải nằm trong 01_Projects hoặc _INBOX/Sonicplan, không có dấu chấm đầu tên.');
    const r = await env.CSDL.prepare('UPDATE du_an SET kb_thu_muc = ?1, kb_duyet = 1 WHERE id = ?2 AND to_chuc_id = ?3').bind(thuMuc, Number(khop[1]), tc).run();
    return r.meta.changes ? json({ ok: true, kb_thu_muc: thuMuc }) : loi(404, 'Không tìm thấy dự án.');
  }
  return null;
}
