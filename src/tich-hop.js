// Tích hợp API của từng tổ chức: dịch vụ AI ngoài (Claude hoặc loại tương thích OpenAI) và địa chỉ nhận việc mới.
// Khóa và địa chỉ được mã hóa bằng KHOA_MA_HOA rồi lưu ở cai_dat, trang Kết nối không bao giờ hiện lại khóa.

import { goiNgoai } from './goi-ngoai.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { giaiMa, maHoa } from './ma-hoa.js';
import { kiemDiaChiTruocGoi, kiemTenMayCongKhai } from './dia-chi-an-toan.js';

const KHOA_CAI_DAT = { ai: 'tich_hop_ai', webhook: 'tich_hop_webhook', google_client: 'tich_hop_google_client', google: 'tich_hop_google', github: 'tich_hop_github', kho_drive: 'tich_hop_kho_drive', hop_drive: 'tich_hop_hop_drive' };
export const CLAUDE_MAC_DINH = 'claude-sonnet-5-5';
const OPENAI_MAC_DINH = { dia_chi: 'https://api.openai.com/v1', mo_hinh: 'gpt-4o-mini' };

export async function docTichHop(env, toChucId, loai) {
  return giaiTichHop(env, await docCaiDat(env, toChucId, KHOA_CAI_DAT[loai]), loai);
}

// Giải mã một bản đã đọc sẵn từ cai_dat, để trang Kết nối đọc cả 5 loại bằng một lần hỏi cơ sở dữ liệu.
export async function giaiTichHop(env, banMa, loai) {
  if (!banMa || !env.KHOA_MA_HOA) return null;
  try {
    return await giaiMa(banMa, env.KHOA_MA_HOA);
  } catch (e) {
    console.error('Không đọc được tích hợp', loai, e);
    return null;
  }
}

export const KHOA_TICH_HOP = KHOA_CAI_DAT;

export async function luuTichHop(env, toChucId, loai, duLieu) {
  if (!env.KHOA_MA_HOA) throw new Error('Hệ thống chưa có khóa mã hóa, liên hệ người quản trị.');
  await ghiCaiDat(env, toChucId, KHOA_CAI_DAT[loai], await maHoa(duLieu, env.KHOA_MA_HOA));
}

export function xoaTichHop(env, toChucId, loai) {
  return env.CSDL.prepare('DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = ?2').bind(toChucId, KHOA_CAI_DAT[loai]).run();
}

// ---- AI ngoài ----

export function chuanHoaCauHinhAi({ loai, khoa, mo_hinh: moHinh, dia_chi: diaChi, workspace_id: workspaceId }) {
  const k = String(khoa || '').trim();
  if (k.length < 20) throw new Error('Khóa API không đúng, chép nguyên chuỗi nhà cung cấp đưa.');
  if (loai === 'claude') {
    const ws = String(workspaceId || '').trim();
    if (ws && !/^[A-Za-z0-9_-]{3,100}$/.test(ws)) throw new Error('Workspace ID không đúng, chép nguyên mã trong console.anthropic.com (mục Workspaces).');
    return { loai, khoa: k, mo_hinh: String(moHinh || '').trim() || CLAUDE_MAC_DINH, ...(ws ? { workspace_id: ws } : {}) };
  }
  if (loai === 'openai') {
    const dc = String(diaChi || '').trim().replace(/\/+$/, '') || OPENAI_MAC_DINH.dia_chi;
    if (!/^https:\/\/[^\s]+$/.test(dc)) throw new Error('Địa chỉ dịch vụ phải bắt đầu bằng https://');
    try { kiemTenMayCongKhai(dc); } catch (e) { throw new Error(e.message.replace('Địa chỉ ', 'Địa chỉ dịch vụ ')); }
    return { loai, khoa: k, dia_chi: dc, mo_hinh: String(moHinh || '').trim() || OPENAI_MAC_DINH.mo_hinh };
  }
  throw new Error('Chọn Claude hoặc loại tương thích OpenAI.');
}

export function loiAi(ten, ma, chiTiet) {
  if (ma === 400 && /workspace/i.test(chiTiet || '')) {
    return `${ten} từ chối (400). Khóa này chưa gắn với Workspace nào. Cách 1: vào console.anthropic.com, tạo khóa mới trong một Workspace rồi dán lại. Cách 2: giữ khóa này và dán mã Workspace (Workspace ID) vào ô "Workspace ID" bên dưới.`;
  }
  const goiY = ma === 401 ? 'Khóa sai hoặc đã bị thu hồi.' : ma === 403 ? 'Khóa không được phép dùng hoặc nhà cung cấp chặn vùng máy chủ.' : ma === 429 ? 'Hết hạn mức, thử lại sau.' : '';
  return `${ten} từ chối (${ma}). ${goiY} ${String(chiTiet || '').slice(0, 200)}`.replace(/\s+/g, ' ').trim();
}

