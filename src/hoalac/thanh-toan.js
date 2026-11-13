// Đợt thanh toán của hợp đồng (khu Dự án): API, tính "đủ điều kiện" và cảnh báo.
// Đã trả thì tạo một dòng qlda_giai_ngan trong cùng giao dịch; bỏ đánh dấu thì gỡ dòng đó.
// Đối tác không dùng được mục này (giống ngân sách); vai trò 'xem' đã bị chặn ghi ở api.js.
import { json, loi, docThan, ngayCoThat, congNgay } from '../tien-ich.js';
import { laDoiTac } from './quyen.js';

const BO_QUA = '__thanh_toan_bo_qua__';
// PUT chỉ đổi qua lại giữa các trạng thái này; 'da_tra' chỉ đặt qua /tra để luôn có dòng giải ngân đi kèm.
const TRANG_THAI_SUA_DUOC = ['cho', 'da_de_nghi', 'huy'];
const BAN_GIAO_DU_DIEU_KIEN = ['da_giao', 'dang_xem', 'da_duyet'];
const SAP_DEN_HAN_NGAY = 7;
// Tổng các đợt khác giá trị hợp đồng quá chừng này (đơn vị tiền) mới báo lệch, tránh báo vì làm tròn.
const SAI_SO_TIEN = 1;

const soHopLeHoacRong = (x) => x == null || (Number.isFinite(x) && x >= 0);
const ngayHopLeHoacRong = (x) => x == null || ngayCoThat(x);

