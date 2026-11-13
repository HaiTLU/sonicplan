// Kho hồ sơ của khu Dự án: thư mục chuẩn, gắn thủ tục/hợp đồng/bàn giao, phiên bản, nhãn duyệt, hạn hiệu lực.
// Tệp gửi lên bằng multipart (trường 'tep'), lưu vào kho tệp rồi ghi bảng tep, qlda_ho_so, qlda_ho_so_phien_ban
// trong một lần batch. Không có xóa (PM chỉ đặt nhãn 'het_hieu_luc'). Đối tác bị chặn; vai trò 'xem' đã bị
// chặn ghi ở api.js nên chỉ xem và tải về.
import { json, loi, docThan, ngayCoThat, congNgay } from '../tien-ich.js';
import { laDoiTac } from './quyen.js';
import { loaiXem } from '../xem-tep.js';

export const THU_MUC = ['phap_ly', 'hop_dong', 'van_ban', 'bien_ban_hop', 'ban_giao', 'khac'];
export const TRANG_THAI_HO_SO = ['du_thao', 'cho_duyet', 'da_duyet', 'het_hieu_luc'];
export const TEP_TOI_DA = 50 * 1024 * 1024;
export const SAP_HET_HAN_NGAY = 30;
const LIEN_KET = { thu_tuc_id: 'qlda_thu_tuc', hop_dong_id: 'qlda_hop_dong', ban_giao_id: 'qlda_san_pham_ban_giao' };
const BO_QUA = '__ho_so_bo_qua__';

const soNguyenHoacRong = (x) => (x == null || x === '' ? null : Number(x));

