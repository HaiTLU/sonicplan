// Vá chương trình đọc Zalo trên máy Mac để mỗi cuộc trò chuyện chỉ là một mục trong Sonicplan:
//  - gửi kèm mã hội thoại (thread_id), Sonicplan gom tin theo mã chứ không theo tên;
//  - tin mình gửi đi được ghi dưới tên người nhận, không còn thành một "người" riêng mang tên mình;
//  - gửi tin về Sonicplan mỗi 30 giây khi có tin mới, thay vì chờ lô hàng giờ;
//  - gửi kèm địa chỉ ảnh đại diện Zalo của cuộc trò chuyện và của người gửi (thread_avatar, sender_id, sender_avatar).
// Chạy lại nhiều lần vẫn an toàn. Dùng: node va-hoi-thoai.mjs [thư mục chương trình]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DONG_CU = 'if (msg.type !== ThreadType.Group) return msg.data.dName || msg.threadId;';
const DONG_MOI = 'if (msg.type !== ThreadType.Group) return tenNguoiDoiDien(api, msg);';
const HAM_MOI = `// Tên người đối diện trong chat riêng: tin mình gửi đi cũng dùng tên người nhận (không phải tên mình).
const tenNguoi = new Map();
async function tenNguoiDoiDien(api, msg) {
  const id = msg.threadId;
  if (!msg.isSelf && msg.data.dName) { tenNguoi.set(id, msg.data.dName); return msg.data.dName; }
  if (tenNguoi.has(id)) return tenNguoi.get(id);
  try {
    const r = await api.getUserInfo(id);
    const hoSo = r?.changed_profiles?.[id] || Object.values(r?.changed_profiles || {})[0];
    const ten = hoSo?.displayName || hoSo?.zaloName;
    if (ten) { tenNguoi.set(id, ten); return ten; }
  } catch {}
  return msg.isSelf ? id : (msg.data.dName || id);
}

`;
const GUI_CU = /(\n(\s*)thread,\n)(\s*type: key === "group")/;

const ANH_DONG_CU = '    thread_id: msg.threadId,\n';
const ANH_DONG_MOI = '    thread_id: msg.threadId,\n    ...(await anhDaiDien(api, msg)),\n';
const ANH_HAM = `// Ảnh đại diện Zalo: của cuộc trò chuyện (chat riêng: người đối diện; nhóm: ảnh nhóm) và của người gửi trong nhóm.
// Nhớ trong bộ nhớ 24 giờ để không hỏi Zalo lại mỗi tin; lỗi thì bỏ qua, tin vẫn đi.
const anhNho = new Map();
async function anhTheoMa(lay, id) {
  const co = anhNho.get(id);
  if (co && Date.now() - co.luc < 24 * 3600000) return co.url;
  let url = '';
  try { url = (await lay()) || ''; } catch {}
  anhNho.set(id, { url, luc: Date.now() - (url ? 0 : 23 * 3600000) }); // không lấy được thì thử lại sau một giờ
  return url;
}
const anhNguoiTheoMa = (api, uid) => anhTheoMa(async () => {
  const r = await api.getUserInfo(uid);
  const hoSo = r?.changed_profiles?.[uid] || Object.values(r?.changed_profiles || {})[0];
  return hoSo?.avatar;
}, 'u:' + uid);
async function anhDaiDien(api, msg) {
  const ra = {};
  try {
    if (msg.type === ThreadType.Group) {
      const url = await anhTheoMa(async () => { const g = (await api.getGroupInfo(msg.threadId)).gridInfoMap?.[msg.threadId]; return g?.avt || g?.fullAvt; }, 'g:' + msg.threadId);
      if (url) ra.thread_avatar = url;
      if (!msg.isSelf && msg.data.uidFrom) {
        ra.sender_id = String(msg.data.uidFrom);
        const anhGui = await anhNguoiTheoMa(api, ra.sender_id);
        if (anhGui) ra.sender_avatar = anhGui;
      }
    } else {
      const url = await anhNguoiTheoMa(api, msg.threadId);
      if (url) ra.thread_avatar = url;
    }
  } catch {}
  return ra;
}

`;
const GUI_LO_CU = '  setInterval(async () => { await flush({ heartbeat: true }); saveSession(api); }, FLUSH_MIN * 60_000);';
const GUI_LO_MOI = `  // Gửi tin gần như ngay (30 giây một lần nếu có tin mới), không chờ lô hàng giờ. Cờ chặn hai lần gửi chồng nhau.
  let dangGui = false;
  const guiLo = async (tuyChon) => {
    if (dangGui) return;
    dangGui = true;
    try { await flush(tuyChon); saveSession(api); } finally { dangGui = false; }
  };
  setInterval(() => guiLo({ heartbeat: true }), FLUSH_MIN * 60_000);
  setInterval(() => { if (buffer.length) guiLo(); }, 30_000);`;

// Trả { ma, doi }: ma là mã đã vá, doi là có thay đổi hay không. Ném lỗi khi không nhận ra mã gốc.
export function vaMa(ma) {
  let moi = ma;
  let doi = false;
  if (!(ma.includes('tenNguoiDoiDien') && ma.includes('thread_id: msg.threadId'))) {
    if (!ma.includes(DONG_CU) || !GUI_CU.test(ma) || !ma.includes('async function threadName(')) {
      throw new Error('Không nhận ra mã chương trình Zalo, nên không vá để tránh làm hỏng.');
    }
    moi = moi.replace('async function threadName(', `${HAM_MOI}async function threadName(`);
    moi = moi.replace(DONG_CU, DONG_MOI);
    moi = moi.replace(GUI_CU, (_t, dau, thut, cuoi) => `${dau}${thut}thread_id: msg.threadId,\n${cuoi}`);
    doi = true;
  }
  if (!moi.includes('guiLo')) {
    if (!moi.includes(GUI_LO_CU)) throw new Error('Không nhận ra chỗ gửi lô tin, nên không vá để tránh làm hỏng.');
    moi = moi.replace(GUI_LO_CU, GUI_LO_MOI);
    doi = true;
  }
  if (!moi.includes('anhDaiDien')) {
    if (!moi.includes(ANH_DONG_CU) || !moi.includes('async function threadName(')) throw new Error('Không nhận ra chỗ gắn ảnh đại diện, nên không vá để tránh làm hỏng.');
    moi = moi.replace('async function threadName(', `${ANH_HAM}async function threadName(`);
    moi = moi.replace(ANH_DONG_CU, ANH_DONG_MOI);
    doi = true;
  }
  return { ma: moi, doi };
}

function timTep(thuMuc) {
  const ds = fs.readdirSync(thuMuc).filter((t) => t.endsWith('.mjs'));
  return ds.map((t) => path.join(thuMuc, t)).find((t) => fs.readFileSync(t, 'utf8').includes('async function threadName('));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const thuMuc = process.argv[2] || path.join(os.homedir(), '.zalo-listener');
  const tep = fs.existsSync(thuMuc) ? timTep(thuMuc) : null;
  if (!tep) { console.error(`Không thấy chương trình đọc Zalo trong ${thuMuc}.`); process.exit(1); }
  const goc = fs.readFileSync(tep, 'utf8');
  const kq = vaMa(goc);
  if (!kq.doi) { console.log('Chương trình Zalo đã được vá từ trước.'); process.exit(0); }
  const sao = `${tep}.truoc-hoi-thoai`;
  if (!fs.existsSync(sao)) fs.writeFileSync(sao, goc);
  fs.writeFileSync(tep, kq.ma);
  console.log(`Đã vá ${path.basename(tep)} (bản cũ giữ ở ${path.basename(sao)}).`);
}
