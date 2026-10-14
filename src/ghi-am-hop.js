// Ghi âm và biên bản họp: đọc một thư mục Google Drive (kể cả thư mục con) do người dùng chọn,
// ghép ghi âm với biên bản cùng cuộc họp, đưa mỗi cuộc họp vào Hộp tin thành một tin nguồn "hop".
// AI tách việc đọc biên bản như mọi tin khác. Biên bản được chép vào kho tệp R2 (rồi vào kho Drive và
// thư mục dự án như tệp đính kèm thường); ghi âm thường nặng nên chỉ giữ liên kết, nghe bằng khung xem của Drive.
// Quyền xin: drive.readonly (chỉ đọc), trên một tài khoản Google chọn riêng, có thể khác tài khoản chính.

import { doiMa, emailTuIdToken, goiGoogle } from './google.js';
import { goiNgoai } from './goi-ngoai.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu, luuTep, luuTin, TEP_TOI_DA } from './hop-tin.js';
import { docTichHop, luuTichHop, xoaTichHop } from './tich-hop.js';
import { cat, chuanHoa } from './tien-ich.js';
import { chuTuDocx } from './xem-tep.js';

export const QUYEN_DOC_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';
const DIA_CHI_DANG_NHAP = 'https://accounts.google.com/o/oauth2/v2/auth';
const LOAI_THU_MUC = 'application/vnd.google-apps.folder';
const LOAI_GOOGLE_DOC = 'application/vnd.google-apps.document';
const LOAI_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Giới hạn mỗi lượt quét (5 phút một lượt) để một lượt không chạy quá lâu.
const TOI_DA_THU_MUC = 40;
const TOI_DA_TEP_DOC = 3000;
const TOI_DA_HOP_MOI_LUOT = 4;
const DO_SAU_TOI_DA = 4;
// Tệp vừa sửa dưới 2 phút có thể đang tải lên dở: để lượt sau.
const CHO_ON_DINH_MS = 2 * 60000;
// Có ghi âm mà chưa có biên bản: chờ 3 giờ cho biên bản về rồi mới đưa riêng ghi âm vào Hộp tin.
const CHO_BIEN_BAN_MS = 3 * 3600000;
// Lần nối đầu chỉ lấy cuộc họp trong 30 ngày gần đây; cuộc họp cũ hơn 3 ngày chỉ vào Hộp tin, không tách việc.
const LAY_LUI_NGAY = 30;
const TACH_VIEC_TRONG_MS = 3 * 86400000;
const KHONG_CO_BIEN_BAN = 'Chưa có biên bản cho cuộc họp này. Bấm "Nghe ghi âm" để nghe lại.';

// ---- Phần thuần (kiểm thử được) ----

// Mã thư mục từ liên kết Drive: .../folders/<mã>, ...?id=<mã>, hoặc dán thẳng mã.
export function maThuMucTuLink(chuoi) {
  const s = String(chuoi || '').trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{10,})$/);
  if (!m) throw new Error('Không đọc được liên kết. Mở thư mục trên Google Drive, chép địa chỉ trên thanh trình duyệt (có chữ /folders/) rồi dán vào.');
  return m[1];
}

const duoi = (ten) => (String(ten).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1]?.toLowerCase() || '';
const DUOI_GHI_AM = ['m4a', 'mp3', 'wav', 'webm', 'ogg', 'oga', 'aac', 'opus', 'flac', 'amr', 'caf'];
// Thứ tự ưu tiên khi một cuộc họp có nhiều bản biên bản (Word, rồi Google Docs, PDF, chữ thường).
const UU_TIEN_BIEN_BAN = ['docx', 'gdoc', 'pdf', 'md', 'txt'];

