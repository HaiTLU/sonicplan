// Nhận tin và tệp Zalo từ chương trình trên máy Mac. Giữ đúng các địa chỉ và dạng dữ liệu
// chương trình đang gửi (zalo-tong-hop, zalo-lenh, zalo-tomtat, zalo-tep), nên máy Mac chỉ cần
// đổi N8N_WEBHOOK_URL và N8N_HEADER_VALUE trong tệp .env, không phải sửa mã.

import { tomTatTin } from './ai.js';
import { ketThucGui, layLenhGui, taiTepGui } from './zalo-gui.js';
import { luuAnhTuLo } from './anh-dai-dien.js';
import { docHoSo } from './ghi-nho.js';
import { docDiaChiNgoai, napTepNgoai } from './zalo-ngoai.js';
import { ghiTinHieu, luuTep, luuTin, TEP_TOI_DA } from './hop-tin.js';
import { baoToChuc } from './telegram.js';
import { docTichHop } from './tich-hop.js';
import { bam, json, loi } from './tien-ich.js';
import { tachViecChoToChuc } from './viec.js';

const lanTachViecCuoi = new Map();

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
    ma_hoi_thoai: t.thread_id ? `${t.type === 'nhom' ? 'nhom' : 'ca-nhan'}:${String(t.thread_id).slice(0, 100)}` : null,
    noi_dung: t.text,
    thoi_diem: Number.isNaN(Date.parse(t.time)) ? new Date().toISOString() : new Date(t.time).toISOString(),
  };
}

// Tin mình gửi trong chat riêng mà chương trình Zalo bản cũ ghi dưới tên mình (không có mã hội thoại):
// nhìn các tin người kia gửi quanh đó 30 phút. Chỉ khi toàn bộ chúng thuộc đúng một cuộc trò chuyện
// thì xếp tin vào cuộc đó; có hai người trở lên thì để nguyên, không đoán bừa.
export async function xepTinGuiDiVaoHoiThoai(env, toChucId) {
  // Tin tệp từ máy Mac không kèm mã hội thoại và không có tieu_de, nên hiện thành một mục riêng cạnh cuộc trò chuyện của người gửi.
  // Chat riêng thì tên người gửi chính là tên cuộc trò chuyện: điền tieu_de để bước nhập chung bên dưới ghép đúng cuộc đã có mã.
  await env.CSDL.prepare(
    `UPDATE tin_nhan SET tieu_de = nguoi_gui WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND ma_goc LIKE 'tep-%' AND COALESCE(nhom, '') = ''
       AND COALESCE(tieu_de, '') = '' AND COALESCE(ma_hoi_thoai, '') = '' AND COALESCE(nguoi_gui, '') NOT IN ('', 'Tôi')`,
  ).bind(toChucId).run();
  // Tin cũ chưa có mã (trước bản vá) cùng tên nhóm/người với đúng một cuộc đã có mã thì nhập vào cuộc đó, khỏi hiện thành hai mục.
  for (const [cot, loai] of [['nhom', 'nhom'], ['tieu_de', 'ca-nhan']]) {
    const dieuKien = cot === 'nhom' ? `COALESCE(nhom, '') <> ''` : `COALESCE(nhom, '') = '' AND COALESCE(tieu_de, '') <> ''`;
    const { results: cu } = await env.CSDL.prepare(
      `SELECT DISTINCT ${cot} AS ten FROM tin_nhan WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND ${dieuKien} AND COALESCE(ma_hoi_thoai, '') = '' LIMIT 100`,
    ).bind(toChucId).all();
    for (const { ten } of cu) {
      const { results: ma } = await env.CSDL.prepare(
        `SELECT DISTINCT ma_hoi_thoai AS ma FROM tin_nhan WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND ${dieuKien} AND ${cot} = ?2 AND ma_hoi_thoai LIKE ?3`,
      ).bind(toChucId, ten, `${loai}:%`).all();
      if (ma.length !== 1) continue;
      await env.CSDL.prepare(
        `UPDATE tin_nhan SET ma_hoi_thoai = ?1 WHERE to_chuc_id = ?2 AND nguon = 'zalo' AND ${dieuKien} AND ${cot} = ?3 AND COALESCE(ma_hoi_thoai, '') = ''`,
      ).bind(ma[0].ma, toChucId, ten).run();
    }
  }
  const { results } = await env.CSDL.prepare(
    `SELECT id, thoi_diem, tieu_de FROM tin_nhan t
     WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND nguoi_gui = 'Tôi' AND COALESCE(nhom, '') = '' AND COALESCE(ma_hoi_thoai, '') = ''
       AND NOT EXISTS (SELECT 1 FROM tin_nhan n WHERE n.to_chuc_id = t.to_chuc_id AND n.nguon = 'zalo' AND n.tieu_de = t.tieu_de AND n.nguoi_gui <> 'Tôi')
     ORDER BY thoi_diem DESC LIMIT 300`,
  ).bind(toChucId).all();
  let xep = 0;
  for (const tin of results) {
    const ms = Date.parse(tin.thoi_diem);
    if (Number.isNaN(ms)) continue;
    const { results: gan } = await env.CSDL.prepare(
      `SELECT DISTINCT tieu_de, COALESCE(ma_hoi_thoai, '') AS ma FROM tin_nhan
       WHERE to_chuc_id = ?1 AND nguon = 'zalo' AND nguoi_gui <> 'Tôi' AND COALESCE(nhom, '') = '' AND COALESCE(tieu_de, '') <> '' AND thoi_diem BETWEEN ?2 AND ?3`,
    ).bind(toChucId, new Date(ms - 30 * 60000).toISOString(), new Date(ms + 30 * 60000).toISOString()).all();
    if (gan.length !== 1) continue;
    await env.CSDL.prepare(`UPDATE tin_nhan SET tieu_de = ?1, ma_hoi_thoai = ?2 WHERE id = ?3 AND to_chuc_id = ?4`)
      .bind(gan[0].tieu_de, gan[0].ma || null, tin.id, toChucId).run();
    xep++;
  }
  return xep;
}

