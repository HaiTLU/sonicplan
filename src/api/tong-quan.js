// API giao diện: Tổng quan, tình trạng hệ thống và nhật ký chạy.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { docCaiDat, ghiCaiDat } from '../hop-tin.js';
import { TAC_VU } from '../lich-chay.js';
import { json, loi, ngayVN } from '../tien-ich.js';
import { tinhTinhTrang } from '../tinh-trang.js';

// ---- Tổng quan ----

// Các khối của trang Tổng quan, người dùng ẩn hiện và đổi thứ tự được (lưu theo từng người).
export const KHOI_TONG_QUAN = ['can-lam', 'de-xuat-claude', 'chi-so', 'du-an', 'viec-toi', 'nhip', 'hieu-suat', 'tong-hop', 'tin-moi', 'he-thong'];

export function chuanBoCuc(x) {
  const hop = (ds) => [...new Set((Array.isArray(ds) ? ds : []).filter((k) => KHOI_TONG_QUAN.includes(k)))];
  const thuTu = hop(x?.thu_tu);
  return { thu_tu: [...thuTu, ...KHOI_TONG_QUAN.filter((k) => !thuTu.includes(k))], an: hop(x?.an) };
}

async function tongQuan(env, tc, phien) {
  const homNay = ngayVN();
  const tuanTruoc = new Date(Date.now() - 7 * 86400000).toISOString();
  const haiTuan = new Date(Date.now() - 14 * 86400000).toISOString();
  const ngay8 = congNgayIso(homNay, -7);
  // Lọc theo khoảng thời gian UTC của ngày VN để dùng được chỉ mục; hàm date(datetime(...)) buộc quét cả bảng.
  const dauNgay = (ngay) => new Date(`${ngay}T00:00:00+07:00`).toISOString();
  const dau = dauNgay(homNay);
  const cuoi = dauNgay(congNgayIso(homNay, 1));
  const dau8 = dauNgay(ngay8);
  const theoGio = (bang, cot, them = '') =>
    env.CSDL.prepare(
      `SELECT CAST(strftime('%H', datetime(${cot}, '+7 hours')) AS INTEGER) AS gio, COUNT(*) AS n FROM ${bang}
       WHERE to_chuc_id IN ${bang === 'nhat_ky_chay' ? "('', ?1)" : '(?1)'} ${bang === 'tin_nhan' ? 'AND an = 0' : ''} AND ${cot} >= ?2 AND ${cot} < ?3 ${them} GROUP BY gio`,
    ).bind(tc, dau, cuoi);
  const theoNgay = (bang, cot, them = '') =>
    env.CSDL.prepare(
      `SELECT date(datetime(${cot}, '+7 hours')) AS ngay, COUNT(*) AS n FROM ${bang}
       WHERE to_chuc_id = ?1 ${them} AND ${cot} >= ?2 GROUP BY ngay`,
    ).bind(tc, dau8);
  const [soLieu, tinGio, viecGio, chayGio, chayLoiGio, sapToi, tinMoi, tinTuan, viecNgay, xongNgay, theoDuAn, claude, boCuc, deXuat] = await env.CSDL.batch([
    env.CSDL.prepare(
      `SELECT
        (SELECT COUNT(*) FROM tin_nhan WHERE to_chuc_id = ?1 AND an = 0 AND thoi_diem >= ?5 AND thoi_diem < ?6) AS tin_hom_nay,
        (SELECT COUNT(*) FROM tin_nhan WHERE to_chuc_id = ?1 AND an = 0 AND da_xem = 0) AS tin_chua_xem,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo') AS viec_mo,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay < ?2) AS viec_qua_han,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay = ?2) AS viec_hom_nay,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'xong' AND xong_luc >= ?5 AND xong_luc < ?6) AS xong_hom_nay,
        (SELECT COUNT(*) FROM tep WHERE to_chuc_id = ?1 AND tao_luc >= ?3) AS tep_tuan,
        (SELECT COUNT(*) FROM tep WHERE to_chuc_id = ?1 AND tao_luc >= ?4 AND tao_luc < ?3) AS tep_tuan_truoc`,
    ).bind(tc, homNay, tuanTruoc, haiTuan, dau, cuoi),
    theoGio('tin_nhan', 'thoi_diem'),
    theoGio('viec', 'tao_luc'),
    theoGio('nhat_ky_chay', 'bat_dau'),
    theoGio('nhat_ky_chay', 'bat_dau', "AND trang_thai = 'loi'"),
    env.CSDL.prepare(
      `SELECT id, tieu_de, han_ngay, gio_hen, ghi_chu FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo'
       ORDER BY han_ngay IS NULL, han_ngay, gio_hen IS NULL, gio_hen, id DESC LIMIT 8`,
    ).bind(tc),
    env.CSDL.prepare(
      `SELECT id, nguon, nguoi_gui, nhom, tieu_de, substr(noi_dung, 1, 160) AS trich, thoi_diem, da_xem FROM tin_nhan
       WHERE to_chuc_id = ?1 AND an = 0 ORDER BY thoi_diem DESC LIMIT 6`,
    ).bind(tc),
    theoNgay('tin_nhan', 'thoi_diem', 'AND an = 0'),
    theoNgay('viec', 'tao_luc'),
    theoNgay('viec', 'xong_luc', "AND trang_thai = 'xong'"),
    // Bảng theo dự án: đang mở, quá hạn, tới hạn 7 ngày, xong 7 ngày.
    env.CSDL.prepare(
      `SELECT d.id, d.ten, d.mau,
         SUM(v.trang_thai = 'mo') AS mo,
         SUM(v.trang_thai = 'mo' AND v.han_ngay < ?2) AS qua_han,
         SUM(v.trang_thai = 'mo' AND v.han_ngay >= ?2 AND v.han_ngay <= ?3) AS sap_han,
         SUM(v.trang_thai = 'xong' AND v.xong_luc >= ?4) AS xong_7
       FROM du_an d LEFT JOIN viec v ON v.du_an_id = d.id AND v.to_chuc_id = d.to_chuc_id
       WHERE d.to_chuc_id = ?1 GROUP BY d.id ORDER BY mo DESC, qua_han DESC, d.ten`,
    ).bind(tc, homNay, congNgayIso(homNay, 7), tuanTruoc),
    // Claude: lượt 7 ngày và việc đang chờ người dùng (hỏi lại hoặc xong chưa duyệt).
    env.CSDL.prepare(
      `SELECT
        (SELECT COUNT(*) FROM luot_claude WHERE to_chuc_id = ?1 AND lo_id IS NULL AND tao_luc >= ?2) AS luot_7,
        (SELECT COUNT(*) FROM luot_claude WHERE to_chuc_id = ?1 AND lo_id IS NULL AND tao_luc >= ?2 AND trang_thai = 'xong') AS xong_7,
        (SELECT COUNT(*) FROM luot_claude WHERE to_chuc_id = ?1 AND lo_id IS NULL AND tao_luc >= ?2 AND trang_thai = 'loi') AS loi_7,
        (SELECT COUNT(*) FROM luot_claude WHERE to_chuc_id = ?1 AND trang_thai IN ('cho', 'dang_lam')) AS dang_chay,
        (SELECT COUNT(*) FROM viec v JOIN luot_claude l ON l.id = (SELECT MAX(id) FROM luot_claude k WHERE k.viec_id = v.id AND k.to_chuc_id = v.to_chuc_id)
           WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'mo' AND l.trang_thai = 'xong' AND l.danh_gia IS NULL) AS cho_ban`,
    ).bind(tc, tuanTruoc),
    env.CSDL.prepare('SELECT gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = ?2').bind(tc, `tq_bo_cuc:${phien?.nguoi_dung?.id || ''}`),
    // Đề xuất giao Claude: việc AI xếp "Claude tự làm" được, chưa giao lượt nào. Bạn bấm mới giao.
    env.CSDL.prepare(
      `SELECT v.id, v.tieu_de, v.han_ngay, v.gio_hen, v.ghi_chu, COUNT(*) OVER () AS tong FROM viec v
       WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'mo' AND v.nhom = 'claude_tu_lam' AND v.github_issue IS NULL
         AND NOT EXISTS (SELECT 1 FROM luot_claude l WHERE l.to_chuc_id = v.to_chuc_id AND l.viec_id = v.id)
       ORDER BY v.han_ngay IS NULL, v.han_ngay, v.id DESC LIMIT 6`,
    ).bind(tc),
  ]);
  const mang8 = (kq) => Array.from({ length: 8 }, (_, i) => kq.results.find((r) => r.ngay === congNgayIso(homNay, i - 7))?.n || 0);
  let bc = null;
  try { bc = JSON.parse(boCuc.results[0]?.gia_tri || 'null'); } catch {}
  const mang24 = (kq) => {
    const a = Array(24).fill(0);
    for (const r of kq.results) if (r.gio >= 0 && r.gio < 24) a[r.gio] = r.n;
    return a;
  };
  return {
    hom_nay: homNay,
    so_lieu: soLieu.results[0],
    nhip: { tin: mang24(tinGio), viec: mang24(viecGio), chay: mang24(chayGio), loi: mang24(chayLoiGio) },
    tin_7_ngay: tinTuan.results,
    theo_ngay: { tin: mang8(tinTuan), viec: mang8(viecNgay), xong: mang8(xongNgay) },
    du_an: theoDuAn.results,
    claude: claude.results[0],
    bo_cuc: chuanBoCuc(bc),
    viec_sap_toi: sapToi.results,
    de_xuat_claude: { tong: deXuat.results[0]?.tong || 0, viec: deXuat.results.map(({ tong, ...v }) => v) },
    tin_moi: tinMoi.results,
    tinh_trang: await layTinhTrang(env, tc),
  };
}

