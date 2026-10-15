// Thông báo trên web: chuông trong trang và thông báo đẩy của trình duyệt (Web Push, RFC 8030, 8291, 8292).
// Mọi mã hóa dùng WebCrypto nên chạy được cả trên Worker lẫn máy chủ Node, không cần thư viện ngoài.
// Telegram vẫn chạy song song; đây là kênh thêm. Lỗi gửi đẩy không bao giờ làm hỏng việc đang tạo.

import { dangYenLang, docLuong } from './luong.js';
import { maHoa, giaiMaEnv } from './ma-hoa.js';
import { cat, gioVN, json, loi } from './tien-ich.js';

const HE_THONG = '';
const KHOA_VAPID = 'vapid_khoa';
const GIU_TOI_DA = 200;
const DS_TOI_DA = 30;

// Các loại thông báo người dùng bật tắt được. 'thu' (nút Gửi thử) luôn gửi.
export const LOAI_THONG_BAO = {
  viec_moi: 'Việc mới AI tách từ Hộp tin (Zalo, Gmail, họp)',
  doi_han: 'Việc đổi hạn theo tin mới',
  gio_hen: 'Việc tới giờ hẹn',
  claude: 'Claude hỏi lại hoặc làm xong',
};

// Chỉ gửi tới dịch vụ đẩy của trình duyệt lớn, không để địa chỉ tùy ý biến máy chủ thành nơi gọi đi bất kỳ đâu.
const MIEN_DAY = ['.googleapis.com', '.mozilla.com', '.push.apple.com', '.notify.windows.com'];
export function laDiaChiDay(dia) {
  try {
    const u = new URL(dia);
    return u.protocol === 'https:' && !u.port && MIEN_DAY.some((m) => u.hostname.endsWith(m));
  } catch {
    return false;
  }
}

// ---------- base64url ----------
export const sangB64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function tuB64u(s) {
  const c = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(c + '='.repeat((4 - (c.length % 4)) % 4)), (x) => x.charCodeAt(0));
}
const noi = (...ds) => {
  const ra = new Uint8Array(ds.reduce((n, d) => n + d.length, 0));
  let vt = 0;
  for (const d of ds) { ra.set(d, vt); vt += d.length; }
  return ra;
};
const chu = (s) => new TextEncoder().encode(s);

async function hkdf(muoi, ikm, thongTin, soByte) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: muoi, info: thongTin }, k, soByte * 8));
}

// Mã hóa nội dung theo RFC 8291 (aes128gcm, một bản ghi). Trả thân yêu cầu gửi cho dịch vụ đẩy.
export async function maHoaDay(noiDung, p256dh, auth) {
  const khoaUa = tuB64u(p256dh);
  const biMat = tuB64u(auth);
  const cap = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const congKhai = new Uint8Array(await crypto.subtle.exportKey('raw', cap.publicKey));
  const ua = await crypto.subtle.importKey('raw', khoaUa, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const chung = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, cap.privateKey, 256));
  const ikm = await hkdf(biMat, chung, noi(chu('WebPush: info\0'), khoaUa, congKhai), 32);
  const muoi = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(muoi, ikm, chu('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(muoi, ikm, chu('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const banMa = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, noi(chu(noiDung), new Uint8Array([2]))));
  const dau = new Uint8Array(21);
  dau.set(muoi);
  new DataView(dau.buffer).setUint32(16, 4096);
  dau[20] = 65;
  return noi(dau, congKhai, banMa);
}

// Khóa VAPID của hệ thống: tạo một lần, lưu mã hóa trong cai_dat. sub là địa chỉ trang lúc tạo (dịch vụ đẩy cần biết liên hệ).
export async function layKhoaVapid(env, goc = '') {
  const doc = async () => {
    const gt = await env.CSDL.prepare('SELECT gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = ?2').bind(HE_THONG, KHOA_VAPID).first();
    if (!gt) return null;
    const s = gt.gia_tri;
    return s.startsWith('v1.') ? giaiMaEnv(s, env) : JSON.parse(s);
  };
  const co = await doc();
  if (co) return co;
  const cap = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const moi = {
    cong_khai: sangB64u(await crypto.subtle.exportKey('raw', cap.publicKey)),
    rieng: await crypto.subtle.exportKey('jwk', cap.privateKey),
    sub: /^https:\/\//.test(goc) ? goc : 'mailto:thong-bao@sonicrec.app',
  };
  const luu = env.KHOA_MA_HOA ? await maHoa(moi, env.KHOA_MA_HOA) : JSON.stringify(moi);
  // Hai yêu cầu cùng tạo một lúc thì giữ bản ghi trước, đọc lại để cả hai dùng chung.
  await env.CSDL.prepare('INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, ?2, ?3) ON CONFLICT (to_chuc_id, khoa) DO NOTHING').bind(HE_THONG, KHOA_VAPID, luu).run();
  return doc();
}

