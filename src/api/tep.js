// API giao diện: Tệp: danh sách, tải, xem, ảnh nhỏ.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { phanDuAnChoTep } from '../du-an.js';
import { ghiTruyCap } from '../du-lieu.js';
import { layAnhNhoDrive } from '../kho.js';
import { json, loi } from '../tien-ich.js';
import { TOI_DA_DOCX, chuTuDocx, loaiXem } from '../xem-tep.js';
import { COT_DRIVE } from './chung.js';

// ---- Tệp ----

async function dsTep(env, tc, url) {
  const q = (url.searchParams.get('q') || '').trim();
  await phanDuAnChoTep(env, tc).catch((e) => console.error('Phân dự án cho tệp lỗi', e));
  const { results } = await env.CSDL.prepare(
    `SELECT tep.id, tep.ten, tep.loai, tep.kich_thuoc, tep.nguon, tep.nguoi_gui, tep.thu_muc, tep.tao_luc, tep.tin_nhan_id, tep.du_an_id, tep.du_an_nguon,
       m.nhom AS tin_nhom, ${COT_DRIVE} FROM tep LEFT JOIN tin_nhan m ON m.id = tep.tin_nhan_id
     WHERE tep.to_chuc_id = ?1 AND (m.id IS NULL OR m.an = 0) ${q ? 'AND (tep.ten LIKE ?2 OR tep.nguoi_gui LIKE ?2)' : ''} ORDER BY tep.id DESC LIMIT 400`,
  ).bind(tc, ...(q ? [`%${q.replace(/[%_]/g, '')}%`] : [])).all();
  return { tep: results };
}

