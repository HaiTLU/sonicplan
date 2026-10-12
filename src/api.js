// API cho giao diện. Mọi hàm nhận phien (người dùng và tổ chức đã xác định) và chỉ đọc ghi
// dữ liệu của phien.to_chuc.id.

import { napTepNgoai } from './zalo-ngoai.js';
import { docTongHopCuoi, tongHopChoToChuc } from './tong-hop.js';
import { docHoSo, LOAI_GHI_NHO, luuHoSo, TOI_DA_HO_SO } from './ghi-nho.js';
import { goMaNhanViec, taoMaNhanViec } from './nhan-ngoai.js';
import { docLuong, luuLuong, NGUONG } from './luong.js';
import { kiemCauHinhGithub, thuGithub } from './github.js';
import { diaChiGoiLai, goKetNoiGoogle, hoanTatDangNhap, kiemClient, taoDiaChiDangNhap } from './google.js';
import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { dongBoKho, goKetNoiKho, hoanTatDangNhapKho, taoDiaChiDangNhapKho } from './kho.js';
import { dsDuAnKemSo, lichSuDuAn, suaDuAn, taoDuAn, xoaDuAn, ghiSuKien } from './du-an.js';
import { caiBot, layBot, maNoiTelegram } from './telegram.js';
import { chuanHoaCauHinhAi, dangViecMoi, docTichHop, giaiTichHop, guiDiaChiNhan, KHOA_TICH_HOP, kiemDiaChiNhan, luuTichHop, thuAiNgoai, xoaTichHop } from './tich-hop.js';
import { bam, cat, json, loi, maNgauNhien, ngayVN } from './tien-ich.js';
import { tinhTinhTrang } from './tinh-trang.js';
import { chuTuDocx, loaiXem, TOI_DA_DOCX } from './xem-tep.js';
import { themViec } from './viec.js';

