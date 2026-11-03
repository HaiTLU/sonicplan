// Nối tài khoản Google bằng đăng nhập (OAuth): đọc thư Gmail vào hộp tin, ghi việc sang Google Tasks
// và mục có giờ sang Google Lịch. Client ID, Secret và khóa làm mới được mã hóa theo từng tổ chức.

import { chuTuHtml } from './nhan-thu.js';
import { goiNgoai } from './goi-ngoai.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu, luuTep, luuTin, TEP_TOI_DA } from './hop-tin.js';
import { docTichHop, luuTichHop, xoaTichHop } from './tich-hop.js';
import { BUOI, congNgay, khungGio, ngayCoThat, ngayVN } from './tien-ich.js';
import { chuanCauHinh, dauVet, ganNhan } from './google-nhan.js';
import { ghiSuKien } from './du-an.js';

export const QUYEN = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
];
// Drive chỉ xin quyền hẹp (drive.file): hệ thống chỉ thấy tệp và thư mục do chính nó tạo. Không bắt buộc.
export const QUYEN_DRIVE = 'https://www.googleapis.com/auth/drive.file';
// Soạn nháp thư (Đợt 4 kế hoạch Claude tự làm việc). Không bắt buộc. Google gộp cả quyền gửi vào gmail.compose, nhưng Sonicplan chỉ gọi drafts.create:
// PM dặn 16/10/2026 không được tự gửi thư, có test quét mã không có đường gửi.
export const QUYEN_NHAP = 'https://www.googleapis.com/auth/gmail.compose';
const TEN_THU_MUC_GOC = 'Sonicplan';
const TEN_THU_MUC_NGUON = { zalo: 'Zalo', gmail: 'Gmail', tay: 'Tải lên' };
const TOI_DA_TEP_DRIVE = 8;
const DIA_CHI_DANG_NHAP = 'https://accounts.google.com/o/oauth2/v2/auth';
const DIA_CHI_MA = 'https://oauth2.googleapis.com/token';
const MUI_GIO = 'Asia/Ho_Chi_Minh';
const TOI_DA_THU = 20;
const TOI_DA_TEP_THU = 5;

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
    scope: [...QUYEN, QUYEN_DRIVE, QUYEN_NHAP].join(' '),
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