// 'ghi_am', 'bien_ban' hoặc null (tệp khác, bỏ qua).
export function loaiTepHop(f) {
  const d = duoi(f.name);
  if (f.mimeType === LOAI_GOOGLE_DOC) return 'bien_ban';
  if (DUOI_GHI_AM.includes(d) || /^audio\//.test(f.mimeType || '')) return 'ghi_am';
  if (UU_TIEN_BIEN_BAN.includes(d)) return 'bien_ban';
  return null;
}

const hangBienBan = (f) => {
  const i = UU_TIEN_BIEN_BAN.indexOf(f.mimeType === LOAI_GOOGLE_DOC ? 'gdoc' : duoi(f.name));
  return i < 0 ? 99 : i;
};

const boDuoi = (ten) => String(ten).replace(/\.[A-Za-z0-9]{1,5}$/, '');
// Chữ chỉ loại tệp, không nói gì về cuộc họp: bỏ đi khi so tên ghi âm với tên biên bản.
const TU_LOAI_TEP = /\b(bien ban( hop)?|ghi am|ban ghi|ban chep loi|chep loi|recording|record|audio|transcript|minutes|bb)\b/g;

// Tên đã chuẩn hóa để ghép: "260930 Giao ban - Biên bản.docx" và "260930 Giao ban.m4a" cùng ra "260930 giao ban".
export function tenGhep(ten) {
  return chuanHoa(boDuoi(ten).replace(/[_\-–.()[\]]+/g, ' ')).replace(TU_LOAI_TEP, ' ').replace(/\s+/g, ' ').trim();
}

const moc = (f) => Date.parse(f.createdTime || f.modifiedTime) || 0;

// Ghép tệp thành cuộc họp. tep: [{ id, name, mimeType, createdTime, modifiedTime, cha }] (cha là mã thư mục chứa).
// Trong cùng thư mục: trùng tên đã chuẩn hóa thì ghép; còn lại nếu thư mục chỉ còn đúng một ghi âm và một biên bản
// thì ghép; nếu không thì ghép biên bản với ghi âm gần giờ nhất trong vòng 3 giờ.
// Trả [{ ghi_am, bien_ban, cha }] (một trong hai có thể null).
export function ghepCuocHop(tep) {
  const theoCha = new Map();
  for (const f of tep) {
    const loai = loaiTepHop(f);
    if (!loai) continue;
    const ds = theoCha.get(f.cha) || theoCha.set(f.cha, []).get(f.cha);
    ds.push({ ...f, loai });
  }
  const ra = [];
  for (const [cha, ds] of theoCha) {
    const theoTen = new Map();
    for (const f of ds) {
      const k = tenGhep(f.name);
      const nhom = theoTen.get(k) || theoTen.set(k, { ghi_am: [], bien_ban: [] }).get(k);
      nhom[f.loai].push(f);
    }
    const leGhi = [];
    const leBan = [];
    for (const [k, nhom] of theoTen) {
      nhom.ghi_am.sort((a, b) => moc(a) - moc(b));
      nhom.bien_ban.sort((a, b) => hangBienBan(a) - hangBienBan(b) || moc(b) - moc(a));
      if (k && nhom.ghi_am.length && nhom.bien_ban.length) {
        // Cùng tên: ghi âm đầu tiên đi với biên bản tốt nhất; ghi âm thừa (cùng tên) đứng riêng.
        ra.push({ ghi_am: nhom.ghi_am[0], bien_ban: nhom.bien_ban[0], cha });
        leGhi.push(...nhom.ghi_am.slice(1));
      } else {
        leGhi.push(...nhom.ghi_am);
        // Nhiều bản biên bản cùng tên (docx và md): chỉ lấy bản tốt nhất.
        if (nhom.bien_ban.length) leBan.push(nhom.bien_ban[0]);
      }
    }
    if (leGhi.length === 1 && leBan.length === 1 && cha) {
      ra.push({ ghi_am: leGhi[0], bien_ban: leBan[0], cha });
      continue;
    }
    const conGhi = [...leGhi];
    for (const b of leBan) {
      let tot = -1;
      let lech = 3 * 3600000;
      conGhi.forEach((g, i) => {
        const d = Math.abs(moc(g) - moc(b));
        if (d <= lech) { tot = i; lech = d; }
      });
      ra.push({ ghi_am: tot >= 0 ? conGhi.splice(tot, 1)[0] : null, bien_ban: b, cha });
    }
    for (const g of conGhi) ra.push({ ghi_am: g, bien_ban: null, cha });
  }
  return ra;
}

// Tên cuộc họp: tên tệp bỏ đuôi và chữ chỉ loại tệp; tên chỉ còn chữ chung chung thì dùng tên thư mục.
export function tieuDeCuocHop(hop, tenThuMuc) {
  const f = hop.bien_ban || hop.ghi_am;
  let ten = boDuoi(f.name).replace(/[_]+/g, ' ').replace(/\s*[-–]\s*(biên bản( họp)?|ghi âm|bản ghi|recording|transcript)\s*$/i, '').replace(/\s+/g, ' ').trim();
  if (!tenGhep(f.name) && tenThuMuc) ten = tenThuMuc;
  return cat(ten || 'Cuộc họp', 200);
}

// Nội dung tin là chữ của biên bản; ghi âm và tệp biên bản hiện thành nút riêng ở Hộp tin.
export const noiDungTinHop = (chu) => (chu && chu.trim() ? chu.trim() : KHONG_CO_BIEN_BAN);

// Phần đáng đọc nhất của biên bản cho AI: kết luận và phân công lên trước, rồi đến phần đầu biên bản.
export function trichBienBan(chu, toiDa = 7000) {
  const s = String(chu || '');
  const m = s.search(/^[ \t*#\d.IVX-]*(kết luận|phân công|giao nhiệm vụ|nhiệm vụ|việc cần làm|danh sách việc|công việc tiếp theo|bước tiếp theo)/im);
  if (m <= 0 || s.length <= toiDa) return s.slice(0, toiDa);
  const sau = s.slice(m, m + Math.floor(toiDa * 0.65));
  return `${sau}\n\n[Phần đầu biên bản]\n${s.slice(0, toiDa - sau.length)}`;
}

export function taoDiaChiDangNhapHop(clientId, goiLai, state) {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: goiLai,
    response_type: 'code',
    scope: ['openid', 'email', QUYEN_DOC_DRIVE].join(' '),
    access_type: 'offline',
    // Chọn đúng tài khoản có thư mục ghi âm, có thể khác tài khoản Google chính.
    prompt: 'consent select_account',
    state,
  });
  return `${DIA_CHI_DANG_NHAP}?${q}`;
}

// ---- Đăng nhập ----

export async function hoanTatDangNhapHop(env, tc, code, goiLai) {
  const client = await docTichHop(env, tc, 'google_client');
  if (!client) throw new Error('Chưa khai Client ID và Secret ở thẻ Google.');
  const kq = await doiMa(client, { grant_type: 'authorization_code', code, redirect_uri: goiLai });
  if (!kq.refresh_token) throw new Error('Google không trả khóa làm mới. Gỡ quyền của ứng dụng ở myaccount.google.com/permissions bằng tài khoản đó rồi chọn lại.');
  if (!String(kq.scope || '').includes(QUYEN_DOC_DRIVE)) throw new Error('Chưa tick quyền xem tệp Drive ở màn hình Google. Chọn lại tài khoản và tick quyền đó.');
  const email = emailTuIdToken(kq.id_token);
  const truoc = await docTichHop(env, tc, 'hop_drive');
  await luuTichHop(env, tc, 'hop_drive', { refresh_token: kq.refresh_token, email, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
  // Đổi sang tài khoản khác thì thư mục cũ có thể không còn quyền: chọn lại thư mục.
  if (truoc && truoc.email !== email) await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'hop_thu_muc'`).bind(tc).run();
  await ghiTinHieu(env, tc, 'hop', 'Vừa đăng nhập, chờ chọn thư mục');
  return email;
}

export async function layTruyCapHop(env, tc) {
  const [client, tk] = [await docTichHop(env, tc, 'google_client'), await docTichHop(env, tc, 'hop_drive')];
  if (!client || !tk) return null;
  if (tk.truy_cap && tk.het_han > Date.now()) return tk.truy_cap;
  const kq = await doiMa(client, { grant_type: 'refresh_token', refresh_token: tk.refresh_token });
  await luuTichHop(env, tc, 'hop_drive', { ...tk, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
  return kq.access_token;
}

// Gỡ kết nối: tin và việc đã có giữ nguyên.
export async function goKetNoiHop(env, tc) {
  const tk = await docTichHop(env, tc, 'hop_drive');
  if (tk?.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tk.refresh_token)}`, { method: 'POST' }).catch(() => {});
  await xoaTichHop(env, tc, 'hop_drive');
  await env.CSDL.batch([
    env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'hop_thu_muc'`).bind(tc),
    env.CSDL.prepare('DELETE FROM tin_hieu WHERE to_chuc_id = ?1 AND nguon = ?2').bind(tc, 'hop'),
  ]);
}

export async function docThuMucHop(env, tc) {
  try { return JSON.parse((await docCaiDat(env, tc, 'hop_thu_muc')) || 'null'); } catch { return null; }
}

// ---- Đọc Drive ----

async function dsCon(token, cha) {
  const ra = [];
  let trang = '';
  do {
    const q = new URLSearchParams({
      q: `'${cha}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      ...(trang ? { pageToken: trang } : {}),
    });
    const kq = await goiGoogle(token, `www.googleapis.com/drive/v3/files?${q}`);
    ra.push(...(kq.files || []));
    trang = kq.nextPageToken || '';
  } while (trang && ra.length < TOI_DA_TEP_DOC);
  return ra;
}

// Duyệt cây thư mục theo chiều rộng. Mỗi tệp mang mã và tên thư mục chứa (thư mục gốc có cha_ten rỗng).
async function duyetCay(token, goc) {
  const tep = [];
  const hang = [{ id: goc, ten: '', sau: 0 }];
  let soThuMuc = 0;
  while (hang.length && soThuMuc < TOI_DA_THU_MUC && tep.length < TOI_DA_TEP_DOC) {
    const tm = hang.shift();
    soThuMuc++;
    for (const f of await dsCon(token, tm.id)) {
      if (f.mimeType === LOAI_THU_MUC) {
        if (tm.sau + 1 < DO_SAU_TOI_DA) hang.push({ id: f.id, ten: tm.ten ? `${tm.ten}/${f.name}` : f.name, sau: tm.sau + 1 });
      } else if (loaiTepHop(f)) {
        tep.push({ ...f, cha: tm.id === goc ? '' : tm.id, cha_ten: tm.ten });
      }
    }
  }
  return tep;
}

// Kiểm quyền đọc thư mục rồi lưu. Trả tên thư mục và số tệp ghi âm, biên bản thấy được.
export async function datThuMucHop(env, tc, link) {
  const id = maThuMucTuLink(link);
  const token = await layTruyCapHop(env, tc);
  if (!token) throw new Error('Đăng nhập tài khoản Google có thư mục ghi âm trước.');
  let f;
  try {
    f = await goiGoogle(token, `www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,capabilities(canListChildren)&supportsAllDrives=true`);
  } catch (e) {
    if (e.trangThai === 404 || e.trangThai === 403) throw new Error('Tài khoản đã đăng nhập không mở được thư mục này. Kiểm tra lại liên kết, hoặc chia sẻ thư mục cho tài khoản đó.');
    throw e;
  }
  if (f.mimeType !== LOAI_THU_MUC) throw new Error('Liên kết này là một tệp, không phải thư mục. Dán liên kết của thư mục chứa các cuộc họp.');
  if (f.capabilities && f.capabilities.canListChildren === false) throw new Error('Tài khoản này không có quyền xem nội dung thư mục.');
  const tep = await duyetCay(token, id);
  const tu = new Date(Date.now() - LAY_LUI_NGAY * 86400000).toISOString();
  await ghiCaiDat(env, tc, 'hop_thu_muc', JSON.stringify({ id, ten: cat(f.name, 200), tu }));
  const dem = { ghi_am: 0, bien_ban: 0 };
  for (const x of tep) dem[loaiTepHop(x)]++;
  await ghiTinHieu(env, tc, 'hop', `Đã chọn thư mục "${cat(f.name, 80)}": ${dem.ghi_am} ghi âm, ${dem.bien_ban} biên bản`);
  return { ten: f.name, ...dem, cuoc_hop: ghepCuocHop(tep).length };
}

async function taiNoiDung(token, f, { xuat } = {}) {
  const duong = xuat
    ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent(xuat)}`
    : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`;
  const ph = await goiNgoai(duong, { headers: { authorization: `Bearer ${token}` } }, { hetGioMs: 60000 });
  if (!ph.ok) throw new Error(`drive ${ph.status} khi tải ${f.name}`);
  return new Uint8Array(await ph.arrayBuffer());
}

