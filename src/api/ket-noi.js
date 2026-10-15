// API giao diện: Trang Kết nối: AI, Google, Drive kho, họp, GitHub, webhook, Telegram, mã nhận.
// Mỗi nhóm nhận (yeuCau, env, phien, url) và trả Response, hoặc null nếu địa chỉ không thuộc nhóm này.
import { caiWorkflow } from '../claude-code.js';
import { datThuMucHop, goKetNoiHop, hoanTatDangNhapHop, quetHop, taoDiaChiDangNhapHop } from '../ghi-am-hop.js';
import { kiemCauHinhGithub, thuGithub } from '../github.js';
import { diaChiGoiLai, goKetNoiGoogle, hoanTatDangNhap, kiemClient, taoDiaChiDangNhap } from '../google.js';
import { docCaiDat, ghiCaiDat } from '../hop-tin.js';
import { dongBoKho, goKetNoiKho, hoanTatDangNhapKho, taoDiaChiDangNhapKho } from '../kho.js';
import { goMaNhanViec, taoMaNhanViec } from '../nhan-ngoai.js';
import { caiBot, layBot, maNoiTelegram } from '../telegram.js';
import { KHOA_TICH_HOP, chuanHoaCauHinhAi, dangViecMoi, docTichHop, giaiTichHop, guiDiaChiNhan, kiemDiaChiNhan, luuTichHop, thuAiNgoai, xoaTichHop } from '../tich-hop.js';
import { bam, json, loi, maNgauNhien, ngayVN } from '../tien-ich.js';
import { laChu, laQuanTri } from './chung.js';

// ---- Kết nối ----