// Đổi dự án của tệp (chọn tay): du_an_id rỗng nghĩa là bỏ khỏi dự án, hệ thống không tự gán lại.
async function suaTep(env, tc, id, than) {
  if (!('du_an_id' in than)) return loi(400, 'Không có gì để sửa.');
  const d = than.du_an_id === null || than.du_an_id === '' ? null : Number(than.du_an_id);
  if (d !== null && (!Number.isInteger(d) || !(await env.CSDL.prepare('SELECT 1 AS x FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(d, tc).first()))) return loi(400, 'Dự án không tồn tại.');
  const kq = await env.CSDL.prepare("UPDATE tep SET du_an_id = ?1, du_an_nguon = 'tay' WHERE id = ?2 AND to_chuc_id = ?3").bind(d, id, tc).run();
  return kq.meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy tệp.');
}

// Ảnh thu nhỏ của tệp: ưu tiên bản Drive tạo (có cả trang đầu Word, PDF, Excel, PowerPoint), lưu đệm ở R2;
// không có thì ảnh gốc trong R2 nếu là ảnh. Không có gì thì 404 để trang hiện biểu tượng.
async function anhNhoTep(env, tc, id) {
  const tep = await env.CSDL.prepare(`SELECT ten, r2_khoa, ${COT_DRIVE} FROM tep WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc).first();
  if (!tep) return loi(404, 'Không tìm thấy tệp.');
  const dau = { 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' };
  const khoaDem = `anh-nho/${tc}/${id}`;
  const dem = await env.TEP.get(khoaDem);
  if (dem) return new Response(dem.body, { headers: { ...dau, 'content-type': dem.httpMetadata?.contentType || 'image/jpeg' } });
  if (tep.drive_id) {
    try {
      const a = await layAnhNhoDrive(env, tc, tep.drive_id);
      if (a) {
        await env.TEP.put(khoaDem, a.bytes, { httpMetadata: { contentType: a.mime } });
        return new Response(a.bytes, { headers: { ...dau, 'content-type': a.mime } });
      }
    } catch (e) {
      console.error('Ảnh thu nhỏ Drive lỗi', e);
    }
  }
  const loai = loaiXem(tep.ten);
  if (tep.r2_khoa && loai?.kieu === 'anh') {
    const vat = await env.TEP.get(tep.r2_khoa);
    if (vat) return new Response(vat.body, { headers: { ...dau, 'content-type': loai.mime } });
  }
  return new Response('Không có ảnh thu nhỏ.', { status: 404, headers: { 'cache-control': 'private, max-age=600' } });
}

// Xem ảnh và PDF ngay trong trang: chỉ phục vụ đúng loại ảnh, PDF theo phần mở rộng, không bao giờ HTML hay SVG.
async function xemTep(env, tc, id) {
  const tep = await env.CSDL.prepare('SELECT ten, r2_khoa FROM tep WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  const loai = tep && loaiXem(tep.ten);
  if (!tep?.r2_khoa || !loai || loai.kieu === 'docx') return loi(404, 'Tệp này không xem trước được.');
  const vat = await env.TEP.get(tep.r2_khoa);
  if (!vat) return loi(404, 'Tệp không còn trong kho.');
  return new Response(vat.body, {
    headers: {
      'content-type': loai.mime,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(tep.ten)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function chuTep(env, tc, id) {
  const tep = await env.CSDL.prepare('SELECT ten, kich_thuoc, r2_khoa FROM tep WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  if (!tep?.r2_khoa || loaiXem(tep.ten)?.kieu !== 'docx') return loi(404, 'Tệp này không có bản chữ để xem trước.');
  if (tep.kich_thuoc > TOI_DA_DOCX) return loi(413, 'Tệp lớn quá để xem trước, tải về để mở.');
  const vat = await env.TEP.get(tep.r2_khoa);
  if (!vat) return loi(404, 'Tệp không còn trong kho.');
  try {
    const chu = await chuTuDocx(new Uint8Array(await vat.arrayBuffer()));
    if (chu == null) return loi(422, 'Không đọc được nội dung tệp Word này, tải về để mở.');
    return json({ chu: chu || '(tệp không có chữ, có thể chỉ chứa ảnh)' });
  } catch (e) {
    console.error('Xem trước docx lỗi', e);
    return loi(422, 'Không đọc được nội dung tệp Word này, tải về để mở.');
  }
}

async function taiTep(env, tc, id) {
  const tep = await env.CSDL.prepare('SELECT ten, loai, r2_khoa, drive_id FROM tep WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  // Ghi âm họp chỉ nằm trên Drive (không chép vào kho): mở bản trên Drive để tải.
  if (tep && !tep.r2_khoa && tep.drive_id) return Response.redirect(`https://drive.google.com/file/d/${encodeURIComponent(tep.drive_id)}/view`, 302);
  if (!tep?.r2_khoa) return loi(404, 'Không tìm thấy tệp này.');
  const vat = await env.TEP.get(tep.r2_khoa);
  if (!vat) return loi(404, 'Tệp không còn trong kho.');
  return new Response(vat.body, {
    headers: {
      'content-type': tep.loai || 'application/octet-stream',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(tep.ten)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function xuLyTep(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/tep' && m === 'GET') return json(await dsTep(env, tc, url));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/tai$/)) && m === 'GET') {
    const kq = await taiTep(env, tc, Number(khop[1]));
    if (kq.ok) {
      let ten = `tệp số ${khop[1]}`;
      try { ten = decodeURIComponent((kq.headers.get('content-disposition') || '').split("''")[1] || '') || ten; } catch { /* giữ tên mặc định */ }
      await ghiTruyCap(env, tc, phien.email, 'tai_tep', ten).catch(() => {});
    }
    return kq;
  }
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/anh-nho$/)) && m === 'GET') return anhNhoTep(env, tc, Number(khop[1]));
  if ((khop = p.match(/^\/api\/tep\/(\d+)$/)) && m === 'PATCH') return suaTep(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/xem$/)) && m === 'GET') return xemTep(env, tc, Number(khop[1]));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/chu$/)) && m === 'GET') return chuTep(env, tc, Number(khop[1]));

  return null;
}