// messages: [{ role: 'system'|'user', content }]. Trả về chuỗi trả lời.
// Trả lời bị cắt vì hết max_tokens (bản tin cụt, JSON dở) thì hỏi lại một lần với gấp đôi; vẫn cắt thì báo lỗi,
// không trả nửa câu cho người dùng.
export async function chayAiNgoai(cauHinh, messages, { maxTokens = 1500, nhietDo = 0.1, json = false } = {}) {
  let kq = await goiAiNgoai(cauHinh, messages, { maxTokens, nhietDo, json });
  if (kq.cat) kq = await goiAiNgoai(cauHinh, messages, { maxTokens: maxTokens * 2, nhietDo, json });
  if (kq.cat) throw new Error(`AI trả lời bị cắt giữa chừng (quá ${maxTokens * 2} token)`);
  return kq.chu;
}

async function goiAiNgoai(cauHinh, messages, { maxTokens, nhietDo, json }) {
  const he = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const hoi = messages.filter((m) => m.role !== 'system');
  if (cauHinh.loai === 'claude') {
    const ph = await goiNgoai('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cauHinh.khoa, 'anthropic-version': '2023-06-01', ...(cauHinh.workspace_id ? { 'anthropic-workspace-id': cauHinh.workspace_id } : {}) },
      body: JSON.stringify({ model: cauHinh.mo_hinh, max_tokens: maxTokens, system: he || undefined, messages: hoi }),
    }, { hetGioMs: 60000 });
    const kq = await ph.json().catch(() => ({}));
    if (!ph.ok) throw new Error(loiAi('Claude', ph.status, kq?.error?.message));
    return { chu: (kq.content || []).map((c) => c.text || '').join(''), cat: kq.stop_reason === 'max_tokens' };
  }
  await kiemDiaChiTruocGoi(cauHinh.dia_chi);
  const ph = await goiNgoai(`${cauHinh.dia_chi}/chat/completions`, {
    method: 'POST',
    redirect: 'manual', // không theo chuyển hướng: một lệnh 302 không được đưa máy chủ vào mạng nội bộ
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cauHinh.khoa}` },
    body: JSON.stringify({
      model: cauHinh.mo_hinh,
      messages: he ? [{ role: 'system', content: he }, ...hoi] : hoi,
      max_tokens: maxTokens,
      temperature: nhietDo,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  }, { hetGioMs: 60000 });
  const kq = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(loiAi('Dịch vụ AI', ph.status, kq?.error?.message));
  return { chu: kq.choices?.[0]?.message?.content || '', cat: kq.choices?.[0]?.finish_reason === 'length' };
}

// Thử khóa bằng một câu hỏi ngắn trước khi lưu.
export async function thuAiNgoai(cauHinh) {
  const tra = await chayAiNgoai(cauHinh, [{ role: 'user', content: 'Trả lời đúng một chữ: ok' }], { maxTokens: 16, nhietDo: 0 });
  if (!tra.trim()) throw new Error('Dịch vụ AI không trả lời.');
}

// ---- Địa chỉ nhận việc mới ----

export function kiemDiaChiNhan(chuoi) {
  const s = String(chuoi || '').trim();
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('Địa chỉ không đúng dạng.');
  }
  if (u.protocol !== 'https:') throw new Error('Địa chỉ phải bắt đầu bằng https://');
  kiemTenMayCongKhai(s);
  return s;
}

export function dangViecMoi(viec) {
  return { su_kien: 'viec_moi', luc: new Date().toISOString(), viec: { id: viec.id, tieu_de: viec.tieu_de, han_ngay: viec.han_ngay || null, gio_hen: viec.gio_hen || null, ghi_chu: viec.ghi_chu || null } };
}

export async function guiDiaChiNhan(diaChi, duLieu) {
  await kiemDiaChiTruocGoi(diaChi);
  const ph = await fetch(diaChi, {
    method: 'POST',
    redirect: 'manual', // không theo chuyển hướng: một lệnh 302 không được đưa máy chủ vào mạng nội bộ
    headers: { 'content-type': 'application/json', 'user-agent': 'Sonicplan' },
    body: JSON.stringify(duLieu),
    signal: AbortSignal.timeout(8000),
  });
  if (!ph.ok) throw new Error(`Nơi nhận trả ${ph.status}`);
}

// Gửi sự kiện cho tổ chức nếu đã khai báo địa chỉ. Không bao giờ làm hỏng việc đang làm.
export async function baoSuKien(env, toChucId, duLieu) {
  try {
    const cauHinh = await docTichHop(env, toChucId, 'webhook');
    if (!cauHinh) return;
    try {
      await guiDiaChiNhan(cauHinh.url, duLieu);
      await ghiTinHieu(env, toChucId, 'webhook', 'Gửi được');
    } catch (e) {
      await ghiTinHieu(env, toChucId, 'webhook', `Lỗi: ${String(e.message).slice(0, 120)}`);
    }
  } catch (e) {
    console.error('Báo sự kiện lỗi', e);
  }
}
