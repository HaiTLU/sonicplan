// Sonicplan: giao diện, API và hẹn giờ trong một Worker, dùng chung cho nhiều tổ chức (khách).

import { xacDinhPhien } from './phien.js';
import { tacVuTheoLich } from './lich-chay.js';
import { tinhTinhTrang } from './tinh-trang.js';

export default {
  async fetch(yeuCau, env) {
    const url = new URL(yeuCau.url);
    try {
      if (url.pathname === '/api/suc-khoe') return json({ ok: true });

      const phien = await xacDinhPhien(yeuCau, env);
      if (!phien.duoc) {
        console.warn('Từ chối:', phien.ly_do, url.pathname);
        if (!url.pathname.startsWith('/api/') && phien.ma === 403) return trangChuaMoi();
        return loi(phien.ma, phien.ma === 403 ? 'Tài khoản chưa được mời dùng hệ thống.' : 'Bạn cần đăng nhập lại.');
      }

      if (url.pathname === '/api/toi' && yeuCau.method === 'GET') return json(thongTinToi(phien));
      if (url.pathname === '/api/tinh-trang' && yeuCau.method === 'GET') return json(await layTinhTrang(env, phien.to_chuc.id));
      if (url.pathname === '/api/nhat-ky' && yeuCau.method === 'GET') return json(await layNhatKy(env, phien.to_chuc.id, url));
      if (url.pathname.startsWith('/api/')) return loi(404, 'Không có chức năng này.');

      return env.ASSETS.fetch(yeuCau);
    } catch (e) {
      console.error('Lỗi xử lý', url.pathname, e);
      return loi(500, 'Hệ thống đang gặp lỗi, thử lại sau ít phút.');
    }
  },

  async scheduled(dieuKhien, env, ctx) {
    for (const tv of tacVuTheoLich(dieuKhien.cron)) {
      ctx.waitUntil(chayTacVu(env, tv));
    }
  },
};

// Tác vụ của cả hệ thống ghi to_chuc_id rỗng. Tác vụ theo khách (giai đoạn 1 trở đi) sẽ lặp qua
// từng tổ chức có kết nối đang chạy và ghi nhật ký riêng cho từng tổ chức.
const CAC_TAC_VU = {
  'tu-kiem': async (env, bayGio) => {
    await env.CSDL.prepare(
      `INSERT INTO tin_hieu (to_chuc_id, nguon, lan_cuoi, ghi_chu) VALUES ('', 'hen-gio', ?1, 'Tự kiểm mỗi giờ')
       ON CONFLICT (to_chuc_id, nguon) DO UPDATE SET lan_cuoi = excluded.lan_cuoi`,
    ).bind(bayGio).run();
    return { so_muc: 1, ghi_chu: 'Hẹn giờ chạy bình thường' };
  },
};

export async function chayTacVu(env, tv, bayGio = new Date().toISOString()) {
  const lam = CAC_TAC_VU[tv.ma];
  if (!lam) return;
  const { meta } = await env.CSDL.prepare(
    `INSERT INTO nhat_ky_chay (to_chuc_id, tac_vu, bat_dau, trang_thai) VALUES ('', ?1, ?2, 'dang_chay')`,
  ).bind(tv.ma, bayGio).run();
  const id = meta.last_row_id;
  try {
    const kq = await lam(env, bayGio);
    await ghiKetQua(env, id, 'xong', kq.so_muc, kq.ghi_chu);
  } catch (e) {
    console.error('Tác vụ lỗi', tv.ma, e);
    await ghiKetQua(env, id, 'loi', 0, String(e.message || e).slice(0, 500));
  }
}

function ghiKetQua(env, id, trangThai, soMuc, ghiChu) {
  return env.CSDL.prepare(
    `UPDATE nhat_ky_chay SET ket_thuc = ?1, trang_thai = ?2, so_muc = ?3, ghi_chu = ?4 WHERE id = ?5`,
  ).bind(new Date().toISOString(), trangThai, soMuc, ghiChu, id).run();
}

function thongTinToi(phien) {
  return { email: phien.email, nguoi_dung: phien.nguoi_dung, to_chuc: phien.to_chuc, cac_to_chuc: phien.cac_to_chuc };
}

// Người dùng thấy nhật ký của tổ chức mình và của cả hệ thống (to_chuc_id rỗng), không thấy của khách khác.
async function layTinhTrang(env, toChucId) {
  const [tinHieu, ketNoi, lanChayCuoi] = await env.CSDL.batch([
    env.CSDL.prepare(`SELECT nguon, lan_cuoi FROM tin_hieu WHERE to_chuc_id = ''`),
    env.CSDL.prepare('SELECT loai, trang_thai, cap_nhat_luc FROM ket_noi WHERE to_chuc_id = ?1').bind(toChucId),
    env.CSDL.prepare(
      `SELECT tac_vu, bat_dau, ket_thuc, trang_thai, so_muc, ghi_chu FROM nhat_ky_chay n
       WHERE to_chuc_id IN ('', ?1)
         AND id = (SELECT MAX(id) FROM nhat_ky_chay m WHERE m.tac_vu = n.tac_vu AND m.to_chuc_id = n.to_chuc_id)`,
    ).bind(toChucId),
  ]);
  return tinhTinhTrang({
    tinHieuHeThong: tinHieu.results,
    ketNoi: ketNoi.results,
    lanChayCuoi: lanChayCuoi.results,
    bayGio: Date.now(),
  });
}

async function layNhatKy(env, toChucId, url) {
  const soDong = Math.min(Math.max(Number(url.searchParams.get('so_dong')) || 50, 1), 200);
  const { results } = await env.CSDL.prepare(
    `SELECT id, tac_vu, bat_dau, ket_thuc, trang_thai, so_muc, ghi_chu FROM nhat_ky_chay
     WHERE to_chuc_id IN ('', ?1) ORDER BY id DESC LIMIT ?2`,
  ).bind(toChucId, soDong).all();
  return { dong: results };
}

function json(duLieu, trangThai = 200) {
  return new Response(JSON.stringify(duLieu), {
    status: trangThai,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Mọi lỗi API cùng một dạng: mã trạng thái và một câu tiếng Việt, không lộ chi tiết kỹ thuật.
function loi(trangThai, thongBao) {
  return json({ loi: thongBao }, trangThai);
}

function trangChuaMoi() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chưa được mời</title>' +
      '<p style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6">' +
      'Tài khoản này chưa được mời dùng hệ thống. Liên hệ người quản trị để được thêm vào.</p>',
    { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
