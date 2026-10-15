// API giao diện: Dự án: ảnh, lịch sử, thư mục Drive kho.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { datAnhDuAn, docAnhDuAn, dsDuAnKemSo, lichSuDuAn, sapXepDuAn, suaDuAn, taoDuAn, xoaAnhDuAn, xoaDuAn } from '../du-an.js';
import { batDriveKho, datLaiDuAn, dongBoMotDuAn, tatDriveKho, thuMucDuAn } from '../kho-du-an.js';
import { congCuKho, layTruyCapKho } from '../kho.js';
import { json, loi } from '../tien-ich.js';
import { laChu } from './chung.js';

export async function xuLyDuAn(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/du-an' && m === 'GET') return json({ du_an: await dsDuAnKemSo(env, tc) });
  if (p === '/api/du-an' && m === 'POST') {
    const than = await yeuCau.json().catch(() => ({}));
    const r = await taoDuAn(env, tc, than);
    if (r.loi) return loi(r.ma || 400, r.loi);
    // "Lưu tệp ở": mặc định tự tạo thư mục trong Sonicplan kho; chọn link Drive có sẵn thì chỉ để mở (không ghi vào được).
    const ra = { id: r.id };
    if (than.luu_o === 'kho' && laChu(phien)) {
      const token = await layTruyCapKho(env, tc).catch(() => null);
      if (!token) ra.drive_loi = 'Chưa nối Drive kho nên chưa tạo thư mục. Vào Cài đặt, Kết nối, thẻ Drive kho để nối, rồi bấm "Lưu dự án vào Drive".';
      else {
        try { Object.assign(ra, { drive_kho_id: (await batDriveKho(env, tc, token, congCuKho(env, tc), r.id)).drive_kho_id }); } catch (e) { ra.drive_loi = `Chưa tạo được thư mục Drive: ${String(e.message).slice(0, 100)}`; }
      }
    }
    return json(ra, 201);
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)\/thu-muc$/)) && m === 'GET') {
    const r = await thuMucDuAn(env, tc, Number(khop[1]));
    return r ? json(r) : loi(404, 'Không tìm thấy dự án.');
  }
  if (p === '/api/du-an/sap-xep' && m === 'POST') {
    const r = await sapXepDuAn(env, tc, (await yeuCau.json().catch(() => ({}))).ids);
    return r.loi ? loi(400, r.loi) : json({ ok: true });
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)\/anh$/))) {
    const id = Number(khop[1]);
    if (m === 'GET') {
      const vat = await docAnhDuAn(env, tc, id);
      if (!vat) return loi(404, 'Dự án chưa có ảnh.');
      return new Response(vat.body, { headers: { 'content-type': vat.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
    }
    if (m === 'PUT') {
      const loai = (yeuCau.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const r = await datAnhDuAn(env, tc, id, loai, await yeuCau.arrayBuffer());
      return r.loi ? loi(r.ma || 400, r.loi) : json(r);
    }
    if (m === 'DELETE') {
      const r = await xoaAnhDuAn(env, tc, id);
      return r.loi ? loi(r.ma || 400, r.loi) : json({ ok: true });
    }
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)\/lich-su$/)) && m === 'GET') {
    const r = await lichSuDuAn(env, tc, Number(khop[1]));
    return r ? json(r) : loi(404, 'Không tìm thấy dự án.');
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)\/drive-kho(\/dong-bo)?$/)) && (m === 'POST' || m === 'DELETE')) {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    const id = Number(khop[1]);
    if (m === 'DELETE') {
      const r = await tatDriveKho(env, tc, id);
      return r.loi ? loi(r.ma || 400, r.loi) : json({ ok: true });
    }
    const token = await layTruyCapKho(env, tc);
    if (!token) return loi(400, 'Chưa nối Drive kho. Vào Cài đặt, Kết nối, thẻ Drive kho để nối trước.');
    try {
      if (!khop[2]) {
        const r = await batDriveKho(env, tc, token, congCuKho(env, tc), id);
        return r.loi ? loi(r.ma || 400, r.loi) : json({ ok: true, ...r });
      }
      const d = await env.CSDL.prepare('SELECT id, ten, tu_khoa, drive_link, drive_kho_id FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (!d) return loi(404, 'Không tìm thấy dự án.');
      if (!d.drive_kho_id) return loi(400, 'Dự án chưa bật lưu vào Drive.');
      await datLaiDuAn(env, tc, id);
      return json({ ok: true, so: await dongBoMotDuAn(env, tc, token, congCuKho(env, tc), d) });
    } catch (e) {
      return loi(502, `Drive báo lỗi: ${String(e.message).slice(0, 120)}`);
    }
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const r = m === 'PATCH' ? await suaDuAn(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({}))) : await xoaDuAn(env, tc, Number(khop[1]));
    return r.loi ? loi(r.ma || 400, r.loi) : json({ ok: true });
  }

  return null;
}