// JWT ES256 cho tiêu đề Authorization: vapid (RFC 8292). Hết hạn sau 12 giờ.
export async function kyVapid(khoa, aud, bayGio = Date.now()) {
  const k = await crypto.subtle.importKey('jwk', khoa.rieng, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const phan = [{ typ: 'JWT', alg: 'ES256' }, { aud, exp: Math.floor(bayGio / 1000) + 12 * 3600, sub: khoa.sub }].map((x) => sangB64u(chu(JSON.stringify(x)))).join('.');
  const chuKy = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, chu(phan));
  return `${phan}.${sangB64u(chuKy)}`;
}

// Gửi một thông báo tới một trình duyệt. Trả 'ok', 'het' (địa chỉ hết hạn, đã xóa) hoặc 'loi'.
export async function guiMotThietBi(env, dk, duLieu, khoa) {
  try {
    const than = await maHoaDay(JSON.stringify(duLieu), dk.p256dh, dk.auth);
    const jwt = await kyVapid(khoa, new URL(dk.endpoint).origin);
    const ra = await fetch(dk.endpoint, {
      method: 'POST',
      headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: `vapid t=${jwt}, k=${khoa.cong_khai}` },
      body: than,
      signal: AbortSignal.timeout(10000),
    });
    if (ra.status === 404 || ra.status === 410) {
      await env.CSDL.prepare('DELETE FROM dang_ky_day WHERE id = ?1').bind(dk.id).run();
      return 'het';
    }
    if (!ra.ok) throw new Error(`Dịch vụ đẩy trả ${ra.status}`);
    await env.CSDL.prepare('UPDATE dang_ky_day SET lan_cuoi = ?1, so_loi = 0 WHERE id = ?2').bind(new Date().toISOString(), dk.id).run();
    return 'ok';
  } catch (e) {
    console.error('Gửi thông báo đẩy lỗi', String(e.message || e).slice(0, 200));
    // Lỗi 5 lần liền thì bỏ địa chỉ này (trình duyệt đã gỡ hoặc khóa hỏng); người dùng bấm Bật lại là có dòng mới.
    await env.CSDL.prepare('UPDATE dang_ky_day SET so_loi = so_loi + 1 WHERE id = ?1').bind(dk.id).run().catch(() => {});
    await env.CSDL.prepare('DELETE FROM dang_ky_day WHERE id = ?1 AND so_loi >= 5').bind(dk.id).run().catch(() => {});
    return 'loi';
  }
}

export async function guiDayToChuc(env, tc, duLieu) {
  const { results } = await env.CSDL.prepare('SELECT id, endpoint, p256dh, auth FROM dang_ky_day WHERE to_chuc_id = ?1').bind(tc).all();
  if (!results.length) return { ok: 0, loi: 0 };
  const khoa = await layKhoaVapid(env);
  const kq = await Promise.all(results.map((dk) => guiMotThietBi(env, dk, duLieu, khoa)));
  return { ok: kq.filter((x) => x === 'ok').length, loi: kq.filter((x) => x === 'loi').length };
}

// ---------- Cài đặt ----------
export async function docCaiThongBao(env, tc) {
  const bat = Object.fromEntries(Object.keys(LOAI_THONG_BAO).map((k) => [k, true]));
  const gt = await env.CSDL.prepare("SELECT gia_tri FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'thong_bao_cai'").bind(tc).first();
  try {
    for (const [k, v] of Object.entries(JSON.parse(gt?.gia_tri || '{}').bat || {})) if (k in bat && typeof v === 'boolean') bat[k] = v;
  } catch { /* cài đặt hỏng thì dùng mặc định */ }
  return { bat };
}

