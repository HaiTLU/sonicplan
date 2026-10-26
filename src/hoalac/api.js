// API phân hệ Viện Hòa Lạc: giai đoạn (stage gate), hạng mục (WBS/Gantt/Kanban), phụ thuộc (CPM), baseline,
// RAID (rủi ro/vấn đề/thay đổi/quyết định/bài học), Pháp lý (các bên liên quan, RACI, hợp đồng tư vấn,
// thủ tục pháp lý, văn bản đi/đến, họp). Mọi địa chỉ /api/hoalac/*.
// Đối tác (doi_tac) chỉ GET đúng hạng mục/thủ tục được gán (quyen.js); các mục còn lại (RAID, các bên
// liên quan, RACI, hợp đồng, văn bản, họp) không có cơ chế gán theo dòng nên chặn hẳn cho đối tác (403).
import { json, loi } from '../tien-ich.js';
import { laDoiTac, idHangMucDuocXem, duocXemHangMuc, idThuTucDuocXem, duocXemThuTuc } from './quyen.js';
import { capNhatCpm } from './wbs.js';
import { taoThongBao } from '../thong-bao.js';

// Mức rủi ro cao (ma trận 5x5, điểm từ 1 đến 25): từ 15 điểm trở lên thì báo, không phải mọi rủi ro.
const DIEM_RUI_RO_CAO = 15;

