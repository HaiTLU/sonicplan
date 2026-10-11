// Báo qua Telegram. Một bot dùng chung cho cả hệ thống (TELEGRAM_BOT_TOKEN là biến bí mật);
// mỗi tổ chức nối bằng cách bấm đường dẫn t.me/<bot>?start=<mã nối> trong trang Kết nối.

import { goiNgoai } from './goi-ngoai.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { maNgauNhien } from './tien-ich.js';

export function coTelegram(env) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TEN);
}

export async function goiBot(env, phuongThuc, duLieu) {
  const ph = await goiNgoai(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${phuongThuc}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(duLieu),
  });
  const kq = await ph.json().catch(() => ({}));
  if (!kq.ok) throw new Error(`Telegram từ chối: ${kq.description || ph.status}`);
  return kq.result;
}

// Gửi tin cho tổ chức; chưa nối Telegram thì bỏ qua và trả false.
export async function baoToChuc(env, toChucId, noiDung) {
  if (!coTelegram(env)) return false;
  const chat = await docCaiDat(env, toChucId, 'telegram_chat_id');
  if (!chat) return false;
  for (let i = 0; i < noiDung.length; i += 3900) {
    await goiBot(env, 'sendMessage', { chat_id: chat, text: noiDung.slice(i, i + 3900), disable_web_page_preview: true });
  }
  await ghiTinHieu(env, toChucId, 'telegram', 'Gửi tin');
  return true;
}

export async function maNoiTelegram(env, toChucId) {
  let ma = await docCaiDat(env, toChucId, 'telegram_ma_noi');
  if (!ma) {
    ma = maNgauNhien(24);
    await ghiCaiDat(env, toChucId, 'telegram_ma_noi', ma);
  }
  return ma;
}

// Telegram gọi vào đây mỗi khi có người nhắn bot. Trả về lệnh cần làm cho phần gọi (để kiểm thử được).
export function phanTichLenh(van) {
  const s = String(van || '').trim();
  const m = s.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/s);
  if (!m) return { lenh: null, doi_so: s };
  return { lenh: m[1].toLowerCase(), doi_so: m[2].trim() };
}

// "/tomtat 3h", "/tomtat 30p", "/tomtat" (mặc định 2 giờ). Trả số phút.
export function soPhutTomTat(doiSo) {
  const m = String(doiSo || '').match(/(\d+)\s*(h|g|giờ|gio|p|phút|phut|m)?/i);
  if (!m) return 120;
  const so = Number(m[1]);
  const donVi = (m[2] || 'h').toLowerCase();
  const phut = /^(p|phút|phut|m)$/.test(donVi) ? so : so * 60;
  return Math.min(Math.max(phut, 5), 48 * 60);
}

export async function nhanWebhook(yeuCau, env, ctx) {
  if (!env.TELEGRAM_WEBHOOK_SECRET || yeuCau.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('', { status: 401 });
  }
  const cap = await yeuCau.json().catch(() => ({}));
  const tin = cap.message;
  if (!tin?.chat?.id) return new Response('ok');
  const chat = String(tin.chat.id);
  const { lenh, doi_so: doiSo } = phanTichLenh(tin.text);

  const tra = (noiDung) => ctx.waitUntil(goiBot(env, 'sendMessage', { chat_id: chat, text: noiDung }).catch((e) => console.error('Trả lời Telegram lỗi', e)));

  if (lenh === 'start' && doiSo) {
    const dong = await env.CSDL.prepare(
      `SELECT c.to_chuc_id, t.ten FROM cai_dat c JOIN to_chuc t ON t.id = c.to_chuc_id WHERE c.khoa = 'telegram_ma_noi' AND c.gia_tri = ?1`,
    ).bind(doiSo).first();
    if (!dong) {
      tra('Mã nối không đúng hoặc đã hết hạn. Mở trang Kết nối của Sonicplan và bấm lại đường dẫn Telegram.');
      return new Response('ok');
    }
    await ghiCaiDat(env, dong.to_chuc_id, 'telegram_chat_id', chat);
    await ghiCaiDat(env, dong.to_chuc_id, 'telegram_ma_noi', maNgauNhien(24));
    await ghiTinHieu(env, dong.to_chuc_id, 'telegram', 'Đã nối');
    tra(`Đã nối Telegram với ${dong.ten}. Từ giờ việc mới và cảnh báo sẽ báo ở đây. Gõ /tomtat 3h để tóm tắt tin Zalo 3 giờ qua.`);
    return new Response('ok');
  }

  const toChuc = await env.CSDL.prepare(`SELECT to_chuc_id FROM cai_dat WHERE khoa = 'telegram_chat_id' AND gia_tri = ?1`).bind(chat).first();
  if (!toChuc) {
    tra('Cuộc trò chuyện này chưa nối với Sonicplan. Mở trang Kết nối và bấm đường dẫn Telegram.');
    return new Response('ok');
  }

  if (lenh === 'tomtat') {
    const phut = soPhutTomTat(doiSo);
    const tu = new Date(Date.now() - phut * 60000).toISOString();
    const nhan = phut % 60 === 0 ? `${phut / 60} giờ qua` : `${phut} phút qua`;
    await env.CSDL.prepare(
      `INSERT INTO lenh_cho (to_chuc_id, lenh, tu_luc, nhan, tao_luc) VALUES (?1, 'tomtat', ?2, ?3, ?4)
       ON CONFLICT (to_chuc_id) DO UPDATE SET lenh = excluded.lenh, tu_luc = excluded.tu_luc, nhan = excluded.nhan, tao_luc = excluded.tao_luc`,
    ).bind(toChuc.to_chuc_id, tu, nhan, new Date().toISOString()).run();
    tra(`Đang lấy tin Zalo ${nhan} từ máy Mac, có tóm tắt trong vài phút.`);
    return new Response('ok');
  }

  tra('Lệnh dùng được: /tomtat 3h (tóm tắt tin Zalo 3 giờ qua).');
  return new Response('ok');
}