// Tạo một thông báo: luôn ghi vào chuông (trừ loại đã tắt); đẩy lên trình duyệt khi không trong giờ yên lặng.
// tb: { loai, tieu_de, noi_dung?, duong_dan?, viec_id? }. Không bao giờ ném lỗi ra ngoài.
export async function taoThongBao(env, tc, tb, { bayGio = new Date().toISOString() } = {}) {
  try {
    if (tb.loai !== 'thu' && !(await docCaiThongBao(env, tc)).bat[tb.loai]) return null;
    const dong = await env.CSDL.prepare(
      `INSERT INTO thong_bao (to_chuc_id, loai, tieu_de, noi_dung, duong_dan, viec_id, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id`,
    ).bind(tc, tb.loai, cat(tb.tieu_de, 160), tb.noi_dung ? cat(tb.noi_dung, 400) : null, tb.duong_dan || null, tb.viec_id ?? null, bayGio).first();
    await env.CSDL.prepare(
      `DELETE FROM thong_bao WHERE to_chuc_id = ?1 AND id <= (SELECT id FROM thong_bao WHERE to_chuc_id = ?1 ORDER BY id DESC LIMIT 1 OFFSET ${GIU_TOI_DA})`,
    ).bind(tc).run();
    let day = null;
    const lg = await docLuong(env, tc);
    if (tb.loai === 'thu' || !dangYenLang(gioVN(bayGio), lg.nguong)) {
      day = await guiDayToChuc(env, tc, { id: dong.id, loai: tb.loai, tieu_de: cat(tb.tieu_de, 160), noi_dung: tb.noi_dung ? cat(tb.noi_dung, 300) : '', duong_dan: tb.duong_dan || '#tong-quan', viec_id: tb.viec_id ?? null });
    }
    return { id: dong.id, day };
  } catch (e) {
    console.error('Tạo thông báo lỗi', e);
    return null;
  }
}

// Dòng thứ hai của thông báo việc: hạn và nơi gửi.
export function moTaViec(v, nguon) {
  const han = v.han_ngay ? `Hạn ${v.han_ngay.slice(8, 10)}/${v.han_ngay.slice(5, 7)}${v.gio_hen ? ` ${v.gio_hen}` : ''}` : 'Chưa có hạn';
  const TEN = { zalo: 'Zalo', email: 'Gmail', gmail: 'Gmail', hop: 'Họp', api: 'Dịch vụ ngoài' };
  const tu = nguon ? [TEN[nguon.nguon] || nguon.nguon, nguon.nhom || nguon.nguoi_gui].filter(Boolean).join(', ') : '';
  return tu ? `${han}. Từ ${tu}` : han;
}

// ---------- API cho trang ----------
const NHAN_THIET_BI = (ua = '') => /iPhone|iPad/.test(ua) ? 'iPhone, iPad' : /Android/.test(ua) ? 'Điện thoại Android' : /Mac OS X/.test(ua) ? 'Máy Mac' : /Windows/.test(ua) ? 'Máy Windows' : 'Trình duyệt';

