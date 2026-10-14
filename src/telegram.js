// Báo qua Telegram. Một bot dùng chung cho cả hệ thống: người quản trị dán mã bot (lấy từ @BotFather)
// một lần ở trang Kết nối, mã được mã hóa rồi lưu trong D1. Mỗi tổ chức nối bằng cách bấm đường dẫn
// t.me/<bot>?start=<mã nối> rồi bấm Start.

import { traLoiTuBoNho } from './ai.js';
import { goiNgoai } from './goi-ngoai.js';
import { tongHopChoToChuc } from './tong-hop.js';
import { chonGhiNho, docHoSo, nhayCam } from './ghi-nho.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { giaiMa, maHoa } from './ma-hoa.js';
import { docTichHop } from './tich-hop.js';
import { bam, congNgay, maNgauNhien, ngayVN, sangUTC } from './tien-ich.js';
import { xuLyVanBanTrucTiep } from './viec.js';

// Thiết lập chung của hệ thống nằm ở cai_dat với to_chuc_id rỗng.
const HE_THONG = '';
let botDaLuu = { luc: 0, bot: null };

// Bot đang dùng: { token, ten } hoặc null nếu chưa cài.
export async function layBot(env) {
  if (Date.now() - botDaLuu.luc < 60000) return botDaLuu.bot;
  let bot = null;
  const banMa = await docCaiDat(env, HE_THONG, 'telegram_bot');
  if (banMa && env.KHOA_MA_HOA) {
    try {
      bot = await giaiMa(banMa, env.KHOA_MA_HOA);
    } catch (e) {
      console.error('Không đọc được mã bot Telegram', e);
    }
  }
  botDaLuu = { luc: Date.now(), bot };
  return bot;
}

// Chuỗi bí mật Telegram gửi kèm mỗi lần gọi vào, suy ra từ mã bot nên không phải cất thêm khóa nào.
export async function biMatWebhook(token) {
  return (await bam(`sonicplan-webhook:${token}`)).slice(0, 64);
}

