// API cho giao diện. Mọi hàm nhận phien (người dùng và tổ chức đã xác định) và chỉ đọc ghi
// dữ liệu của phien.to_chuc.id.

import { docCaiDat } from './hop-tin.js';
import { caiBot, layBot, maNoiTelegram } from './telegram.js';
import { bam, cat, json, loi, maNgauNhien, ngayVN } from './tien-ich.js';
import { tinhTinhTrang } from './tinh-trang.js';
import { themViec } from './viec.js';

const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function xuLyApi(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/toi' && m === 'GET') return json({ email: phien.email, nguoi_dung: phien.nguoi_dung, to_chuc: phien.to_chuc, cac_to_chuc: phien.cac_to_chuc });
  if (p === '/api/tong-quan' && m === 'GET') return json(await tongQuan(env, tc));
  if (p === '/api/tinh-trang' && m === 'GET') return json(await layTinhTrang(env, tc));
  if (p === '/api/nhat-ky' && m === 'GET') return json(await layNhatKy(env, tc, url));

  if (p === '/api/tin' && m === 'GET') return json(await dsTin(env, tc, url));
  if (p === '/api/tin/da-xem-het' && m === 'POST') {
    await env.CSDL.prepare('UPDATE tin_nhan SET da_xem = 1 WHERE to_chuc_id = ?1 AND da_xem = 0').bind(tc).run();
    return json({ ok: true });
  }
  if ((khop = p.match(/^\/api\/tin\/(\d+)$/)) && m === 'GET') return motTin(env, tc, Number(khop[1]));

  if (p === '/api/viec' && m === 'GET') return json(await dsViec(env, tc, url));
  if (p === '/api/viec' && m === 'POST') return taoViec(env, tc, await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/viec\/(\d+)$/)) && m === 'PATCH') return suaViec(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));

  if (p === '/api/tep' && m === 'GET') return json(await dsTep(env, tc, url));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/tai$/)) && m === 'GET') return taiTep(env, tc, Number(khop[1]));

  if (p === '/api/ket-noi' && m === 'GET') return json(await layKetNoi(env, tc, url, phien));
  if ((khop = p.match(/^\/api\/ket-noi\/(zalo|lich)$/)) && m === 'POST') return taoKhoa(env, tc, khop[1], url);
  if (p === '/api/ket-noi/telegram/bot' && m === 'POST') {
    if (!laQuanTri(env, phien)) return loi(403, 'Chỉ người quản trị hệ thống cài được bot.');
    const { token } = await yeuCau.json().catch(() => ({}));
    try {
      return json({ ten: await caiBot(env, token, url.origin) });
    } catch (e) {
      return loi(400, e.message);
    }
  }

  return loi(404, 'Không có chức năng này.');
}

// ---- Tổng quan ----