async function layKetNoi(env, tc, url, phien) {
  // Mọi thứ đọc từ D1 gom vào một lượt (trước đây khoảng 12 lượt nối tiếp, mỗi lượt qua lại giữa Worker và cơ sở dữ liệu).
  const khoaCaiDat = [...Object.values(KHOA_TICH_HOP), 'telegram_chat_id', 'gmail_xac_nhan', 'telegram_ma_noi', 'nhan_viec_bam', 'kho_drive_thu_muc', 'hop_thu_muc'];
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
  const [tichAi, tichWebhook, tichClient, tichGoogle, tichGithub, tichKho, tichHop, bot] = await Promise.all([
    ...['ai', 'webhook', 'google_client', 'google', 'github', 'kho_drive', 'hop_drive'].map((loai) => giaiTichHop(env, cai[KHOA_TICH_HOP[loai]], loai)),
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
    google: { co_client: Boolean(tichClient), client_id: tichClient?.client_id || null, da_noi: tichGoogle ? { email: tichGoogle.email || null, co_drive: Boolean(tichGoogle.co_drive) } : null, dia_chi_goi_lai: diaChiGoiLai(url.origin), lan_cuoi: th.google || null },
    kho_drive: { da_noi: tichKho ? { email: tichKho.email || null } : null, lan_cuoi: th.kho || null, thu_muc: maThuMucKho(cai.kho_drive_thu_muc) },
    hop: { da_noi: tichHop ? { email: tichHop.email || null } : null, thu_muc: thuMucHop(cai.hop_thu_muc), lan_cuoi: th.hop || null },
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

function thuMucHop(tho) {
  try {
    const o = JSON.parse(tho || 'null');
    return o && /^[\w-]{10,80}$/.test(o.id) ? { id: o.id, ten: o.ten || '' } : null;
  } catch {
    return null;
  }
}

// Mã các thư mục cấp một của kho trên Drive (chỉ để dựng liên kết mở thư mục); thư mục con bỏ qua.
function maThuMucKho(tho) {
  let o = {};
  try { o = JSON.parse(tho || '{}'); } catch { o = {}; }
  return Object.fromEntries(['goc', 'tin', 'thu', 'tep', 'bo_nho', 'viec', 'phan_loai'].filter((k) => /^[\w-]{10,80}$/.test(String(o[k] || ''))).map((k) => [k, o[k]]));
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

export async function xuLyKetNoi(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;
  let khop;

  if (p === '/api/ket-noi' && m === 'GET') return json(await layKetNoi(env, tc, url, phien));
  if ((khop = p.match(/^\/api\/ket-noi\/(zalo|lich)$/)) && m === 'POST') {
    // Mã Zalo làm luồng nhận tin cả tổ chức đứt nếu bị đổi, và trả về chính mã đó: chỉ chủ được tạo.
    if (khop[1] === 'zalo' && !laChu(phien)) return loi(403, 'Chỉ chủ tổ chức tạo được mã Zalo.');
    return taoKhoa(env, tc, khop[1], url);
  }
  if (p === '/api/ket-noi/ai' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được dịch vụ AI.');
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
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await xoaTichHop(env, tc, 'ai');
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/google' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được Google.');
    try {
      await luuTichHop(env, tc, 'google_client', kiemClient(await yeuCau.json().catch(() => ({}))));
      return json({ ok: true });
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/ket-noi/google' && m === 'DELETE') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goKetNoiGoogle(env, tc);
    if (new URL(yeuCau.url).searchParams.get('het') === '1') await xoaTichHop(env, tc, 'google_client');
    return json({ ok: true });
  }
  if (p === '/api/kho-drive/bat-dau' && m === 'GET') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được Drive kho.');
    const client = await docTichHop(env, tc, 'google_client');
    if (!client) return loi(400, 'Chưa khai Client ID và Secret ở thẻ Google.');
    const state = maNgauNhien(24);
    await ghiCaiDat(env, tc, 'google_state', `${state}.${Date.now() + 10 * 60000}.kho`);
    return Response.redirect(taoDiaChiDangNhapKho(client.client_id, diaChiGoiLai(url.origin), state), 302);
  }
  if (p === '/api/kho-drive/luu-ngay' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    try {
      const kq = await dongBoKho(env, tc);
      if (!kq) return loi(400, 'Chưa nối Drive kho.');
      return json({ ok: true, ...kq });
    } catch (e) {
      return loi(502, e.message);
    }
  }
  if (p === '/api/ket-noi/kho-drive' && m === 'DELETE') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goKetNoiKho(env, tc);
    return json({ ok: true });
  }
  // Ghi âm và biên bản họp: tài khoản Google có thư mục (chỉ đọc), rồi dán liên kết thư mục.
  if (p === '/api/hop/bat-dau' && m === 'GET') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được thư mục họp.');
    const client = await docTichHop(env, tc, 'google_client');
    if (!client) return loi(400, 'Chưa khai Client ID và Secret ở thẻ Google.');
    const state = maNgauNhien(24);
    await ghiCaiDat(env, tc, 'google_state', `${state}.${Date.now() + 10 * 60000}.hop`);
    return Response.redirect(taoDiaChiDangNhapHop(client.client_id, diaChiGoiLai(url.origin), state), 302);
  }
  if (p === '/api/ket-noi/hop' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được thư mục họp.');
    try {
      return json(await datThuMucHop(env, tc, (await yeuCau.json().catch(() => ({}))).link));
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/hop/quet-ngay' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    try {
      const kq = await quetHop(env, tc);
      if (!kq) return loi(400, 'Chưa chọn thư mục họp.');
      return json({ ok: true, ...kq });
    } catch (e) {
      return loi(502, e.message);
    }
  }
  if (p === '/api/ket-noi/hop' && m === 'DELETE') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goKetNoiHop(env, tc);
    return json({ ok: true });
  }
  if (p === '/api/google/bat-dau' && m === 'GET') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được Google.');
    const client = await docTichHop(env, tc, 'google_client');
    if (!client) return loi(400, 'Chưa khai Client ID và Secret.');
    const state = maNgauNhien(24);
    await ghiCaiDat(env, tc, 'google_state', `${state}.${Date.now() + 10 * 60000}`);
    return Response.redirect(taoDiaChiDangNhap(client.client_id, diaChiGoiLai(url.origin), state), 302);
  }
  if (p === '/api/google/goi-lai' && m === 'GET') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được Google.');
    const [state, han, dich] = String((await docCaiDat(env, tc, 'google_state')) || '').split('.');
    await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'google_state'`).bind(tc).run();
    const laKho = dich === 'kho';
    const laHop = dich === 'hop';
    const veTrang = (thongBao) => Response.redirect(`${url.origin}/?${laKho ? 'kho' : laHop ? 'hop' : 'google'}=${encodeURIComponent(thongBao)}#ket-noi`, 302);
    if (url.searchParams.get('error')) return veTrang(url.searchParams.get('error') === 'access_denied' ? 'Bạn đã từ chối ở màn hình Google.' : `Google báo lỗi: ${url.searchParams.get('error')}`);
    if (!state || state !== url.searchParams.get('state') || Date.now() > Number(han)) return veTrang('Phiên đăng nhập đã hết hạn, bấm nút đăng nhập lại.');
    try {
      if (laKho) await hoanTatDangNhapKho(env, tc, url.searchParams.get('code'), diaChiGoiLai(url.origin));
      else if (laHop) await hoanTatDangNhapHop(env, tc, url.searchParams.get('code'), diaChiGoiLai(url.origin));
      else await hoanTatDangNhap(env, tc, url.searchParams.get('code'), diaChiGoiLai(url.origin));
      return veTrang('ok');
    } catch (e) {
      return veTrang(e.message);
    }
  }
  if (p === '/api/ket-noi/github' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức nối được GitHub.');
    try {
      const cauHinh = kiemCauHinhGithub(await yeuCau.json().catch(() => ({})));
      await thuGithub(cauHinh);
      await luuTichHop(env, tc, 'github', cauHinh);
      return json({ repo: cauHinh.repo, nhan: cauHinh.nhan });
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/ket-noi/github/cai-claude' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    const cauHinh = await docTichHop(env, tc, 'github');
    if (!cauHinh) return loi(400, 'Nối GitHub trước.');
    try {
      await caiWorkflow(cauHinh);
      return json({ ok: true });
    } catch (e) {
      return loi(400, e.message);
    }
  }
  if (p === '/api/ket-noi/github' && m === 'DELETE') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await xoaTichHop(env, tc, 'github');
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/nhan-viec' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức tạo được mã.');
    return json({ dia_chi: `${url.origin}/nhan/viec`, ma: await taoMaNhanViec(env, tc) });
  }
  if (p === '/api/ket-noi/nhan-viec' && m === 'DELETE') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await goMaNhanViec(env, tc);
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/webhook' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
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
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
    await xoaTichHop(env, tc, 'webhook');
    return json({ ok: true });
  }
  if (p === '/api/ket-noi/webhook/thu' && m === 'POST') {
    if (!laChu(phien)) return loi(403, 'Chỉ chủ tổ chức làm được việc này.');
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

  return null;
}
