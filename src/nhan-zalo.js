// Nhận tin và tệp Zalo từ chương trình trên máy Mac. Giữ đúng các địa chỉ và dạng dữ liệu
// chương trình đang gửi (zalo-tong-hop, zalo-lenh, zalo-tomtat, zalo-tep), nên máy Mac chỉ cần
// đổi N8N_WEBHOOK_URL và N8N_HEADER_VALUE trong tệp .env, không phải sửa mã.

import { tomTatTin } from './ai.js';
import { ghiTinHieu, luuTep, luuTin, TEP_TOI_DA } from './hop-tin.js';
import { baoToChuc } from './telegram.js';
import { bam, json, loi } from './tien-ich.js';
import { tachViecChoToChuc } from './viec.js';

export async function toChucTheoKhoa(env, khoa, loai) {
  if (!khoa || khoa.length < 20) return null;
  const dong = await env.CSDL.prepare('SELECT to_chuc_id FROM khoa_truy_cap WHERE ma_bam = ?1 AND loai = ?2').bind(await bam(khoa), loai).first();
  return dong ? dong.to_chuc_id : null;
}

function layKhoa(yeuCau) {
  const tieuDe = yeuCau.headers.get('x-zalo-token');
  if (tieuDe) return tieuDe.trim();
  const m = (yeuCau.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

// Chuyển một tin từ máy Mac sang dạng lưu. Tin gửi đi từ chính mình ghi người gửi "Tôi".
export function chuyenTinZalo(t) {
  return {
    nguon: 'zalo',
    ma_goc: String(t.id ?? `${t.time}-${t.sender}-${String(t.text || '').slice(0, 40)}`),
    nguoi_gui: t.sender,
    nhom: t.type === 'nhom' ? t.thread : null,
    tieu_de: t.type === 'nhom' ? null : t.thread,
    noi_dung: t.text,
    thoi_diem: Number.isNaN(Date.parse(t.time)) ? new Date().toISOString() : new Date(t.time).toISOString(),
  };
}

export async function nhanZalo(yeuCau, env, ctx, duongDan) {
  const toChucId = await toChucTheoKhoa(env, layKhoa(yeuCau), 'zalo');
  if (!toChucId) return loi(401, 'Mã máy gửi Zalo không đúng. Tạo mã mới ở trang Kết nối.');

  if (duongDan === '/nhan/zalo-lenh' && yeuCau.method === 'GET') {
    await ghiTinHieu(env, toChucId, 'zalo', 'Máy Mac hỏi lệnh');
    const lenh = await env.CSDL.prepare('SELECT lenh, tu_luc, nhan FROM lenh_cho WHERE to_chuc_id = ?1').bind(toChucId).first();
    if (!lenh) return json({});
    await env.CSDL.prepare('DELETE FROM lenh_cho WHERE to_chuc_id = ?1').bind(toChucId).run();
    return json({ cmd: lenh.lenh, since: lenh.tu_luc, label: lenh.nhan });
  }

  if (yeuCau.method !== 'POST') return loi(405, 'Sai phương thức.');

  if (duongDan === '/nhan/zalo-tong-hop') {
    const than = await yeuCau.json().catch(() => null);
    if (!than || !Array.isArray(than.messages)) return loi(400, 'Thiếu danh sách tin.');
    let moi = 0;
    for (const t of than.messages.slice(0, 500)) {
      if (await luuTin(env, toChucId, chuyenTinZalo(t))) moi++;
    }
    await ghiTinHieu(env, toChucId, 'zalo', moi ? `Nhận ${moi} tin` : 'Tín hiệu còn chạy');
    if (moi) ctx.waitUntil(tachViecChoToChuc(env, toChucId).catch((e) => console.error('Tách việc lỗi', e)));
    return json({ ok: true, moi });
  }

  if (duongDan === '/nhan/zalo-tomtat') {
    const than = await yeuCau.json().catch(() => ({}));
    const tin = Array.isArray(than.messages) ? than.messages : [];
    ctx.waitUntil(
      (async () => {
        const tomTat = tin.length ? await tomTatTin(env, tin, than.label) : 'Không có tin Zalo nào trong khoảng này.';
        await baoToChuc(env, toChucId, `Tóm tắt Zalo ${than.label || ''}\n\n${tomTat}`);
      })().catch((e) => console.error('Tóm tắt lỗi', e)),
    );
    return json({ ok: true, so_tin: tin.length });
  }

  if (duongDan === '/nhan/zalo-tep') {
    const doDai = Number(yeuCau.headers.get('content-length') || 0);
    if (doDai > TEP_TOI_DA + 64 * 1024) return loi(413, 'Tệp lớn quá 25 MB.');
    const form = await yeuCau.formData().catch(() => null);
    if (!form) return loi(400, 'Thiếu dữ liệu tệp.');
    const duLieu = form.get('data');
    const ten = String(form.get('ten') || duLieu?.name || 'tep');
    const thoiDiem = form.get('thoiGian') ? new Date(String(form.get('thoiGian'))).toISOString() : new Date().toISOString();
    const nguoiGui = String(form.get('nguoiGui') || '');
    const nhom = String(form.get('nhom') || '');
    const tinId = await luuTin(env, toChucId, {
      nguon: 'zalo',
      ma_goc: `tep-${thoiDiem}-${ten}`,
      nguoi_gui: nguoiGui,
      nhom: nhom || null,
      noi_dung: `Gửi tệp: ${ten}${form.get('ngucanh') ? `\n${form.get('ngucanh')}` : ''}`,
      thoi_diem: thoiDiem,
    });
    if (duLieu && typeof duLieu !== 'string') {
      if (duLieu.size > TEP_TOI_DA) return loi(413, 'Tệp lớn quá 25 MB.');
      await luuTep(env, toChucId, {
        ten,
        loai: duLieu.type,
        kich_thuoc: duLieu.size,
        du_lieu: await duLieu.arrayBuffer(),
        nguon: 'zalo',
        nguoi_gui: nguoiGui,
        nhom,
        tin_nhan_id: tinId,
      });
    }
    await ghiTinHieu(env, toChucId, 'zalo', `Nhận tệp ${ten}`);
    return json({ ok: true });
  }

  return loi(404, 'Không có địa chỉ này.');
}

// Lệnh cài một dòng hiện ở trang Kết nối: curl -fsSL <gốc>/nhan/zalo-cai/<mã> | bash
// Trả một đoạn lệnh trỏ chương trình đọc Zalo trên Mac về Sonicplan rồi khởi động lại nó.
// Chỉ trả khi mã đúng, vì đoạn lệnh có chứa mã.
export async function lenhCaiZalo(env, khoa, url) {
  if (!/^[a-z0-9]{20,64}$/.test(khoa) || !(await toChucTheoKhoa(env, khoa, 'zalo'))) {
    return new Response('echo "Mã không đúng hoặc đã thay. Mở trang Kết nối của Sonicplan và bấm Tạo lệnh mới."; exit 1\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const diaChi = `${url.origin}/nhan/zalo-tong-hop`;
  const lenh = `#!/bin/bash
# Nối chương trình đọc Zalo trên máy Mac với Sonicplan.
set -e
THU_MUC="$HOME/.zalo-listener"
if [ ! -f "$THU_MUC/.env" ]; then
  echo "Máy này chưa có chương trình đọc Zalo. Bản cài cho máy mới đang được chuẩn bị."
  exit 1
fi
cp "$THU_MUC/.env" "$THU_MUC/.env.truoc-sonicplan-$(date +%Y%m%d%H%M%S)"
grep -vE '^(N8N_WEBHOOK_URL|N8N_HEADER_NAME|N8N_HEADER_VALUE|N8N_POLL_URL|N8N_SUMMARY_URL|N8N_TEP_URL)=' "$THU_MUC/.env" > "$THU_MUC/.env.moi" || true
printf 'N8N_WEBHOOK_URL=%s\\nN8N_HEADER_NAME=x-zalo-token\\nN8N_HEADER_VALUE=%s\\n' '${diaChi}' '${khoa}' >> "$THU_MUC/.env.moi"
mv "$THU_MUC/.env.moi" "$THU_MUC/.env"
chmod 600 "$THU_MUC/.env"
NHAN=$(launchctl list | awk '/zalo/ {print $3; exit}')
if [ -n "$NHAN" ]; then
  launchctl kickstart -k "gui/$(id -u)/$NHAN"
  echo "Xong. Zalo trên máy này đã gửi về Sonicplan. Mở lại trang Kết nối sau vài phút để thấy đèn xanh."
else
  echo "Đã ghi cấu hình nhưng không thấy chương trình đang chạy. Khởi động lại máy Mac để chương trình chạy lại."
fi
`;
  return new Response(lenh, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