// Đọc chữ và bản lưu của biên bản. Trả { chu, du_lieu, ten, loai } (du_lieu null nếu quá lớn).
async function docBienBan(env, token, f) {
  if (f.mimeType === LOAI_GOOGLE_DOC) {
    const chu = new TextDecoder().decode(await taiNoiDung(token, f, { xuat: 'text/plain' }));
    const du = await taiNoiDung(token, f, { xuat: LOAI_DOCX }).catch(() => null);
    return { chu, du_lieu: du, ten: `${f.name}.docx`, loai: LOAI_DOCX };
  }
  if (Number(f.size) > TEP_TOI_DA) return { chu: '', du_lieu: null, ten: f.name, loai: f.mimeType };
  const du = await taiNoiDung(token, f);
  const d = duoi(f.name);
  let chu = '';
  if (d === 'docx') chu = (await chuTuDocx(du)) || '';
  else if (d === 'md' || d === 'txt') chu = new TextDecoder().decode(du);
  else if (d === 'pdf' && env.AI?.toMarkdown) {
    try {
      const [kq] = await env.AI.toMarkdown([{ name: f.name, blob: new Blob([du], { type: 'application/pdf' }) }]);
      chu = kq?.format === 'markdown' ? kq.data || '' : '';
    } catch (e) {
      console.error('Đọc PDF biên bản lỗi', f.name, e.message);
    }
  }
  return { chu, du_lieu: du, ten: f.name, loai: f.mimeType || 'application/octet-stream' };
}