const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function xuLyApi(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/phien-ban' && m === 'GET') return json({ ban: env.PHIEN_BAN || '' });
  if (p === '/api/toi' && m === 'GET') return json({ email: phien.email, nguoi_dung: phien.nguoi_dung, to_chuc: phien.to_chuc, cac_to_chuc: phien.cac_to_chuc });
  if (p === '/api/tong-quan' && m === 'GET') return json(await tongQuan(env, tc));
  if (p === '/api/tinh-trang' && m === 'GET') return json(await layTinhTrang(env, tc));
  if (p === '/api/nhat-ky' && m === 'GET') return json(await layNhatKy(env, tc, url));

  if (p === '/api/zalo/hoi-thoai' && m === 'GET') return json(await dsHoiThoaiZalo(env, tc, url));
  if (p === '/api/zalo/tin' && m === 'GET') return tinHoiThoaiZalo(env, tc, url);

  if (p === '/api/tin' && m === 'GET') return json(await dsTin(env, tc, url));
  if (p === '/api/tin/da-xem-het' && m === 'POST') {
    await env.CSDL.prepare('UPDATE tin_nhan SET da_xem = 1 WHERE to_chuc_id = ?1 AND da_xem = 0').bind(tc).run();
    return json({ ok: true });
  }
  if ((khop = p.match(/^\/api\/tin\/(\d+)\/nap$/)) && m === 'POST') {
    try { return json({ tep: await napTepNgoai(env, tc, Number(khop[1])) }); } catch (e) { return loi(e.trangThai || 502, String(e.message || e).slice(0, 200)); }
  }
  if ((khop = p.match(/^\/api\/tin\/(\d+)$/)) && m === 'GET') return motTin(env, tc, Number(khop[1]));

  if (p === '/api/viec' && m === 'GET') return json(await dsViec(env, tc, url));
  if (p === '/api/viec/sap-xep' && m === 'POST') return sapXepViec(env, tc, await yeuCau.json().catch(() => ({})));
  if (p === '/api/viec' && m === 'POST') return taoViec(env, tc, await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/viec\/(\d+)$/)) && m === 'PATCH') return suaViec(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));

  if (p === '/api/du-an' && m === 'GET') return json({ du_an: await dsDuAnKemSo(env, tc) });
  if (p === '/api/du-an' && m === 'POST') {
    const r = await taoDuAn(env, tc, await yeuCau.json().catch(() => ({})));
    return r.loi ? loi(r.ma || 400, r.loi) : json({ id: r.id }, 201);
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)\/lich-su$/)) && m === 'GET') {
    const r = await lichSuDuAn(env, tc, Number(khop[1]));
    return r ? json(r) : loi(404, 'Không tìm thấy dự án.');
  }
  if ((khop = p.match(/^\/api\/du-an\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const r = m === 'PATCH' ? await suaDuAn(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({}))) : await xoaDuAn(env, tc, Number(khop[1]));
    return r.loi ? loi(r.ma || 400, r.loi) : json({ ok: true });
  }

  if (p === '/api/luong' && m === 'GET') return json(await layLuong(env, tc));
  if (p === '/api/luong' && m === 'PATCH') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức chỉnh được luồng.');
    const e = await luuLuong(env, tc, await yeuCau.json().catch(() => ({})));
    return e ? loi(400, e) : json(await layLuong(env, tc));
  }

  if (p === '/api/tong-hop' && m === 'GET') return json({ cuoi: await docTongHopCuoi(env, tc) });
  if (p === '/api/tong-hop' && m === 'POST') {
    try { return json({ cuoi: await tongHopChoToChuc(env, tc) }); } catch (e) { return loi(502, `Chưa tổng hợp được: ${String(e.message || e).slice(0, 150)}`); }
  }
  if (p === '/api/ho-so' && m === 'GET') return json({ noi_dung: await docHoSo(env, tc), toi_da: TOI_DA_HO_SO });
  if (p === '/api/ho-so' && m === 'PUT') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức sửa được hồ sơ.');
    const e = await luuHoSo(env, tc, (await yeuCau.json().catch(() => ({}))).noi_dung);
    return e ? loi(400, e) : json({ noi_dung: await docHoSo(env, tc), toi_da: TOI_DA_HO_SO });
  }
  if (p === '/api/ghi-nho' && m === 'GET') return json(await dsGhiNho(env, tc, url));
  if (p === '/api/ghi-nho' && m === 'POST') return taoGhiNho(env, tc, await yeuCau.json().catch(() => ({})));
  if (p === '/api/ghi-nho' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức xóa toàn bộ được.');
    const kq = await env.CSDL.prepare('DELETE FROM ghi_nho WHERE to_chuc_id = ?1').bind(tc).run();
    return json({ da_xoa: kq.meta.changes || 0 });
  }
  if ((khop = p.match(/^\/api\/ghi-nho\/(\d+)$/)) && m === 'PATCH') return suaGhiNho(env, tc, Number(khop[1]), await yeuCau.json().catch(() => ({})));
  if ((khop = p.match(/^\/api\/ghi-nho\/(\d+)$/)) && m === 'DELETE') {
    await env.CSDL.prepare('DELETE FROM ghi_nho WHERE id = ?1 AND to_chuc_id = ?2').bind(Number(khop[1]), tc).run();
    return json({ ok: true });
  }

  if (p === '/api/tep' && m === 'GET') return json(await dsTep(env, tc, url));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/tai$/)) && m === 'GET') return taiTep(env, tc, Number(khop[1]));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/xem$/)) && m === 'GET') return xemTep(env, tc, Number(khop[1]));
  if ((khop = p.match(/^\/api\/tep\/(\d+)\/chu$/)) && m === 'GET') return chuTep(env, tc, Number(khop[1]));

  if (p === '/api/ket-noi' && m === 'GET') return json(await layKetNoi(env, tc, url, phien));
  if ((khop = p.match(/^\/api\/ket-noi\/(zalo|lich)$/)) && m === 'POST') return taoKhoa(env, tc, khop[1], url);
  if (p === '/api/ket-noi/ai' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức nối được dịch vụ AI.');
    try {
      const cauHinh = chuanHoaCauHinhAi(await yeuCau.json().catch(() => ({})));
      await thuAiNgoai(cauHinh);
      await luuTichHop(env, tc, 'ai', cauHinh);
      return json({ loai: cauHinh.loai, mo_hinh: cauHinh.mo_hinh });
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/ket-noi/ai' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await xoaTichHop(env, tc, 'ai');
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/google' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức nối được Google.');
    try {
      await luuTichHop(env, tc, 'google_client', kiemClient(await yeuCau.json().catch(() => ({}))));
      return json({ ok: true });
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/ket-noi/google' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goKetNoiGoogle(env, tc);
    if (new URL(yeuCau.url).searchParams.get('het') === '1') await xoaTichHop(env, tc, 'google_client');
    return json({ ok: true });
  }
  if (p === '/api/kho-drive/bat-dau' && m === 'GET') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức nối được Drive kho.');
    const client = await docTichHop(env, tc, 'google_client');
    if (!client) return loi(400, 'Chưa khai Client ID và Secret ở thẻ Google.');
    const state = maNgauNhien(24);
    await ghiCaiDat(env, tc, 'google_state', `${state}.${Date.now() + 10 * 60000}.kho`);
    return Response.redirect(taoDiaChiDangNhapKho(client.client_id, diaChiGoiLai(url.origin), state), 302);
  }
  if (p === '/api/kho-drive/luu-ngay' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    try {
      const kq = await dongBoKho(env, tc);
      if (!kq) return loi(400, 'Chưa nối Drive kho.');
      return json({ ok: true, ...kq });
    } catch (e) {
      return loi(502, e.message);
    }
  }
  if (p === '/api/ket-noi/kho-drive' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goKetNoiKho(env, tc);
    return json({ ok: true });
  }
  if (p === '/api/google/bat-dau' && m === 'GET') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức nối được Google.');
    const client = await docTichHop(env, tc, 'google_client');
    if (!client) return loi(400, 'Chưa khai Client ID và Secret.');
    const state = maNgauNhien(24);
    await ghiCaiDat(env, tc, 'google_state', `${state}.${Date.now() + 10 * 60000}`);
    return Response.redirect(taoDiaChiDangNhap(client.client_id, diaChiGoiLai(url.origin), state), 302);
  }
  if (p === '/api/google/goi-lai' && m === 'GET') {
    const [state, han, dich] = String((await docCaiDat(env, tc, 'google_state')) || '').split('.');
    await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'google_state'`).bind(tc).run();
    const laKho = dich === 'kho';
    const veTrang = (thongBao) => Response.redirect(`${url.origin}/?${laKho ? 'kho' : 'google'}=${encodeURIComponent(thongBao)}#ket-noi`, 302);
    if (url.searchParams.get('error')) return veTrang(url.searchParams.get('error') === 'access_denied' ? 'Bạn đã từ chối ở màn hình Google.' : `Google báo lỗi: ${url.searchParams.get('error')}`);
    if (!state || state !== url.searchParams.get('state') || Date.now() > Number(han)) return veTrang('Phiên đăng nhập đã hết hạn, bấm nút đăng nhập lại.');
    try {
      if (laKho) await hoanTatDangNhapKho(env, tc, url.searchParams.get('code'), diaChiGoiLai(url.origin));
      else await hoanTatDangNhap(env, tc, url.searchParams.get('code'), diaChiGoiLai(url.origin));
      return veTrang('ok');
    } catch (e) {
      return veTrang(e.message);
    }
  }
  if (p === '/api/ket-noi/github' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức nối được GitHub.');
    try {
      const cauHinh = kiemCauHinhGithub(await yeuCau.json().catch(() => ({})));
      await thuGithub(cauHinh);
      await luuTichHop(env, tc, 'github', cauHinh);
      return json({ repo: cauHinh.repo, nhan: cauHinh.nhan });
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/ket-noi/github' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await xoaTichHop(env, tc, 'github');
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/nhan-viec' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức tạo được mã.');
    return json({ dia_chi: `${url.origin}/nhan/viec`, ma: await taoMaNhanViec(env, tc) });
  }
  if (p === '/api/ket-noi/nhan-viec' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goMaNhanViec(env, tc);
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/webhook' && m === 'POST') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    try {
      const { url: diaChi } = await yeuCau.json().catch(() => ({}));
      const u = kiemDiaChiNhan(diaChi);
      await guiDiaChiNhan(u, { su_kien: 'thu', luc: new Date().toISOString(), tin: 'Sonicplan nối thành công' });
      await luuTichHop(env, tc, 'webhook', { url: u });
      return json({ host: new URL(u).host });
    } catch (e) {
      return loi(400, `Không gửi thử được: ${e.message}`);
    }
  }
  if (p === '/api/ket-noi/webhook' && m === 'DELETE') {
    if (phien.to_chuc.vai_tro !== 'chu') return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await xoaTichHop(env, tc, 'webhook');
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/webhook/thu' && m === 'POST') {
    const cauHinh = await docTichHop(env, tc, 'webhook');
    if (!cauHinh) return loi(400, 'Chưa nối địa chỉ nhận việc mới.');
    try {
      await guiDiaChiNhan(cauHinh.url, dangViecMoi({ id: 0, tieu_de: 'Việc thử từ Sonicplan', han_ngay: ngayVN() }));
      return json({ ok: true });
    } catch (e) {
      return loi(400, `Không gửi được: ${e.message}`);
    }
  }
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
  if (th.github) ds.push({ loai: 'github', trang_thai: th.github.ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th.github.ghi_chu || 'Đã nối', cap_nhat_luc: th.github.lan_cuoi });
  if (th['api-vao']) ds.push({ loai: 'api-vao', trang_thai: th['api-vao'].ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th['api-vao'].ghi_chu || 'Đang nhận', cap_nhat_luc: th['api-vao'].lan_cuoi });
  if (th.google) ds.push({ loai: 'google', trang_thai: th.google.ghi_chu?.startsWith('Lỗi') ? 'loi' : 'dang_chay', mo_ta: th.google.ghi_chu?.startsWith('Lỗi') ? th.google.ghi_chu.slice(0, 120) : `Đồng bộ ${gioTruoc(th.google.lan_cuoi)}`, cap_nhat_luc: th.google.lan_cuoi });
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
    env.CSDL.prepare(`SELECT id, ten, loai, kich_thuoc, ${DRIVE_ID_TEP} FROM tep WHERE tin_nhan_id = ?1 AND to_chuc_id = ?2`).bind(id, tc),
    env.CSDL.prepare('SELECT id, tieu_de, han_ngay, gio_hen, trang_thai FROM viec WHERE tin_nhan_id = ?1 AND to_chuc_id = ?2').bind(id, tc),
    env.CSDL.prepare('UPDATE tin_nhan SET da_xem = 1 WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc),
  ]);
  return json({ tin: { ...tin, da_xem: 1 }, tep: tep.results, viec: viec.results });
}

