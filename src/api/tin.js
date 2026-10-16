// API giao diện: Hộp tin: tin nhắn, nguồn bị chặn và hội thoại Zalo.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { boChan, chanNguon, danhSachChan, kiemChan, tuyChonChan } from '../chan-tin.js';
import { anhCoSan, phucVuAnh } from '../anh-dai-dien.js';
import { xepTinGuiDiVaoHoiThoai } from '../nhan-zalo.js';
import { json, loi, ngayVN } from '../tien-ich.js';
import { napTepNgoai } from '../zalo-ngoai.js';
import { COT_DRIVE } from './chung.js';

// ---- Hộp tin ----

async function dsTin(env, tc, url) {
  const dieuKien = ['t.to_chuc_id = ?1', 't.an = 0'];
  const thamSo = [tc];
  const nguon = url.searchParams.get('nguon');
  if (/^[a-z][a-z0-9-]{1,20}$/.test(nguon || '')) {
    thamSo.push(nguon);
    dieuKien.push(`t.nguon = ?${thamSo.length}`);
  }
  if (url.searchParams.get('chua_xem') === '1') dieuKien.push('t.da_xem = 0');
  // Tin hôm nay (giờ Việt Nam), có thể chỉ một giờ: dùng khi bấm số liệu hoặc cột giờ ở trang Tổng quan.
  if (url.searchParams.get('hom_nay') === '1') {
    thamSo.push(ngayVN());
    dieuKien.push(`date(datetime(t.thoi_diem, '+7 hours')) = ?${thamSo.length}`);
    const gio = Number(url.searchParams.get('gio'));
    if (url.searchParams.has('gio') && Number.isInteger(gio) && gio >= 0 && gio < 24) {
      thamSo.push(gio);
      dieuKien.push(`CAST(strftime('%H', datetime(t.thoi_diem, '+7 hours')) AS INTEGER) = ?${thamSo.length}`);
    }
  }
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
    env.CSDL.prepare(`SELECT id, ten, loai, kich_thuoc, ${COT_DRIVE} FROM tep WHERE tin_nhan_id = ?1 AND to_chuc_id = ?2`).bind(id, tc),
    env.CSDL.prepare('SELECT id, tieu_de, han_ngay, gio_hen, trang_thai FROM viec WHERE tin_nhan_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
    env.CSDL.prepare('UPDATE tin_nhan SET da_xem = 1 WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
  ]);
  return json({ tin: { ...tin, da_xem: 1 }, tep: tep.results, viec: viec.results, chan: tuyChonChan(tin) });
}