// Ghi âm: một dòng tệp chỉ giữ mã Drive (không chép vào R2), mở bằng khung xem của Drive.
async function themTepGhiAm(env, tc, tinId, f) {
  await env.CSDL.prepare(
    `INSERT INTO tep (to_chuc_id, tin_nhan_id, ten, loai, kich_thuoc, drive_id, nguon, thu_muc, tao_luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'hop', ?7, ?8)`,
  ).bind(tc, tinId, cat(f.name, 200), f.mimeType || null, Number(f.size) || null, f.id, cat(f.cha_ten || '', 200) || null, new Date().toISOString()).run();
}

async function themTepBienBan(env, tc, tinId, f, bb) {
  if (!bb.du_lieu) {
    // Quá lớn để chép: vẫn giữ liên kết Drive như ghi âm.
    await themTepGhiAm(env, tc, tinId, f);
    return;
  }
  const id = env.TEP ? await luuTep(env, tc, { ten: bb.ten, loai: bb.loai, kich_thuoc: bb.du_lieu.byteLength, du_lieu: bb.du_lieu, nguon: 'hop', nhom: f.cha_ten || '', tin_nhan_id: tinId }) : null;
  // Mã Drive gốc giữ trên dòng tệp: đánh dấu đã xử lý, và để Drive chính không tải lên lần nữa.
  if (id) await env.CSDL.prepare('UPDATE tep SET drive_id = ?1 WHERE id = ?2').bind(f.id, id).run();
  else await themTepGhiAm(env, tc, tinId, f);
}

