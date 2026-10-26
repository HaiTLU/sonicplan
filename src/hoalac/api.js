// API phân hệ Viện Hòa Lạc: giai đoạn (stage gate), hạng mục (WBS/Gantt/Kanban), phụ thuộc (CPM), baseline,
// RAID (rủi ro/vấn đề/thay đổi/quyết định/bài học). Mọi địa chỉ /api/hoalac/*.
// Đối tác (doi_tac) chỉ GET đúng hạng mục được gán (quyen.js); toàn bộ RAID không có cơ chế gán theo
// dòng nên chặn hẳn cho đối tác (403), không chỉ chặn sửa.
import { json, loi } from '../tien-ich.js';
import { laDoiTac, idHangMucDuocXem, duocXemHangMuc } from './quyen.js';
import { capNhatCpm } from './wbs.js';
import { taoThongBao } from '../thong-bao.js';

// Mức rủi ro cao (ma trận 5x5, điểm từ 1 đến 25): từ 15 điểm trở lên thì báo, không phải mọi rủi ro.
const DIEM_RUI_RO_CAO = 15;

const CHI_CHU_THANH_VIEN = (phien) => (laDoiTac(phien) ? loi(403, 'Tài khoản đối tác chỉ xem, không sửa được.') : null);
const CHAN_DOI_TAC = (phien) => (laDoiTac(phien) ? loi(403, 'Tài khoản đối tác không dùng được mục này.') : null);

// Luồng duyệt thay đổi một chiều, không lùi lại hay nhảy cóc.
const CHUYEN_TRANG_THAI_THAY_DOI = { de_xuat: ['xem_xet'], xem_xet: ['duyet', 'tu_choi'], duyet: [], tu_choi: [] };