export async function nhanZalo(yeuCau, env, ctx, duongDan) {
  const toChucId = await toChucTheoKhoa(env, layKhoa(yeuCau), 'zalo');
  if (!toChucId) return loi(401, 'Mã máy gửi Zalo không đúng. Tạo mã mới ở trang Kết nối.');

  if (duongDan === '/nhan/zalo-lenh' && yeuCau.method === 'GET') {
    await ghiTinHieu(env, toChucId, 'zalo', 'Máy Mac hỏi lệnh');
    const lenh = await env.CSDL.prepare('SELECT lenh, tu_luc, nhan, tao_luc FROM lenh_cho WHERE to_chuc_id = ?1').bind(toChucId).first();
    if (!lenh) return json({});
    await env.CSDL.prepare('DELETE FROM lenh_cho WHERE to_chuc_id = ?1').bind(toChucId).run();
    if (Date.now() - Date.parse(lenh.tao_luc) > 15 * 60000) return json({}); // lệnh quá 15 phút thì bỏ
    return json({ cmd: lenh.lenh, since: lenh.tu_luc, label: lenh.nhan });
  }

  // Gửi tin Zalo do chủ bấm trong Sonicplan: máy Mac lấy lệnh, tải tệp đính kèm, gửi rồi báo kết quả.
  if (duongDan === '/nhan/zalo-gui-cho' && yeuCau.method === 'GET') return layLenhGui(env, toChucId);
  if (duongDan === '/nhan/zalo-gui-tep' && yeuCau.method === 'GET') return taiTepGui(env, toChucId, new URL(yeuCau.url));
  if (duongDan === '/nhan/zalo-gui-xong' && yeuCau.method === 'POST') return ketThucGui(env, toChucId, await yeuCau.json().catch(() => ({})));

  if (yeuCau.method !== 'POST') return loi(405, 'Sai phương thức.');

  if (duongDan === '/nhan/zalo-tong-hop') {
    const than = await yeuCau.json().catch(() => null);
    if (!than || !Array.isArray(than.messages)) return loi(400, 'Thiếu danh sách tin.');
    let moi = 0;
    const canNap = [];
    for (const t of than.messages.slice(0, 500)) {
      const tinMoi = chuyenTinZalo(t);
      const id = await luuTin(env, toChucId, tinMoi);
      if (!id) continue;
      moi++;
      if (!tinMoi.an && docDiaChiNgoai(tinMoi.noi_dung)) canNap.push(id);
    }
    // Tải ảnh và tệp về kho ngay khi tin về, trước khi đường dẫn Zalo hết hạn. Lỗi thì bỏ qua, trang tin vẫn thử lại khi mở.
    if (canNap.length) ctx.waitUntil((async () => { for (const id of canNap.slice(0, 15)) await napTepNgoai(env, toChucId, id).catch(() => {}); })());
    if (moi) await xepTinGuiDiVaoHoiThoai(env, toChucId).catch((e) => console.error('Xếp tin gửi đi lỗi', e));
    // Ảnh đại diện Zalo (cuộc trò chuyện, người gửi): tải về kho ở nền, lỗi thì bỏ qua.
    if (than.messages.some((t) => t && (t.thread_avatar || t.sender_avatar))) ctx.waitUntil(luuAnhTuLo(env, toChucId, than.messages.slice(0, 500)).catch((e) => console.error('Lưu ảnh đại diện lỗi', e)));
    // Ghi rõ chương trình Zalo trên Mac là bản đã vá (gửi mã hội thoại) hay chưa, để anh thấy ngay ở trang Kết nối.
    const daVa = than.messages.some((t) => t && t.thread_id);
    const chuVa = than.messages.length ? (daVa ? ', chương trình Zalo đã vá' : ', chương trình Zalo chưa vá (chạy cai-va.sh)') : '';
    await ghiTinHieu(env, toChucId, 'zalo', moi ? `Nhận ${moi} tin${chuVa}` : 'Tín hiệu còn chạy');
    // Tin về gần như tức thì (30 giây/lần) nhưng AI tách việc vẫn gom, tối đa 10 phút một lượt cho mỗi tổ chức.
    if (moi && Date.now() - (lanTachViecCuoi.get(toChucId) || 0) > 10 * 60_000) {
      lanTachViecCuoi.set(toChucId, Date.now());
      ctx.waitUntil(tachViecChoToChuc(env, toChucId).catch((e) => console.error('Tách việc lỗi', e)));
    }
    return json({ ok: true, moi });
  }

  if (duongDan === '/nhan/zalo-tomtat') {
    const than = await yeuCau.json().catch(() => ({}));
    const tin = Array.isArray(than.messages) ? than.messages : [];
    ctx.waitUntil(
      (async () => {
        if (!tin.length) {
          await baoToChuc(env, toChucId, `Không có tin Zalo ${than.label || 'trong khoảng này'}.`);
          return;
        }
        const tomTat = await tomTatTin(env, tin, than.label, { ngoai: await docTichHop(env, toChucId, 'ai'), hoSo: await docHoSo(env, toChucId) });
        await baoToChuc(env, toChucId, `Tóm tắt Zalo ${than.label || ''} (${tin.length} tin)\n\n${tomTat}`);
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
    const tinTep = {
      nguon: 'zalo',
      ma_goc: `tep-${thoiDiem}-${ten}`,
      nguoi_gui: nguoiGui,
      nhom: nhom || null,
      noi_dung: `Gửi tệp: ${ten}${form.get('ngucanh') ? `\n${form.get('ngucanh')}` : ''}`,
      thoi_diem: thoiDiem,
    };
    const tinId = await luuTin(env, toChucId, tinTep);
    if (duLieu && typeof duLieu !== 'string' && !tinTep.an) {
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
