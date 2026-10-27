// Sonicplan: giao diện, API, nhận tin và hẹn giờ trong một Worker, dùng chung cho nhiều tổ chức (khách).

import { xuLyApi } from './api.js';
import { diaChiIp, gioiHanTanSuat, hanMucDuongDan } from './gioi-han.js';
import { nhanViecNgoai } from './nhan-ngoai.js';
import { taoIcs } from './lich-ics.js';
import { TAC_VU, tacVuTheoLich } from './lich-chay.js';
import { nhanThu } from './nhan-thu.js';
import { nhanThuQuaHttp } from './nhan-thu-http.js';
import { lenhCaiZalo, nhanZalo, toChucTheoKhoa } from './nhan-zalo.js';
import { xacDinhPhien } from './phien.js';
import { baoLoiTacVu, CAC_TAC_VU } from './tac-vu.js';
import { nhanWebhook } from './telegram.js';
import { bam, json, loi } from './tien-ich.js';
import { nhanTram, xuLyApiTram } from './tram-claude.js';

// Durable Object giữ phòng chat của trang Claude (mỗi tổ chức một phòng).
export { TramClaude } from './tram-claude.js';

export default {
  async fetch(yeuCau, env, ctx) {
    const url = new URL(yeuCau.url);
    try {
      if (url.pathname === '/api/suc-khoe') return json({ ok: true });

      // Địa chỉ cho máy móc gọi vào, tự kiểm bằng mã riêng, không qua đăng nhập Access.
      const han = hanMucDuongDan(url.pathname);
      if (han) {
        const kq = gioiHanTanSuat(han.nhom, diaChiIp(yeuCau), han.toiDa);
        if (!kq.duoc) return new Response(JSON.stringify({ loi: 'Gọi quá nhiều lần, thử lại sau ít phút.' }), { status: 429, headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': String(kq.cho_giay) } });
      }
      const cai = url.pathname.match(/^\/nhan\/zalo-cai\/([^/]+)$/);
      if (cai && yeuCau.method === 'GET') return lenhCaiZalo(env, cai[1], url);
      if (url.pathname.startsWith('/nhan/zalo-')) return nhanZalo(yeuCau, env, ctx, url.pathname);
      if (url.pathname === '/nhan/viec') return nhanViecNgoai(yeuCau, env, ctx);
      if (url.pathname === '/nhan/thu') return nhanThuQuaHttp(yeuCau, env, ctx);
      if (url.pathname.startsWith('/nhan/tram/')) return nhanTram(yeuCau, env, url);
      if (url.pathname === '/nhan/telegram' && yeuCau.method === 'POST') return nhanWebhook(yeuCau, env, ctx);
      const lich = url.pathname.match(/^\/lich\/([a-z0-9]{20,64})\.ics$/);
      if (lich && yeuCau.method === 'GET') return docLich(env, lich[1], url);

      // Phần /hoalac (Viện Hòa Lạc) cách ly hẳn khỏi phần còn lại: tổ chức phạm vi 'hoalac' chỉ
      // vào được đúng đường dẫn này, và đường dẫn này chỉ nhận tổ chức phạm vi 'hoalac'. Tính trước
      // khi xác định phiên để một người thuộc nhiều tổ chức (ví dụ vừa chủ tổ chức thường vừa chủ
      // Hòa Lạc) vẫn được chọn đúng tổ chức Hòa Lạc khi gọi đường dẫn này, không chỉ chọn tổ chức
      // thêm trước nhất.
      const duongHoaLac = url.pathname === '/hoalac' || url.pathname.startsWith('/hoalac/') || url.pathname === '/api/hoalac' || url.pathname.startsWith('/api/hoalac/');
      const phien = await xacDinhPhien(yeuCau, env, duongHoaLac ? 'hoalac' : undefined);
      if (!phien.duoc) {
        console.warn('Từ chối:', phien.ly_do, url.pathname);
        if (!url.pathname.startsWith('/api/') && phien.ma === 403) return trangChuaMoi();
        return loi(phien.ma, phien.ma === 403 ? 'Tài khoản chưa được mời dùng hệ thống.' : 'Bạn cần đăng nhập lại.');
      }

      // Chống giả mạo yêu cầu từ trang khác (OWASP ASVS V3/V4): lệnh ghi phải đến từ chính trang này.
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(yeuCau.method) && !cungNguon(yeuCau, url)) {
        return loi(403, 'Yêu cầu không đến từ trang Sonicplan.');
      }

      if (phien.to_chuc.pham_vi_truy_cap === 'hoalac') {
        if (!duongHoaLac && !url.pathname.startsWith('/api/toi') && url.pathname !== '/api/thong-bao' && !url.pathname.startsWith('/api/thong-bao/')) {
          return loi(403, 'Tài khoản này chỉ dùng được phần Viện Hòa Lạc.');
        }
      } else if (duongHoaLac) {
        return loi(403, 'Tài khoản này không thuộc Viện Hòa Lạc.');
      }

      // Chạy ngay một tác vụ hẹn giờ (nút "Chạy ngay" ở trang Luồng và Nhật ký). Chỉ chủ tổ chức.
      if (url.pathname === '/api/chay-ngay' && yeuCau.method === 'POST') {
        if (phien.to_chuc.vai_tro !== 'chu') return json({ loi: 'Chỉ chủ tổ chức chạy tay được.' }, 403);
        const { tac_vu: ma } = await yeuCau.json().catch(() => ({}));
        const tv = TAC_VU.find((t) => t.ma === ma && t.ma !== 'tu-kiem');
        if (!tv) return json({ loi: 'Không có tác vụ này.' }, 400);
        return json(await chayTacVu(env, tv, new Date().toISOString(), { ep: true }));
      }
      if (url.pathname.startsWith('/api/tram/')) return xuLyApiTram(yeuCau, env, phien, url);
      if (url.pathname.startsWith('/api/')) return xuLyApi(yeuCau, env, phien, url);
      // Trang, mã và kiểu dáng luôn hỏi lại máy chủ trước khi dùng bản lưu, để bản mới lên ngay.
      // Phần /hoalac có bundle riêng (public/hoalac/), không dùng SPA fallback của bundle chính:
      // mọi đường dẫn trang (không có đuôi tệp) dưới /hoalac trả về đúng public/hoalac/index.html.
      let yeuCauTinh = yeuCau;
      if (duongHoaLac && !/\.[a-z0-9]+$/i.test(url.pathname)) {
        const u2 = new URL(url); u2.pathname = '/hoalac/index.html';
        yeuCauTinh = new Request(u2, yeuCau);
      }
      const tinh = await env.ASSETS.fetch(yeuCauTinh);
      if (/\.(?:js|css|html|webmanifest)$|\/$/.test(new URL(yeuCauTinh.url).pathname)) {
        const ra = new Response(tinh.body, tinh);
        ra.headers.set('cache-control', 'no-cache');
        return ra;
      }
      return tinh;
    } catch (e) {
      console.error('Lỗi xử lý', url.pathname, e);
      return loi(500, 'Hệ thống đang gặp lỗi, thử lại sau ít phút.');
    }
  },

  async email(thu, env, ctx) {
    try {
      await nhanThu(thu, env, ctx);
    } catch (e) {
      console.error('Nhận thư lỗi', e);
      thu.setReject('Hệ thống tạm lỗi, gửi lại sau.');
    }
  },

  async scheduled(dieuKhien, env, ctx) {
    // Từ 13/10/2026 Sonicplan chạy trên Mac mini (may-chu/). Bản Worker cũ trên Cloudflare vẫn được tự triển khai
    // từ main và vẫn có lịch hẹn giờ, nên chạy song song trên D1 cũ: báo lỗi trùng, gửi tin Telegram trùng.
    // Chỉ chạy tác vụ khi là máy chủ riêng, hoặc khi cố ý đặt biến CHAY_TREN_CF = "1".
    if (!env.MAY_RIENG && env.CHAY_TREN_CF !== '1') return;
    for (const tv of tacVuTheoLich(dieuKhien.cron)) {
      ctx.waitUntil(chayTacVu(env, tv));
    }
  },
};

async function docLich(env, khoa, url) {
  const toChucId = await toChucTheoKhoa(env, khoa, 'lich');
  if (!toChucId) return new Response('Không tìm thấy lịch', { status: 404 });
  const [viec, moc, toChuc] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay IS NOT NULL`).bind(toChucId),
    // Mốc dự án (/hoalac): la_moc=1, ngày lấy từ ngay_ket_thuc, hoặc ngay_bat_dau nếu chưa có ngày kết thúc.
    env.CSDL.prepare(
      `SELECT id, ten, mo_ta, COALESCE(ngay_ket_thuc, ngay_bat_dau) AS han_ngay FROM qlda_hang_muc
       WHERE to_chuc_id = ?1 AND la_moc = 1 AND COALESCE(ngay_ket_thuc, ngay_bat_dau) IS NOT NULL`,
    ).bind(toChucId),
    env.CSDL.prepare('SELECT ten FROM to_chuc WHERE id = ?1').bind(toChucId),
    env.CSDL.prepare('UPDATE khoa_truy_cap SET dung_luc = ?2 WHERE ma_bam = ?1').bind(await bam(khoa), new Date().toISOString()),
  ]);
  const cacMoc = moc.results.map((m) => ({ id: m.id, tieu_de: `Mốc: ${m.ten}`, ghi_chu: m.mo_ta, han_ngay: m.han_ngay, gio_hen: null, loai: 'moc' }));
  const ics = taoIcs([...viec.results, ...cacMoc], { ten: `Việc - ${toChuc.results[0]?.ten || 'Sonicplan'}`, mien: url.hostname });
  return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function chayTacVu(env, tv, bayGio = new Date().toISOString(), tuyChon = {}) {
  const lam = CAC_TAC_VU[tv.ma];
  if (!lam) return { trang_thai: 'khong-co', ghi_chu: 'Không có tác vụ này' };
  // Bấm "Chạy ngay" khi lượt trước còn đang chạy (dưới 10 phút) thì không chạy chồng lên nhau.
  if (tuyChon.ep) {
    const dangChay = await env.CSDL.prepare(`SELECT id FROM nhat_ky_chay WHERE tac_vu = ?1 AND trang_thai = 'dang_chay' AND bat_dau > ?2 LIMIT 1`)
      .bind(tv.ma, new Date(Date.parse(bayGio) - 10 * 60000).toISOString()).first();
    if (dangChay) return { trang_thai: 'dang-chay', ghi_chu: 'Tác vụ này đang chạy, đợi nó xong rồi bấm lại.' };
  }
  const { meta } = await env.CSDL.prepare(
    `INSERT INTO nhat_ky_chay (to_chuc_id, tac_vu, bat_dau, trang_thai) VALUES ('', ?1, ?2, 'dang_chay')`,
  ).bind(tv.ma, bayGio).run();
  const id = meta.last_row_id;
  try {
    const kq = await lam(env, bayGio, tuyChon);
    if (kq.bo_qua) {
      // Chưa đến giờ của tác vụ: không ghi nhật ký.
      await env.CSDL.prepare('DELETE FROM nhat_ky_chay WHERE id = ?1').bind(id).run();
      return { trang_thai: 'bo-qua', ghi_chu: 'Chưa có gì cần làm lúc này' };
    }
    await ghiKetQua(env, id, 'xong', kq.so_muc, kq.ghi_chu);
    return { trang_thai: 'xong', ghi_chu: kq.ghi_chu };
  } catch (e) {
    console.error('Tác vụ lỗi', tv.ma, e);
    await ghiKetQua(env, id, 'loi', 0, String(e.message || e).slice(0, 500));
    await baoLoiTacVu(env, tv, bayGio, e.message || e).catch((e2) => console.error('Báo lỗi tác vụ lỗi', e2));
    return { trang_thai: 'loi', ghi_chu: String(e.message || e).slice(0, 300) };
  }
}

function ghiKetQua(env, id, trangThai, soMuc, ghiChu) {
  return env.CSDL.prepare(
    `UPDATE nhat_ky_chay SET ket_thuc = ?1, trang_thai = ?2, so_muc = ?3, ghi_chu = ?4 WHERE id = ?5`,
  ).bind(new Date().toISOString(), trangThai, soMuc, ghiChu, id).run();
}

function trangChuaMoi() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chưa được mời</title>' +
      '<p style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6">' +
      'Tài khoản này chưa được mời dùng Sonicplan. Liên hệ người quản trị để được thêm vào.</p>',
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

// Trình duyệt luôn gửi Sec-Fetch-Site hoặc Origin với lệnh ghi; thiếu cả hai (công cụ dòng lệnh đã qua Access) thì cho qua.
export function cungNguon(yeuCau, url) {
  const site = yeuCau.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const nguon = yeuCau.headers.get('origin');
  return !nguon || nguon === url.origin;
}