// Kiểm một khóa ngoài có thật và thuộc đúng tổ chức trước khi ghi, tránh một tổ chức gán tới dòng của tổ chức khác.
// `bang` luôn là tên cố định viết sẵn trong tệp này, không phải dữ liệu người dùng.
async function thuocToChuc(env, tc, bang, id) {
  if (id == null) return true;
  const r = await env.CSDL.prepare(`SELECT 1 FROM ${bang} WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc).first();
  return !!r;
}

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

  // ---------- RAID: rủi ro ----------
  if (p === '/api/hoalac/rui-ro' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_rui_ro WHERE to_chuc_id = ?1 ORDER BY (xac_suat * tac_dong) DESC, id DESC').bind(tc).all();
    return json({ rui_ro: results.map((r) => ({ ...r, muc_do: r.xac_suat * r.tac_dong })) });
  }
  if (p === '/api/hoalac/rui-ro' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên rủi ro.');
    if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_rui_ro (to_chuc_id, ten, mo_ta, xac_suat, tac_dong, bien_phap, phu_trach, hang_muc_id, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
    ).bind(tc, than.ten, than.mo_ta || '', Number(than.xac_suat) || 3, Number(than.tac_dong) || 3, than.bien_phap || '', than.phu_trach || '', than.hang_muc_id ?? null, phien.email, bayGio).run();
    const diem = (Number(than.xac_suat) || 3) * (Number(than.tac_dong) || 3);
    if (diem >= DIEM_RUI_RO_CAO) {
      await taoThongBao(env, tc, { loai: 'hoalac_rui_ro', tieu_de: `Rủi ro mức cao: ${than.ten}`, noi_dung: than.mo_ta || '', duong_dan: '/hoalac#raid' });
    }
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/rui-ro\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_rui_ro SET ten = COALESCE(?1, ten), mo_ta = COALESCE(?2, mo_ta), xac_suat = COALESCE(?3, xac_suat),
         tac_dong = COALESCE(?4, tac_dong), bien_phap = COALESCE(?5, bien_phap), phu_trach = COALESCE(?6, phu_trach),
         hang_muc_id = COALESCE(?7, hang_muc_id), trang_thai = COALESCE(?8, trang_thai), cap_nhat_luc = ?9 WHERE id = ?10 AND to_chuc_id = ?11`,
      ).bind(than.ten ?? null, than.mo_ta ?? null, than.xac_suat ?? null, than.tac_dong ?? null, than.bien_phap ?? null,
        than.phu_trach ?? null, than.hang_muc_id ?? null, than.trang_thai ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy rủi ro.');
    }
    if (m === 'DELETE') {
      // Một vấn đề còn tham chiếu tới rủi ro này thì chặn xóa (khóa ngoài CSDL thật sẽ ném lỗi ràng buộc, không phải 409 có ích).
      const coVanDe = await env.CSDL.prepare('SELECT 1 FROM qlda_van_de WHERE rui_ro_id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (coVanDe) return loi(409, 'Rủi ro đang được một vấn đề tham chiếu, hãy bỏ liên kết ở vấn đề đó trước khi xóa.');
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_rui_ro WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy rủi ro.');
    }
  }

  // ---------- RAID: vấn đề ----------
  if (p === '/api/hoalac/van-de' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_van_de WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
    return json({ van_de: results });
  }
  if (p === '/api/hoalac/van-de' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên vấn đề.');
    if (!(await thuocToChuc(env, tc, 'qlda_rui_ro', than.rui_ro_id))) return loi(400, 'Rủi ro không thuộc tổ chức này.');
    if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_van_de (to_chuc_id, ten, mo_ta, muc_do, phu_trach, rui_ro_id, hang_muc_id, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`,
    ).bind(tc, than.ten, than.mo_ta || '', than.muc_do || 'trung', than.phu_trach || '', than.rui_ro_id ?? null, than.hang_muc_id ?? null, phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/van-de\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (!(await thuocToChuc(env, tc, 'qlda_rui_ro', than.rui_ro_id))) return loi(400, 'Rủi ro không thuộc tổ chức này.');
      if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_van_de SET ten = COALESCE(?1, ten), mo_ta = COALESCE(?2, mo_ta), muc_do = COALESCE(?3, muc_do),
         phu_trach = COALESCE(?4, phu_trach), rui_ro_id = COALESCE(?5, rui_ro_id), hang_muc_id = COALESCE(?6, hang_muc_id),
         trang_thai = COALESCE(?7, trang_thai), cap_nhat_luc = ?8 WHERE id = ?9 AND to_chuc_id = ?10`,
      ).bind(than.ten ?? null, than.mo_ta ?? null, than.muc_do ?? null, than.phu_trach ?? null, than.rui_ro_id ?? null,
        than.hang_muc_id ?? null, than.trang_thai ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy vấn đề.');
    }
    if (m === 'DELETE') {
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_van_de WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy vấn đề.');
    }
  }

  // ---------- RAID: thay đổi (luồng duyệt de_xuat -> xem_xet -> duyet|tu_choi) ----------
  if (p === '/api/hoalac/thay-doi' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_thay_doi WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
    return json({ thay_doi: results });
  }
  if (p === '/api/hoalac/thay-doi' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên yêu cầu thay đổi.');
    if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_thay_doi (to_chuc_id, ten, mo_ta, ly_do, anh_huong, hang_muc_id, de_xuat_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(tc, than.ten, than.mo_ta || '', than.ly_do || '', than.anh_huong || '', than.hang_muc_id ?? null, phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/thay-doi\/(\d+)$/)) && m === 'PUT') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    const than = await yeuCau.json().catch(() => ({}));
    if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
    if (than.trang_thai) {
      const hien = await env.CSDL.prepare('SELECT ten, trang_thai FROM qlda_thay_doi WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (!hien) return loi(404, 'Không tìm thấy yêu cầu thay đổi.');
      if (!(CHUYEN_TRANG_THAI_THAY_DOI[hien.trang_thai] || []).includes(than.trang_thai)) {
        return loi(409, `Không chuyển được từ "${hien.trang_thai}" sang "${than.trang_thai}".`);
      }
      // Giữ đúng trạng thái vừa đọc trong điều kiện UPDATE: hai lượt duyệt/từ chối tới cùng lúc thì chỉ một lượt ghi được, lượt sau trả 409 thay vì đè quyết định đã duyệt.
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_thay_doi SET ten = COALESCE(?1, ten), mo_ta = COALESCE(?2, mo_ta), ly_do = COALESCE(?3, ly_do),
         anh_huong = COALESCE(?4, anh_huong), hang_muc_id = COALESCE(?5, hang_muc_id), trang_thai = ?6,
         ghi_chu_duyet = COALESCE(?7, ghi_chu_duyet), duyet_boi = CASE WHEN ?6 IN ('duyet', 'tu_choi') THEN ?8 ELSE duyet_boi END,
         cap_nhat_luc = ?9 WHERE id = ?10 AND to_chuc_id = ?11 AND trang_thai = ?12`,
      ).bind(than.ten ?? null, than.mo_ta ?? null, than.ly_do ?? null, than.anh_huong ?? null, than.hang_muc_id ?? null,
        than.trang_thai, than.ghi_chu_duyet ?? null, phien.email, bayGio, id, tc, hien.trang_thai).run();
      if (!meta.changes) return loi(409, `Trạng thái đã bị một yêu cầu khác đổi (không còn ở "${hien.trang_thai}"), hãy tải lại.`);
      if (than.trang_thai === 'xem_xet') {
        await taoThongBao(env, tc, { loai: 'hoalac_thay_doi', tieu_de: `Thay đổi chờ duyệt: ${hien.ten}`, duong_dan: '/hoalac#raid' });
      }
      return json({ ok: true });
    }
    const { meta } = await env.CSDL.prepare(
      `UPDATE qlda_thay_doi SET ten = COALESCE(?1, ten), mo_ta = COALESCE(?2, mo_ta), ly_do = COALESCE(?3, ly_do),
       anh_huong = COALESCE(?4, anh_huong), hang_muc_id = COALESCE(?5, hang_muc_id), cap_nhat_luc = ?6
       WHERE id = ?7 AND to_chuc_id = ?8`,
    ).bind(than.ten ?? null, than.mo_ta ?? null, than.ly_do ?? null, than.anh_huong ?? null, than.hang_muc_id ?? null, bayGio, id, tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy yêu cầu thay đổi.');
  }
  if ((khop = p.match(/^\/api\/hoalac\/thay-doi\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_thay_doi WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy yêu cầu thay đổi.');
  }

  // ---------- RAID: quyết định ----------
  if (p === '/api/hoalac/quyet-dinh' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_quyet_dinh WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
    return json({ quyet_dinh: results });
  }
  if (p === '/api/hoalac/quyet-dinh' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên quyết định.');
    if (!(await thuocToChuc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return loi(400, 'Hạng mục không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_quyet_dinh (to_chuc_id, ten, noi_dung, can_cu, nguoi_quyet_dinh, ngay_quyet_dinh, hang_muc_id, tao_boi, tao_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(tc, than.ten, than.noi_dung || '', than.can_cu || '', than.nguoi_quyet_dinh || '', than.ngay_quyet_dinh ?? null, than.hang_muc_id ?? null, phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/quyet-dinh\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_quyet_dinh WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy quyết định.');
  }

  // ---------- RAID: bài học ----------
  if (p === '/api/hoalac/bai-hoc' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_bai_hoc WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
    return json({ bai_hoc: results });
  }
  if (p === '/api/hoalac/bai-hoc' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên bài học.');
    if (!(await thuocToChuc(env, tc, 'qlda_giai_doan', than.giai_doan_id))) return loi(400, 'Giai đoạn không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_bai_hoc (to_chuc_id, ten, mo_ta, loai, de_xuat_ap_dung, giai_doan_id, tao_boi, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(tc, than.ten, than.mo_ta || '', than.loai || 'tot', than.de_xuat_ap_dung || '', than.giai_doan_id ?? null, phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/bai-hoc\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_bai_hoc WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy bài học.');
  }

  return loi(404, 'Không có chức năng này.');
}