// Tệp đính kèm của thư Gmail: phần có tên tệp và mã tệp. Bỏ âm thanh, video, lời mời lịch và ảnh nhúng nhỏ (logo, chữ ký).
export function tepTuThuGmail(thu) {
  const ra = [];
  const duyet = (phan) => {
    if (!phan) return;
    if (phan.filename && phan.body?.attachmentId) {
      const loai = phan.mimeType || 'application/octet-stream';
      const kichThuoc = Number(phan.body.size) || 0;
      const nhung = (phan.headers || []).some((h) => h.name?.toLowerCase() === 'content-id');
      const bo = !kichThuoc || kichThuoc > TEP_TOI_DA || /^(audio|video)\//.test(loai) || loai === 'text/calendar' || /\.ics$/i.test(phan.filename)
        || (/^image\//.test(loai) && nhung && kichThuoc < 100 * 1024);
      if (!bo) ra.push({ ten: phan.filename, loai, kich_thuoc: kichThuoc, ma_tep: phan.body.attachmentId });
    }
    for (const con of phan.parts || []) duyet(con);
  };
  duyet(thu.payload);
  return ra;
}

const giaiB64UrlNhiPhan = (s) => {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export function thanTask(viec) {
  const buoi = !viec.gio_hen && viec.buoi === 'sang' ? 'Buổi: sáng' : !viec.gio_hen && viec.buoi === 'chieu' ? 'Buổi: chiều' : '';
  const ghiChu = [viec.ghi_chu, viec.gio_hen ? `Giờ: ${viec.gio_hen}` : buoi].filter(Boolean).join('\n');
  return { title: viec.tieu_de, ...(ghiChu ? { notes: ghiChu } : {}), ...(viec.han_ngay ? { due: `${viec.han_ngay}T00:00:00.000Z` } : {}) };
}

// Việc có giờ hẹn thành sự kiện 30 phút; chưa có giờ nhưng có buổi thì sáng 8-12h, chiều 13-17h;
// chỉ có ngày (hoặc "cả ngày") thành sự kiện cả ngày.
export function thanSuKien(viec) {
  // mau: màu hiệu lực (màu riêng của việc, không có thì màu dự án), trùng colorId của Lịch.
  // sonicplan_viec_id: nhận ra sự kiện của mình khi mất liên kết lich_event_id, để kéo Lịch về không tạo việc trùng.
  const goc = { summary: viec.tieu_de, ...(viec.ghi_chu ? { description: viec.ghi_chu } : {}), ...(viec.mau ? { colorId: String(viec.mau) } : {}), ...(viec.id ? { extendedProperties: { private: { sonicplan_viec_id: String(viec.id) } } } : {}) };
  const khung = khungGio(viec);
  if (khung) {
    const ngayKet = khung.sang_ngay_sau ? congNgay(viec.han_ngay, 1) : viec.han_ngay;
    return { ...goc, start: { dateTime: `${viec.han_ngay}T${khung.bat_dau}:00`, timeZone: MUI_GIO }, end: { dateTime: `${ngayKet}T${khung.ket_thuc}:00`, timeZone: MUI_GIO } };
  }
  return { ...goc, start: { date: viec.han_ngay }, end: { date: congNgay(viec.han_ngay, 1) } };
}

// Ngược của thanSuKien: từ sự kiện Lịch ra ngày, giờ, buổi, tiêu đề, ghi chú của việc. `viec` là việc đang nối với sự kiện
// (rỗng nếu sự kiện mới). Nhãn do ganNhan thêm ([Hôm nay], [Xong]...) được bỏ đi để không lẫn vào tên việc.
// Trả về null nếu sự kiện không có ngày bắt đầu; ngược lại { han_ngay, gio_hen, buoi, tieu_de, ghi_chu, doi }.
const LECH_VN_MS = 7 * 3600000;
const gioVNCua = (thoiDiem) => new Date(new Date(thoiDiem).getTime() + LECH_VN_MS).toISOString().slice(11, 16);
const NHAN_DAU = /^(\s*\[[^\]\n]*\])+\s*/;

export function viecTuSuKien(sk, viec = {}, ch = chuanCauHinh(null), homNay = ngayVN()) {
  const bd = sk?.start || {};
  let hanNgay;
  let gioHen = null;
  let buoi = null;
  if (bd.dateTime) {
    hanNgay = ngayVN(bd.dateTime);
    const bat = gioVNCua(bd.dateTime);
    const ket = sk.end?.dateTime && ngayVN(sk.end.dateTime) === hanNgay ? gioVNCua(sk.end.dateTime) : null;
    const khung = Object.entries(BUOI).find(([, [b, k]]) => b === bat && k === ket);
    if (khung) buoi = khung[0]; else gioHen = bat;
  } else if (bd.date) {
    hanNgay = bd.date;
    if (viec.buoi === 'ca_ngay') buoi = 'ca_ngay';
  } else return null;

  const g = ganNhan({ trang_thai: 'mo', ...viec }, ch, homNay);
  let tieuDe = viec.tieu_de ?? '';
  let ghiChu = viec.ghi_chu ?? null;
  const ten = String(sk.summary || '').trim();
  if (ten && ten !== g.tieu_de) tieuDe = g.nhan && ch.cho === 'tieu_de' ? ten.replace(NHAN_DAU, '').trim() || tieuDe : ten;
  // Lịch đổi mô tả sang HTML khi sửa trên giao diện: đưa về chữ thường để so với ghi chú.
  const mo = (/<[a-z][\s\S]*>/i.test(sk.description || '') ? chuTuHtml(sk.description) : String(sk.description || '')).trim();
  if (mo !== String(g.ghi_chu || '').trim()) ghiChu = (g.nhan && ch.cho === 'ghi_chu' ? mo.replace(NHAN_DAU, '').trim() : mo) || null;
  const doi = hanNgay !== (viec.han_ngay ?? null) || gioHen !== (viec.gio_hen ?? null) || buoi !== (viec.buoi ?? null)
    || tieuDe !== (viec.tieu_de ?? '') || (ghiChu || null) !== (viec.ghi_chu || null);
  return { han_ngay: hanNgay, gio_hen: gioHen, buoi, tieu_de: tieuDe, ghi_chu: ghiChu, doi };
}

// PATCH gộp từng trường vào sự kiện cũ: sự kiện cả ngày đổi sang có giờ (hoặc ngược lại) mà không xóa
// trường kia thì Lịch trả 400 "Invalid start time". Gửi null để xóa trường không còn dùng.
export function thanSuaSuKien(viec) {
  const sk = thanSuKien(viec);
  const doiMoc = (m) => (m.dateTime ? { date: null, ...m } : { dateTime: null, timeZone: null, ...m });
  return { colorId: null, ...sk, start: doiMoc(sk.start), end: doiMoc(sk.end) };
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
    const e = new Error(
      kq.error === 'invalid_grant' ? 'Google đã thu hồi quyền hoặc khóa hết hạn, đăng nhập lại.'
        : (kq.error === 'invalid_client' || /client secret/i.test(kq.error_description || '')) ? 'Google không nhận Client Secret đang lưu (đã đổi hoặc nhập sai). Vào Cài đặt, Kết nối, thẻ Google, bấm "Nhập lại khóa Google" rồi dán Client Secret mới.'
          : `Google từ chối (${ph.status}): ${kq.error_description || kq.error || ''}`.trim(),
    );
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
  const coNhap = String(kq.scope || '').includes(QUYEN_NHAP);
  const email = emailTuIdToken(kq.id_token);
  await luuTichHop(env, tc, 'google', { refresh_token: kq.refresh_token, email, co_drive: coDrive, co_nhap: coNhap, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
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

// ---- Nháp thư Gmail (không bao giờ gửi) ----

const RE_EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
const bytesB64 = (u8) => btoa(String.fromCharCode(...u8));
const chuoiB64 = (s) => bytesB64(new TextEncoder().encode(s));
const b64url = (s) => chuoiB64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const mot = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

// Tiêu đề không dấu để nguyên; có dấu thì mã hóa RFC 2047, cắt từng nhóm 30 ký tự để không vượt 75 ký tự mỗi từ mã hóa.
export function maHoaTieuDe(s) {
  const t = mot(s);
  if (/^[\x20-\x7e]*$/.test(t)) return t;
  const ky = [...t];
  const nhom = [];
  for (let i = 0; i < ky.length; i += 30) nhom.push(`=?UTF-8?B?${chuoiB64(ky.slice(i, i + 30).join(''))}?=`);
  return nhom.join(' ');
}

// Làm sạch và kiểm bản nháp do Claude ghi ở ket-qua/nhap-email.json. Trả { nhap } hoặc { loi }.
export function chuanNhapEmail(x) {
  if (!x || typeof x !== 'object') return { loi: 'Tệp nhap-email.json không phải JSON đối tượng.' };
  const ds = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []).map(mot).filter(Boolean);
  const den = ds(x.den);
  const cc = ds(x.cc);
  const sai = [...den, ...cc].find((e) => !RE_EMAIL.test(e));
  if (sai) return { loi: `Địa chỉ không hợp lệ: ${sai.slice(0, 60)}` };
  if (den.length + cc.length > 20) return { loi: 'Quá 20 người nhận.' };
  const chuDe = mot(x.chu_de).slice(0, 200);
  const noiDung = String(x.noi_dung ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 20000);
  if (!chuDe) return { loi: 'Thiếu chủ đề.' };
  if (!noiDung) return { loi: 'Thiếu nội dung.' };
  return { nhap: { den, cc, chu_de: chuDe, noi_dung: noiDung } };
}

// Thư dạng RFC 822 từ bản nháp. goc: { threadId, messageId, references } nếu trả lời một thư.
export function dungThuNhap(nhap, goc = {}) {
  const dau = [
    ...(nhap.den.length ? [`To: ${nhap.den.join(', ')}`] : []),
    ...(nhap.cc.length ? [`Cc: ${nhap.cc.join(', ')}`] : []),
    `Subject: ${maHoaTieuDe(nhap.chu_de)}`,
    ...(goc.messageId ? [`In-Reply-To: ${mot(goc.messageId)}`, `References: ${mot([goc.references, goc.messageId].filter(Boolean).join(' '))}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ];
  const than = chuoiB64(nhap.noi_dung).replace(/(.{76})/g, '$1\r\n');
  return `${dau.join('\r\n')}\r\n\r\n${than}`;
}

// Tạo MỘT bản nháp trong Gmail của tổ chức (Thư nháp). Có tin gốc là thư Gmail thì nháp nằm trong đúng luồng thư và, nếu Claude không ghi người nhận, gửi cho người đã viết thư gốc.
// Không gọi bất kỳ API gửi nào. Trả { ok, id } hoặc { ok: false, ly_do }.
export async function taoNhapGmail(env, tc, nhapTho, { tinGoc = null } = {}) {
  const k = chuanNhapEmail(nhapTho);
  if (k.loi) return { ok: false, ly_do: k.loi };
  const tk = await docTichHop(env, tc, 'google');
  if (!tk) return { ok: false, ly_do: 'Chưa nối Google.' };
  if (!tk.co_nhap) return { ok: false, ly_do: 'Chưa có quyền soạn nháp thư. Vào Kết nối, đăng nhập lại Google và tick quyền soạn thư (Sonicplan chỉ tạo nháp, không gửi).' };
  const token = await layTruyCap(env, tc);
  if (!token) return { ok: false, ly_do: 'Chưa nối Google.' };
  const nhap = k.nhap;
  const goc = {};
  if (tinGoc?.nguon === 'gmail' && tinGoc.ma_goc && !String(tinGoc.ma_goc).startsWith('gmail:')) {
    try {
      const ds = (await goiGoogle(token, `gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: `rfc822msgid:${tinGoc.ma_goc}`, maxResults: '1' })}`)).messages || [];
      if (ds[0]) {
        const m = await goiGoogle(token, `gmail.googleapis.com/gmail/v1/users/me/messages/${ds[0].id}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Reply-To&metadataHeaders=From`);
        const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
        goc.threadId = m.threadId;
        goc.messageId = h['message-id'];
        goc.references = h.references;
        if (!nhap.den.length) {
          const dich = String(h['reply-to'] || h.from || '').match(/[^\s<>",;]+@[^\s<>",;]+/)?.[0];
          if (dich && RE_EMAIL.test(dich)) nhap.den = [dich];
        }
      }
    } catch (e) { /* không lấy được luồng thư: vẫn tạo nháp riêng */ }
  }
  if (!nhap.den.length) return { ok: false, ly_do: 'Không có người nhận (Claude chưa ghi và không tìm được người gửi thư gốc).' };
  try {
    const kq = await goiGoogle(token, 'gmail.googleapis.com/gmail/v1/users/me/drafts', { method: 'POST', body: { message: { raw: b64url(dungThuNhap(nhap, goc)), ...(goc.threadId ? { threadId: goc.threadId } : {}) } } });
    return { ok: true, id: kq.id, trong_luong_thu: Boolean(goc.threadId) };
  } catch (e) {
    return { ok: false, ly_do: /403|insufficient/i.test(e.message) ? 'Google từ chối: cần đăng nhập lại và cấp quyền soạn thư.' : `Gmail báo lỗi: ${String(e.message).slice(0, 120)}` };
  }
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
    const tinId = await luuTin(env, tc, tin);
    if (!tinId) continue;
    them++;
    if (tin.an) continue; // nguồn đã chặn: không lưu tệp
    // Tệp đính kèm lỗi thì bỏ qua tệp đó, thư vẫn được lưu.
    const ngay = ngayVN(new Date(tin.thoi_diem)).slice(2).replace(/-/g, '');
    for (const t of tepTuThuGmail(thu).slice(0, TOI_DA_TEP_THU)) {
      try {
        const kq = await goiGoogle(token, `gmail.googleapis.com/gmail/v1/users/me/messages/${id}/attachments/${t.ma_tep}`);
        if (!kq.data) continue;
        const du = giaiB64UrlNhiPhan(kq.data);
        await luuTep(env, tc, { ten: `${ngay}_Gmail_${t.ten}`, loai: t.loai, kich_thuoc: du.byteLength, du_lieu: du, nguon: 'gmail', nguoi_gui: tin.nguoi_gui, nhom: tin.tieu_de, tin_nhan_id: tinId });
      } catch (e) {
        console.error('Tệp đính kèm Gmail lỗi', t.ten, e.message);
      }
    }
  }
  // Lùi mốc 2 phút để không sót thư đến sát giờ; tin trùng mã đã được bỏ qua ở luuTin.
  await ghiCaiDat(env, tc, 'google_gmail_moc', String(Math.floor(Date.now() / 1000) - 120));
  return them;
}

// ---- Tasks và Lịch: việc của hệ thống sang Google, việc xong bên Tasks về lại ----

const COT_VIEC_GG = `v.id, v.tieu_de, v.ghi_chu, v.han_ngay, v.gio_hen, v.buoi, v.trang_thai, v.google_task_id, v.lich_event_id, v.nhan_gg, v.nguon,
  t.nguon AS tin_nguon, t.nguoi_gui AS tin_nguoi_gui, t.nhom AS tin_nhom, d.ten AS du_an_ten, COALESCE(v.mau, d.mau) AS mau
  FROM viec v LEFT JOIN tin_nhan t ON t.id = v.tin_nhan_id LEFT JOIN du_an d ON d.id = v.du_an_id`;

export async function docCauHinhNhan(env, tc) {
  return chuanCauHinh(await docCaiDat(env, tc, 'google_nhan'));
}

// Việc đi tới đâu trên Google. Ba chế độ cũ giữ nguyên (trả lại đúng chế độ); 'tu-chia' mỗi việc chỉ vào một nơi:
// có giờ hẹn hoặc buổi (và ngày có thật để đặt lịch) thì chỉ sự kiện Lịch, còn lại chỉ Google Task.
export function noiDong(viec, cheDo) {
  if (cheDo !== 'tu-chia') return cheDo;
  if (viec.nguon === 'lich') return 'lich'; // việc sinh từ sự kiện Lịch của PM: không xóa sự kiện đó, cũng không nhân đôi sang Tasks
  return khungGio(viec) && ngayCoThat(viec.han_ngay) ? 'lich' : 'tasks';
}

export async function dongBoViec(env, tc, token) {
  const bayGio = new Date().toISOString();
  const ch = await docCauHinhNhan(env, tc);
  const hn = ngayVN();
  const chThuan = chuanCauHinh({ che_do: ch.che_do });
  const gan = (v) => ganNhan(v, ch, hn);
  const bay = new Date(Date.now() - 7 * 86400000).toISOString();
  const gangXong = `(v.trang_thai = 'mo' OR (v.trang_thai = 'xong' AND v.xong_luc >= '${bay}'))`;
  let dayLen = 0;
  let veLai = 0;
  const loiViec = []; // lỗi theo từng việc: một việc hỏng không được chặn các việc sau
  const thu = async (v, f) => { try { await f(); } catch (e) { loiViec.push(`#${v.id} (${v.han_ngay || '-'} ${v.gio_hen || v.buoi || ''}): ${e.message}`.replace(/ +\)/, ')')); } };

  // Việc mới sang Tasks (trừ khi chỉ dùng Lịch).
  const moi = (await env.CSDL.prepare(
    `SELECT ${COT_VIEC_GG} WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'mo' AND v.google_task_id IS NULL ORDER BY v.id LIMIT 200`,
  ).bind(tc).all()).results.filter((v) => noiDong(v, ch.che_do) !== 'lich').slice(0, 25);
  for (const v of moi) {
    const g = gan(v);
    const t = await goiGoogle(token, 'tasks.googleapis.com/tasks/v1/lists/@default/tasks', { method: 'POST', body: thanTask({ ...v, tieu_de: g.tieu_de, ghi_chu: g.ghi_chu }) });
    await env.CSDL.prepare('UPDATE viec SET google_task_id = ?1, nhan_gg = ?2 WHERE id = ?3 AND to_chuc_id = ?4').bind(t.id, dauVet(g), v.id, tc).run();
    dayLen++;
  }

  const daXong = (await env.CSDL.prepare(
    `SELECT id, google_task_id FROM viec WHERE to_chuc_id = ?1 AND trang_thai IN ('xong','huy') AND google_task_id IS NOT NULL AND google_task_xong = 0 LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of daXong) {
    await goiGoogle(token, `tasks.googleapis.com/tasks/v1/lists/@default/tasks/${v.google_task_id}`, { method: 'PATCH', body: { status: 'completed' } }).catch((e) => { if (e.trangThai !== 404) throw e; });
    await env.CSDL.prepare('UPDATE viec SET google_task_xong = 1 WHERE id = ?1').bind(v.id).run();
  }

  // Việc bấm xong bên Google Tasks thì xong ở đây. Chỉ đọc trạng thái, không đọc tiêu đề nên nhãn không lẫn vào tên việc.
  const moc = await docCaiDat(env, tc, 'google_tasks_moc');
  const q = new URLSearchParams({ showCompleted: 'true', showHidden: 'true', maxResults: '100', ...(moc ? { updatedMin: moc } : {}) });
  const ds = (await goiGoogle(token, `tasks.googleapis.com/tasks/v1/lists/@default/tasks?${q}`)).items || [];
  for (const t of ds.filter((x) => x.status === 'completed')) {
    const kq = await env.CSDL.prepare(
      `UPDATE viec SET trang_thai = 'xong', xong_luc = ?1, cap_nhat_luc = ?1, google_task_xong = 1 WHERE to_chuc_id = ?2 AND google_task_id = ?3 AND trang_thai = 'mo'`,
    ).bind(bayGio, tc, t.id).run();
    veLai += kq.meta.changes || 0;
    if (kq.meta.changes) await env.CSDL.prepare(
      `INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) SELECT to_chuc_id, id, 'xong', tieu_de, ?1 FROM viec WHERE to_chuc_id = ?2 AND google_task_id = ?3`,
    ).bind(bayGio, tc, t.id).run().catch(() => {});
  }
  await ghiCaiDat(env, tc, 'google_tasks_moc', new Date(Date.now() - 5 * 60000).toISOString());

  // Nhãn đổi theo ngày (Hôm nay thành Quá hạn), theo trạng thái (Xong) hoặc do cấu hình: đánh dấu việc cần đẩy lại.
  const xet = (await env.CSDL.prepare(
    `SELECT ${COT_VIEC_GG} WHERE v.to_chuc_id = ?1 AND ${gangXong} AND (v.google_task_id IS NOT NULL OR v.lich_event_id IS NOT NULL) AND v.can_dong_bo = 0 ORDER BY v.id DESC LIMIT 300`,
  ).bind(tc).all()).results;
  const lech = xet.filter((v) => dauVet(gan(v)) !== (v.nhan_gg ?? dauVet(ganNhan(v, chThuan, hn))));
  for (const v of lech) await env.CSDL.prepare('UPDATE viec SET can_dong_bo = 1 WHERE id = ?1').bind(v.id).run();

  // Chế độ tu-chia: dọn bản thừa của cách đồng bộ cũ và chuyển nơi khi việc đổi qua lại giữa có giờ và không giờ.
  // Việc không giờ mà còn sự kiện Lịch thì xóa sự kiện (Lịch giữ 30 ngày trong Thùng rác). Việc đang mở có giờ mà còn Task thì xóa Task;
  // Task của việc đã xong không đụng tới. Task được tạo lại ở nơi đúng ngay trong lượt này (bước tạo mới ở trên và Lịch ở dưới).
  if (ch.che_do === 'tu-chia') {
    const thua = (await env.CSDL.prepare(
      `SELECT ${COT_VIEC_GG} WHERE v.to_chuc_id = ?1 AND (v.lich_event_id IS NOT NULL OR (v.trang_thai = 'mo' AND v.google_task_id IS NOT NULL)) ORDER BY v.id LIMIT 300`,
    ).bind(tc).all()).results;
    for (const v of thua) await thu(v, async () => {
      const noi = noiDong(v, ch.che_do);
      if (v.lich_event_id && noi === 'tasks') {
        await goiGoogle(token, `www.googleapis.com/calendar/v3/calendars/primary/events/${v.lich_event_id}`, { method: 'DELETE' }).catch((e) => { if (e.trangThai !== 404 && e.trangThai !== 410) throw e; });
        await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1').bind(v.id).run();
      }
      if (v.google_task_id && v.trang_thai === 'mo' && noi === 'lich') {
        await goiGoogle(token, `tasks.googleapis.com/tasks/v1/lists/@default/tasks/${v.google_task_id}`, { method: 'DELETE' }).catch((e) => { if (e.trangThai !== 404 && e.trangThai !== 410) throw e; });
        await env.CSDL.prepare('UPDATE viec SET google_task_id = NULL, google_task_xong = 0 WHERE id = ?1').bind(v.id).run();
      }
    });
  }

  // Việc vừa đổi hạn, giờ, tên, màu hoặc nhãn: cập nhật Task và sự kiện Lịch đã có.
  const daDoi = (await env.CSDL.prepare(
    `SELECT ${COT_VIEC_GG} WHERE v.to_chuc_id = ?1 AND ${gangXong} AND v.can_dong_bo = 1 LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of daDoi) await thu(v, async () => {
    const g = gan(v);
    const dung = { ...v, tieu_de: g.tieu_de, ghi_chu: g.ghi_chu, mau: g.mau };
    const noi = noiDong(v, ch.che_do);
    let capNhatLich = null; // `updated` của sự kiện sau khi ta ghi: lần kéo Lịch về sau bỏ qua thay đổi này
    if (v.google_task_id && noi !== 'lich') {
      // Bỏ hạn thì phải gửi due rỗng mới xóa được hạn bên Google.
      const thanT = { ...thanTask(dung), due: v.han_ngay ? `${v.han_ngay}T00:00:00.000Z` : null };
      await goiGoogle(token, `tasks.googleapis.com/tasks/v1/lists/@default/tasks/${v.google_task_id}`, { method: 'PATCH', body: { ...thanT, notes: thanT.notes ?? '' } }).catch((e) => { if (e.trangThai !== 404) throw e; });
    }
    if (v.lich_event_id) {
      const dich = `www.googleapis.com/calendar/v3/calendars/primary/events/${v.lich_event_id}`;
      if (!ngayCoThat(v.han_ngay) || noi === 'tasks') {
        await goiGoogle(token, dich, { method: 'DELETE' }).catch((e) => { if (e.trangThai !== 404 && e.trangThai !== 410) throw e; });
        await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1').bind(v.id).run();
      } else {
        const r = await goiGoogle(token, dich, { method: 'PATCH', body: thanSuaSuKien(dung) }).catch(async (e) => {
          if (e.trangThai !== 404 && e.trangThai !== 410) throw e;
          await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1').bind(v.id).run(); // sự kiện đã bị xóa: tạo lại ở bước dưới
          return null;
        });
        capNhatLich = r?.updated || null;
      }
    }
    await env.CSDL.prepare('UPDATE viec SET can_dong_bo = 0, nhan_gg = ?2, lich_cap_nhat = COALESCE(?3, lich_cap_nhat) WHERE id = ?1').bind(v.id, dauVet(g), capNhatLich).run();
  });

  // Lịch: việc còn mở có ngày hạn thành sự kiện (trừ khi chỉ dùng Tasks, hoặc tu-chia và việc không giờ).
  const canLich = (await env.CSDL.prepare(
    `SELECT ${COT_VIEC_GG} WHERE v.to_chuc_id = ?1 AND v.trang_thai = 'mo' AND v.han_ngay IS NOT NULL AND v.lich_event_id IS NULL ORDER BY v.han_ngay LIMIT 200`,
  ).bind(tc).all()).results.filter((v) => ngayCoThat(v.han_ngay) && noiDong(v, ch.che_do) !== 'tasks').slice(0, 25); // ngày không có thật thì Lịch trả 400 và kẹt cả lượt
  for (const v of canLich) await thu(v, async () => {
    const g = gan(v);
    const s = await goiGoogle(token, 'www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', body: thanSuKien({ ...v, tieu_de: g.tieu_de, ghi_chu: g.ghi_chu, mau: g.mau }) });
    await env.CSDL.prepare('UPDATE viec SET lich_event_id = ?1, nhan_gg = ?2, lich_cap_nhat = ?5 WHERE id = ?3 AND to_chuc_id = ?4').bind(s.id, dauVet(g), v.id, tc, s.updated || null).run();
  });
  // Việc xong hoặc hủy thì gỡ sự kiện, trừ khi bật nhãn Xong (khi đó sự kiện giữ lại, đổi màu xám).
  const giuXong = ch.bat.includes('xong') && ch.che_do !== 'tasks';
  const canGo = (await env.CSDL.prepare(
    `SELECT id, lich_event_id FROM viec WHERE to_chuc_id = ?1 AND ${giuXong ? "trang_thai = 'huy'" : "trang_thai IN ('xong','huy')"} AND lich_event_id IS NOT NULL LIMIT 25`,
  ).bind(tc).all()).results;
  for (const v of canGo) {
    await goiGoogle(token, `www.googleapis.com/calendar/v3/calendars/primary/events/${v.lich_event_id}`, { method: 'DELETE' }).catch((e) => { if (e.trangThai !== 404 && e.trangThai !== 410) throw e; });
    await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1').bind(v.id).run();
  }
  // Chỉ dùng Tasks: sự kiện Lịch còn sót thì gỡ để không hiện hai mục.
  if (ch.che_do === 'tasks') {
    const sot = (await env.CSDL.prepare(`SELECT id, lich_event_id FROM viec WHERE to_chuc_id = ?1 AND lich_event_id IS NOT NULL LIMIT 25`).bind(tc).all()).results;
    for (const v of sot) {
      await goiGoogle(token, `www.googleapis.com/calendar/v3/calendars/primary/events/${v.lich_event_id}`, { method: 'DELETE' }).catch((e) => { if (e.trangThai !== 404 && e.trangThai !== 410) throw e; });
      await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1').bind(v.id).run();
    }
  }
  if (loiViec.length) throw new Error(`${loiViec.length} việc lỗi: ${loiViec.slice(0, 2).join('; ')}`);
  return { dayLen, veLai, lich: canLich.length };
}

// ---- Lịch về: sự kiện sửa, xóa hoặc tạo mới trên Google Lịch thì việc đổi theo ----

const KHOA_LICH_SYNC = 'google_lich_sync';
const TRANG_LICH_TOI_DA = 30;

// Sự kiện mới trên Lịch có đáng thành việc không: bỏ sự kiện lặp, loại đặc biệt (sinh nhật, nghỉ phép...),
// lời mời đã từ chối, và sự kiện đã qua hơn một ngày.
export function suKienThanhViec(sk, homNay) {
  if (!sk || sk.status === 'cancelled' || (sk.eventType && sk.eventType !== 'default')) return false;
  if (sk.recurringEventId || sk.recurrence) return false;
  const toi = (sk.attendees || []).find((a) => a.self);
  if (toi?.responseStatus === 'declined') return false;
  if (!sk.organizer?.self && !toi) return false;
  const ngay = sk.start?.date || (sk.start?.dateTime ? ngayVN(sk.start.dateTime) : null);
  return Boolean(ngay) && ngay >= congNgay(homNay, -1) && String(sk.summary || '').trim() !== '';
}

// Kéo thay đổi từ calendars/primary bằng syncToken. Lần đầu chỉ ghi mốc (không biến cả lịch cũ thành việc);
// từ lần sau, sự kiện mới mới tạo việc. `goi` thay được khi kiểm thử.
export async function keoLichVe(env, tc, token, { goi = goiGoogle } = {}) {
  const ch = await docCauHinhNhan(env, tc);
  const hn = ngayVN();
  const moc = await docCaiDat(env, tc, KHOA_LICH_SYNC);
  const lanDau = !moc;
  const ds = [];
  let trang = null;
  let mocMoi = null;
  for (let i = 0; i < TRANG_LICH_TOI_DA && !mocMoi; i++) {
    const q = new URLSearchParams({ maxResults: '250', ...(moc ? { syncToken: moc } : {}), ...(trang ? { pageToken: trang } : {}) });
    let kq;
    try {
      kq = await goi(token, `www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
    } catch (e) {
      // 410: mốc hết hạn. Xóa mốc, lần sau kéo lại từ đầu.
      if (e.trangThai === 410) { await ghiCaiDat(env, tc, KHOA_LICH_SYNC, ''); return { ve: 0, tao: 0, huy: 0 }; }
      throw e;
    }
    ds.push(...(kq.items || []));
    trang = kq.nextPageToken || null;
    mocMoi = kq.nextSyncToken || null;
    if (!trang && !mocMoi) break;
  }
  if (!mocMoi) throw new Error('Lịch trả quá nhiều trang, chưa lấy được mốc đồng bộ');

  const r = { ve: 0, tao: 0, huy: 0 };
  const bay = new Date().toISOString();
  for (const sk of ds) {
    const v = await env.CSDL.prepare(
      `SELECT id, tieu_de, ghi_chu, han_ngay, gio_hen, buoi, trang_thai, cap_nhat_luc, can_dong_bo, lich_cap_nhat, nguon, mau
       FROM viec WHERE to_chuc_id = ?1 AND lich_event_id = ?2`,
    ).bind(tc, sk.id).first();

    if (!v) {
      // Sự kiện do Sonicplan tạo mà mất liên kết: nối lại, không tạo việc trùng.
      const maViec = Number(sk.extendedProperties?.private?.sonicplan_viec_id);
      if (maViec) {
        if (sk.status !== 'cancelled') await env.CSDL.prepare('UPDATE viec SET lich_event_id = ?1, lich_cap_nhat = ?2 WHERE id = ?3 AND to_chuc_id = ?4 AND lich_event_id IS NULL AND trang_thai = \'mo\'').bind(sk.id, sk.updated || null, maViec, tc).run();
        continue;
      }
      if (lanDau || !suKienThanhViec(sk, hn)) continue;
      const moi = viecTuSuKien(sk, {}, ch, hn);
      if (!moi) continue;
      const dong = await env.CSDL.prepare(
        `INSERT INTO viec (to_chuc_id, tieu_de, ghi_chu, han_ngay, gio_hen, buoi, trang_thai, tao_luc, cap_nhat_luc, nguon, lich_event_id, lich_cap_nhat, nhan_gg)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'mo', ?7, ?7, 'lich', ?8, ?9, ?10) RETURNING id`,
      ).bind(tc, moi.tieu_de, moi.ghi_chu, moi.han_ngay, moi.gio_hen, moi.buoi, bay, sk.id, sk.updated || bay,
        dauVet(ganNhan({ ...moi, trang_thai: 'mo', nguon: 'lich' }, ch, hn))).first();
      await ghiSuKien(env, tc, dong.id, 'tao', `Từ Google Lịch: ${moi.tieu_de}`).catch(() => {});
      r.tao++; r.ve++;
      continue;
    }

    // Thay đổi do chính Sonicplan đẩy lên: bỏ qua.
    if (sk.updated && v.lich_cap_nhat && sk.updated <= v.lich_cap_nhat) continue;

    if (sk.status === 'cancelled') {
      if (v.trang_thai === 'mo') {
        await env.CSDL.prepare("UPDATE viec SET trang_thai = 'huy', lich_event_id = NULL, can_dong_bo = 0, cap_nhat_luc = ?1 WHERE id = ?2 AND to_chuc_id = ?3").bind(bay, v.id, tc).run();
        await ghiSuKien(env, tc, v.id, 'huy_lich', `Xóa sự kiện trên Google Lịch: ${v.tieu_de}`).catch(() => {});
        r.huy++; r.ve++;
      } else {
        await env.CSDL.prepare('UPDATE viec SET lich_event_id = NULL WHERE id = ?1 AND to_chuc_id = ?2').bind(v.id, tc).run();
      }
      continue;
    }

    // Việc đã đóng thì không đổi theo Lịch, chỉ nhớ mốc.
    if (v.trang_thai !== 'mo') {
      await env.CSDL.prepare('UPDATE viec SET lich_cap_nhat = ?1 WHERE id = ?2').bind(sk.updated || null, v.id).run();
      continue;
    }
    // Bên sửa sau thắng: việc có thay đổi chờ đẩy và sửa sau sự kiện thì giữ việc, lần đẩy tới ghi đè sự kiện.
    if (v.can_dong_bo === 1 && sk.updated && String(v.cap_nhat_luc) > sk.updated) {
      await env.CSDL.prepare('UPDATE viec SET lich_cap_nhat = ?1 WHERE id = ?2').bind(sk.updated, v.id).run();
      continue;
    }
    const moi = viecTuSuKien(sk, v, ch, hn);
    if (!moi) continue;
    if (!moi.doi) {
      await env.CSDL.prepare('UPDATE viec SET lich_cap_nhat = ?1 WHERE id = ?2').bind(sk.updated || null, v.id).run();
      continue;
    }
    await env.CSDL.prepare(
      `UPDATE viec SET tieu_de = ?1, ghi_chu = ?2, han_ngay = ?3, gio_hen = ?4, buoi = ?5, nhan_gg = ?6, lich_cap_nhat = ?7, cap_nhat_luc = ?8, can_dong_bo = 0
       WHERE id = ?9 AND to_chuc_id = ?10`,
    ).bind(moi.tieu_de, moi.ghi_chu, moi.han_ngay, moi.gio_hen, moi.buoi, dauVet(ganNhan({ ...v, ...moi }, ch, hn)), sk.updated || null, sk.updated || bay, v.id, tc).run();
    await env.CSDL.prepare('DELETE FROM nhac_da_gui WHERE viec_id = ?1').bind(v.id).run().catch(() => {});
    await ghiSuKien(env, tc, v.id, 'doi_lich', `Sửa trên Google Lịch: ${moi.tieu_de} | ${moi.han_ngay}${moi.gio_hen ? ` ${moi.gio_hen}` : ''}`).catch(() => {});
    r.ve++;
  }
  await ghiCaiDat(env, tc, KHOA_LICH_SYNC, mocMoi);
  return r;
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
  let token;
  try { token = await layTruyCap(env, tc); } catch (e) {
    // Khóa hỏng thì ghi lỗi vào tín hiệu để trang Kết nối báo đỏ kèm lý do, rồi vẫn báo lỗi lên tác vụ.
    await ghiTinHieu(env, tc, 'google', `Lỗi ${String(e.message).slice(0, 200)}`).catch(() => {});
    throw e;
  }
  if (!token) return null;
  const kq = { thu: 0, day_len: 0, ve_lai: 0, lich: 0, lich_ve: 0, tep: 0, loi: [] };
  const lam = async (ten, f) => {
    try { await f(); } catch (e) { kq.loi.push(`${ten}: ${String(e.message).slice(0, 220)}`); }
  };
  if (thu) await lam('Gmail', async () => { kq.thu = await dongBoGmail(env, tc, token); });
  // Kéo Lịch về trước khi đẩy: sự kiện sửa sau việc thì thắng, việc sửa sau thì lần đẩy ngay sau ghi đè sự kiện.
  if (viec) await lam('Lịch về', async () => { kq.lich_ve = (await keoLichVe(env, tc, token)).ve; });
  if (viec) await lam('Tasks, Lịch', async () => { const r = await dongBoViec(env, tc, token); kq.day_len = r.dayLen; kq.ve_lai = r.veLai; kq.lich = r.lich; });
  if (viec) await lam('Drive', async () => { kq.tep = await dongBoDrive(env, tc, token); });
  await ghiTinHieu(env, tc, 'google', kq.loi.length ? `Lỗi ${kq.loi.join('; ')}` : `Đồng bộ xong: ${kq.thu} thư, ${kq.day_len} việc sang Google, ${kq.ve_lai} việc xong về${kq.lich_ve ? `, ${kq.lich_ve} việc đổi theo Lịch` : ''}${kq.tep ? `, ${kq.tep} tệp lên Drive` : ''}`);
  return kq;
}