// ---- Quét định kỳ ----

// Mỗi 5 phút: tìm tệp mới trong thư mục, ghép thành cuộc họp, đưa vào Hộp tin. Tệp đã xử lý nhận ra nhờ mã Drive trên bảng tep.
export async function quetHop(env, tc, bayGio = Date.now()) {
  const thuMuc = await docThuMucHop(env, tc);
  if (!thuMuc) return null;
  const token = await layTruyCapHop(env, tc);
  if (!token) return null;
  const tep = await duyetCay(token, thuMuc.id);
  const daCo = new Map((await env.CSDL.prepare(
    `SELECT drive_id, tin_nhan_id FROM tep WHERE to_chuc_id = ?1 AND nguon = 'hop' AND drive_id IS NOT NULL`,
  ).bind(tc).all()).results.map((r) => [r.drive_id, r.tin_nhan_id]));
  const tu = Date.parse(thuMuc.tu) || 0;
  const kq = { moi: 0, bo_sung: 0, loi: [] };
  let lam = 0;
  for (const hop of ghepCuocHop(tep)) {
    if (lam >= TOI_DA_HOP_MOI_LUOT) break;
    const ds = [hop.ghi_am, hop.bien_ban].filter(Boolean);
    const moi = ds.filter((f) => !daCo.has(f.id));
    if (!moi.length) continue;
    if (moi.some((f) => bayGio - Date.parse(f.modifiedTime || f.createdTime) < CHO_ON_DINH_MS)) continue;
    const tinCu = ds.map((f) => daCo.get(f.id)).find(Boolean);
    if (!tinCu && Math.max(...ds.map(moc)) < tu) continue; // cuộc họp cũ hơn mốc lấy lùi
    if (!tinCu && !hop.bien_ban && bayGio - moc(hop.ghi_am) < CHO_BIEN_BAN_MS) continue; // chờ biên bản
    lam++;
    try {
      if (tinCu) await boSungCuocHop(env, tc, token, hop, moi, tinCu, bayGio);
      else await themCuocHop(env, tc, token, hop, bayGio);
      for (const f of moi) daCo.set(f.id, tinCu || -1);
      if (tinCu) kq.bo_sung++;
      else kq.moi++;
    } catch (e) {
      kq.loi.push(`${(hop.bien_ban || hop.ghi_am).name}: ${String(e.message).slice(0, 100)}`);
    }
  }
  await ghiTinHieu(env, tc, 'hop', kq.loi.length ? `Lỗi ${kq.loi.join('; ')}` : `Quét xong: ${kq.moi} cuộc họp mới${kq.bo_sung ? `, ${kq.bo_sung} cuộc họp có thêm tệp` : ''}`);
  return kq;
}

