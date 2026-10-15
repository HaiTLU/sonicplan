// API giao diện: Tài khoản và dữ liệu cá nhân: phiên, xuất dữ liệu, nhật ký truy cập, xóa tổ chức, số đếm thanh dưới.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { dsTruyCap, ghiTruyCap, xuatDuLieu } from '../du-lieu.js';
import { quenPhien } from '../phien.js';
import { json, loi, ngayVN } from '../tien-ich.js';
import { xoaToChuc } from '../xoa-to-chuc.js';
import { laChu } from './chung.js';

export async function xuLyTaiKhoan(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;

  if (p === '/api/phien-ban' && m === 'GET') return json({ ban: env.PHIEN_BAN || '' });
  if (p === '/api/toi' && m === 'GET') {
    await ghiTruyCap(env, tc, phien.email, 'mo_trang').catch(() => {});
    return json({ email: phien.email, nguoi_dung: phien.nguoi_dung, to_chuc: phien.to_chuc, cac_to_chuc: phien.cac_to_chuc });
  }
  if (p === '/api/du-lieu/xuat' && m === 'GET') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức tải được toàn bộ dữ liệu.');
    const ra = await xuatDuLieu(env, tc);
    await ghiTruyCap(env, tc, phien.email, 'xuat_du_lieu').catch(() => {});
    return new Response(JSON.stringify(ra, null, 1), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': `attachment; filename="sonicplan-du-lieu-${ngayVN()}.json"` },
    });
  }
  if (p === '/api/du-lieu/truy-cap' && m === 'GET') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức xem được nhật ký truy cập.');
    return json({ ds: await dsTruyCap(env, tc) });
  }
  if (p === '/api/to-chuc/xoa' && m === 'POST') {
    const than = await yeuCau.json().catch(() => ({}));
    const kq = await xoaToChuc(env, phien.to_chuc, phien.email, than.ten_xac_nhan);
    if (kq.ok) quenPhien();
    return kq.loi ? loi(kq.ma, kq.loi) : json(kq);
  }
  // Hai số đếm ở thanh dưới, làm mới mỗi 2 phút: chỉ 2 truy vấn có chỉ mục, thay vì cả Tổng quan (khoảng 10 truy vấn).
  if (p === '/api/dem' && m === 'GET') {
    const r = await env.CSDL.prepare(
      `SELECT (SELECT COUNT(*) FROM tin_nhan WHERE to_chuc_id = ?1 AND an = 0 AND da_xem = 0) AS tin_chua_xem,
              (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo') AS viec_mo`,
    ).bind(tc).first();
    return json({ tin_chua_xem: r?.tin_chua_xem ?? 0, viec_mo: r?.viec_mo ?? 0 });
  }

  return null;
}