async function tongQuan(env, tc) {
  const homNay = ngayVN();
  const tuanTruoc = new Date(Date.now() - 7 * 86400000).toISOString();
  const theoGio = (bang, cot, them = '') =>
    env.CSDL.prepare(
      `SELECT CAST(strftime('%H', datetime(${cot}, '+7 hours')) AS INTEGER) AS gio, COUNT(*) AS n FROM ${bang}
       WHERE to_chuc_id IN ${bang === 'nhat_ky_chay' ? "('', ?1)" : '(?1)'} AND date(datetime(${cot}, '+7 hours')) = ?2 ${them} GROUP BY gio`,
    ).bind(tc, homNay);
  const [soLieu, tinGio, viecGio, chayGio, chayLoiGio, sapToi, tinMoi, tinTuan] = await env.CSDL.batch([
    env.CSDL.prepare(
      `SELECT
        (SELECT COUNT(*) FROM tin_nhan WHERE to_chuc_id = ?1 AND date(datetime(thoi_diem, '+7 hours')) = ?2) AS tin_hom_nay,
        (SELECT COUNT(*) FROM tin_nhan WHERE to_chuc_id = ?1 AND da_xem = 0) AS tin_chua_xem,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo') AS viec_mo,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay < ?2) AS viec_qua_han,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay = ?2) AS viec_hom_nay,
        (SELECT COUNT(*) FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'xong' AND date(datetime(xong_luc, '+7 hours')) = ?2) AS xong_hom_nay,
        (SELECT COUNT(*) FROM tep WHERE to_chuc_id = ?1 AND tao_luc >= ?3) AS tep_tuan`,
    ).bind(tc, homNay, tuanTruoc),
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
       WHERE to_chuc_id = ?1 ORDER BY thoi_diem DESC LIMIT 6`,
    ).bind(tc),
    env.CSDL.prepare(
      `SELECT date(datetime(thoi_diem, '+7 hours')) AS ngay, COUNT(*) AS n FROM tin_nhan WHERE to_chuc_id = ?1 AND thoi_diem >= ?2 GROUP BY ngay`,
    ).bind(tc, tuanTruoc),
  ]);
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
    viec_sap_toi: sapToi.results,
    tin_moi: tinMoi.results,
    tinh_trang: await layTinhTrang(env, tc),
  };
}

async function layTinhTrang(env, tc) {
  const [tinHieu, lanChayCuoi, khoa, tinHieuTc] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT nguon, lan_cuoi FROM tin_hieu WHERE to_chuc_id = ''`),
    env.CSDL.prepare(
      `SELECT tac_vu, bat_dau, ket_thuc, trang_thai, so_muc, ghi_chu FROM nhat_ky_chay n
       WHERE to_chuc_id IN ('', ?1)
         AND id = (SELECT MAX(id) FROM nhat_ky_chay m WHERE m.tac_vu = n.tac_vu AND m.to_chuc_id = n.to_chuc_id)`,
    ).bind(tc),
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
  if (th.thu) ds.push({ loai: 'thu', trang_thai: 'dang_chay', mo_ta: `Thư cuối ${gioTruoc(th.thu.lan_cuoi)}`, cap_nhat_luc: th.thu.lan_cuoi });
  else if (env.EMAIL_DOMAIN) ds.push({ loai: 'thu', trang_thai: 'cho', mo_ta: 'Chờ thư đầu tiên' });
  if (coKhoa.zalo) {
    const z = th.zalo;
    if (!z) ds.push({ loai: 'zalo', trang_thai: 'cho', mo_ta: 'Đã tạo mã, chờ máy Mac gửi tin' });
    else if (Date.now() - Date.parse(z.lan_cuoi) > 6 * 3600000) ds.push({ loai: 'zalo', trang_thai: 'loi', mo_ta: `Máy Mac im ${gioTruoc(z.lan_cuoi).replace(' trước', '')}`, cap_nhat_luc: z.lan_cuoi });
    else ds.push({ loai: 'zalo', trang_thai: 'dang_chay', mo_ta: `Tín hiệu ${gioTruoc(z.lan_cuoi)}`, cap_nhat_luc: z.lan_cuoi });
  }
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

// ---- Hộp tin ----

async function dsTin(env, tc, url) {
  const dieuKien = ['t.to_chuc_id = ?1'];
  const thamSo = [tc];
  const nguon = url.searchParams.get('nguon');
  if (nguon === 'zalo' || nguon === 'gmail') {
    thamSo.push(nguon);
    dieuKien.push(`t.nguon = ?${thamSo.length}`);
  }
  if (url.searchParams.get('chua_xem') === '1') dieuKien.push('t.da_xem = 0');
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    thamSo.push(`%${q.replace(/[%_]/g, '')}%`);
    const i = thamSo.length;
    dieuKien.push(`(t.noi_dung LIKE ?${i} OR t.tieu_de LIKE ?${i} OR t.nguoi_gui LIKE ?${i} OR t.nhom LIKE ?${i})`);
  }
  const truoc = Number(url.searchParams.get('truoc_id'));
  if (truoc) {
    thamSo.push(truoc);
    dieuKien.push(`t.id < ?${thamSo.length}`);
  }
  const { results } = await env.CSDL.prepare(
    `SELECT t.id, t.nguon, t.nguoi_gui, t.nhom, t.tieu_de, substr(t.noi_dung, 1, 220) AS trich, t.thoi_diem, t.da_xem,
       (SELECT COUNT(*) FROM tep WHERE tep.tin_nhan_id = t.id) AS so_tep,
       (SELECT COUNT(*) FROM viec WHERE viec.tin_nhan_id = t.id) AS so_viec
     FROM tin_nhan t WHERE ${dieuKien.join(' AND ')}
     ORDER BY t.id DESC LIMIT 60`,
  ).bind(...thamSo).all();
  return { tin: results };
}

async function motTin(env, tc, id) {
  const tin = await env.CSDL.prepare('SELECT * FROM tin_nhan WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  if (!tin) return loi(404, 'Không tìm thấy tin này.');
  const [tep, viec] = await env.CSDL.batch([
    env.CSDL.prepare('SELECT id, ten, loai, kich_thuoc FROM tep WHERE tin_nhan_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
    env.CSDL.prepare('SELECT id, tieu_de, han_ngay, gio_hen, trang_thai FROM viec WHERE tin_nhan_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
    env.CSDL.prepare('UPDATE tin_nhan SET da_xem = 1 WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
  ]);
  return json({ tin: { ...tin, da_xem: 1 }, tep: tep.results, viec: viec.results });
}

// ---- Việc ----

async function dsViec(env, tc, url) {
  const trangThai = url.searchParams.get('trang_thai') === 'xong' ? 'xong' : 'mo';
  const thuTu = trangThai === 'xong' ? 'xong_luc DESC' : 'han_ngay IS NULL, han_ngay, gio_hen IS NULL, gio_hen, id DESC';
  const { results } = await env.CSDL.prepare(
    `SELECT v.id, v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.trang_thai, v.tin_nhan_id, v.tao_luc, v.xong_luc,
       t.nguon AS tin_nguon, t.nguoi_gui AS tin_nguoi_gui, t.nhom AS tin_nhom
     FROM viec v LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id
     WHERE v.to_chuc_id = ?1 AND v.trang_thai = ?2 ORDER BY ${thuTu.replace(/\b(xong_luc|han_ngay|gio_hen|id)\b/g, 'v.$1')} LIMIT 300`,
  ).bind(tc, trangThai).all();
  return { viec: results, hom_nay: ngayVN() };
}

export function kiemViec(than, { batBuocTieuDe }) {
  const ra = {};
  if ('tieu_de' in than || batBuocTieuDe) {
    const t = String(than.tieu_de || '').trim();
    if (!t) return { loi: 'Nhập tên việc.' };
    if (t.length > 200) return { loi: 'Tên việc dài quá 200 ký tự.' };
    ra.tieu_de = t;
  }
  if ('ghi_chu' in than) ra.ghi_chu = cat(String(than.ghi_chu || '').trim(), 2000) || null;
  if ('han_ngay' in than) {
    if (than.han_ngay && !NGAY.test(than.han_ngay)) return { loi: 'Ngày hạn sai dạng.' };
    ra.han_ngay = than.han_ngay || null;
  }
  if ('gio_hen' in than) {
    if (than.gio_hen && !GIO.test(than.gio_hen)) return { loi: 'Giờ hẹn sai dạng, ví dụ 14:30.' };
    ra.gio_hen = than.gio_hen || null;
  }
  if ('trang_thai' in than) {
    if (!['mo', 'xong', 'huy'].includes(than.trang_thai)) return { loi: 'Trạng thái không hợp lệ.' };
    ra.trang_thai = than.trang_thai;
  }
  return { viec: ra };
}

async function taoViec(env, tc, than) {
  const k = kiemViec(than, { batBuocTieuDe: true });
  if (k.loi) return loi(400, k.loi);
  const kq = await themViec(env, tc, k.viec, { boQuaTrung: true });
  return json({ id: kq.id }, 201);
}

async function suaViec(env, tc, id, than) {
  const k = kiemViec(than, { batBuocTieuDe: false });
  if (k.loi) return loi(400, k.loi);
  const cot = Object.keys(k.viec);
  if (!cot.length) return loi(400, 'Không có gì để sửa.');
  const bayGio = new Date().toISOString();
  const gan = cot.map((c, i) => `${c} = ?${i + 3}`);
  const giaTri = cot.map((c) => k.viec[c]);
  if (k.viec.trang_thai) gan.push(`xong_luc = ${k.viec.trang_thai === 'xong' ? `?${cot.length + 3}` : 'NULL'}`);
  const kq = await env.CSDL.prepare(
    `UPDATE viec SET ${gan.join(', ')}, cap_nhat_luc = ?${cot.length + 3} WHERE id = ?1 AND to_chuc_id = ?2`,
  ).bind(id, tc, ...giaTri, bayGio).run();
  if (!kq.meta.changes) return loi(404, 'Không tìm thấy việc này.');
  return json({ ok: true });
}

// ---- Tệp ----

async function dsTep(env, tc, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const { results } = await env.CSDL.prepare(
    `SELECT id, ten, loai, kich_thuoc, nguon, nguoi_gui, thu_muc, tao_luc, tin_nhan_id FROM tep
     WHERE to_chuc_id = ?1 ${q ? 'AND (ten LIKE ?2 OR nguoi_gui LIKE ?2)' : ''} ORDER BY id DESC LIMIT 200`,
  ).bind(tc, ...(q ? [`%${q.replace(/[%_]/g, '')}%`] : [])).all();
  return { tep: results };
}

async function taiTep(env, tc, id) {
  const tep = await env.CSDL.prepare('SELECT ten, loai, r2_khoa FROM tep WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
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

// ---- Kết nối ----

// Người quản trị hệ thống (cài bot chung...): danh sách email trong biến QUAN_TRI, cách nhau dấu phẩy.
function laQuanTri(env, phien) {
  return String(env.QUAN_TRI || '').toLowerCase().split(',').map((x) => x.trim()).includes(phien.email);
}

async function layKetNoi(env, tc, url, phien) {
  const [toChuc, khoa, tinHieu] = await env.CSDL.batch([
    env.CSDL.prepare('SELECT ma_nhan FROM to_chuc WHERE id = ?1').bind(tc),
    env.CSDL.prepare('SELECT loai, tao_luc, dung_luc FROM khoa_truy_cap WHERE to_chuc_id = ?1 ORDER BY tao_luc DESC').bind(tc),
    env.CSDL.prepare('SELECT nguon, lan_cuoi, ghi_chu FROM tin_hieu WHERE to_chuc_id = ?1').bind(tc),
  ]);
  const maNhan = toChuc.results[0]?.ma_nhan;
  const khoaTheo = (loai) => khoa.results.find((k) => k.loai === loai) || null;
  const th = Object.fromEntries(tinHieu.results.map((t) => [t.nguon, t]));
  const chat = await docCaiDat(env, tc, 'telegram_chat_id');
  const bot = await layBot(env);
  let xacNhan = null;
  try {
    xacNhan = JSON.parse((await docCaiDat(env, tc, 'gmail_xac_nhan')) || 'null');
  } catch {}
  // Đã có thư thật về sau lần xác nhận thì không cần hiện nút xác nhận nữa.
  if (xacNhan && th.thu && th.thu.lan_cuoi > xacNhan.luc) xacNhan = null;
  return {
    goc: url.origin,
    thu: { dia_chi: env.EMAIL_DOMAIN && maNhan ? `${maNhan}@${env.EMAIL_DOMAIN}` : null, lan_cuoi: th.thu || null, xac_nhan: xacNhan },
    zalo: { khoa: khoaTheo('zalo'), lan_cuoi: th.zalo || null },
    lich: { khoa: khoaTheo('lich') },
    telegram: {
      co_bot: Boolean(bot),
      ten_bot: bot?.ten || null,
      quan_tri: laQuanTri(env, phien),
      da_noi: Boolean(chat),
      duong_dan: bot ? `https://t.me/${bot.ten}?start=${await maNoiTelegram(env, tc)}` : null,
      lan_cuoi: th.telegram || null,
    },
    ai: { co: Boolean(env.AI) },
    tep: { co: Boolean(env.TEP) },
  };
}

// Tạo mã mới thì mã cũ cùng loại hết hiệu lực. Mã chỉ trả về một lần.
async function taoKhoa(env, tc, loai, url) {
  const khoa = maNgauNhien(40);
  await env.CSDL.batch([
    env.CSDL.prepare('DELETE FROM khoa_truy_cap WHERE to_chuc_id = ?1 AND loai = ?2').bind(tc, loai),
    env.CSDL.prepare('INSERT INTO khoa_truy_cap (ma_bam, to_chuc_id, loai, tao_luc) VALUES (?1, ?2, ?3, ?4)').bind(await bam(khoa), tc, loai, new Date().toISOString()),
  ]);
  if (loai === 'lich') {
    const duongDan = `${url.origin}/lich/${khoa}.ics`;
    return json({ duong_dan: duongDan, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(duongDan.replace(/^https:/, 'webcal:'))}` });
  }
  return json({ lenh: `curl -fsSL ${url.origin}/nhan/zalo-cai/${khoa} | bash` });
}
