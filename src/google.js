// Nối tài khoản Google bằng đăng nhập (OAuth): đọc thư Gmail vào hộp tin, ghi việc sang Google Tasks
// và mục có giờ sang Google Lịch. Client ID, Secret và khóa làm mới được mã hóa theo từng tổ chức.

import { chuTuHtml } from './nhan-thu.js';
import { goiNgoai } from './goi-ngoai.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu, luuTin } from './hop-tin.js';
import { docTichHop, luuTichHop, xoaTichHop } from './tich-hop.js';
import { congNgay } from './tien-ich.js';

export const QUYEN = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
];
// Drive chỉ xin quyền hẹp (drive.file): hệ thống chỉ thấy tệp và thư mục do chính nó tạo. Không bắt buộc.
export const QUYEN_DRIVE = 'https://www.googleapis.com/auth/drive.file';
const TEN_THU_MUC_GOC = 'Sonicplan';
const TEN_THU_MUC_NGUON = { zalo: 'Zalo', gmail: 'Gmail', tay: 'Tải lên' };
const TOI_DA_TEP_DRIVE = 8;
const DIA_CHI_DANG_NHAP = 'https://accounts.google.com/o/oauth2/v2/auth';
const DIA_CHI_MA = 'https://oauth2.googleapis.com/token';
const MUI_GIO = 'Asia/Ho_Chi_Minh';
const TOI_DA_THU = 20;

// ---- Phần thuần (kiểm thử được) ----

export function kiemClient({ client_id: id, client_secret: bi }) {
  const i = String(id || '').trim();
  const b = String(bi || '').trim();
  if (!/^[\w-]+(\.[\w-]+)*\.apps\.googleusercontent\.com$/.test(i)) throw new Error('Client ID phải kết thúc bằng .apps.googleusercontent.com, chép nguyên chuỗi Google đưa.');
  if (b.length < 10 || /\s/.test(b)) throw new Error('Client Secret không đúng, chép nguyên chuỗi Google đưa.');
  return { client_id: i, client_secret: b };
}

export function diaChiGoiLai(goc) {
  return `${goc}/api/google/goi-lai`;
}

