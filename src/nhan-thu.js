// Nhận thư qua Cloudflare Email Routing. Mỗi tổ chức có một địa chỉ <ma_nhan>@<EMAIL_DOMAIN>;
// người dùng cài chuyển tiếp thư từ Gmail (hay hộp thư khác) về địa chỉ đó. Không cần xin quyền đọc Gmail.

import PostalMime from 'postal-mime';
import { ghiTinHieu, luuTep, luuTin, TEP_TOI_DA } from './hop-tin.js';
import { tachViecChoToChuc } from './viec.js';

export function maNhanTuDiaChi(diaChi, mien) {
  const s = String(diaChi || '').toLowerCase().trim();
  const [cucBo, phanMien] = s.split('@');
  if (!cucBo || (mien && phanMien !== String(mien).toLowerCase())) return null;
  return cucBo.split('+')[0];
}

// Thư HTML không có bản chữ thường: bỏ thẻ, giữ xuống dòng.
export function chuTuHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function nhanThu(thu, env, ctx) {
  const maNhan = maNhanTuDiaChi(thu.to, env.EMAIL_DOMAIN);
  const toChuc = maNhan && (await env.CSDL.prepare('SELECT id FROM to_chuc WHERE ma_nhan = ?1').bind(maNhan).first());
  if (!toChuc) {
    thu.setReject('Không có hộp thư này.');
    return;
  }
  const docThu = await PostalMime.parse(thu.raw);
  const nguoiGui = docThu.from?.name ? `${docThu.from.name} <${docThu.from.address}>` : docThu.from?.address || thu.from;
  const tinId = await luuTin(env, toChuc.id, {
    nguon: 'gmail',
    ma_goc: docThu.messageId || `${thu.from}-${docThu.date}-${docThu.subject}`,
    nguoi_gui: nguoiGui,
    tieu_de: docThu.subject || '(không có tiêu đề)',
    noi_dung: (docThu.text || chuTuHtml(docThu.html)).trim(),
    thoi_diem: Number.isNaN(Date.parse(docThu.date)) ? new Date().toISOString() : new Date(docThu.date).toISOString(),
  });
  if (!tinId) return; // thư trùng
  for (const tep of docThu.attachments || []) {
    const kichThuoc = tep.content?.byteLength ?? 0;
    if (!kichThuoc || kichThuoc > TEP_TOI_DA) continue;
    // Bỏ ảnh nhúng trong thân thư (logo, chữ ký), chỉ giữ tệp đính kèm thật.
    if (tep.disposition === 'inline' && /^image\//.test(tep.mimeType) && kichThuoc < 100 * 1024) continue;
    await luuTep(env, toChuc.id, {
      ten: tep.filename || 'tep-dinh-kem',
      loai: tep.mimeType,
      kich_thuoc: kichThuoc,
      du_lieu: tep.content,
      nguon: 'gmail',
      nguoi_gui: nguoiGui,
      tin_nhan_id: tinId,
    });
  }
  await ghiTinHieu(env, toChuc.id, 'thu', `Thư từ ${docThu.from?.address || thu.from}`);
  ctx.waitUntil(tachViecChoToChuc(env, toChuc.id).catch((e) => console.error('Tách việc lỗi', e)));
}