// Đánh dấu "không gửi field này, giữ nguyên" khi PUT dùng COALESCE - phân biệt với gửi null (muốn xóa liên kết),
// vì COALESCE(null, cot) luôn giữ nguyên nên không tự xóa được một khóa ngoài nullable qua PUT một phần.
const BO_QUA = '__hoalac_bo_qua__';
const TRANG_THAI_SO_LIEU_HOP_LE = ['chua_thong_nhat', 'da_xac_nhan'];
// true nếu x là null/undefined (hợp lệ, "chưa có số") hoặc một số hữu hạn; false với chuỗi, NaN, Infinity...
const soHopLeHoacRong = (x) => x == null || Number.isFinite(x);

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

  // ---------- Pháp lý: các bên liên quan ----------
  if (p === '/api/hoalac/ben-lien-quan' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_ben_lien_quan WHERE to_chuc_id = ?1 ORDER BY ten').bind(tc).all();
    return json({ ben_lien_quan: results });
  }
  if (p === '/api/hoalac/ben-lien-quan' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên bên liên quan.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_ben_lien_quan (to_chuc_id, ten, loai, don_vi, vai_tro, lien_he, muc_do_anh_huong, ghi_chu, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
    ).bind(tc, than.ten, than.loai || 'tu_van', than.don_vi || '', than.vai_tro || '', than.lien_he || '',
      than.muc_do_anh_huong ?? null, than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/ben-lien-quan\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_ben_lien_quan SET ten = COALESCE(?1, ten), loai = COALESCE(?2, loai), don_vi = COALESCE(?3, don_vi),
         vai_tro = COALESCE(?4, vai_tro), lien_he = COALESCE(?5, lien_he), muc_do_anh_huong = COALESCE(?6, muc_do_anh_huong),
         ghi_chu = COALESCE(?7, ghi_chu), cap_nhat_luc = ?8 WHERE id = ?9 AND to_chuc_id = ?10`,
      ).bind(than.ten ?? null, than.loai ?? null, than.don_vi ?? null, than.vai_tro ?? null, than.lien_he ?? null,
        than.muc_do_anh_huong ?? null, than.ghi_chu ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy bên liên quan.');
    }
    if (m === 'DELETE') {
      const coHopDong = await env.CSDL.prepare('SELECT 1 FROM qlda_hop_dong WHERE ben_lien_quan_id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (coHopDong) return loi(409, 'Bên liên quan đang gắn với một hợp đồng, hãy xóa hoặc đổi hợp đồng đó trước.');
      const kq = await env.CSDL.batch([
        env.CSDL.prepare('DELETE FROM qlda_raci WHERE ben_lien_quan_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
        env.CSDL.prepare('DELETE FROM qlda_ben_lien_quan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
      ]);
      return kq[1].meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy bên liên quan.');
    }
  }

  // ---------- Pháp lý: RACI ----------
  if (p === '/api/hoalac/raci' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare(
      `SELECT r.*, b.ten AS ben_lien_quan_ten FROM qlda_raci r JOIN qlda_ben_lien_quan b ON b.id = r.ben_lien_quan_id
       WHERE r.to_chuc_id = ?1 ORDER BY r.id DESC`,
    ).bind(tc).all();
    return json({ raci: results });
  }
  if (p === '/api/hoalac/raci' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.hoat_dong || !than.ben_lien_quan_id || !than.vai_tro) return loi(400, 'Thiếu hoạt động, bên liên quan hoặc vai trò.');
    if (!['R', 'A', 'C', 'I'].includes(than.vai_tro)) return loi(400, 'Vai trò RACI phải là R, A, C hoặc I.');
    if (!(await thuocToChuc(env, tc, 'qlda_ben_lien_quan', than.ben_lien_quan_id))) return loi(400, 'Bên liên quan không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_raci (to_chuc_id, hoat_dong, ben_lien_quan_id, vai_tro, ghi_chu, tao_boi, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(tc, than.hoat_dong, than.ben_lien_quan_id, than.vai_tro, than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/raci\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_raci WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy dòng RACI.');
  }

  // ---------- Pháp lý: hợp đồng tư vấn ----------
  if (p === '/api/hoalac/hop-dong' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_hop_dong WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
    return json({ hop_dong: results });
  }
  if (p === '/api/hoalac/hop-dong' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên hợp đồng.');
    if (!(await thuocToChuc(env, tc, 'qlda_ben_lien_quan', than.ben_lien_quan_id))) return loi(400, 'Bên liên quan không thuộc tổ chức này.');
    if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_hop_dong (to_chuc_id, ten, ben_lien_quan_id, so_hop_dong, gia_tri, don_vi_tien, ngay_ky, ngay_bat_dau, ngay_ket_thuc, trang_thai, tep_id, ghi_chu, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)`,
    ).bind(tc, than.ten, than.ben_lien_quan_id ?? null, than.so_hop_dong || '', than.gia_tri ?? null, than.don_vi_tien || 'VND',
      than.ngay_ky ?? null, than.ngay_bat_dau ?? null, than.ngay_ket_thuc ?? null, than.trang_thai || 'du_thao', than.tep_id ?? null,
      than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/hop-dong\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (!(await thuocToChuc(env, tc, 'qlda_ben_lien_quan', than.ben_lien_quan_id))) return loi(400, 'Bên liên quan không thuộc tổ chức này.');
      if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_hop_dong SET ten = COALESCE(?1, ten), ben_lien_quan_id = COALESCE(?2, ben_lien_quan_id), so_hop_dong = COALESCE(?3, so_hop_dong),
         gia_tri = COALESCE(?4, gia_tri), don_vi_tien = COALESCE(?5, don_vi_tien), ngay_ky = COALESCE(?6, ngay_ky),
         ngay_bat_dau = COALESCE(?7, ngay_bat_dau), ngay_ket_thuc = COALESCE(?8, ngay_ket_thuc), trang_thai = COALESCE(?9, trang_thai),
         tep_id = COALESCE(?10, tep_id), ghi_chu = COALESCE(?11, ghi_chu), cap_nhat_luc = ?12 WHERE id = ?13 AND to_chuc_id = ?14`,
      ).bind(than.ten ?? null, than.ben_lien_quan_id ?? null, than.so_hop_dong ?? null, than.gia_tri ?? null, than.don_vi_tien ?? null,
        than.ngay_ky ?? null, than.ngay_bat_dau ?? null, than.ngay_ket_thuc ?? null, than.trang_thai ?? null, than.tep_id ?? null,
        than.ghi_chu ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy hợp đồng.');
    }
    if (m === 'DELETE') {
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_hop_dong WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy hợp đồng.');
    }
  }

  // ---------- Pháp lý: thủ tục (đối tác chỉ xem đúng thủ tục được gán, 404 nếu không) ----------
  if (p === '/api/hoalac/thu-tuc' && m === 'GET') {
    let { results } = await env.CSDL.prepare('SELECT * FROM qlda_thu_tuc WHERE to_chuc_id = ?1 ORDER BY nhom, id').bind(tc).all();
    if (laDoiTac(phien)) {
      const duocXem = await idThuTucDuocXem(env, phien);
      results = results.filter((t) => duocXem.has(t.id));
    }
    return json({ thu_tuc: results });
  }
  if (p === '/api/hoalac/thu-tuc' && m === 'POST') {
    const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên thủ tục.');
    if (!than.nhom || !['A', 'B', 'C', 'D', 'E'].includes(than.nhom)) return loi(400, 'Nhóm phải là A, B, C, D hoặc E.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_thu_tuc (to_chuc_id, ma_nguon, nhom, ten, don_vi_phu_trach, nguon, can_cu, diem_chua_ro, so_ngay, la_moc, ngay_co_dinh, trang_thai, ghi_chu, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)`,
    ).bind(tc, than.ma_nguon || '', than.nhom, than.ten, than.don_vi_phu_trach || '', than.nguon || '', than.can_cu || '',
      than.diem_chua_ro || '', than.so_ngay ?? null, than.la_moc ? 1 : 0, than.ngay_co_dinh ?? null, than.trang_thai || 'todo',
      than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/thu-tuc\/(\d+)$/))) {
    const id = Number(khop[1]);
    if (m === 'GET') {
      if (!(await duocXemThuTuc(env, phien, id))) return loi(404, 'Không tìm thấy thủ tục.');
      const r = await env.CSDL.prepare('SELECT * FROM qlda_thu_tuc WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      return r ? json(r) : loi(404, 'Không tìm thấy thủ tục.');
    }
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (laDoiTac(phien)) {
        // Đối tác chỉ cập nhật trạng thái thực hiện của đúng thủ tục được gán, không đổi cấu trúc/căn cứ pháp lý.
        if (!(await duocXemThuTuc(env, phien, id))) return loi(404, 'Không tìm thấy thủ tục.');
        const { meta } = await env.CSDL.prepare(
          `UPDATE qlda_thu_tuc SET trang_thai = COALESCE(?1, trang_thai), ngay_bat_dau_thuc_te = COALESCE(?2, ngay_bat_dau_thuc_te),
           ngay_hoan_thanh_thuc_te = COALESCE(?3, ngay_hoan_thanh_thuc_te), cap_nhat_luc = ?4 WHERE id = ?5 AND to_chuc_id = ?6`,
        ).bind(than.trang_thai ?? null, than.ngay_bat_dau_thuc_te ?? null, than.ngay_hoan_thanh_thuc_te ?? null, bayGio, id, tc).run();
        return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy thủ tục.');
      }
      if (than.nhom && !['A', 'B', 'C', 'D', 'E'].includes(than.nhom)) return loi(400, 'Nhóm phải là A, B, C, D hoặc E.');
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_thu_tuc SET ma_nguon = COALESCE(?1, ma_nguon), nhom = COALESCE(?2, nhom), ten = COALESCE(?3, ten),
         don_vi_phu_trach = COALESCE(?4, don_vi_phu_trach), nguon = COALESCE(?5, nguon), can_cu = COALESCE(?6, can_cu),
         diem_chua_ro = COALESCE(?7, diem_chua_ro), so_ngay = COALESCE(?8, so_ngay), la_moc = COALESCE(?9, la_moc),
         ngay_co_dinh = COALESCE(?10, ngay_co_dinh), ngay_bat_dau_thuc_te = COALESCE(?11, ngay_bat_dau_thuc_te),
         ngay_hoan_thanh_thuc_te = COALESCE(?12, ngay_hoan_thanh_thuc_te), trang_thai = COALESCE(?13, trang_thai),
         ghi_chu = COALESCE(?14, ghi_chu), cap_nhat_luc = ?15 WHERE id = ?16 AND to_chuc_id = ?17`,
      ).bind(than.ma_nguon ?? null, than.nhom ?? null, than.ten ?? null, than.don_vi_phu_trach ?? null, than.nguon ?? null,
        than.can_cu ?? null, than.diem_chua_ro ?? null, than.so_ngay ?? null, than.la_moc == null ? null : (than.la_moc ? 1 : 0),
        than.ngay_co_dinh ?? null, than.ngay_bat_dau_thuc_te ?? null, than.ngay_hoan_thanh_thuc_te ?? null, than.trang_thai ?? null,
        than.ghi_chu ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy thủ tục.');
    }
    if (m === 'DELETE') {
      const chan = CHI_CHU_THANH_VIEN(phien); if (chan) return chan;
      const coVanBan = await env.CSDL.prepare('SELECT 1 FROM qlda_van_ban WHERE lien_quan_thu_tuc_id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (coVanBan) return loi(409, 'Thủ tục đang được một văn bản tham chiếu, hãy bỏ liên kết ở văn bản đó trước khi xóa.');
      const kq = await env.CSDL.batch([
        env.CSDL.prepare('DELETE FROM qlda_thu_tuc_phu_thuoc WHERE to_chuc_id = ?1 AND (truoc_id = ?2 OR sau_id = ?2)').bind(tc, id),
        env.CSDL.prepare(`DELETE FROM qlda_giao_doi_tac WHERE to_chuc_id = ?1 AND loai = 'thu_tuc' AND doi_tuong_id = ?2`).bind(tc, id),
        env.CSDL.prepare('DELETE FROM qlda_thu_tuc WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
      ]);
      return kq[2].meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy thủ tục.');
    }
  }

  // ---------- Pháp lý: phụ thuộc giữa thủ tục (chỉ để hiển thị thứ tự, không tính CPM) ----------
  if (p === '/api/hoalac/thu-tuc-phu-thuoc' && m === 'GET') {
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_thu_tuc_phu_thuoc WHERE to_chuc_id = ?1').bind(tc).all();
    return json({ thu_tuc_phu_thuoc: laDoiTac(phien) ? [] : results });
  }
  if (p === '/api/hoalac/thu-tuc-phu-thuoc' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.truoc_id || !than.sau_id) return loi(400, 'Thiếu thủ tục trước hoặc sau.');
    if (than.truoc_id === than.sau_id) return loi(400, 'Một thủ tục không tự phụ thuộc chính nó.');
    if (!(await thuocToChuc(env, tc, 'qlda_thu_tuc', than.truoc_id))) return loi(400, 'Thủ tục trước không thuộc tổ chức này.');
    if (!(await thuocToChuc(env, tc, 'qlda_thu_tuc', than.sau_id))) return loi(400, 'Thủ tục sau không thuộc tổ chức này.');
    try {
      await env.CSDL.prepare('INSERT INTO qlda_thu_tuc_phu_thuoc (to_chuc_id, truoc_id, sau_id) VALUES (?1, ?2, ?3)')
        .bind(tc, than.truoc_id, than.sau_id).run();
      return json({ ok: true }, 201);
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return loi(409, 'Hai thủ tục này đã có phụ thuộc với nhau.');
      throw e;
    }
  }
  if ((khop = p.match(/^\/api\/hoalac\/thu-tuc-phu-thuoc\/(\d+)\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_thu_tuc_phu_thuoc WHERE to_chuc_id = ?1 AND truoc_id = ?2 AND sau_id = ?3')
      .bind(tc, Number(khop[1]), Number(khop[2])).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy phụ thuộc.');
  }

  // ---------- Pháp lý: văn bản đi/đến ----------
  if (p === '/api/hoalac/van-ban' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_van_ban WHERE to_chuc_id = ?1 ORDER BY id DESC').bind(tc).all();
    return json({ van_ban: results });
  }
  if (p === '/api/hoalac/van-ban' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.trich_yeu) return loi(400, 'Thiếu trích yếu văn bản.');
    if (!than.loai || !['den', 'di'].includes(than.loai)) return loi(400, 'Loại văn bản phải là "den" hoặc "di".');
    if (!(await thuocToChuc(env, tc, 'qlda_thu_tuc', than.lien_quan_thu_tuc_id))) return loi(400, 'Thủ tục không thuộc tổ chức này.');
    if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_van_ban (to_chuc_id, loai, so_hieu, trich_yeu, noi_gui, noi_nhan, ngay_van_ban, ngay_nhan_gui, lien_quan_thu_tuc_id, tep_id, ghi_chu, tao_boi, tao_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    ).bind(tc, than.loai, than.so_hieu || '', than.trich_yeu, than.noi_gui || '', than.noi_nhan || '', than.ngay_van_ban ?? null,
      than.ngay_nhan_gui ?? null, than.lien_quan_thu_tuc_id ?? null, than.tep_id ?? null, than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/van-ban\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (!(await thuocToChuc(env, tc, 'qlda_thu_tuc', than.lien_quan_thu_tuc_id))) return loi(400, 'Thủ tục không thuộc tổ chức này.');
      if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
      // Gửi lien_quan_thu_tuc_id: null là cố ý bỏ liên kết; không gửi field này mới giữ nguyên.
      const lienQuanThuTuc = 'lien_quan_thu_tuc_id' in than ? than.lien_quan_thu_tuc_id : BO_QUA;
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_van_ban SET loai = COALESCE(?1, loai), so_hieu = COALESCE(?2, so_hieu), trich_yeu = COALESCE(?3, trich_yeu),
         noi_gui = COALESCE(?4, noi_gui), noi_nhan = COALESCE(?5, noi_nhan), ngay_van_ban = COALESCE(?6, ngay_van_ban),
         ngay_nhan_gui = COALESCE(?7, ngay_nhan_gui),
         lien_quan_thu_tuc_id = CASE WHEN ?8 = ?13 THEN lien_quan_thu_tuc_id ELSE ?8 END,
         tep_id = COALESCE(?9, tep_id), ghi_chu = COALESCE(?10, ghi_chu) WHERE id = ?11 AND to_chuc_id = ?12`,
      ).bind(than.loai ?? null, than.so_hieu ?? null, than.trich_yeu ?? null, than.noi_gui ?? null, than.noi_nhan ?? null,
        than.ngay_van_ban ?? null, than.ngay_nhan_gui ?? null, lienQuanThuTuc, than.tep_id ?? null, than.ghi_chu ?? null, id, tc, BO_QUA).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy văn bản.');
    }
    if (m === 'DELETE') {
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_van_ban WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy văn bản.');
    }
  }

  // ---------- Pháp lý: họp ----------
  if (p === '/api/hoalac/hop' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_hop WHERE to_chuc_id = ?1 ORDER BY thoi_gian DESC').bind(tc).all();
    return json({ hop: results });
  }
  if (p === '/api/hoalac/hop' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.tieu_de || !than.thoi_gian) return loi(400, 'Thiếu tiêu đề hoặc thời gian họp.');
    if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_hop (to_chuc_id, tieu_de, thoi_gian, dia_diem, thanh_phan, noi_dung, tep_id, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`,
    ).bind(tc, than.tieu_de, than.thoi_gian, than.dia_diem || '', than.thanh_phan || '', than.noi_dung || '', than.tep_id ?? null, phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/hop\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'GET') {
      const cuoc = await env.CSDL.prepare('SELECT * FROM qlda_hop WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (!cuoc) return loi(404, 'Không tìm thấy cuộc họp.');
      const { results } = await env.CSDL.prepare('SELECT * FROM qlda_hop_viec WHERE hop_id = ?1 AND to_chuc_id = ?2 ORDER BY id').bind(id, tc).all();
      return json({ ...cuoc, viec: results });
    }
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_hop SET tieu_de = COALESCE(?1, tieu_de), thoi_gian = COALESCE(?2, thoi_gian), dia_diem = COALESCE(?3, dia_diem),
         thanh_phan = COALESCE(?4, thanh_phan), noi_dung = COALESCE(?5, noi_dung), tep_id = COALESCE(?6, tep_id), cap_nhat_luc = ?7
         WHERE id = ?8 AND to_chuc_id = ?9`,
      ).bind(than.tieu_de ?? null, than.thoi_gian ?? null, than.dia_diem ?? null, than.thanh_phan ?? null, than.noi_dung ?? null,
        than.tep_id ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy cuộc họp.');
    }
    if (m === 'DELETE') {
      const kq = await env.CSDL.batch([
        env.CSDL.prepare('DELETE FROM qlda_hop_viec WHERE hop_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
        env.CSDL.prepare('DELETE FROM qlda_hop WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
      ]);
      return kq[1].meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy cuộc họp.');
    }
  }

  // ---------- Pháp lý: việc sau họp ----------
  if (p === '/api/hoalac/hop-viec' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.noi_dung || !than.hop_id) return loi(400, 'Thiếu nội dung hoặc cuộc họp.');
    if (!(await thuocToChuc(env, tc, 'qlda_hop', than.hop_id))) return loi(400, 'Cuộc họp không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_hop_viec (to_chuc_id, hop_id, noi_dung, phu_trach, han, trang_thai, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(tc, than.hop_id, than.noi_dung, than.phu_trach || '', than.han ?? null, than.trang_thai || 'chua_xong', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/hop-viec\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (!(await thuocToChuc(env, tc, 'qlda_hop', than.hop_id))) return loi(400, 'Cuộc họp không thuộc tổ chức này.');
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_hop_viec SET noi_dung = COALESCE(?1, noi_dung), phu_trach = COALESCE(?2, phu_trach), han = COALESCE(?3, han),
         trang_thai = COALESCE(?4, trang_thai), cap_nhat_luc = ?5 WHERE id = ?6 AND to_chuc_id = ?7`,
      ).bind(than.noi_dung ?? null, than.phu_trach ?? null, than.han ?? null, than.trang_thai ?? null, bayGio, id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy việc sau họp.');
    }
    if (m === 'DELETE') {
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_hop_viec WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy việc sau họp.');
    }
  }

  // ---------- Ngân sách & EVM (chưa có cơ chế gán theo dòng cho đối tác, chặn hẳn như RAID) ----------
  if (p === '/api/hoalac/ngan-sach' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_ngan_sach_dong WHERE to_chuc_id = ?1 ORDER BY nhom, id').bind(tc).all();
    return json({ ngan_sach: results });
  }
  if (p === '/api/hoalac/ngan-sach' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ten) return loi(400, 'Thiếu tên dòng ngân sách.');
    if (than.trang_thai_so_lieu && !TRANG_THAI_SO_LIEU_HOP_LE.includes(than.trang_thai_so_lieu)) return loi(400, 'Trạng thái số liệu không hợp lệ.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_ngan_sach_dong (to_chuc_id, ten, nhom, ngan_sach_du_kien, don_vi_tien, nguon, trang_thai_so_lieu, ghi_chu, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
    ).bind(tc, than.ten, than.nhom || '', than.ngan_sach_du_kien ?? null, than.don_vi_tien || 'VND', than.nguon || '',
      than.trang_thai_so_lieu || 'chua_thong_nhat', than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/ngan-sach\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      if (than.trang_thai_so_lieu && !TRANG_THAI_SO_LIEU_HOP_LE.includes(than.trang_thai_so_lieu)) return loi(400, 'Trạng thái số liệu không hợp lệ.');
      // Số tiền phải tự xóa được về NULL (quay lại "chưa thống nhất"), nên dùng BO_QUA thay COALESCE thẳng.
      const ngs = 'ngan_sach_du_kien' in than ? than.ngan_sach_du_kien : BO_QUA;
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_ngan_sach_dong SET ten = COALESCE(?1, ten), nhom = COALESCE(?2, nhom),
         ngan_sach_du_kien = CASE WHEN ?3 = ?11 THEN ngan_sach_du_kien ELSE ?3 END,
         don_vi_tien = COALESCE(?4, don_vi_tien), nguon = COALESCE(?5, nguon), trang_thai_so_lieu = COALESCE(?6, trang_thai_so_lieu),
         ghi_chu = COALESCE(?7, ghi_chu), cap_nhat_luc = ?8 WHERE id = ?9 AND to_chuc_id = ?10`,
      ).bind(than.ten ?? null, than.nhom ?? null, ngs, than.don_vi_tien ?? null, than.nguon ?? null,
        than.trang_thai_so_lieu ?? null, than.ghi_chu ?? null, bayGio, id, tc, BO_QUA).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy dòng ngân sách.');
    }
    if (m === 'DELETE') {
      const coGiaiNgan = await env.CSDL.prepare('SELECT 1 FROM qlda_giai_ngan WHERE ngan_sach_dong_id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
      if (coGiaiNgan) return loi(409, 'Dòng ngân sách đang có giải ngân, hãy xóa hoặc đổi các giải ngân đó trước.');
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_ngan_sach_dong WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy dòng ngân sách.');
    }
  }

  if (p === '/api/hoalac/giai-ngan' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_giai_ngan WHERE to_chuc_id = ?1 ORDER BY ngay DESC, id DESC').bind(tc).all();
    return json({ giai_ngan: results });
  }
  if (p === '/api/hoalac/giai-ngan' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!Number.isFinite(than.so_tien)) return loi(400, 'Thiếu hoặc sai số tiền giải ngân.');
    if (!(await thuocToChuc(env, tc, 'qlda_ngan_sach_dong', than.ngan_sach_dong_id))) return loi(400, 'Dòng ngân sách không thuộc tổ chức này.');
    if (!(await thuocToChuc(env, tc, 'tep', than.tep_id))) return loi(400, 'Tệp không thuộc tổ chức này.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_giai_ngan (to_chuc_id, ngan_sach_dong_id, so_tien, ngay, noi_dung, tep_id, tao_boi, tao_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(tc, than.ngan_sach_dong_id ?? null, than.so_tien, than.ngay ?? null, than.noi_dung || '', than.tep_id ?? null, phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/giai-ngan\/(\d+)$/)) && m === 'DELETE') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    const { meta } = await env.CSDL.prepare('DELETE FROM qlda_giai_ngan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy giải ngân.');
  }

  if (p === '/api/hoalac/evm' && m === 'GET') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const { results } = await env.CSDL.prepare('SELECT * FROM qlda_evm WHERE to_chuc_id = ?1 ORDER BY ky').bind(tc).all();
    return json({ evm: results.map(tinhEvm) });
  }
  if (p === '/api/hoalac/evm' && m === 'POST') {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const than = await yeuCau.json().catch(() => ({}));
    if (!than.ky) return loi(400, 'Thiếu kỳ báo cáo.');
    if (!soHopLeHoacRong(than.pv) || !soHopLeHoacRong(than.ac) || !soHopLeHoacRong(than.ev)) return loi(400, 'PV/AC/EV phải là số hoặc để trống.');
    const trung = await env.CSDL.prepare('SELECT 1 FROM qlda_evm WHERE to_chuc_id = ?1 AND ky = ?2').bind(tc, than.ky).first();
    if (trung) return loi(409, 'Kỳ này đã có dòng EVM, hãy sửa dòng cũ.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_evm (to_chuc_id, ky, pv, ac, ev, ghi_chu, tao_boi, tao_luc, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
    ).bind(tc, than.ky, than.pv ?? null, than.ac ?? null, than.ev ?? null, than.ghi_chu || '', phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }
  if ((khop = p.match(/^\/api\/hoalac\/evm\/(\d+)$/))) {
    const chan = CHAN_DOI_TAC(phien); if (chan) return chan;
    const id = Number(khop[1]);
    if (m === 'PUT') {
      const than = await yeuCau.json().catch(() => ({}));
      // pv/ac/ev phải tự xóa được về NULL khi số nguồn bị rút lại, nên dùng BO_QUA cho cả ba.
      const pv = 'pv' in than ? than.pv : BO_QUA;
      const ac = 'ac' in than ? than.ac : BO_QUA;
      const ev = 'ev' in than ? than.ev : BO_QUA;
      if (!soHopLeHoacRong(pv === BO_QUA ? null : pv) || !soHopLeHoacRong(ac === BO_QUA ? null : ac) || !soHopLeHoacRong(ev === BO_QUA ? null : ev)) {
        return loi(400, 'PV/AC/EV phải là số hoặc để trống.');
      }
      if (than.ky) {
        const trung = await env.CSDL.prepare('SELECT 1 FROM qlda_evm WHERE to_chuc_id = ?1 AND ky = ?2 AND id <> ?3').bind(tc, than.ky, id).first();
        if (trung) return loi(409, 'Kỳ này đã có dòng EVM khác, hãy sửa dòng đó hoặc chọn kỳ khác.');
      }
      const { meta } = await env.CSDL.prepare(
        `UPDATE qlda_evm SET ky = COALESCE(?1, ky),
         pv = CASE WHEN ?2 = ?9 THEN pv ELSE ?2 END, ac = CASE WHEN ?3 = ?9 THEN ac ELSE ?3 END, ev = CASE WHEN ?4 = ?9 THEN ev ELSE ?4 END,
         ghi_chu = COALESCE(?5, ghi_chu), cap_nhat_luc = ?6 WHERE id = ?7 AND to_chuc_id = ?8`,
      ).bind(than.ky ?? null, pv, ac, ev, than.ghi_chu ?? null, bayGio, id, tc, BO_QUA).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy kỳ EVM.');
    }
    if (m === 'DELETE') {
      const { meta } = await env.CSDL.prepare('DELETE FROM qlda_evm WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).run();
      return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy kỳ EVM.');
    }
  }

  return loi(404, 'Không có chức năng này.');
}

// EVM: cv/sv/cpi/spi tính từ pv/ev/ac khi có đủ số (và mẫu khác 0), không lưu cứng để khỏi lệch khi sửa số nguồn.
function tinhEvm(r) {
  const cv = r.ev != null && r.ac != null ? r.ev - r.ac : null;
  const sv = r.ev != null && r.pv != null ? r.ev - r.pv : null;
  const cpi = r.ev != null && r.ac ? r.ev / r.ac : null;
  const spi = r.ev != null && r.pv ? r.ev / r.pv : null;
  return { ...r, cv, sv, cpi, spi };
}