export async function xuLyApiThongBao(yeuCau, env, phien, url) {
  const p = url.pathname;
  const m = yeuCau.method;
  const tc = phien.to_chuc.id;

  if (p === '/api/thong-bao' && m === 'GET') {
    const sau = Number(url.searchParams.get('sau')) || 0;
    const dem = await env.CSDL.prepare('SELECT COUNT(*) AS n, MAX(id) AS moi FROM thong_bao WHERE to_chuc_id = ?1 AND da_doc_luc IS NULL').bind(tc).first();
    const moiNhat = await env.CSDL.prepare('SELECT MAX(id) AS id FROM thong_bao WHERE to_chuc_id = ?1').bind(tc).first();
    // Trang hỏi định kỳ kèm ?sau=<id mới nhất đã có>: không có gì mới thì không gửi lại danh sách.
    if (sau && (moiNhat?.id || 0) <= sau) return json({ chua_doc: dem?.n || 0, moi_nhat: moiNhat?.id || 0, ds: null });
    const { results } = await env.CSDL.prepare(
      'SELECT id, loai, tieu_de, noi_dung, duong_dan, viec_id, tao_luc, da_doc_luc FROM thong_bao WHERE to_chuc_id = ?1 ORDER BY id DESC LIMIT ?2',
    ).bind(tc, DS_TOI_DA).all();
    return json({ chua_doc: dem?.n || 0, moi_nhat: moiNhat?.id || 0, ds: results });
  }
  if (p === '/api/thong-bao/doc' && m === 'POST') {
    const than = await yeuCau.json().catch(() => ({}));
    const bayGio = new Date().toISOString();
    if (than.tat_ca) await env.CSDL.prepare('UPDATE thong_bao SET da_doc_luc = ?2 WHERE to_chuc_id = ?1 AND da_doc_luc IS NULL').bind(tc, bayGio).run();
    else if (Number.isInteger(than.id)) await env.CSDL.prepare('UPDATE thong_bao SET da_doc_luc = ?3 WHERE to_chuc_id = ?1 AND id = ?2 AND da_doc_luc IS NULL').bind(tc, than.id, bayGio).run();
    else return loi(400, 'Thiếu thông báo cần đánh dấu.');
    const dem = await env.CSDL.prepare('SELECT COUNT(*) AS n FROM thong_bao WHERE to_chuc_id = ?1 AND da_doc_luc IS NULL').bind(tc).first();
    return json({ chua_doc: dem?.n || 0 });
  }
  if (p === '/api/thong-bao/cai' && m === 'GET') {
    const khoa = await layKhoaVapid(env, url.origin);
    const { results } = await env.CSDL.prepare('SELECT endpoint, thiet_bi, lan_cuoi, tao_luc FROM dang_ky_day WHERE to_chuc_id = ?1 ORDER BY id').bind(tc).all();
    return json({ ...(await docCaiThongBao(env, tc)), loai: LOAI_THONG_BAO, khoa_cong_khai: khoa.cong_khai, thiet_bi: results });
  }
  if (p === '/api/thong-bao/cai' && m === 'PUT') {
    const than = await yeuCau.json().catch(() => ({}));
    const bat = {};
    for (const [k, v] of Object.entries(than?.bat || {})) {
      if (!(k in LOAI_THONG_BAO) || typeof v !== 'boolean') return loi(400, `Không có loại thông báo "${k}".`);
      bat[k] = v;
    }
    const cu = await docCaiThongBao(env, tc);
    const moi = { bat: { ...cu.bat, ...bat } };
    await env.CSDL.prepare(
      `INSERT INTO cai_dat (to_chuc_id, khoa, gia_tri) VALUES (?1, 'thong_bao_cai', ?2) ON CONFLICT (to_chuc_id, khoa) DO UPDATE SET gia_tri = excluded.gia_tri`,
    ).bind(tc, JSON.stringify(moi)).run();
    return json(moi);
  }
  if (p === '/api/thong-bao/dang-ky' && m === 'POST') {
    const than = await yeuCau.json().catch(() => ({}));
    const dia = String(than?.endpoint || '');
    const p256dh = String(than?.keys?.p256dh || '');
    const auth = String(than?.keys?.auth || '');
    if (!laDiaChiDay(dia) || dia.length > 1000) return loi(400, 'Địa chỉ nhận thông báo của trình duyệt không hợp lệ.');
    if (!/^[\w-]{80,100}$/.test(p256dh) || !/^[\w-]{16,32}$/.test(auth)) return loi(400, 'Khóa thông báo của trình duyệt không hợp lệ.');
    // Máy này đã đăng ký cho tổ chức khác: chỉ chuyển sang tổ chức này nếu người gọi cũng thuộc tổ chức kia (đổi tổ chức trên cùng một máy).
    const cu = await env.CSDL.prepare('SELECT to_chuc_id FROM dang_ky_day WHERE endpoint = ?1').bind(dia).first();
    if (cu && cu.to_chuc_id !== tc && !(phien.cac_to_chuc || []).some((x) => x.id === cu.to_chuc_id)) return loi(409, 'Địa chỉ nhận thông báo này đang thuộc tổ chức khác.');
    await env.CSDL.prepare(
      `INSERT INTO dang_ky_day (to_chuc_id, endpoint, p256dh, auth, thiet_bi, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (endpoint) DO UPDATE SET to_chuc_id = excluded.to_chuc_id, p256dh = excluded.p256dh, auth = excluded.auth, thiet_bi = excluded.thiet_bi, so_loi = 0`,
    ).bind(tc, dia, p256dh, auth, NHAN_THIET_BI(yeuCau.headers.get('user-agent') || ''), new Date().toISOString()).run();
    return json({ ok: true });
  }
  if (p === '/api/thong-bao/dang-ky' && m === 'DELETE') {
    const than = await yeuCau.json().catch(() => ({}));
    await env.CSDL.prepare('DELETE FROM dang_ky_day WHERE to_chuc_id = ?1 AND endpoint = ?2').bind(tc, String(than?.endpoint || '')).run();
    return json({ ok: true });
  }
  if (p === '/api/thong-bao/thu' && m === 'POST') {
    const kq = await taoThongBao(env, tc, { loai: 'thu', tieu_de: 'Thông báo thử của Sonicplan', noi_dung: 'Thấy dòng này là thông báo đã chạy. Việc mới sẽ hiện như thế này.', duong_dan: '#viec' });
    if (!kq) return loi(500, 'Không tạo được thông báo thử.');
    return json({ ok: true, day: kq.day });
  }
  return loi(404, 'Không có mục này.');
}