function congNgayIso(ngay, n) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function layTinhTrang(env, tc) {
  const [tinHieu, lanChayCuoi, khoa, tinHieuTc] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT nguon, lan_cuoi FROM tin_hieu WHERE to_chuc_id = ''`),
    // Mỗi (tổ chức, tác vụ) lấy một dòng mới nhất qua chỉ mục, không quét cả nhật ký.
    env.CSDL.prepare(
      ['', tc].flatMap((_, i) => TAC_VU.map((__, j) =>
        `SELECT * FROM (SELECT tac_vu, bat_dau, ket_thuc, trang_thai, so_muc, ghi_chu FROM nhat_ky_chay WHERE to_chuc_id = ?${i + 1} AND tac_vu = ?${j + 3} ORDER BY id DESC LIMIT 1)`)
      ).join(' UNION ALL '),
    ).bind('', tc, ...TAC_VU.map((t) => t.ma)),
    env.CSDL.prepare('SELECT loai, MAX(dung_luc) AS dung_luc FROM khoa_truy_cap WHERE to_chuc_id = ?1 GROUP BY loai').bind(tc),
    env.CSDL.prepare('SELECT nguon, lan_cuoi, ghi_chu FROM tin_hieu WHERE to_chuc_id = ?1').bind(tc),
  ]);
  const ketNoi = await tinhKetNoi(env, tc, khoa.results, tinHieuTc.results);
  return tinhTinhTrang({ tinHieuHeThong: tinHieu.results, ketNoi, lanChayCuoi: lanChayCuoi.results, bayGio: Date.now() });
}

const gioTruoc = (iso) => {
  const phut = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (phut < 60) return `${phut} phút trước`;
  if (phut < 48 * 60) return `${Math.round(phut / 60)} giờ trước`;
  return `${Math.round(phut / 1440)} ngày trước`;
};

async function tinhKetNoi(env, tc, khoa, tinHieu) {
  const coKhoa = Object.fromEntries(khoa.map((k) => [k.loai, k]));
  const th = Object.fromEntries(tinHieu.map((t) => [t.nguon, t]));
  const ds = [];
  if (coKhoa.zalo) {
    const z = th.zalo;
    if (!z) ds.push({ loai: 'zalo', trang_thai: 'cho', mo_ta: 'Đã tạo mã, chờ máy Mac gửi tin' });
    else if (Date.now() - Date.parse(z.lan_cuoi) > 6 * 3600000) ds.push({ loai: 'zalo', trang_thai: 'loi', mo_ta: `Máy Mac im ${gioTruoc(z.lan_cuoi).replace(' trước', '')}`, cap_nhat_luc: z.lan_cuoi });
    else ds.push({ loai: 'zalo', trang_thai: 'dang_chay', mo_ta: `Tín hiệu ${gioTruoc(z.lan_cuoi)}`, cap_nhat_luc: z.lan_cuoi });
  }
  if (th.github) ds.push({ loai: 'github', trang_thai: th.github.ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th.github.ghi_chu || 'Đã nối', cap_nhat_luc: th.github.lan_cuoi });
  if (th['api-vao']) ds.push({ loai: 'api-vao', trang_thai: th['api-vao'].ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th['api-vao'].ghi_chu || 'Đang nhận', cap_nhat_luc: th['api-vao'].lan_cuoi });
  if (th.google) ds.push({ loai: 'google', trang_thai: th.google.ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th.google.ghi_chu?.startsWith('Lỗi') ? th.google.ghi_chu.slice(0, 120) : `Đồng bộ ${gioTruoc(th.google.lan_cuoi)}`, cap_nhat_luc: th.google.lan_cuoi });
  if (th.hop) ds.push({ loai: 'hop', trang_thai: th.hop.ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th.hop.ghi_chu?.startsWith('Lỗi') ? th.hop.ghi_chu.slice(0, 120) : `Quét họp ${gioTruoc(th.hop.lan_cuoi)}`, cap_nhat_luc: th.hop.lan_cuoi });
  if (th.kho) ds.push({ loai: 'kho', trang_thai: th.kho.ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th.kho.ghi_chu?.startsWith('Lỗi') ? th.kho.ghi_chu.slice(0, 120) : `Lưu ${gioTruoc(th.kho.lan_cuoi)}`, cap_nhat_luc: th.kho.lan_cuoi });
  if (env.TEP) ds.push({ loai: 'tep', trang_thai: 'dang_chay', mo_ta: 'Kho R2 sẵn sàng' });
  if (coKhoa.lich) ds.push({ loai: 'lich', trang_thai: 'dang_chay', mo_ta: coKhoa.lich.dung_luc ? `Lịch đọc ${gioTruoc(coKhoa.lich.dung_luc)}` : 'Chờ ứng dụng lịch đọc lần đầu' });
  if (env.AI) {
    const loiAi = await env.CSDL.prepare(`SELECT COUNT(*) AS n FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 3 AND tao_luc >= ?2`)
      .bind(tc, new Date(Date.now() - 86400000).toISOString())
      .first();
    ds.push(loiAi.n ? { loai: 'ai', trang_thai: 'loi', mo_ta: `${loiAi.n} tin không tách được trong 24 giờ` } : { loai: 'ai', trang_thai: 'dang_chay', mo_ta: 'Workers AI sẵn sàng' });
  }
  if (await docCaiDat(env, tc, 'telegram_chat_id')) ds.push({ loai: 'telegram', trang_thai: 'dang_chay', mo_ta: th.telegram ? `Gửi lần cuối ${gioTruoc(th.telegram.lan_cuoi)}` : 'Đã nối' });
  return ds;
}

async function layNhatKy(env, tc, url) {
  const soDong = Math.min(Math.max(Number(url.searchParams.get('so_dong')) || 50, 1), 300);
  const { results } = await env.CSDL.prepare(
    `SELECT id, tac_vu, bat_dau, ket_thuc, trang_thai, so_muc, ghi_chu FROM nhat_ky_chay
     WHERE to_chuc_id IN ('', ?1) ORDER BY id DESC LIMIT ?2`,
  ).bind(tc, soDong).all();
  return { dong: results };
}

export async function xuLyTongQuan(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;

  if (p === '/api/tong-quan' && m === 'GET') return json(await tongQuan(env, tc, phien));
  if (p === '/api/tong-quan/bo-cuc' && m === 'PUT') {
    const bc = chuanBoCuc(await yeuCau.json().catch(() => null));
    await ghiCaiDat(env, tc, `tq_bo_cuc:${phien.nguoi_dung.id}`, JSON.stringify(bc));
    return json({ bo_cuc: bc });
  }
  if (p === '/api/tinh-trang' && m === 'GET') return json(await layTinhTrang(env, tc));
  if (p === '/api/nhat-ky' && m === 'GET') return json(await layNhatKy(env, tc, url));

  return null;
}