async function goiTelegram(token, phuongThuc, duLieu) {
  const ph = await goiNgoai(`https://api.telegram.org/bot${token}/${phuongThuc}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(duLieu),
  });
  const kq = await ph.json().catch(() => ({}));
  if (!kq.ok) throw new Error(`Telegram từ chối: ${kq.description || ph.status}`);
  return kq.result;
}

export async function goiBot(env, phuongThuc, duLieu) {
  const bot = await layBot(env);
  if (!bot) throw new Error('Chưa cài bot Telegram');
  return goiTelegram(bot.token, phuongThuc, duLieu);
}

// Người quản trị dán mã bot: kiểm mã với Telegram, lưu (đã mã hóa), đăng ký địa chỉ nhận tin. Trả tên bot.
export async function caiBot(env, token, goc) {
  const ma = String(token || '').trim();
  if (!/^\d{5,15}:[\w-]{30,}$/.test(ma)) throw new Error('Mã bot không đúng dạng. Chép nguyên dòng mã @BotFather gửi.');
  if (!env.KHOA_MA_HOA) throw new Error('Hệ thống chưa có khóa mã hóa, liên hệ người quản trị.');
  const toi = await goiTelegram(ma, 'getMe', {});
  await goiTelegram(ma, 'setWebhook', { url: `${goc}/nhan/telegram`, secret_token: await biMatWebhook(ma), allowed_updates: ['message', 'callback_query'] });
  await ghiCaiDat(env, HE_THONG, 'telegram_bot', await maHoa({ token: ma, ten: toi.username }, env.KHOA_MA_HOA));
  botDaLuu = { luc: 0, bot: null };
  return toi.username;
}

// Gửi tin cho tổ chức; chưa nối Telegram thì bỏ qua và trả false.
export async function baoToChuc(env, toChucId, noiDung) {
  if (!(await layBot(env))) return false;
  const chat = await docCaiDat(env, toChucId, 'telegram_chat_id');
  if (!chat) return false;
  for (let i = 0; i < noiDung.length; i += 3900) {
    await goiBot(env, 'sendMessage', { chat_id: chat, text: noiDung.slice(i, i + 3900), disable_web_page_preview: true });
  }
  await ghiTinHieu(env, toChucId, 'telegram', 'Gửi tin');
  return true;
}

// Gửi một tin kèm hàng nút bấm trả lời nhanh. nut: [[{ text, callback_data }]].
export async function baoToChucNut(env, toChucId, noiDung, nut) {
  if (!(await layBot(env))) return false;
  const chat = await docCaiDat(env, toChucId, 'telegram_chat_id');
  if (!chat) return false;
  await goiBot(env, 'sendMessage', { chat_id: chat, text: noiDung.slice(0, 3900), reply_markup: { inline_keyboard: nut } });
  await ghiTinHieu(env, toChucId, 'telegram', 'Gửi tin');
  return true;
}

// Nút trả lời nhanh dưới lời nhắc việc. Dữ liệu nút dạng "v:<id>:<hành động>", tối đa 64 byte theo giới hạn của Telegram.
export function nutNhacViec(viecId) {
  return [[
    { text: 'Xong', callback_data: `v:${viecId}:xong` },
    { text: 'Dời mai', callback_data: `v:${viecId}:mai` },
    { text: 'Dời tuần sau', callback_data: `v:${viecId}:tuan` },
    { text: 'Bỏ', callback_data: `v:${viecId}:bo` },
  ]];
}

export function phanTichNut(du) {
  const m = String(du || '').match(/^v:(\d+):(xong|mai|tuan|bo)$/);
  return m ? { viec_id: Number(m[1]), hanh_dong: m[2] } : null;
}

// Áp một lựa chọn nút lên việc của tổ chức. Trả câu ghi lại dưới tin nhắn, hoặc null nếu không tìm thấy việc.
export async function apDungNutViec(env, tc, { viec_id: id, hanh_dong: hanhDong }, bayGio = new Date().toISOString()) {
  const v = await env.CSDL.prepare('SELECT id, tieu_de, han_ngay FROM viec WHERE id = ?1 AND to_chuc_id = ?2').bind(id, tc).first();
  if (!v) return null;
  if (hanhDong === 'xong' || hanhDong === 'bo') {
    await env.CSDL.prepare(`UPDATE viec SET trang_thai = ?3, xong_luc = ?4, cap_nhat_luc = ?5 WHERE id = ?1 AND to_chuc_id = ?2`)
      .bind(id, tc, hanhDong === 'xong' ? 'xong' : 'huy', hanhDong === 'xong' ? bayGio : null, bayGio).run();
    return hanhDong === 'xong' ? 'Đã đánh dấu xong.' : 'Đã bỏ việc này.';
  }
  const goc = v.han_ngay && v.han_ngay > ngayVN(bayGio) ? v.han_ngay : ngayVN(bayGio);
  const moi = congNgay(goc, hanhDong === 'mai' ? 1 : 7);
  // can_dong_bo = 1: Google Tasks và Lịch dời theo.
  await env.CSDL.prepare(`UPDATE viec SET han_ngay = ?3, cap_nhat_luc = ?4, can_dong_bo = 1 WHERE id = ?1 AND to_chuc_id = ?2`).bind(id, tc, moi, bayGio).run();
  // Hạn đổi thì lời nhắc cũ hết nghĩa: xóa dấu đã nhắc để nhắc lại theo hạn mới.
  await env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id = ?1').bind(id).run();
  return `Đã dời sang ${moi.slice(8, 10)}/${moi.slice(5, 7)}.`;
}

// Đăng ký lại địa chỉ nhận tin của Telegram để nhận cả lượt bấm nút (callback_query). Giữ nguyên địa chỉ đang dùng.
export async function bamNutDuocChua(env) {
  const bot = await layBot(env);
  if (!bot) return false;
  if ((await docCaiDat(env, HE_THONG, 'telegram_webhook_nut')) === bot.token.slice(-6)) return false;
  const info = await goiTelegram(bot.token, 'getWebhookInfo', {});
  if (!info.url) return false;
  await goiTelegram(bot.token, 'setWebhook', { url: info.url, secret_token: await biMatWebhook(bot.token), allowed_updates: ['message', 'callback_query'] });
  await ghiCaiDat(env, HE_THONG, 'telegram_webhook_nut', bot.token.slice(-6));
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

// Một dòng việc cho tin Telegram: "- 09:00 12/10 Họp với chị Lan".
export function dongViecTelegram(v) {
  const ngay = v.han_ngay ? `${v.han_ngay.slice(8, 10)}/${v.han_ngay.slice(5, 7)}` : '';
  const han = [v.gio_hen, ngay].filter(Boolean).join(' ');
  return `- ${han ? `${han} ` : ''}${v.tieu_de}`;
}

// /nho <nội dung>: tiêu đề là vài chữ đầu, nội dung là cả câu. Mục do tay nhập nên AI không ghi đè.
export function ghiNhoTuLenh(doiSo) {
  const nd = String(doiSo || '').trim().slice(0, 600);
  if (!nd) return { loi: 'Gõ kèm điều cần nhớ, ví dụ: /nho Chị Lan là trưởng phòng đào tạo.' };
  if (nhayCam(nd)) return { loi: 'Em không lưu mật khẩu, mã xác nhận, số thẻ hay số giấy tờ.' };
  return { tieu_de: nd.split(/\s+/).slice(0, 8).join(' ').slice(0, 80), noi_dung: nd };
}

async function lenhViec(env, tc) {
  const { results } = await env.CSDL.prepare(
    `SELECT tieu_de, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' ORDER BY han_ngay IS NULL, han_ngay, gio_hen, id LIMIT 12`,
  ).bind(tc).all();
  if (!results.length) return 'Không có việc nào đang mở.';
  return `Việc đang mở:\n${results.map(dongViecTelegram).join('\n')}`;
}