async function thuoc(env, tc, bang, id) {
  if (id == null) return true;
  if (!Number.isInteger(id) || id <= 0) return false;
  return !!(await env.CSDL.prepare(`SELECT 1 FROM ${bang} WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc).first());
}

// Kiểm các trường thông tin hồ sơ (dùng chung cho tạo và sửa). Trả câu lỗi hoặc ''.
async function kiemThongTin(env, tc, than, tao) {
  if (tao || 'ten' in than) {
    if (!String(than.ten || '').trim()) return 'Thiếu tên hồ sơ.';
    if (String(than.ten).length > 300) return 'Tên hồ sơ dài quá (tối đa 300 ký tự).';
  }
  if ((tao || 'thu_muc' in than) && !THU_MUC.includes(than.thu_muc)) return 'Thư mục không hợp lệ.';
  if ('han_hieu_luc' in than && than.han_hieu_luc != null && !ngayCoThat(than.han_hieu_luc)) return 'Hạn hiệu lực sai (YYYY-MM-DD).';
  const gan = Object.keys(LIEN_KET).filter((k) => than[k] != null);
  if (gan.length > 1) return 'Mỗi hồ sơ chỉ gắn với một mục: thủ tục, hợp đồng hoặc sản phẩm bàn giao.';
  for (const k of gan) if (!(await thuoc(env, tc, LIEN_KET[k], than[k]))) return 'Mục được gắn không thuộc dự án này.';
  return '';
}

// Đọc multipart: trả { tep: File, truong: {...} } hoặc { loi }.
async function docBieuMau(yeuCau) {
  const dai = Number(yeuCau.headers.get('content-length') || 0);
  if (dai > TEP_TOI_DA + 1024 * 1024) return { loi: 'Tệp lớn quá (tối đa 50 MB).', ma: 413 };
  let fd;
  try { fd = await yeuCau.formData(); } catch { return { loi: 'Không đọc được tệp gửi lên.' }; }
  const tep = fd.get('tep');
  if (!tep || typeof tep === 'string') return { loi: 'Chưa chọn tệp.' };
  if (!tep.size) return { loi: 'Tệp trống.' };
  if (tep.size > TEP_TOI_DA) return { loi: 'Tệp lớn quá (tối đa 50 MB).', ma: 413 };
  const truong = {};
  for (const [k, v] of fd.entries()) if (k !== 'tep' && typeof v === 'string') truong[k] = v;
  return { tep, truong };
}

// Lưu tệp vào kho tệp; trả { khoa, ten, loai, kich_thuoc }.
async function luuTep(env, tc, tep, bayGio) {
  const ten = String(tep.name || 'tep').replace(/[\\/\u0000-\u001f]/g, '_').slice(-150);
  const khoa = `${tc}/ho-so/${bayGio.slice(0, 7)}/${crypto.randomUUID()}-${ten}`;
  const loai = tep.type || 'application/octet-stream';
  await env.TEP.put(khoa, await tep.arrayBuffer(), { httpMetadata: { contentType: loai } });
  return { khoa, ten, loai, kich_thuoc: tep.size };
}

// Hồ sơ của một dự án kèm phiên bản mới nhất và tình trạng hạn: het_han | sap_het_han | null.
export async function docHoSo(env, tc, homNay) {
  const sau = congNgay(homNay, SAP_HET_HAN_NGAY);
  const { results } = await env.CSDL.prepare(
    `SELECT h.*, pb.id AS pb_id, pb.so, pb.trang_thai, pb.ghi_chu AS pb_ghi_chu, pb.doi_boi, pb.doi_luc, pb.tao_boi AS pb_tao_boi, pb.tao_luc AS pb_tao_luc,
       t.ten AS ten_tep, t.kich_thuoc,
       tt.ten AS ten_thu_tuc, hd.ten AS ten_hop_dong, bg.ten AS ten_ban_giao,
       CASE WHEN h.han_hieu_luc IS NULL OR pb.trang_thai = 'het_hieu_luc' THEN NULL
         WHEN h.han_hieu_luc < ?2 THEN 'het_han' WHEN h.han_hieu_luc <= ?3 THEN 'sap_het_han' END AS tinh_trang_han
     FROM qlda_ho_so h
     JOIN qlda_ho_so_phien_ban pb ON pb.ho_so_id = h.id AND pb.to_chuc_id = h.to_chuc_id
       AND pb.so = (SELECT MAX(so) FROM qlda_ho_so_phien_ban x WHERE x.ho_so_id = h.id)
     JOIN tep t ON t.id = pb.tep_id
     LEFT JOIN qlda_thu_tuc tt ON tt.id = h.thu_tuc_id AND tt.to_chuc_id = h.to_chuc_id
     LEFT JOIN qlda_hop_dong hd ON hd.id = h.hop_dong_id AND hd.to_chuc_id = h.to_chuc_id
     LEFT JOIN qlda_san_pham_ban_giao bg ON bg.id = h.ban_giao_id AND bg.to_chuc_id = h.to_chuc_id
     WHERE h.to_chuc_id = ?1 ORDER BY h.cap_nhat_luc DESC, h.id DESC`,
  ).bind(tc, homNay, sau).all();
  return results;
}

export async function xuLyHoSo(yeuCau, env, phien, p, m) {
  if (!p.startsWith('/api/hoalac/ho-so')) return null;
  if (laDoiTac(phien)) return loi(403, 'Tài khoản đối tác không dùng được mục này.');
  const tc = phien.to_chuc.id;
  const bayGio = new Date().toISOString();
  let khop;

  if (p === '/api/hoalac/ho-so' && m === 'GET') {
    const homNay = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    return json({ ho_so: await docHoSo(env, tc, homNay), thu_muc: THU_MUC });
  }

  if (p === '/api/hoalac/ho-so' && m === 'POST') {
    if (!env.TEP) return loi(503, 'Chưa có kho tệp.');
    const bm = await docBieuMau(yeuCau);
    if (bm.loi) return loi(bm.ma || 400, bm.loi);
    const f = bm.truong;
    const than = {
      ten: (f.ten || '').trim() || bm.tep.name, thu_muc: f.thu_muc, mo_ta: f.mo_ta || '',
      han_hieu_luc: f.han_hieu_luc || null,
      thu_tuc_id: soNguyenHoacRong(f.thu_tuc_id), hop_dong_id: soNguyenHoacRong(f.hop_dong_id), ban_giao_id: soNguyenHoacRong(f.ban_giao_id),
    };
    const trangThai = f.trang_thai || 'du_thao';
    if (!TRANG_THAI_HO_SO.includes(trangThai)) return loi(400, 'Trạng thái không hợp lệ.');
    const sai = await kiemThongTin(env, tc, than, true);
    if (sai) return loi(400, sai);
    const t = await luuTep(env, tc, bm.tep, bayGio);
    try {
      await env.CSDL.batch([
        env.CSDL.prepare(
          `INSERT INTO tep (to_chuc_id, ten, loai, kich_thuoc, r2_khoa, nguon, nguoi_gui, thu_muc, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, 'ho_so', ?6, 'Hồ sơ dự án', ?7)`,
        ).bind(tc, t.ten, t.loai, t.kich_thuoc, t.khoa, phien.email, bayGio),
        env.CSDL.prepare(
          `INSERT INTO qlda_ho_so (to_chuc_id, thu_muc, ten, mo_ta, thu_tuc_id, hop_dong_id, ban_giao_id, han_hieu_luc, tao_boi, tao_luc, cap_nhat_luc)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
        ).bind(tc, than.thu_muc, than.ten.trim(), String(than.mo_ta), than.thu_tuc_id, than.hop_dong_id, than.ban_giao_id, than.han_hieu_luc, phien.email, bayGio),
        env.CSDL.prepare(
          `INSERT INTO qlda_ho_so_phien_ban (to_chuc_id, ho_so_id, so, tep_id, trang_thai, doi_boi, doi_luc, tao_boi, tao_luc)
           VALUES (?1, last_insert_rowid(), 1, (SELECT id FROM tep WHERE r2_khoa = ?2), ?3, ?4, ?5, ?4, ?5)`,
        ).bind(tc, t.khoa, trangThai, phien.email, bayGio),
      ]);
    } catch (e) {
      await env.TEP.delete?.(t.khoa)?.catch?.(() => {});
      throw e;
    }
    const moi = await env.CSDL.prepare(
      'SELECT pb.ho_so_id FROM qlda_ho_so_phien_ban pb JOIN tep t ON t.id = pb.tep_id WHERE t.r2_khoa = ?1 AND pb.to_chuc_id = ?2',
    ).bind(t.khoa, tc).first();
    return json({ id: moi.ho_so_id }, 201);
  }

  // Tải phiên bản mới: số phiên bản tính trong cùng câu INSERT nên hai người tải cùng lúc không trùng số.
  if ((khop = p.match(/^\/api\/hoalac\/ho-so\/(\d+)\/phien-ban$/)) && m === 'POST') {
    if (!env.TEP) return loi(503, 'Chưa có kho tệp.');
    const id = Number(khop[1]);
    if (!(await thuoc(env, tc, 'qlda_ho_so', id))) return loi(404, 'Không tìm thấy hồ sơ.');
    const bm = await docBieuMau(yeuCau);
    if (bm.loi) return loi(bm.ma || 400, bm.loi);
    const trangThai = bm.truong.trang_thai || 'du_thao';
    if (!TRANG_THAI_HO_SO.includes(trangThai)) return loi(400, 'Trạng thái không hợp lệ.');
    const t = await luuTep(env, tc, bm.tep, bayGio);
    try {
      await env.CSDL.batch([
        env.CSDL.prepare(
          `INSERT INTO tep (to_chuc_id, ten, loai, kich_thuoc, r2_khoa, nguon, nguoi_gui, thu_muc, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, 'ho_so', ?6, 'Hồ sơ dự án', ?7)`,
        ).bind(tc, t.ten, t.loai, t.kich_thuoc, t.khoa, phien.email, bayGio),
        env.CSDL.prepare(
          `INSERT INTO qlda_ho_so_phien_ban (to_chuc_id, ho_so_id, so, tep_id, trang_thai, ghi_chu, doi_boi, doi_luc, tao_boi, tao_luc)
           SELECT ?1, ?2, COALESCE(MAX(so), 0) + 1, (SELECT id FROM tep WHERE r2_khoa = ?3), ?4, ?5, ?6, ?7, ?6, ?7
           FROM qlda_ho_so_phien_ban WHERE ho_so_id = ?2`,
        ).bind(tc, id, t.khoa, trangThai, String(bm.truong.ghi_chu || ''), phien.email, bayGio),
        env.CSDL.prepare('UPDATE qlda_ho_so SET cap_nhat_luc = ?1 WHERE id = ?2 AND to_chuc_id = ?3').bind(bayGio, id, tc),
      ]);
    } catch (e) {
      await env.TEP.delete?.(t.khoa)?.catch?.(() => {});
      throw e;
    }
    return json({ ok: true }, 201);
  }

  if ((khop = p.match(/^\/api\/hoalac\/ho-so\/(\d+)\/phien-ban$/)) && m === 'GET') {
    const id = Number(khop[1]);
    const { results } = await env.CSDL.prepare(
      `SELECT pb.id, pb.so, pb.trang_thai, pb.ghi_chu, pb.doi_boi, pb.doi_luc, pb.tao_boi, pb.tao_luc, t.ten AS ten_tep, t.kich_thuoc
       FROM qlda_ho_so_phien_ban pb JOIN tep t ON t.id = pb.tep_id WHERE pb.ho_so_id = ?1 AND pb.to_chuc_id = ?2 ORDER BY pb.so DESC`,
    ).bind(id, tc).all();
    if (!results.length) return loi(404, 'Không tìm thấy hồ sơ.');
    return json({ phien_ban: results });
  }

  if ((khop = p.match(/^\/api\/hoalac\/ho-so\/(\d+)$/)) && m === 'PUT') {
    const id = Number(khop[1]);
    const than = await docThan(yeuCau);
    const cu = await env.CSDL.prepare('SELECT * FROM qlda_ho_so WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
    if (!cu) return loi(404, 'Không tìm thấy hồ sơ.');
    // Kiểm "một mục được gắn" trên giá trị sau khi sửa: trường không gửi giữ giá trị cũ.
    const sau = { ...than };
    for (const k of Object.keys(LIEN_KET)) if (!(k in than)) sau[k] = cu[k];
    for (const k of Object.keys(LIEN_KET)) if (k in than) sau[k] = soNguyenHoacRong(than[k]);
    const sai = await kiemThongTin(env, tc, sau, false);
    if (sai) return loi(400, sai);
    const giu = (k) => (k in than ? (sau[k] ?? null) : BO_QUA);
    await env.CSDL.prepare(
      `UPDATE qlda_ho_so SET ten = COALESCE(?1, ten), thu_muc = COALESCE(?2, thu_muc), mo_ta = COALESCE(?3, mo_ta),
       thu_tuc_id = CASE WHEN ?4 IS ?9 THEN thu_tuc_id ELSE ?4 END, hop_dong_id = CASE WHEN ?5 IS ?9 THEN hop_dong_id ELSE ?5 END,
       ban_giao_id = CASE WHEN ?6 IS ?9 THEN ban_giao_id ELSE ?6 END, han_hieu_luc = CASE WHEN ?7 IS ?9 THEN han_hieu_luc ELSE ?7 END,
       cap_nhat_luc = ?8 WHERE id = ?10 AND to_chuc_id = ?11`,
    ).bind('ten' in than ? String(than.ten).trim() : null, than.thu_muc ?? null, than.mo_ta == null ? null : String(than.mo_ta),
      giu('thu_tuc_id'), giu('hop_dong_id'), giu('ban_giao_id'), giu('han_hieu_luc'), bayGio, BO_QUA, id, tc).run();
    return json({ ok: true });
  }

  // Đổi nhãn một phiên bản: ghi người đổi và lúc đổi.
  if ((khop = p.match(/^\/api\/hoalac\/ho-so\/phien-ban\/(\d+)$/)) && m === 'PUT') {
    const id = Number(khop[1]);
    const than = await docThan(yeuCau);
    if (than.trang_thai != null && !TRANG_THAI_HO_SO.includes(than.trang_thai)) return loi(400, 'Trạng thái không hợp lệ.');
    const { meta } = await env.CSDL.prepare(
      `UPDATE qlda_ho_so_phien_ban SET trang_thai = COALESCE(?1, trang_thai), ghi_chu = COALESCE(?2, ghi_chu),
       doi_boi = CASE WHEN ?1 IS NULL THEN doi_boi ELSE ?3 END, doi_luc = CASE WHEN ?1 IS NULL THEN doi_luc ELSE ?4 END
       WHERE id = ?5 AND to_chuc_id = ?6`,
    ).bind(than.trang_thai ?? null, than.ghi_chu == null ? null : String(than.ghi_chu), phien.email, bayGio, id, tc).run();
    return meta.changes ? json({ ok: true }) : loi(404, 'Không tìm thấy phiên bản.');
  }

  // Tải về (mặc định) hoặc xem trong trang (?xem=1, chỉ ảnh và PDF; không bao giờ phục vụ HTML hay SVG).
  if ((khop = p.match(/^\/api\/hoalac\/ho-so\/phien-ban\/(\d+)\/tai$/)) && m === 'GET') {
    const id = Number(khop[1]);
    const t = await env.CSDL.prepare(
      'SELECT t.ten, t.r2_khoa FROM qlda_ho_so_phien_ban pb JOIN tep t ON t.id = pb.tep_id AND t.to_chuc_id = pb.to_chuc_id WHERE pb.id = ?1 AND pb.to_chuc_id = ?2',
    ).bind(id, tc).first();
    if (!t?.r2_khoa) return loi(404, 'Không tìm thấy tệp.');
    const vat = env.TEP && (await env.TEP.get(t.r2_khoa));
    if (!vat) return loi(404, 'Tệp không còn trong kho.');
    const xem = new URL(yeuCau.url).searchParams.get('xem') === '1' && ['anh', 'pdf'].includes(loaiXem(t.ten)?.kieu);
    return new Response(vat.body, {
      headers: {
        'content-type': xem ? loaiXem(t.ten).mime : 'application/octet-stream',
        'content-disposition': `${xem ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(t.ten)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  return loi(404, 'Không có địa chỉ này trong kho hồ sơ.');
}