export function taoDiaChiDangNhap(clientId, goiLai, state) {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: goiLai,
    response_type: 'code',
    scope: [...QUYEN, QUYEN_DRIVE].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${DIA_CHI_DANG_NHAP}?${q}`;
}

const giaiB64Url = (s) => {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

export function emailTuIdToken(idToken) {
  try {
    return JSON.parse(giaiB64Url(String(idToken).split('.')[1])).email || null;
  } catch {
    return null;
  }
}

// Thư Gmail (định dạng full) thành tin để lưu. Ưu tiên bản chữ thường, không có thì đổi HTML.
export function tinTuThuGmail(thu) {
  const dau = Object.fromEntries((thu.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
  let chu = '';
  let html = '';
  const duyet = (phan) => {
    if (!phan) return;
    if (phan.mimeType === 'text/plain' && phan.body?.data && !phan.filename) chu += `${giaiB64Url(phan.body.data)}\n`;
    else if (phan.mimeType === 'text/html' && phan.body?.data && !phan.filename) html += giaiB64Url(phan.body.data);
    for (const con of phan.parts || []) duyet(con);
  };
  duyet(thu.payload);
  const ngay = Number(thu.internalDate);
  return {
    nguon: 'gmail',
    ma_goc: String(dau['message-id'] || '').replace(/[<>]/g, '').trim() || `gmail:${thu.id}`,
    nguoi_gui: dau.from || '',
    tieu_de: dau.subject || '(không có tiêu đề)',
    noi_dung: (chu.trim() || chuTuHtml(html)).trim(),
    thoi_diem: ngay ? new Date(ngay).toISOString() : new Date().toISOString(),
  };
}

export function thanTask(viec) {
  const ghiChu = [viec.ghi_chu, viec.gio_hen ? `Giờ: ${viec.gio_hen}` : ''].filter(Boolean).join('\n');
  return { title: viec.tieu_de, ...(ghiChu ? { notes: ghiChu } : {}), ...(viec.han_ngay ? { due: `${viec.han_ngay}T00:00:00.000Z` } : {}) };
}

// Việc có giờ hẹn thành sự kiện 30 phút; việc chỉ có ngày thành sự kiện cả ngày.
export function thanSuKien(viec) {
  const goc = { summary: viec.tieu_de, ...(viec.ghi_chu ? { description: viec.ghi_chu } : {}) };
  if (viec.gio_hen) {
    const [g, p] = viec.gio_hen.split(':').map(Number);
    const tong = g * 60 + p + 30;
    const ngayKet = tong >= 1440 ? congNgay(viec.han_ngay, 1) : viec.han_ngay;
    const ket = `${String(Math.floor((tong % 1440) / 60)).padStart(2, '0')}:${String(tong % 60).padStart(2, '0')}`;
    return { ...goc, start: { dateTime: `${viec.han_ngay}T${viec.gio_hen}:00`, timeZone: MUI_GIO }, end: { dateTime: `${ngayKet}T${ket}:00`, timeZone: MUI_GIO } };
  }
  return { ...goc, start: { date: viec.han_ngay }, end: { date: congNgay(viec.han_ngay, 1) } };
}

// ---- Đăng nhập và mã truy cập ----

export async function doiMa(client, thamSo) {
  const ph = await goiNgoai(DIA_CHI_MA, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, ...thamSo }),
  });
  const kq = await ph.json().catch(() => ({}));
  if (!ph.ok) {
    const e = new Error(kq.error === 'invalid_grant' ? 'Google đã thu hồi quyền hoặc khóa hết hạn, đăng nhập lại.' : `Google từ chối (${ph.status}): ${kq.error_description || kq.error || ''}`.trim());
    e.maLoi = kq.error;
    throw e;
  }
  return kq;
}

// Đổi mã nhận về từ Google lấy khóa làm mới; trả về email đã nối.
export async function hoanTatDangNhap(env, tc, code, goiLai) {
  const client = await docTichHop(env, tc, 'google_client');
  if (!client) throw new Error('Chưa khai Client ID và Secret.');
  const kq = await doiMa(client, { grant_type: 'authorization_code', code, redirect_uri: goiLai });
  if (!kq.refresh_token) throw new Error('Google không trả khóa làm mới. Gỡ quyền của ứng dụng ở myaccount.google.com/permissions rồi đăng nhập lại.');
  const duQuyen = QUYEN.slice(2).every((q) => String(kq.scope || '').includes(q));
  if (!duQuyen) throw new Error('Chưa tick đủ quyền Gmail, Lịch và Tasks ở màn hình Google. Đăng nhập lại và tick hết.');
  const coDrive = String(kq.scope || '').includes(QUYEN_DRIVE);
  const email = emailTuIdToken(kq.id_token);
  await luuTichHop(env, tc, 'google', { refresh_token: kq.refresh_token, email, co_drive: coDrive, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
  await ghiCaiDat(env, tc, 'google_gmail_moc', String(Math.floor(Date.now() / 1000) - 86400));
  await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'google_drive_thu_muc'`).bind(tc).run();
  await ghiTinHieu(env, tc, 'google', 'Vừa nối xong');
  return email;
}