async function lenhHoi(env, tc, cauHoi) {
  if (!cauHoi) return 'Gõ kèm câu hỏi, ví dụ: /hoi chị Lan phụ trách gì?';
  const [gn, viec] = await env.CSDL.batch([
    env.CSDL.prepare('SELECT loai, tieu_de, noi_dung, ghim FROM ghi_nho WHERE to_chuc_id = ?1 ORDER BY ghim DESC, cap_nhat_luc DESC LIMIT 300').bind(tc),
    env.CSDL.prepare(`SELECT tieu_de, han_ngay FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' ORDER BY id DESC LIMIT 40`).bind(tc),
  ]);
  const ghiNho = chonGhiNho(gn.results, cauHoi);
  return (await traLoiTuBoNho(env, cauHoi, ghiNho, viec.results.map((v) => `${v.tieu_de}${v.han_ngay ? ` (hạn ${v.han_ngay})` : ''}`), { ngoai: await docTichHop(env, tc, 'ai'), hoSo: await docHoSo(env, tc) })) || 'Em chưa nhớ điều này.';
}

// Nhắn thường: AI đọc như một tin, thấy việc thì tạo việc và báo lại.
async function nhanTinThuong(env, tc, van, tenNguoi) {
  const kq = await xuLyVanBanTrucTiep(env, tc, { nguon: 'telegram', nguoi_gui: tenNguoi || 'Tôi', noi_dung: van });
  if (kq.tat) return 'Khâu đọc tin và tách việc đang tắt ở trang Luồng nên em chưa tạo việc được.';
  if (!kq.viec.length) return 'Em chưa thấy việc nào trong tin này. Muốn em nhớ điều gì thì gõ /nho, muốn hỏi thì gõ /hoi.';
  const moi = kq.viec.filter((v) => !v.trung);
  const trung = kq.viec.length - moi.length;
  return [moi.length ? `Đã thêm ${moi.length} việc:\n${moi.map(dongViecTelegram).join('\n')}` : '', trung ? `${trung} việc đã có sẵn nên không thêm lại.` : ''].filter(Boolean).join('\n');
}

async function luotBamNut(env, ctx, cb) {
  const chat = String(cb.message?.chat?.id || '');
  const nut = phanTichNut(cb.data);
  const toChuc = chat && (await env.CSDL.prepare(`SELECT to_chuc_id FROM cai_dat WHERE khoa = 'telegram_chat_id' AND gia_tri = ?1`).bind(chat).first());
  const bot = await layBot(env);
  const tra = (van) => ctx.waitUntil(goiTelegram(bot.token, 'answerCallbackQuery', { callback_query_id: cb.id, text: van }).catch(() => {}));
  if (!nut || !toChuc) { tra('Nút này không còn dùng được.'); return new Response('ok'); }
  const ketQua = await apDungNutViec(env, toChuc.to_chuc_id, nut);
  tra(ketQua || 'Không tìm thấy việc này nữa.');
  if (ketQua) {
    // Bỏ hàng nút và ghi kết quả vào tin để khỏi bấm lần hai.
    ctx.waitUntil(goiTelegram(bot.token, 'editMessageText', { chat_id: chat, message_id: cb.message.message_id, text: `${cb.message.text}\n${ketQua}` }).catch(() => {}));
  }
  return new Response('ok');
}