async function thuoc(env, tc, bang, id) {
  if (id == null) return true;
  if (!Number.isInteger(id)) return false;
  return !!(await env.CSDL.prepare(`SELECT 1 FROM ${bang} WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc).first());
}

// Đợt của một dự án kèm tên hợp đồng và cờ du_dieu_kien (0/1) tính lúc đọc.
export async function docDotThanhToan(env, tc) {
  const { results } = await env.CSDL.prepare(
    `SELECT d.*, h.ten AS ten_hop_dong, h.trang_thai AS trang_thai_hop_dong,
       CASE WHEN d.trang_thai = 'cho' AND (hm.trang_thai = 'xong' OR bg.trang_thai IN ('da_giao', 'dang_xem', 'da_duyet'))
         THEN 1 ELSE 0 END AS du_dieu_kien
     FROM qlda_dot_thanh_toan d
     JOIN qlda_hop_dong h ON h.id = d.hop_dong_id AND h.to_chuc_id = d.to_chuc_id
     LEFT JOIN qlda_hang_muc hm ON hm.id = d.hang_muc_id AND hm.to_chuc_id = d.to_chuc_id
     LEFT JOIN qlda_san_pham_ban_giao bg ON bg.id = d.ban_giao_id AND bg.to_chuc_id = d.to_chuc_id
     WHERE d.to_chuc_id = ?1 ORDER BY d.hop_dong_id, d.thu_tu, d.id`,
  ).bind(tc).all();
  return results;
}

// Cảnh báo của một dự án. loai: qua_han | sap_den_han | du_dieu_kien | lech_gia_tri.
// Một đợt quá hạn không báo thêm "sắp đến hạn"; đủ điều kiện báo riêng vì là việc khác (làm hồ sơ).
export async function canhBaoThanhToan(env, tc, homNay) {
  const dot = (await docDotThanhToan(env, tc)).filter((d) => d.trang_thai_hop_dong !== 'da_huy');
  const sau = congNgay(homNay, SAP_DEN_HAN_NGAY);
  const ra = [];
  for (const d of dot) {
    const conNo = d.trang_thai === 'cho' || d.trang_thai === 'da_de_nghi';
    const goc = { dot_id: d.id, hop_dong_id: d.hop_dong_id, ten: d.ten, ten_hop_dong: d.ten_hop_dong, han: d.han };
    if (conNo && d.han && d.han < homNay) ra.push({ loai: 'qua_han', ...goc });
    else if (conNo && d.han && d.han <= sau) ra.push({ loai: 'sap_den_han', ...goc });
    if (d.du_dieu_kien) ra.push({ loai: 'du_dieu_kien', ...goc });
  }

  const { results: hopDong } = await env.CSDL.prepare(
    `SELECT id, ten, gia_tri FROM qlda_hop_dong WHERE to_chuc_id = ?1 AND trang_thai <> 'da_huy' AND gia_tri IS NOT NULL`,
  ).bind(tc).all();
  for (const h of hopDong) {
    const cua = dot.filter((d) => d.hop_dong_id === h.id && d.trang_thai !== 'huy');
    if (!cua.length) continue;
    const coSo = cua.filter((d) => d.so_tien != null);
    const tong = coSo.reduce((s, d) => s + d.so_tien, 0);
    const duSo = coSo.length === cua.length;
    if ((duSo && Math.abs(tong - h.gia_tri) > SAI_SO_TIEN) || tong > h.gia_tri + SAI_SO_TIEN) {
      ra.push({ loai: 'lech_gia_tri', hop_dong_id: h.id, ten_hop_dong: h.ten, tong_dot: tong, gia_tri: h.gia_tri, du_so: duSo });
    }
  }
  return ra;
}

function kiemTruong(than) {
  if ('so_tien' in than && !soHopLeHoacRong(than.so_tien)) return 'Số tiền không hợp lệ.';
  if ('han' in than && !ngayHopLeHoacRong(than.han)) return 'Hạn không hợp lệ (YYYY-MM-DD).';
  if ('thu_tu' in than && than.thu_tu != null && !Number.isInteger(than.thu_tu)) return 'Thứ tự phải là số nguyên.';
  if (than.hang_muc_id != null && than.ban_giao_id != null) return 'Chỉ gắn một điều kiện: hạng mục hoặc bàn giao.';
  return null;
}

async function kiemLienKet(env, tc, than) {
  if (!(await thuoc(env, tc, 'qlda_hang_muc', than.hang_muc_id))) return 'Hạng mục không thuộc dự án này.';
  if (!(await thuoc(env, tc, 'qlda_san_pham_ban_giao', than.ban_giao_id))) return 'Sản phẩm bàn giao không thuộc dự án này.';
  return null;
}

export async function xuLyThanhToan(yeuCau, env, phien, p, m) {
  if (!p.startsWith('/api/hoalac/dot-thanh-toan')) return null;
  if (laDoiTac(phien)) return loi(403, 'Tài khoản đối tác không dùng được mục này.');
  const tc = phien.to_chuc.id;
  const bayGio = new Date().toISOString();
  let khop;

  if (p === '/api/hoalac/dot-thanh-toan' && m === 'GET') {
    const homNay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    return json({ dot_thanh_toan: await docDotThanhToan(env, tc), canh_bao: await canhBaoThanhToan(env, tc, homNay) });
  }

  if (p === '/api/hoalac/dot-thanh-toan' && m === 'POST') {
    const than = await docThan(yeuCau);
    if (!than.ten || typeof than.ten !== 'string') return loi(400, 'Thiếu tên đợt thanh toán.');
    if (!Number.isInteger(than.hop_dong_id) || !(await thuoc(env, tc, 'qlda_hop_dong', than.hop_dong_id))) return loi(400, 'Hợp đồng không thuộc dự án này.');
    const sai = kiemTruong(than) || (await kiemLienKet(env, tc, than));
    if (sai) return loi(400, sai);
    if (than.trang_thai != null && !TRANG_THAI_SUA_DUOC.includes(than.trang_thai)) return loi(400, 'Trạng thái không hợp lệ.');
    const { meta } = await env.CSDL.prepare(
      `INSERT INTO qlda_dot_thanh_toan (to_chuc_id, hop_dong_id, ten, thu_tu, so_tien, han, hang_muc_id, ban_giao_id, dieu_kien, trang_thai, ghi_chu, tao_boi, tao_luc, cap_nhat_luc)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
    ).bind(tc, than.hop_dong_id, than.ten, than.thu_tu ?? 0, than.so_tien ?? null, than.han ?? null, than.hang_muc_id ?? null,
      than.ban_giao_id ?? null, String(than.dieu_kien || ''), than.trang_thai || 'cho', String(than.ghi_chu || ''), phien.email, bayGio).run();
    return json({ id: meta.last_row_id }, 201);
  }

  if ((khop = p.match(/^\/api\/hoalac\/dot-thanh-toan\/(\d+)$/)) && (m === 'PUT' || m === 'DELETE')) {
    const id = Number(khop[1]);
    const dot = await env.CSDL.prepare('SELECT * FROM qlda_dot_thanh_toan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
    if (!dot) return loi(404, 'Không tìm thấy đợt thanh toán.');
    if (dot.trang_thai === 'da_tra') return loi(409, 'Đợt đã trả. Bỏ đánh dấu đã trả trước khi sửa hoặc xóa.');
    if (m === 'DELETE') {
      await env.CSDL.prepare('DELETE FROM qlda_dot_thanh_toan WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai <> \'da_tra\'').bind(id, tc).run();
      return json({ ok: true });
    }
    const than = await docThan(yeuCau);
    const sai = kiemTruong({
      ...than,
      hang_muc_id: 'hang_muc_id' in than ? than.hang_muc_id : dot.hang_muc_id,
      ban_giao_id: 'ban_giao_id' in than ? than.ban_giao_id : dot.ban_giao_id,
    }) || (await kiemLienKet(env, tc, than));
    if (sai) return loi(400, sai);
    if (than.trang_thai != null && !TRANG_THAI_SUA_DUOC.includes(than.trang_thai)) return loi(400, 'Trạng thái không hợp lệ. Dùng nút Đã trả để đánh dấu đã trả.');
    if ('ten' in than && (!than.ten || typeof than.ten !== 'string')) return loi(400, 'Tên đợt không được trống.');
    const giu = (k) => (k in than ? (than[k] ?? null) : BO_QUA);
    const { meta } = await env.CSDL.prepare(
      `UPDATE qlda_dot_thanh_toan SET ten = COALESCE(?1, ten), thu_tu = COALESCE(?2, thu_tu),
       so_tien = CASE WHEN ?3 IS ?12 THEN so_tien ELSE ?3 END, han = CASE WHEN ?4 IS ?12 THEN han ELSE ?4 END,
       hang_muc_id = CASE WHEN ?5 IS ?12 THEN hang_muc_id ELSE ?5 END, ban_giao_id = CASE WHEN ?6 IS ?12 THEN ban_giao_id ELSE ?6 END,
       dieu_kien = COALESCE(?7, dieu_kien), trang_thai = COALESCE(?8, trang_thai), ghi_chu = COALESCE(?9, ghi_chu), cap_nhat_luc = ?10
       WHERE id = ?11 AND to_chuc_id = ?13 AND trang_thai <> 'da_tra'`,
    ).bind(than.ten ?? null, than.thu_tu ?? null, giu('so_tien'), giu('han'), giu('hang_muc_id'), giu('ban_giao_id'),
      than.dieu_kien == null ? null : String(than.dieu_kien), than.trang_thai ?? null, than.ghi_chu == null ? null : String(than.ghi_chu), bayGio, id, BO_QUA, tc).run();
    return meta.changes ? json({ ok: true }) : loi(409, 'Đợt vừa đổi trạng thái. Tải lại trang.');
  }

  // Đánh dấu đã trả: ghi đợt và dòng giải ngân trong một giao dịch. Điều kiện trạng thái ở từng câu
  // nên bấm hai lần (hoặc hai người cùng bấm) chỉ tạo đúng một dòng giải ngân.
  if ((khop = p.match(/^\/api\/hoalac\/dot-thanh-toan\/(\d+)\/tra$/)) && m === 'POST') {
    const id = Number(khop[1]);
    const than = await docThan(yeuCau);
    if (!Number.isFinite(than.so_tien) || than.so_tien < 0) return loi(400, 'Thiếu hoặc sai số tiền thực trả.');
    if (!ngayCoThat(than.ngay)) return loi(400, 'Thiếu hoặc sai ngày trả (YYYY-MM-DD).');
    if (!(await thuoc(env, tc, 'qlda_ngan_sach_dong', than.ngan_sach_dong_id))) return loi(400, 'Dòng ngân sách không thuộc dự án này.');
    const dot = await env.CSDL.prepare('SELECT trang_thai FROM qlda_dot_thanh_toan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
    if (!dot) return loi(404, 'Không tìm thấy đợt thanh toán.');
    if (dot.trang_thai === 'da_tra') return loi(409, 'Đợt này đã đánh dấu đã trả rồi.');
    if (dot.trang_thai === 'huy') return loi(409, 'Đợt đã hủy, không đánh dấu trả được.');
    const [doi] = await env.CSDL.batch([
      env.CSDL.prepare(
        `UPDATE qlda_dot_thanh_toan SET trang_thai = 'da_tra', ngay_tra = ?1, giai_ngan_id = NULL, cap_nhat_luc = ?2
         WHERE id = ?3 AND to_chuc_id = ?4 AND trang_thai IN ('cho', 'da_de_nghi')`,
      ).bind(than.ngay, bayGio, id, tc),
      env.CSDL.prepare(
        `INSERT INTO qlda_giai_ngan (to_chuc_id, ngan_sach_dong_id, so_tien, ngay, noi_dung, tao_boi, tao_luc)
         SELECT ?1, ?2, ?3, ?4, 'Đợt thanh toán: ' || d.ten || ' - HĐ ' || h.ten, ?5, ?6
         FROM qlda_dot_thanh_toan d JOIN qlda_hop_dong h ON h.id = d.hop_dong_id
         WHERE d.id = ?7 AND d.to_chuc_id = ?1 AND d.trang_thai = 'da_tra' AND d.giai_ngan_id IS NULL AND d.cap_nhat_luc = ?6`,
      ).bind(tc, than.ngan_sach_dong_id ?? null, than.so_tien, than.ngay, phien.email, bayGio, id),
      env.CSDL.prepare(
        `UPDATE qlda_dot_thanh_toan SET giai_ngan_id = last_insert_rowid()
         WHERE id = ?1 AND to_chuc_id = ?2 AND trang_thai = 'da_tra' AND giai_ngan_id IS NULL AND cap_nhat_luc = ?3`,
      ).bind(id, tc, bayGio),
    ]);
    if (!doi.meta.changes) return loi(409, 'Đợt vừa đổi trạng thái. Tải lại trang.');
    return json({ ok: true });
  }

  // Bỏ đánh dấu đã trả: đợt về 'da_de_nghi', dòng giải ngân đi kèm bị gỡ.
  if ((khop = p.match(/^\/api\/hoalac\/dot-thanh-toan\/(\d+)\/bo-tra$/)) && m === 'POST') {
    const id = Number(khop[1]);
    const dot = await env.CSDL.prepare('SELECT trang_thai, giai_ngan_id FROM qlda_dot_thanh_toan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
    if (!dot) return loi(404, 'Không tìm thấy đợt thanh toán.');
    if (dot.trang_thai !== 'da_tra') return loi(409, 'Đợt này chưa đánh dấu đã trả.');
    const [doi] = await env.CSDL.batch([
      env.CSDL.prepare(
        `UPDATE qlda_dot_thanh_toan SET trang_thai = 'da_de_nghi', ngay_tra = NULL, giai_ngan_id = NULL, cap_nhat_luc = ?1
         WHERE id = ?2 AND to_chuc_id = ?3 AND trang_thai = 'da_tra' AND giai_ngan_id IS ?4`,
      ).bind(bayGio, id, tc, dot.giai_ngan_id ?? null),
      env.CSDL.prepare(
        `DELETE FROM qlda_giai_ngan WHERE id = ?1 AND to_chuc_id = ?2
         AND NOT EXISTS (SELECT 1 FROM qlda_dot_thanh_toan WHERE giai_ngan_id = ?1)`,
      ).bind(dot.giai_ngan_id ?? null, tc),
    ]);
    if (!doi.meta.changes) return loi(409, 'Đợt vừa đổi trạng thái. Tải lại trang.');
    return json({ ok: true });
  }

  return loi(404, 'Không có địa chỉ này.');
}