async function layTruyCap(env, tc) {
  const [client, tk] = [await docTichHop(env, tc, 'google_client'), await docTichHop(env, tc, 'google')];
  if (!client || !tk) return null;
  if (tk.truy_cap && tk.het_han > Date.now()) return tk.truy_cap;
  const kq = await doiMa(client, { grant_type: 'refresh_token', refresh_token: tk.refresh_token });
  await luuTichHop(env, tc, 'google', { ...tk, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
  return kq.access_token;
}

export async function goKetNoiGoogle(env, tc) {
  const tk = await docTichHop(env, tc, 'google');
  if (tk?.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tk.refresh_token)}`, { method: 'POST' }).catch(() => {});
  await xoaTichHop(env, tc, 'google');
  await env.CSDL.prepare('DELETE FROM tin_hieu WHERE to_chuc_id = ?1 AND nguon = ?2').bind(tc, 'google').run();
}

export async function goiGoogle(token, duongDan, { method = 'GET', body } = {}) {
  const ph = await goiNgoai(`https://${duongDan}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (ph.status === 204) return {};
  const kq = await ph.json().catch(() => ({}));
  if (!ph.ok) {
    const e = new Error(`${duongDan.split('/')[0].split('.')[0]} ${ph.status}: ${kq.error?.message || ''}`.trim());
    e.trangThai = ph.status;
    throw e;
  }
  return kq;
}

// ---- Gmail: thư mới vào hộp tin ----

async function dongBoGmail(env, tc, token) {
  const moc = Number(await docCaiDat(env, tc, 'google_gmail_moc')) || Math.floor(Date.now() / 1000) - 86400;
  const q = new URLSearchParams({ q: `in:inbox -from:me after:${moc}`, maxResults: String(TOI_DA_THU) });
  const ds = (await goiGoogle(token, `gmail.googleapis.com/gmail/v1/users/me/messages?${q}`)).messages || [];
  let them = 0;
  for (const { id } of ds.reverse()) {
    const thu = await goiGoogle(token, `gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`);
    const tin = tinTuThuGmail(thu);
    if (!tin.noi_dung) tin.noi_dung = thu.snippet || '';
    if (await luuTin(env, tc, tin)) them++;
  }
  // Lùi mốc 2 phút để không sót thư đến sát giờ; tin trùng mã đã được bỏ qua ở luuTin.
  await ghiCaiDat(env, tc, 'google_gmail_moc', String(Math.floor(Date.now() / 1000) - 120));
  return them;
}

// ---- Tasks và Lịch: việc của hệ thống sang Google, việc xong bên Tasks về lại ----

async function dongBoViec(env, tc, token) {
  const bayGio = new Date().toISOString();
  let dayLen = 0;
  let veLai = 0;

  const moi = (await env.CSDL.prepare(
    `SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND google_task_id IS NULL ORDER BY id LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of moi) {
    const t = await goiGoogle(token, 'tasks.googleapis.com/tasks/v1/lists/@default/tasks', { method: 'POST', body: thanTask(v) });
    await env.CSDL.prepare('UPDATE viec SET google_task_id = ?1 WHERE id = ?2 AND to_chuc_id = ?3').bind(t.id, v.id, tc).run();
    dayLen++;
  }

  const daXong = (await env.CSDL.prepare(
    `SELECT id, google_task_id FROM viec WHERE to_chuc_id = ?1 AND trang_thai IN ('xong','huy') AND google_task_id IS NOT NULL AND google_task_xong = 0 LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of daXong) {
    await goiGoogle(token, `tasks.googleapis.com/tasks/v1/lists/@default/tasks/${v.google_task_id}`, { method: 'PATCH', body: { status: 'completed' } }).catch((e) => { if (e.trangThai !== 404) throw e; });
    await env.CSDL.prepare('UPDATE viec SET google_task_xong = 1 WHERE id = ?1').bind(v.id).run();
  }

  // Việc bấm xong bên Google Tasks thì xong ở đây.
  const moc = await docCaiDat(env, tc, 'google_tasks_moc');
  const q = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100', ...(moc ? { updatedMin: moc } : {}) });
  const ds = (await goiGoogle(token, `tasks.googleapis.com/tasks/v1/lists/@default/tasks?${q}`)).items || [];
  for (const t of ds.filter((x) => x.status === 'completed')) {
    const kq = await env.CSDL.prepare(
      `UPDATE viec SET trang_thai = 'xong', xong_luc = ?1, cap_nhat_luc = ?1, google_task_xong = 1 WHERE to_chuc_id = ?2 AND google_task_id = ?3 AND trang_thai = 'mo'`,
    ).bind(bayGio, tc, t.id).run();
    veLai += kq.meta.changes || 0;
  }
  await ghiCaiDat(env, tc, 'google_tasks_moc', new Date(Date.now() - 5 * 60000).toISOString());

  // Lịch: việc còn mở có ngày hạn thành sự kiện; việc xong thì gỡ sự kiện.
  const canLich = (await env.CSDL.prepare(
    `SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay IS NOT NULL AND lich_event_id IS NULL ORDER BY han_ngay LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of canLich) {
    const s = await goiGoogle(token, 'www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', body: thanSuKien(v) });
    await env.CSDL.prepare('UPDATE viec SET lich_event_id = ?1 WHERE id = ?2 AND to_chuc_id = ?3').bind(s.id, v.id, tc).run();
  }
  const canGo = (await env.CSDL.prepare(
    `SELECT id, lich_event_id FROM viec WHERE to_chuc_id = ?1 AND trang_thai IN ('xong','huy') AND lich_event_id IS NOT NULL LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of canGo) {
    await goiGoogle(token, `www.googleapis.com/calendar/v3/calendars/primary/events/${v.lich_event_id}`, { method: 'DELETE' }).catch((e) => { if (e.trangThai !== 404 && e.trangThai !== 410) throw e; });
    await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1').bind(v.id).run();
  }
  return { dayLen, veLai, lich: canLich.length };
}

// ---- Drive: tệp đính kèm lưu thêm vào thư mục Sonicplan (R2 vẫn giữ bản gốc) ----

// Dựng thân multipart: phần JSON mô tả tệp rồi đến nội dung.
export function thanTaiLen(meta, noiDung, loai) {
  const ranh = `sp${crypto.randomUUID().replace(/-/g, '')}`;
  const ma = new TextEncoder();
  const dau = ma.encode(`--${ranh}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${ranh}\r\ncontent-type: ${loai || 'application/octet-stream'}\r\n\r\n`);
  const cuoi = ma.encode(`\r\n--${ranh}--`);
  const nd = new Uint8Array(noiDung);
  const thanBody = new Uint8Array(dau.length + nd.length + cuoi.length);
  thanBody.set(dau, 0);
  thanBody.set(nd, dau.length);
  thanBody.set(cuoi, dau.length + nd.length);
  return { ranh, thanBody };
}

export async function taoThuMuc(token, ten, cha) {
  const r = await goiGoogle(token, 'www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    body: { name: ten, mimeType: 'application/vnd.google-apps.folder', ...(cha ? { parents: [cha] } : {}) },
  });
  return r.id;
}

// Thư mục gốc Sonicplan và thư mục con theo nguồn; nhớ mã để lần sau khỏi tạo lại.
async function thuMucDrive(env, tc, token, nguon) {
  let nho = {};
  try { nho = JSON.parse((await docCaiDat(env, tc, 'google_drive_thu_muc')) || '{}'); } catch { nho = {}; }
  if (!nho.goc) nho.goc = await taoThuMuc(token, TEN_THU_MUC_GOC, null);
  const khoa = TEN_THU_MUC_NGUON[nguon] ? nguon : 'tay';
  if (!nho[khoa]) nho[khoa] = await taoThuMuc(token, TEN_THU_MUC_NGUON[khoa], nho.goc);
  await ghiCaiDat(env, tc, 'google_drive_thu_muc', JSON.stringify(nho));
  return nho[khoa];
}

async function dongBoDrive(env, tc, token) {
  const tk = await docTichHop(env, tc, 'google');
  if (!tk?.co_drive || !env.TEP) return 0;
  const ds = (await env.CSDL.prepare(
    `SELECT id, ten, loai, nguon, r2_khoa FROM tep WHERE to_chuc_id = ?1 AND drive_id IS NULL AND r2_khoa IS NOT NULL ORDER BY id LIMIT ?2`,
  ).bind(tc, TOI_DA_TEP_DRIVE).all()).results;
  let xong = 0;
  for (const t of ds) {
    const vat = await env.TEP.get(t.r2_khoa);
    if (!vat) {
      await env.CSDL.prepare(`UPDATE tep SET drive_id = '' WHERE id = ?1`).bind(t.id).run();
      continue;
    }
    const cha = await thuMucDrive(env, tc, token, t.nguon);
    const { ranh, thanBody } = thanTaiLen({ name: t.ten, parents: [cha] }, await vat.arrayBuffer(), t.loai);
    const ph = await goiNgoai('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${ranh}` },
      body: thanBody,
    }, { hetGioMs: 60000 });
    const kq = await ph.json().catch(() => ({}));
    if (!ph.ok) throw new Error(`drive ${ph.status}: ${kq.error?.message || ''}`.trim());
    await env.CSDL.prepare('UPDATE tep SET drive_id = ?1 WHERE id = ?2').bind(kq.id, t.id).run();
    xong++;
  }
  return xong;
}

// Chạy mỗi 5 phút cho một tổ chức đã nối Google. Lỗi một phần không chặn các phần còn lại.
export async function dongBoGoogle(env, tc, { thu = true, viec = true } = {}) {
  const token = await layTruyCap(env, tc);
  if (!token) return null;
  const kq = { thu: 0, day_len: 0, ve_lai: 0, lich: 0, tep: 0, loi: [] };
  const lam = async (ten, f) => {
    try { await f(); } catch (e) { kq.loi.push(`${ten}: ${String(e.message).slice(0, 100)}`); }
  };
  if (thu) await lam('Gmail', async () => { kq.thu = await dongBoGmail(env, tc, token); });
  if (viec) await lam('Tasks, Lịch', async () => { const r = await dongBoViec(env, tc, token); kq.day_len = r.dayLen; kq.ve_lai = r.veLai; kq.lich = r.lich; });
  if (viec) await lam('Drive', async () => { kq.tep = await dongBoDrive(env, tc, token); });
  await ghiTinHieu(env, tc, 'google', kq.loi.length ? `Lỗi ${kq.loi.join('; ')}` : `Đồng bộ xong: ${kq.thu} thư, ${kq.day_len} việc sang Google, ${kq.ve_lai} việc xong về${kq.tep ? `, ${kq.tep} tệp lên Drive` : ''}`);
  return kq;
}
