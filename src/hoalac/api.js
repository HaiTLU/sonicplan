// API phân hệ Viện Hòa Lạc: giai đoạn (stage gate), hạng mục (WBS/Gantt/Kanban), phụ thuộc (CPM), baseline.
// Mọi địa chỉ /api/hoalac/*. Đối tác (doi_tac) chỉ GET đúng hạng mục được gán (quyen.js), không sửa gì.
import { json, loi } from '../tien-ich.js';
import { laDoiTac, idHangMucDuocXem, duocXemHangMuc } from './quyen.js';
import { capNhatCpm } from './wbs.js';

const CHI_CHU_THANH_VIEN = (phien) => (laDoiTac(phien) ? loi(403, 'Tài khoản đối tác chỉ xem, không sửa được.') : null);

export async function xuLyHoaLac(yeuCau, env, phien, url) {
  const p = url.pathname;
  if (!p.startsWith('/api/hoalac/')) return null;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  const bayGio = new Date().toISOString();
  let khop;

  // ---------- Giai đoạn (stage gate) ----------
  if (p === '/api/hoalac/giai-doan' && m === 'GET') {
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_giai_doan WHERE to_chuc_id = ?1 ORDER BY thu_tu').bind(tc).all();
    return json({ giai_doan: results });
  }
  if (p === '/api/hoalac/giai-doan' && m === 'POST') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên giai đoạn.');
    const { meta } = await env.CSDL.prepare('INSERT INTO qlda_giai_doan (to_chuc_id, ten, thu_tu, tao_luc) VALUES (?1, ?2, ?3, ?4)')
      .bind(tc, than.ten, Number(than.thu_tu) || 0, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/giai-doan\/(\d+)$/)) && m === 'PUT') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const id = Number(khop[1]);
    const than = await yeuCau.json().catch(() => ({}));
    const { meta } = await env.CSDL.prepare('UPDATE qlda_giai_doan SET ten = COALESCE(?1, ten), thu_tu = COALESCE(?2, thu_tu), trang_thai = COALESCE(?3, trang_thai) WHERE id = ?4 AND to_chuc_id = ?5')
      .bind(than.ten ?? null, than.thu_tu ?? null, than.trang_thai ?? null, id, tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy giai đoạn.');
  }

  // ---------- Hạng mục (WBS) ----------
  if (p === '/api/hoalac/hang-muc' && m === 'GET') {
    let { results } = await env.CSDL.prepare('SELECT * FROM qlda_hang_muc WHERE to_chuc_id = ?1 ORDER BY id').bind(tc).all();
    if (laDoiTac(phien)) {
      const duocXem = await idHangMucDuocXem(env, phien);
      results = results.filter((h) => duocXem.has(h.id));
    }
    return json({ hang_muc: results });
  }
  if (p === '/api/hoalac/hang-muc' && m === 'POST') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên hạng mục.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_hang_muc (to_chuc_id, giai_doan_id, nhom_id, ma, ten, mo_ta, la_moc, thoi_gian_ngay, ngay_bat_dau, ngay_ket_thuc, phu_trach, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
    ).bind(tc, than.giai_doan_id ?? null, than.nhom_id ?? null, than.ma || '', than.ten, than.mo_ta || '',
      than.la_moc ? 1 : 0, Number(than.thoi_gian_ngay) || (than.la_moc ? 0 : 1), than.ngay_bat_dau ?? null, than.ngay_ket_thuc ?? null, than.phu_trach || '', bayGio).run();
    await capNhatCpm(env, tc, bayGio);
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/hang-muc\/(\d+)$/))) {
    const id = Number(khop[1]);
    if (m === 'GET') {
      if (!(await duocXemHangMuc(env, phien, id))) return loi(404, 'Không tìm thấy hạng mục.');
      const r = await env.CSDL.prepare('SELECT * FROM qlda_hang_muc WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      return r ? json(r) : loi(404, 'Không tìm thấy hạng mục.');
    }
    if (m === 'PUT') {
      // Đối tác được cập nhật tiến độ/trạng thái của đúng hạng mục được gán (việc thực tế ngoài công trường), không đổi ngày hay cấu trúc.
      const than = await yeuCau.json().catch(() => ({}));
      if (laDoiTac(phien)) {
        if (!(await duocXemHangMuc(env, phien, id))) return loi(404, 'Không tìm thấy hạng mục.');
        const { meta } = await env.CSDL.prepare('UPDATE qlda_hang_muc SET tien_do_pt = COALESCE(?1, tien_do_pt), trang_thai = COALESCE(?2, trang_thai), cap_nhat_luc = ?3 WHERE id = ?4 AND to_chuc_id = ?5')
          .bind(than.tien_do_pt ?? null, than.trang_thai ?? null, bayGio, id, tc).run();
        return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy hạng mục.');
      }
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_hang_muc SET giai_doan_id = COALESCE(?1, giai_doan_id), nhom_id = COALESCE(?2, nhom_id), ma = COALESCE(?3, ma),
         ten = COALESCE(?4, ten), mo_ta = COALESCE(?5, mo_ta), la_moc = COALESCE(?6, la_moc), thoi_gian_ngay = COALESCE(?7, thoi_gian_ngay),
         ngay_bat_dau = COALESCE(?8, ngay_bat_dau), ngay_ket_thuc = COALESCE(?9, ngay_ket_thuc), tien_do_pt = COALESCE(?10, tien_do_pt),
         trang_thai = COALESCE(?11, trang_thai), phu_trach = COALESCE(?12, phu_trach), cap_nhat_luc = ?13
         WHERE id = ?14 AND to_chuc_id = ?15`,
      ).bind(than.giai_doan_id ?? null, than.nhom_id ?? null, than.ma ?? null, than.ten ?? null, than.mo_ta ?? null,
        than.la_moc == null ? null : (than.la_moc ? 1 : 0), than.thoi_gian_ngay ?? null, than.ngay_bat_dau ?? null, than.ngay_ket_thuc ?? null,
        than.tien_do_pt ?? null, than.trang_thai ?? null, than.phu_trach ?? null, bayGio, id, tc).run();
      if (!meta.changes) return loi(404, 'Không tìm thấy hạng mục.');
      await capNhatCpm(env, tc, bayGio);
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
      // Hạng mục đã vào một baseline (ảnh chụp mốc cho mục đích đối chiếu) thì không xóa, tránh phá dữ liệu lịch sử.
      const trongBaseline = await env.CSDL.prepare('SELECT 1 FROM qlda_baseline_hang_muc WHERE hang_muc_id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (trongBaseline) return loi(409, 'Hạng mục đã nằm trong một baseline, không xóa được. Hãy đóng hạng mục thay vì xóa.');
      await env.CSDL.batch([
        env.CSDL.prepare('UPDATE qlda_hang_muc SET nhom_id = NULL WHERE nhom_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
        env.CSDL.prepare('DELETE FROM qlda_phu_thuoc WHERE to_chuc_id = ?1 AND (truoc_id = ?2 OR sau_id = ?2)').bind(tc, id),
        env.CSDL.prepare('DELETE FROM qlda_giao_doi_tac WHERE to_chuc_id = ?1 AND loai = \'hang_muc\' AND doi_tuong_id = ?2').bind(tc, id),
        env.CSDL.prepare('DELETE FROM qlda_hang_muc WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
      ]);
      await capNhatCpm(env, tc, bayGio);
      return json({ ok: true });
    }
  }

  // ---------- Phụ thuộc (CPM) ----------
  if (p === '/api/hoalac/phu-thuoc' && m === 'GET') {
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_phu_thuoc WHERE to_chuc_id = ?1').bind(tc).all();
    return json({ phu_thuoc: laDoiTac(phien) ? [] : results });
  }
  if (p === '/api/hoalac/phu-thuoc' && m === 'POST') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.truoc_id || !than.sau_id) return loi(400, 'Thiếu hạng mục trước hoặc sau.');
    if (than.truoc_id === than.sau_id) return loi(400, 'Một hạng mục không tự phụ thuộc chính nó.');
    try {
      const { meta } = await env.CSDL.prepare('INSERT INTO qlda_phu_thuoc (to_chuc_id, truoc_id, sau_id, loai, do_tre_ngay) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(tc, than.truoc_id, than.sau_id, than.loai || 'FS', Number(than.do_tre_ngay) || 0).run();
      await capNhatCpm(env, tc, bayGio);
      return json({ id: meta.last_row_id }, 201);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return loi(409, 'Hai hạng mục này đã có phụ thuộc với nhau.');
      throw e;
    }
  }
  if ((khop = p.match(/^\/api\/hoalac\/phu-thuoc\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_phu_thuoc WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    if (!meta.changes) return loi(404, 'Không tìm thấy phụ thuộc.');
    await capNhatCpm(env, tc, bayGio);
    return json({ ok: true });
  }

  // ---------- Baseline ----------
  if (p === '/api/hoalac/baseline' && m === 'GET') {
    if (laDoiTac(phien)) return loi(403, 'Tài khoản đối tác không xem baseline.');
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_baseline WHERE to_chuc_id = ?1 ORDER BY tao_luc DESC').bind(tc).all();
    return json({ baseline: results });
  }
  if (p === '/api/hoalac/baseline' && m === 'POST') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên baseline.');
    const { meta } = await env.CSDL.prepare('INSERT INTO qlda_baseline (to_chuc_id, ten, ghi_chu, tao_boi, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(tc, than.ten, than.ghi_chu || '', phien.email, bayGio).run();
    const baselineId = meta.last_row_id;
    const { results: hangMuc } = await env.CSDL.prepare('SELECT id, ngay_bat_dau, ngay_ket_thuc FROM qlda_hang_muc WHERE to_chuc_id = ?1').bind(tc).all();
    if (hangMuc.length) {
      await env.CSDL.batch(hangMuc.map((h) => env.CSDL.prepare(
        'INSERT INTO qlda_baseline_hang_muc (baseline_id, hang_muc_id, to_chuc_id, ngay_bat_dau, ngay_ket_thuc) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(baselineId, h.id, tc, h.ngay_bat_dau, h.ngay_ket_thuc)));
    }
    return json({ id: baselineId, so_hang_muc: hangMuc.length }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/baseline\/(\d+)$/)) && m === 'GET') {
    if (laDoiTac(phien)) return loi(403, 'Tài khoản đối tác không xem baseline.');
    const id = Number(khop[1]);
    const cai = await env.CSDL.prepare('SELECT * FROM qlda_baseline WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
    if (!cai) return loi(404, 'Không tìm thấy baseline.');
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_baseline_hang_muc WHERE baseline_id = ?1 AND to_chuc_id = ?2').bind(id, tc).all();
    return json({ ...cai, hang_muc: results });
  }

  return loi(404, 'Không có chức năng này.');
}