// ---- Việc ----

async function dsViec(env, tc, url) {
  const trangThai = url.searchParams.get('trang_thai') === 'xong' ? 'xong' : 'mo';
  const thuTu = trangThai === 'xong' ? 'xong_luc DESC' : 'han_ngay IS NULL, han_ngay, thu_tu IS NULL, thu_tu, gio_hen IS NULL, gio_hen, id DESC';
  const { results } = await env.CSDL.prepare(
    `SELECT v.id, v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.trang_thai, v.tin_nhan_id, v.tao_luc, v.xong_luc,
       t.nguon AS tin_nguon, t.nguoi_gui AS tin_nguoi_gui, t.nhom AS tin_nhom,
       v.du_an_id, v.nguon, d.ten AS du_an_ten
     FROM viec v LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id LEFT JOIN du_an d ON d.id = v.du_an_id
     WHERE v.to_chuc_id = ?1 AND v.trang_thai = ?2 ORDER BY ${thuTu.replace(/\b(xong_luc|han_ngay|gio_hen|thu_tu|id)\b/g, 'v.$1')} LIMIT 300`,
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
  if ('du_an_id' in than) {
    const d = than.du_an_id;
    if (d !== null && d !== '' && !Number.isInteger(Number(d))) return { loi: 'Dự án không hợp lệ.' };
    ra.du_an_id = d === null || d === '' ? null : Number(d);
  }
  return { viec: ra };
}

async function taoViec(env, tc, than) {
  const k = kiemViec(than, { batBuocTieuDe: true });
  if (k.loi) return loi(400, k.loi);
  const kq = await themViec(env, tc, k.viec, { boQuaTrung: true, duAnId: k.viec.du_an_id ?? null, nguon: 'tay' });
  return json({ id: kq.id }, 201);
}

// Lưu thứ tự tay của các thẻ trong một cột: ids theo thứ tự từ trên xuống.
export async function sapXepViec(env, tc, than) {
  const ids = Array.isArray(than.ids) ? than.ids.map(Number) : [];
  if (!ids.length || ids.length > 150 || ids.some((x) => !Number.isInteger(x) || x <= 0)) return loi(400, 'Danh sách việc không hợp lệ.');
  const cau = ids.map((id, i) => env.CSDL.prepare("UPDATE viec SET thu_tu = ?1 WHERE id = ?2 AND to_chuc_id = ?3 AND trang_thai = 'mo'").bind(i + 1, id, tc));
  if (env.CSDL.batch) await env.CSDL.batch(cau);
  else for (const c of cau) await c.run();
  return json({ ok: true });
}

async function suaViec(env, tc, id, than) {
  const k = kiemViec(than, { batBuocTieuDe: false });
  if (k.loi) return loi(400, k.loi);
  const cot = Object.keys(k.viec);
  if (!cot.length) return loi(400, 'Không có gì để sửa.');
  if (k.viec.du_an_id != null && !(await env.CSDL.prepare('SELECT 1 AS x FROM du_an WHERE id = ?1 AND to_chuc_id = ?2').bind(k.viec.du_an_id, tc).first())) return loi(400, 'Dự án không tồn tại.');
  const truoc = k.viec.trang_thai || 'du_an_id' in k.viec ? await env.CSDL.prepare('SELECT trang_thai, du_an_id, tieu_de FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first() : null;
  const bayGio = new Date().toISOString();
  const gan = cot.map((c, i) => `${c} = ?${i + 3}`);
  // Đổi tên, hạn hoặc giờ thì báo cho lượt đồng bộ cập nhật Google Tasks và Lịch.
  if (['tieu_de', 'han_ngay', 'gio_hen', 'ghi_chu'].some((c) => c in k.viec)) gan.push('can_dong_bo = 1');
  const giaTri = cot.map((c) => k.viec[c]);
  if (k.viec.trang_thai) gan.push(`xong_luc = ${k.viec.trang_thai === 'xong' ? `?${cot.length + 3}` : 'NULL'}`);
  const kq = await env.CSDL.prepare(
    `UPDATE viec SET ${gan.join(', ')}, cap_nhat_luc = ?${cot.length + 3} WHERE id = ?1 AND to_chuc_id = ?2`,
  ).bind(id, tc, ...giaTri, bayGio).run();
  if (!kq.meta.changes) return loi(404, 'Không tìm thấy việc này.');
  if (truoc) {
    if (k.viec.trang_thai && k.viec.trang_thai !== truoc.trang_thai) {
      const loaiSk = k.viec.trang_thai === 'xong' ? 'xong' : k.viec.trang_thai === 'mo' ? 'mo_lai' : 'huy';
      await ghiSuKien(env, tc, id, loaiSk, truoc.tieu_de).catch(() => {});
    }
    if ('du_an_id' in k.viec && k.viec.du_an_id !== truoc.du_an_id) {
      const ten = k.viec.du_an_id ? (await env.CSDL.prepare('SELECT ten FROM du_an WHERE id = ?1').bind(k.viec.du_an_id).first())?.ten : null;
      await ghiSuKien(env, tc, id, 'doi_du_an', ten ? `Chuyển vào dự án ${ten}` : 'Gỡ khỏi dự án').catch(() => {});
    }
  }
  // Đổi hạn hoặc giờ thì cho phép nhắc lại theo mốc mới.
  if ('han_ngay' in k.viec || 'gio_hen' in k.viec) await env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id = ?1').bind(id).run();
  return json({ ok: true });
}

// ---- Tệp ----

async function dsTep(env, tc, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const { results } = await env.CSDL.prepare(
    `SELECT id, ten, loai, kich_thuoc, nguon, nguoi_gui, thu_muc, tao_luc, tin_nhan_id, ${DRIVE_ID_TEP} FROM tep
     WHERE to_chuc_id = ?1 ${q ? 'AND (ten LIKE ?2 OR nguoi_gui LIKE ?2)' : ''} ORDER BY id DESC LIMIT 200`,
  ).bind(tc, ...(q ? [`%${q.replace(/[%_]/g, '')}%`] : [])).all();
  return { tep: results };
}

// Xem ảnh và PDF ngay trong trang: chỉ phục vụ đúng loại ảnh, PDF theo phần mở rộng, không bao giờ HTML hay SVG.
async function xemTep(env, tc, id) {
  const tep = await env.CSDL.prepare('SELECT ten, r2_khoa FROM tep WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  const loai = tep && loaiXem(tep.ten);
  if (!tep?.r2_khoa || !loai || loai.kieu === 'docx') return loi(404, 'Tệp này không xem trước được.');
  const vat = await env.TEP.get(tep.r2_khoa);
  if (!vat) return loi(404, 'Tệp không còn trong kho.');
  return new Response(vat.body, {
    headers: {
      'content-type': loai.mime,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(tep.ten)}`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function chuTep(env, tc, id) {
  const tep = await env.CSDL.prepare('SELECT ten, kich_thuoc, r2_khoa FROM tep WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  if (!tep?.r2_khoa || loaiXem(tep.ten)?.kieu !== 'docx') return loi(404, 'Tệp này không có bản chữ để xem trước.');
  if (tep.kich_thuoc > TOI_DA_DOCX) return loi(413, 'Tệp lớn quá để xem trước, tải về để mở.');
  const vat = await env.TEP.get(tep.r2_khoa);
  if (!vat) return loi(404, 'Tệp không còn trong kho.');
  try {
    const chu = await chuTuDocx(new Uint8Array(await vat.arrayBuffer()));
    if (chu == null) return loi(422, 'Không đọc được nội dung tệp Word này, tải về để mở.');
    return json({ chu: chu || '(tệp không có chữ, có thể chỉ chứa ảnh)' });
  } catch (e) {
    console.error('Xem trước docx lỗi', e);
    return loi(422, 'Không đọc được nội dung tệp Word này, tải về để mở.');
  }
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
  // Mọi thứ đọc từ D1 gom vào một lượt (trước đây khoảng 12 lượt nối tiếp, mỗi lượt qua lại giữa Worker và cơ sở dữ liệu).
  const khoaCaiDat = [...Object.values(KHOA_TICH_HOP), 'telegram_chat_id', 'gmail_xac_nhan', 'telegram_ma_noi', 'nhan_viec_bam'];
  const [toChuc, khoa, tinHieu, caiDat] = await env.CSDL.batch([
    env.CSDL.prepare('SELECT ma_nhan FROM to_chuc WHERE id = ?1').bind(tc),
    env.CSDL.prepare('SELECT loai, tao_luc, dung_luc FROM khoa_truy_cap WHERE to_chuc_id = ?1 ORDER BY tao_luc DESC').bind(tc),
    env.CSDL.prepare('SELECT nguon, lan_cuoi, ghi_chu FROM tin_hieu WHERE to_chuc_id = ?1').bind(tc),
    env.CSDL.prepare(`SELECT khoa, gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa IN (${khoaCaiDat.map((_, i) => `?${i + 2}`).join(',')})`).bind(tc, ...khoaCaiDat),
  ]);
  const maNhan = toChuc.results[0]?.ma_nhan;
  const khoaTheo = (loai) => khoa.results.find((k) => k.loai === loai) || null;
  const th = Object.fromEntries(tinHieu.results.map((t) => [t.nguon, t]));
  const cai = Object.fromEntries(caiDat.results.map((d) => [d.khoa, d.gia_tri]));
  const chat = cai.telegram_chat_id || null;
  let xacNhan = null;
  try {
    xacNhan = JSON.parse(cai.gmail_xac_nhan || 'null');
  } catch {}
  // Đã có thư thật về sau lần xác nhận thì không cần hiện nút xác nhận nữa.
  if (xacNhan && th.thu && th.thu.lan_cuoi > xacNhan.luc) xacNhan = null;
  const [tichAi, tichWebhook, tichClient, tichGoogle, tichGithub, tichKho, bot] = await Promise.all([
    ...['ai', 'webhook', 'google_client', 'google', 'github', 'kho_drive'].map((loai) => giaiTichHop(env, cai[KHOA_TICH_HOP[loai]], loai)),
    layBot(env),
  ]);
  const maNoi = bot ? cai.telegram_ma_noi || (await maNoiTelegram(env, tc)) : null;
  return {
    goc: url.origin,
    tich_hop: {
      ai: tichAi ? { loai: tichAi.loai, mo_hinh: tichAi.mo_hinh, dia_chi: tichAi.dia_chi || null, loi: th.ai?.ghi_chu?.startsWith('Dịch vụ AI ngoài lỗi') ? th.ai : null } : null,
      webhook: tichWebhook ? { host: new URL(tichWebhook.url).host, lan_cuoi: th.webhook || null } : null,
      vai_tro: phien.to_chuc.vai_tro,
    },
    github: tichGithub ? { repo: tichGithub.repo, nhan: tichGithub.nhan, lan_cuoi: th.github || null } : null,
    nhan_viec: { co: Boolean(cai.nhan_viec_bam), dia_chi: `${url.origin}/nhan/viec`, lan_cuoi: th['api-vao'] || null },
    google: { co_client: Boolean(tichClient), da_noi: tichGoogle ? { email: tichGoogle.email || null, co_drive: Boolean(tichGoogle.co_drive) } : null, dia_chi_goi_lai: diaChiGoiLai(url.origin), lan_cuoi: th.google || null },
    kho_drive: { da_noi: tichKho ? { email: tichKho.email || null } : null, lan_cuoi: th.kho || null },
    thu: { dia_chi: env.EMAIL_DOMAIN && maNhan ? `${maNhan}@${env.EMAIL_DOMAIN}` : null, lan_cuoi: th.thu || null, xac_nhan: xacNhan },
    zalo: { khoa: khoaTheo('zalo'), lan_cuoi: th.zalo || null },
    lich: { khoa: khoaTheo('lich') },
    telegram: {
      co_bot: Boolean(bot),
      ten_bot: bot?.ten || null,
      quan_tri: laQuanTri(env, phien),
      da_noi: Boolean(chat),
      duong_dan: bot ? `https://t.me/${bot.ten}?start=${maNoi}` : null,
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

// ---- Zalo: danh sách hội thoại và tin theo dòng thời gian, giống ứng dụng Zalo ----

// Nhóm có tên nhóm; tin riêng gom theo tên người đối diện (tieu_de), thiếu thì theo người gửi.
// Mã tệp trên Drive (nếu đã lưu): ưu tiên cột drive_id của tep, rồi sổ kho_da_luu. Rỗng thì trả NULL.
const DRIVE_ID_TEP = `COALESCE(NULLIF(tep.drive_id, ''), (SELECT NULLIF(k.drive_id, '') FROM kho_da_luu k WHERE k.to_chuc_id = tep.to_chuc_id AND k.loai = 'tep' AND k.ma = CAST(tep.id AS TEXT))) AS drive_id`;

const TEN_TIN_ZALO = `CASE WHEN COALESCE(nhom, '') <> '' THEN nhom ELSE COALESCE(NULLIF(tieu_de, ''), NULLIF(nguoi_gui, ''), 'Không rõ') END`;
const LOAI_TIN_ZALO = `CASE WHEN COALESCE(nhom, '') <> '' THEN 'nhom' ELSE 'ca-nhan' END`;

async function dsHoiThoaiZalo(env, tc, url) {
  const q = (url.searchParams.get('q') || '').trim().replace(/[%_]/g, '');
  const { results } = await env.CSDL.prepare(
    `WITH t AS (
       SELECT id, ${LOAI_TIN_ZALO} AS loai, ${TEN_TIN_ZALO} AS ten, nguoi_gui, noi_dung, thoi_diem, da_xem
       FROM tin_nhan WHERE to_chuc_id = ?1 AND nguon = 'zalo'
     ), x AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY loai, ten ORDER BY thoi_diem DESC, id DESC) AS rn,
         COUNT(*) OVER (PARTITION BY loai, ten) AS n,
         SUM(CASE WHEN da_xem = 0 THEN 1 ELSE 0 END) OVER (PARTITION BY loai, ten) AS chua_xem
       FROM t
     )
     SELECT loai, ten, n, chua_xem, thoi_diem AS cuoi, nguoi_gui AS nguoi_cuoi, substr(noi_dung, 1, 120) AS trich
     FROM x WHERE rn = 1 AND ten LIKE ?2 ORDER BY thoi_diem DESC LIMIT 300`,
  ).bind(tc, `%${q}%`).all();
  return { ds: results };
}

async function tinHoiThoaiZalo(env, tc, url) {
  const loai = url.searchParams.get('loai');
  const ten = (url.searchParams.get('ten') || '').slice(0, 300);
  if ((loai !== 'nhom' && loai !== 'ca-nhan') || !ten) return loi(400, 'Thiếu hội thoại cần xem.');
  const truocLuc = url.searchParams.get('truoc_luc');
  const truocId = Number(url.searchParams.get('truoc_id')) || 0;
  const dieuKien = `to_chuc_id = ?1 AND nguon = 'zalo' AND ${LOAI_TIN_ZALO} = ?2 AND ${TEN_TIN_ZALO} = ?3`;
  const thamSo = [tc, loai, ten];
  let them = '';
  if (truocLuc) {
    thamSo.push(truocLuc, truocId);
    them = ' AND (thoi_diem < ?4 OR (thoi_diem = ?4 AND id < ?5))';
  }
  const { results } = await env.CSDL.prepare(
    `SELECT id, nguoi_gui, noi_dung, thoi_diem, da_xem FROM tin_nhan WHERE ${dieuKien}${them} ORDER BY thoi_diem DESC, id DESC LIMIT 81`,
  ).bind(...thamSo).all();
  const conNua = results.length > 80;
  const tin = results.slice(0, 80).reverse();
  let tep = [];
  if (tin.length) {
    const ids = tin.map((t) => Number(t.id)).join(',');
    tep = (await env.CSDL.prepare(`SELECT id, tin_nhan_id, ten, loai, kich_thuoc, ${DRIVE_ID_TEP} FROM tep WHERE to_chuc_id = ?1 AND tin_nhan_id IN (${ids})`).bind(tc).all()).results;
  }
  if (!truocLuc) {
    await env.CSDL.prepare(`UPDATE tin_nhan SET da_xem = 1 WHERE ${dieuKien} AND da_xem = 0`).bind(tc, loai, ten).run();
  }
  return json({ tin, tep, con_nua: conNua });
}

// ---- Ghi nhớ ----

async function dsGhiNho(env, tc, url) {
  const loai = url.searchParams.get('loai');
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const moi = url.searchParams.get('moi') === '1';
  const dieuKien = ['to_chuc_id = ?1'];
  const thamSo = [tc];
  if (LOAI_GHI_NHO.includes(loai)) { thamSo.push(loai); dieuKien.push(`loai = ?${thamSo.length}`); }
  if (moi) dieuKien.push('da_duyet = 0 AND nguon = \'ai\'');
  if (q) { thamSo.push(`%${q.replace(/[%_]/g, '')}%`); dieuKien.push(`(tieu_de LIKE ?${thamSo.length} OR noi_dung LIKE ?${thamSo.length})`); }
  const [ds, dem] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT id, loai, tieu_de, noi_dung, nguon, do_tin_cay, ghim, da_duyet, tao_luc, cap_nhat_luc FROM ghi_nho WHERE ${dieuKien.join(' AND ')} ORDER BY ghim DESC, cap_nhat_luc DESC LIMIT 200`).bind(...thamSo),
    env.CSDL.prepare(`SELECT COUNT(*) AS tong, SUM(CASE WHEN da_duyet = 0 AND nguon = 'ai' THEN 1 ELSE 0 END) AS moi FROM ghi_nho WHERE to_chuc_id = ?1`).bind(tc),
  ]);
  return { ghi_nho: ds.results, tong: dem.results[0].tong || 0, moi: dem.results[0].moi || 0 };
}

async function taoGhiNho(env, tc, du) {
  const loai = String(du.loai || '');
  const tieuDe = String(du.tieu_de || '').trim().slice(0, 120);
  const noiDung = String(du.noi_dung || '').trim().slice(0, 600);
  if (!LOAI_GHI_NHO.includes(loai) || !tieuDe || !noiDung) return loi(400, 'Chọn loại, nhập tiêu đề và nội dung.');
  const bayGio = new Date().toISOString();
  const kq = await env.CSDL.prepare(
    `INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, nguon, da_duyet, tao_luc, cap_nhat_luc) VALUES (?1, ?2, ?3, ?4, 'tay', 1, ?5, ?5)
     ON CONFLICT (to_chuc_id, loai, tieu_de) DO UPDATE SET noi_dung = excluded.noi_dung, nguon = 'tay', da_duyet = 1, cap_nhat_luc = excluded.cap_nhat_luc RETURNING id`,
  ).bind(tc, loai, tieuDe, noiDung, bayGio).first();
  return json({ id: kq.id });
}

// Sửa nội dung hoặc tiêu đề thì thành mục "tay" (AI không ghi đè nữa); ghim và duyệt giữ nguyên nguồn.
async function suaGhiNho(env, tc, id, du) {
  const dat = [];
  const thamSo = [id, tc];
  const them = (cot, gt) => { thamSo.push(gt); dat.push(`${cot} = ?${thamSo.length}`); };
  if (typeof du.noi_dung === 'string') {
    const nd = du.noi_dung.trim().slice(0, 600);
    if (!nd) return loi(400, 'Nội dung không được để trống.');
    them('noi_dung', nd);
    dat.push(`nguon = 'tay'`, 'da_duyet = 1');
  }
  if (typeof du.tieu_de === 'string') {
    const td = du.tieu_de.trim().slice(0, 120);
    if (!td) return loi(400, 'Tiêu đề không được để trống.');
    them('tieu_de', td);
    dat.push(`nguon = 'tay'`, 'da_duyet = 1');
  }
  if (du.ghim === true || du.ghim === false) them('ghim', du.ghim ? 1 : 0);
  if (du.da_duyet === true) dat.push('da_duyet = 1');
  if (!dat.length) return loi(400, 'Không có gì để sửa.');
  them('cap_nhat_luc', new Date().toISOString());
  try {
    const kq = await env.CSDL.prepare(`UPDATE ghi_nho SET ${[...new Set(dat)].join(', ')} WHERE id = ?1 AND to_chuc_id = ?2`).bind(...thamSo).run();
    if (!kq.meta.changes) return loi(404, 'Không thấy mục ghi nhớ này.');
  } catch (e) {
    if (/UNIQUE/i.test(String(e.message))) return loi(409, 'Đã có mục cùng loại và tiêu đề này.');
    throw e;
  }
  return json({ ok: true });
}

// ---- Luồng: cài đặt từng khâu và số liệu hiện trên sơ đồ ----

async function layLuong(env, tc) {
  const [lg, dem, ai, webhook] = await Promise.all([
    docLuong(env, tc),
    env.CSDL.batch([
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM ghi_nho WHERE to_chuc_id = ?1`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo'`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM tin_nhan WHERE to_chuc_id = ?1 AND da_tach = 0`).bind(tc),
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND gio_hen IS NOT NULL AND han_ngay >= ?2`).bind(tc, ngayVN()),
    ]),
    docTichHop(env, tc, 'ai'),
    docTichHop(env, tc, 'webhook'),
  ]);
  const [nho, viec, tinCho, nhac] = dem.map((d) => d.results[0].n);
  return {
    ...lg,
    gioi_han: Object.fromEntries(Object.entries(NGUONG).map(([k, v]) => [k, { min: v.min, max: v.max, mac_dinh: v.mac_dinh }])),
    so_lieu: { ghi_nho: nho, viec_mo: viec, tin_cho: tinCho, nhac_sap_toi: nhac },
    ai: ai ? { loai: ai.loai, mo_hinh: ai.mo_hinh } : null,
    webhook: Boolean(webhook),
  };
}