async function themCuocHop(env, tc, token, hop, bayGio) {
  const bb = hop.bien_ban ? await docBienBan(env, token, hop.bien_ban) : null;
  const tenThuMuc = (hop.bien_ban || hop.ghi_am).cha_ten?.split('/').pop() || '';
  const thoiDiem = new Date(moc(hop.ghi_am || hop.bien_ban) || bayGio).toISOString();
  const tin = {
    nguon: 'hop',
    ma_goc: `hop:${(hop.bien_ban || hop.ghi_am).id}`,
    nguoi_gui: null,
    nhom: null,
    tieu_de: tieuDeCuocHop(hop, tenThuMuc),
    noi_dung: noiDungTinHop(bb?.chu),
    thoi_diem: thoiDiem,
  };
  const tinId = await luuTin(env, tc, tin);
  if (!tinId) return;
  // Không có chữ để đọc, hoặc cuộc họp đã cũ: chỉ vào Hộp tin, không tách việc.
  if (!bb?.chu?.trim() || bayGio - Date.parse(thoiDiem) > TACH_VIEC_TRONG_MS) {
    await env.CSDL.prepare('UPDATE tin_nhan SET da_tach = 1 WHERE id = ?1 AND to_chuc_id = ?2').bind(tinId, tc).run();
  }
  if (tin.an) return;
  if (hop.bien_ban) await themTepBienBan(env, tc, tinId, hop.bien_ban, bb);
  if (hop.ghi_am) await themTepGhiAm(env, tc, tinId, hop.ghi_am);
}

// Cuộc họp đã có trong Hộp tin nhận thêm tệp: ghi âm về sau, hoặc biên bản về sau ghi âm.
async function boSungCuocHop(env, tc, token, hop, moi, tinId, bayGio) {
  const tin = await env.CSDL.prepare('SELECT id, noi_dung, thoi_diem FROM tin_nhan WHERE id = ?1 AND to_chuc_id = ?2').bind(tinId, tc).first();
  if (!tin) return;
  for (const f of moi) {
    if (f === hop.ghi_am) {
      await themTepGhiAm(env, tc, tinId, f);
      continue;
    }
    const bb = await docBienBan(env, token, f);
    await themTepBienBan(env, tc, tinId, f, bb);
    if (!bb.chu.trim()) continue;
    const tenThuMuc = f.cha_ten?.split('/').pop() || '';
    const chuaCo = tin.noi_dung === KHONG_CO_BIEN_BAN;
    const tachLai = chuaCo && bayGio - Date.parse(tin.thoi_diem) <= TACH_VIEC_TRONG_MS;
    await env.CSDL.prepare(
      `UPDATE tin_nhan SET tieu_de = ?1, noi_dung = ?2, da_xem = 0${tachLai ? ', da_tach = 0' : ''} WHERE id = ?3 AND to_chuc_id = ?4`,
    ).bind(tieuDeCuocHop(hop, tenThuMuc), cat(noiDungTinHop(bb.chu), 20000), tinId, tc).run();
  }
}