export async function nhanWebhook(yeuCau, env, ctx) {
  const bot = await layBot(env);
  if (!bot || yeuCau.headers.get('x-telegram-bot-api-secret-token') !== (await biMatWebhook(bot.token))) {
    return new Response('', { status: 401 });
  }
  const cap = await yeuCau.json().catch(() => ({}));
  if (cap.callback_query) return luotBamNut(env, ctx, cap.callback_query);
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

  if (lenh === 'tomtat' || lenh === 'tomtat24') {
    // /tomtat24: 24 giờ qua. /tomtat không kèm gì: từ 0h hôm nay. /tomtat 3h hoặc 30p: theo số đã nêu.
    let tu, nhan;
    if (lenh === 'tomtat24') {
      tu = new Date(Date.now() - 24 * 3600000).toISOString();
      nhan = '24 giờ qua';
    } else if (!doiSo) {
      tu = sangUTC(ngayVN(), '00:00').toISOString();
      nhan = 'từ 0h hôm nay';
    } else {
      const phut = soPhutTomTat(doiSo);
      tu = new Date(Date.now() - phut * 60000).toISOString();
      nhan = phut % 60 === 0 ? `${phut / 60} giờ qua` : `${phut} phút qua`;
    }
    await env.CSDL.prepare(
      `INSERT INTO lenh_cho (to_chuc_id, lenh, tu_luc, nhan, tao_luc) VALUES (?1, 'tomtat', ?2, ?3, ?4)
       ON CONFLICT (to_chuc_id) DO UPDATE SET lenh = excluded.lenh, tu_luc = excluded.tu_luc, nhan = excluded.nhan, tao_luc = excluded.tao_luc`,
    ).bind(toChuc.to_chuc_id, tu, nhan, new Date().toISOString()).run();
    tra(`Đang lấy tin Zalo ${nhan}, khoảng 1-2 phút nữa có bản tóm tắt.`);
    return new Response('ok');
  }

  const lam = (viec) => ctx.waitUntil(Promise.resolve().then(viec).then(tra, (e) => { console.error('Lệnh Telegram lỗi', e); tra(`Em chưa làm được: ${String(e.message || e).slice(0, 150)}`); }));
  if (lenh === 'viec') { lam(() => lenhViec(env, toChuc.to_chuc_id)); return new Response('ok'); }
  if (lenh === 'tonghop') {
    lam(async () => {
      try { return (await tongHopChoToChuc(env, toChuc.to_chuc_id)).noi_dung.slice(0, 3900); } catch (e) { return `Chưa tổng hợp được: ${String(e.message || e).slice(0, 150)}`; }
    });
    return new Response('ok');
  }
  if (lenh === 'hoi') { lam(() => lenhHoi(env, toChuc.to_chuc_id, doiSo)); return new Response('ok'); }
  if (lenh === 'nho') {
    const g = ghiNhoTuLenh(doiSo);
    if (g.loi) { tra(g.loi); return new Response('ok'); }
    const bayGio = new Date().toISOString();
    await env.CSDL.prepare(
      `INSERT INTO ghi_nho (to_chuc_id, loai, tieu_de, noi_dung, nguon, da_duyet, tao_luc, cap_nhat_luc) VALUES (?1, 'su_that', ?2, ?3, 'tay', 1, ?4, ?4)
       ON CONFLICT (to_chuc_id, loai, tieu_de) DO UPDATE SET noi_dung = excluded.noi_dung, nguon = 'tay', da_duyet = 1, cap_nhat_luc = excluded.cap_nhat_luc`,
    ).bind(toChuc.to_chuc_id, g.tieu_de, g.noi_dung, bayGio).run();
    tra('Đã nhớ. Xem hoặc sửa ở trang Ghi nhớ.');
    return new Response('ok');
  }
  if (!lenh && String(doiSo).trim().length >= 4) {
    await ghiTinHieu(env, toChuc.to_chuc_id, 'telegram', 'Nhận tin nhắn');
    lam(() => nhanTinThuong(env, toChuc.to_chuc_id, doiSo, [tin.from?.first_name, tin.from?.last_name].filter(Boolean).join(' ')));
    return new Response('ok');
  }

  tra('Nhắn bình thường, ví dụ "mai 9h họp với chị Lan", em sẽ tạo việc.\n/viec - việc đang mở\n/nho <điều cần nhớ>\n/hoi <câu hỏi> - hỏi từ ghi nhớ\n/tonghop - bản tổng hợp việc, tin, rủi ro\n/tomtat - tóm tắt tin Zalo từ 0h hôm nay\n/tomtat 3h - tóm tắt 3 giờ qua');
  return new Response('ok');
}
