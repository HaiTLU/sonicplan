// Sonicplan: giao diện, API, nhận tin và hẹn giờ trong một Worker, dùng chung cho nhiều tổ chức (khách).

import { xuLyApi } from './api.js';
import { nhanViecNgoai } from './nhan-ngoai.js';
import { taoIcs } from './lich-ics.js';
import { TAC_VU, tacVuTheoLich } from './lich-chay.js';
import { nhanThu } from './nhan-thu.js';
import { lenhCaiZalo, nhanZalo, toChucTheoKhoa } from './nhan-zalo.js';
import { xacDinhPhien } from './phien.js';
import { baoLoiTacVu, CAC_TAC_VU } from './tac-vu.js';
import { nhanWebhook } from './telegram.js';
import { bam, json, loi } from './tien-ich.js';

export default {
  async fetch(yeuCau, env, ctx) {
    const url = new URL(yeuCau.url);
    try {
      if (url.pathname === '/api/suc-khoe') return json({ ok: true });

      // Địa chỉ cho máy móc gọi vào, tự kiểm bằng mã riêng, không qua đăng nhập Access.
      const cai = url.pathname.match(/^\/nhan\/zalo-cai\/([^/]+)$/);
      if (cai && yeuCau.method === 'GET') return lenhCaiZalo(env, cai[1], url);
      if (url.pathname.startsWith('/nhan/zalo-')) return nhanZalo(yeuCau, env, ctx, url.pathname);
      if (url.pathname === '/nhan/viec') return nhanViecNgoai(yeuCau, env, ctx);
      if (url.pathname === '/nhan/telegram' && yeuCau.method === 'POST') return nhanWebhook(yeuCau, env, ctx);
      const lich = url.pathname.match(/^\/lich\/([a-z0-9]{20,64})\.ics$/);
      if (lich && yeuCau.method === 'GET') return docLich(env, lich[1], url);

      const phien = await xacDinhPhien(yeuCau, env);
      if (!phien.duoc) {
        console.warn('Từ chối:', phien.ly_do, url.pathname);
        if (!url.pathname.startsWith('/api/') && phien.ma === 403) return trangChuaMoi();
        return loi(phien.ma, phien.ma === 403 ? 'Tài khoản chưa được mời dùng hệ thống.' : 'Bạn cần đăng nhập lại.');
      }

      // Chạy ngay một tác vụ hẹn giờ (nút "Chạy ngay" ở trang Luồng và Nhật ký). Chỉ chủ tổ chức.
      if (url.pathname === '/api/chay-ngay' && yeuCau.method === 'POST') {
        if (phien.to_chuc.vai_tro !== 'chu') return json({ loi: 'Chỉ chủ tổ chức chạy tay được.' }, 403);
        const { tac_vu: ma } = await yeuCau.json().catch(() => ({}));
        const tv = TAC_VU.find((t) => t.ma === ma && t.ma !== 'tu-kiem');
        if (!tv) return json({ loi: 'Không có tác vụ này.' }, 400);
        return json(await chayTacVu(env, tv, new Date().toISOString(), { ep: true }));
      }
      if (url.pathname.startsWith('/api/')) return xuLyApi(yeuCau, env, phien, url);
      // Trang, mã và kiểu dáng luôn hỏi lại máy chủ trước khi dùng bản lưu, để bản mới lên ngay.
      const tinh = await env.ASSETS.fetch(yeuCau);
      if (/\.(?:js|css|html|webmanifest)$|\/$/.test(url.pathname)) {
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
    for (const tv of tacVuTheoLich(dieuKhien.cron)) {
      ctx.waitUntil(chayTacVu(env, tv));
    }
  },
};

async function docLich(env, khoa, url) {
  const toChucId = await toChucTheoKhoa(env, khoa, 'lich');
  if (!toChucId) return new Response('Không tìm thấy lịch', { status: 404 });
  const [viec, toChuc] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay IS NOT NULL`).bind(toChucId),
    env.CSDL.prepare('SELECT ten FROM to_chuc WHERE id = ?1').bind(toChucId),
    env.CSDL.prepare('UPDATE khoa_truy_cap SET dung_luc = ?2 WHERE ma_bam = ?1').bind(await bam(khoa), new Date().toISOString()),
  ]);
  const ics = taoIcs(viec.results, { ten: `Việc - ${toChuc.results[0]?.ten || 'Sonicplan'}`, mien: url.hostname });
  return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function chayTacVu(env, tv, bayGio = new Date().toISOString(), tuyChon = {}) {
  const lam = CAC_TAC_VU[tv.ma];
  if (!lam) return { trang_thai: 'khong-co', ghi_chu: 'Không có tác vụ này' };
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