// Spam: chặn một nguồn tin. Gửi tin_id (kèm loai nếu thư có nhiều cách chặn) hoặc nguon + loai + gia_tri (hội thoại Zalo).
async function chanTin(env, tc, than) {
  let chan = than;
  if (than.tin_id) {
    const tin = await env.CSDL.prepare('SELECT nguon, nguoi_gui, nhom, tieu_de FROM tin_nhan WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(than.tin_id), tc).first();
    if (!tin) return loi(404, 'Không tìm thấy tin này.');
    const cach = tuyChonChan(tin).find((c) => !than.loai || c.loai === than.loai);
    if (!cach) return loi(400, 'Tin này không có thông tin để chặn.');
    chan = { nguon: tin.nguon, ...cach };
  }
  const k = kiemChan(chan);
  if (k.loi) return loi(400, k.loi);
  return json({ ok: true, ...(await chanNguon(env, tc, k.chan)), nhan: k.chan.nhan });
}

// ---- Zalo: danh sách hội thoại và tin theo dòng thời gian, giống ứng dụng Zalo ----

// Nhóm có tên nhóm; tin riêng gom theo tên người đối diện (tieu_de), thiếu thì theo người gửi.
const TEN_TIN_ZALO = `CASE WHEN COALESCE(nhom, '') <> '' THEN nhom ELSE COALESCE(NULLIF(tieu_de, ''), NULLIF(nguoi_gui, ''), 'Không rõ') END`;
const LOAI_TIN_ZALO = `CASE WHEN COALESCE(nhom, '') <> '' THEN 'nhom' ELSE 'ca-nhan' END`;
// Khóa gom hội thoại: mã hội thoại Zalo khi có (tin mình gửi đi nằm cùng tin người kia), tin cũ thì theo loại và tên.
const KHOA_TIN_ZALO = `COALESCE(NULLIF(ma_hoi_thoai, ''), ${LOAI_TIN_ZALO} || '~' || ${TEN_TIN_ZALO})`;

export async function dsHoiThoaiZalo(env, tc, url) {
  const q = (url.searchParams.get('q') || '').trim().replace(/[%_]/g, '');
  await xepTinGuiDiVaoHoiThoai(env, tc).catch((e) => console.error('Xếp tin gửi đi lỗi', e));
  // Tên hiển thị lấy từ tin mới nhất của người kia, nên đổi tên trên Zalo là cập nhật theo.
  const { results } = await env.CSDL.prepare(
    `WITH t AS (
       SELECT id, ${KHOA_TIN_ZALO} AS khoa, ${LOAI_TIN_ZALO} AS loai, ${TEN_TIN_ZALO} AS ten, nguoi_gui, noi_dung, thoi_diem, da_xem
       FROM tin_nhan WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND an = 0
     ), x AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY khoa ORDER BY thoi_diem DESC, id DESC) AS rn,
         FIRST_VALUE(ten) OVER (PARTITION BY khoa ORDER BY CASE WHEN nguoi_gui = 'Tôi' THEN 1 ELSE 0 END, thoi_diem DESC, id DESC) AS ten_hien,
         COUNT(*) OVER (PARTITION BY khoa) AS n,
         SUM(CASE WHEN da_xem = 0 THEN 1 ELSE 0 END) OVER (PARTITION BY khoa) AS chua_xem
       FROM t
     )
     SELECT khoa, loai, ten_hien AS ten, n, chua_xem, thoi_diem AS cuoi, nguoi_gui AS nguoi_cuoi, substr(noi_dung, 1, 120) AS trich
     FROM x WHERE rn = 1 AND ten_hien LIKE ?2 ORDER BY thoi_diem DESC LIMIT 300`,
  ).bind(tc, `%${q}%`).all();
  const anh = new Map((await anhCoSan(env, tc, 'nhom')).concat(await anhCoSan(env, tc, 'ca-nhan')).map((a) => [a.ma, a.url]));
  return { ds: results.map((r) => ({ ...r, anh: anh.get(r.khoa) || null })) };
}

// Chuyển tay tin mình gửi mà máy chủ không đoán được gửi cho ai (chương trình Zalo chưa vá, không có mã hội thoại)
// sang đúng cuộc trò chuyện cá nhân. Chỉ đụng tin "Tôi" chưa có mã hội thoại và không thuộc nhóm.
export async function chuyenTinSangHoiThoai(env, tc, du) {
  const ids = [...new Set((Array.isArray(du.ids) ? du.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  const dich = String(du.khoa_dich || '').slice(0, 400);
  if (!ids.length) return loi(400, 'Chưa chọn tin nào để chuyển.');
  const kieu = dich.match(/^ca-nhan([~:])(.+)$/);
  if (!kieu) return loi(400, 'Chỉ chuyển được sang một cuộc trò chuyện cá nhân.');
  let ma = null;
  let ten = kieu[2];
  if (kieu[1] === ':') {
    ma = dich;
    const goc = await env.CSDL.prepare(
      `SELECT tieu_de FROM tin_nhan WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND ma_hoi_thoai = ?2 AND nguoi_gui <> 'Tôi' AND COALESCE(tieu_de, '') <> ''
       ORDER BY thoi_diem DESC, id DESC LIMIT 1`,
    ).bind(tc, ma).first();
    if (!goc) return loi(404, 'Không thấy cuộc trò chuyện đích.');
    ten = goc.tieu_de;
  }
  const kq = await env.CSDL.prepare(
    `UPDATE tin_nhan SET tieu_de = ?1, ma_hoi_thoai = ?2
     WHERE to_chuc_id = ?3 AND nguon = 'zalo' AND nguoi_gui = 'Tôi' AND COALESCE(nhom, '') = '' AND COALESCE(ma_hoi_thoai, '') = ''
       AND id IN (${ids.join(',')})`,
  ).bind(ten, ma, tc).run();
  return json({ da_chuyen: kq.meta.changes || 0 });
}

export async function tinHoiThoaiZalo(env, tc, url) {
  const loai = url.searchParams.get('loai');
  const ten = (url.searchParams.get('ten') || '').slice(0, 300);
  // Địa chỉ cũ (loai + ten) vẫn dùng được: đổi sang khóa của tin chưa có mã hội thoại.
  const khoa = (url.searchParams.get('khoa') || '').slice(0, 400) || ((loai === 'nhom' || loai === 'ca-nhan') && ten ? `${loai}~${ten}` : '');
  if (!khoa) return loi(400, 'Thiếu hội thoại cần xem.');
  const truocLuc = url.searchParams.get('truoc_luc');
  const sauId = Number(url.searchParams.get('sau_id')) || 0;
  const dieuKien = `to_chuc_id = ?1 AND nguon = 'zalo' AND an = 0 AND ${KHOA_TIN_ZALO} = ?2`;
  const cot = 'SELECT id, nguoi_gui, noi_dung, thoi_diem, da_xem FROM tin_nhan WHERE';
  let tin;
  let conNua = false;
  if (sauId) {
    // Chỉ lấy tin mới hơn tin đang hiện, để khung tin tự cập nhật mà không tải lại cả hội thoại.
    tin = (await env.CSDL.prepare(`${cot} ${dieuKien} AND id > ?3 ORDER BY id ASC LIMIT 80`).bind(tc, khoa, sauId).all()).results;
  } else {
    const truocId = Number(url.searchParams.get('truoc_id')) || 0;
    const thamSo = [tc, khoa];
    let them = '';
    if (truocLuc) {
      thamSo.push(truocLuc, truocId);
      them = ' AND (thoi_diem < ?3 OR (thoi_diem = ?3 AND id < ?4))';
    }
    const { results } = await env.CSDL.prepare(`${cot} ${dieuKien}${them} ORDER BY thoi_diem DESC, id DESC LIMIT 81`).bind(...thamSo).all();
    conNua = results.length > 80;
    tin = results.slice(0, 80).reverse();
  }
  let tep = [];
  if (tin.length) {
    const ids = tin.map((t) => Number(t.id)).join(',');
    tep = (await env.CSDL.prepare(`SELECT id, tin_nhan_id, ten, loai, kich_thuoc, ${COT_DRIVE} FROM tep WHERE to_chuc_id = ?1 AND tin_nhan_id IN (${ids})`).bind(tc).all()).results;
  }
  if (!truocLuc) {
    await env.CSDL.prepare(`UPDATE tin_nhan SET da_xem = 1 WHERE ${dieuKien} AND da_xem = 0`).bind(tc, khoa).run();
  }
  // Ảnh đại diện: của cuộc trò chuyện, và của từng người gửi trong nhóm (ghép theo tên hiển thị).
  const anhHoiThoai = (await anhCoSan(env, tc, khoa.startsWith('nhom:') ? 'nhom' : 'ca-nhan')).find((a) => a.ma === khoa)?.url || null;
  const tenGui = new Set(tin.map((t) => t.nguoi_gui).filter(Boolean));
  const anhNguoi = {};
  if (khoa.startsWith('nhom:') && tenGui.size) for (const a of await anhCoSan(env, tc, 'nguoi')) if (tenGui.has(a.ten)) anhNguoi[a.ten] = a.url;
  return json({ tin, tep, con_nua: conNua, anh_hoi_thoai: anhHoiThoai, anh_nguoi: anhNguoi });
}

export async function xuLyTin(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/zalo/hoi-thoai' && m === 'GET') return json(await dsHoiThoaiZalo(env, tc, url));
  if (p === '/api/zalo/tin' && m === 'GET') return tinHoiThoaiZalo(env, tc, url);
  if ((khop = p.match(/^\/api\/anh\/([^/]+)$/)) && m === 'GET') return phucVuAnh(env, tc, decodeURIComponent(khop[1]));
  if (p === '/api/zalo/chuyen-tin' && m === 'POST') return chuyenTinSangHoiThoai(env, tc, await yeuCau.json().catch(() => ({})));

  if (p === '/api/tin' && m === 'GET') return json(await dsTin(env, tc, url));
  if (p === '/api/tin/da-xem-het' && m === 'POST') {
    await env.CSDL.prepare('UPDATE tin_nhan SET da_xem = 1 WHERE to_chuc_id = ?1 AND da_xem = 0 AND an = 0').bind(tc).run();
    return json({ ok: true });
  }
  if (p === '/api/chan' && m === 'GET') return json({ ds: await danhSachChan(env, tc) });
  if (p === '/api/chan' && m === 'POST') return chanTin(env, tc, await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/chan\/(\d+)$/)) && m === 'DELETE') {
    const kq = await boChan(env, tc, Number(khop[1]));
    return kq ? json({ ok: true, ...kq }) : loi(404, 'Không tìm thấy mục này.');
  }
  if ((khop = p.match(/^\/api\/tin\/(\d+)\/nap$/)) && m === 'POST') {
    try { return json({ tep: await napTepNgoai(env, tc, Number(khop[1])) }); } catch (e) { return loi(e.trangThai || 502, String(e.message || e).slice(0, 200)); }
  }
  if ((khop = p.match(/^\/api\/tin\/(\d+)$/)) && m === 'GET') return motTin(env, tc, Number(khop[1]));

  return null;
}
