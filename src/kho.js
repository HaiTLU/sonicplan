// Kho Drive: một Google Drive riêng (thường là tài khoản khác tài khoản chính) làm nơi lưu lại
// tin nhắn, thư, tệp, bộ nhớ AI và việc. Chỉ xin quyền drive.file nên hệ thống chỉ thấy thứ do chính nó tạo.
// Không xóa gì trên Drive: tin nhắn và thư gom thành một tệp mỗi ngày, bộ nhớ và việc ghi đè đúng một tệp.

import { doiMa, goiGoogle, QUYEN_DRIVE, taoThuMuc, thanTaiLen, emailTuIdToken } from './google.js';
import { goiNgoai } from './goi-ngoai.js';
import { docHoSo } from './ghi-nho.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { docTichHop, luuTichHop, xoaTichHop } from './tich-hop.js';
import { cat, chuanHoa, ngayVN } from './tien-ich.js';
import { dongBoDuAn } from './kho-du-an.js';

const DIA_CHI_DANG_NHAP = 'https://accounts.google.com/o/oauth2/v2/auth';
const LECH_VN_MS = 7 * 3600000;
const TOI_DA_TEP = 8;
const TOI_DA_NGAY = 6;
const TEN_THU_MUC = { goc: 'Sonicplan kho', tin: 'Tin nhắn', thu: 'Thư', tep: 'Tệp', phan_loai: 'Phân loại', bo_nho: 'Bộ nhớ AI', viec: 'Việc' };
const NHAN_GHI_NHO = { nguoi: 'Người', du_an: 'Dự án', quyet_dinh: 'Quyết định', su_that: 'Sự thật' };

// ---- Phần thuần (kiểm thử được) ----

const DUOI_ANH = /\.(jpe?g|png|gif|webp|heic|bmp)$/i;
const TOI_THIEU_ANH = 50000; // ảnh nhỏ hơn mức này coi là sticker, ảnh vụn
const THU_MUC_CAN_XEM = '99_CanXem';

export const tenNguonTep = (nguon) => (nguon === 'zalo' ? 'Zalo' : nguon === 'gmail' ? 'Gmail' : 'Tải lên');

// Tên mới: [Nguồn] YYMMDD Nhóm hoặc người gửi - Tên gốc.ext
export function tenPhanLoai(tep) {
  const m = String(tep.ten).match(/^(\d{6})_(?:Zalo|Gmail)_([\s\S]+)$/);
  const ngay = m ? m[1] : ngayVN(tep.tao_luc || new Date()).slice(2).replace(/-/g, '');
  let phan = m ? m[2] : String(tep.ten);
  if (tep.nhom && phan.startsWith(`${tep.nhom}_`)) phan = `${tep.nhom} - ${phan.slice(tep.nhom.length + 1)}`;
  const duoi = (phan.match(/\.[A-Za-z0-9]{1,5}$/) || [''])[0];
  const than = cat(`[${tenNguonTep(tep.nguon)}] ${ngay} ${duoi ? phan.slice(0, -duoi.length) : phan}`, 190);
  return `${than}${duoi}`;
}

// Quy tắc: [{ thu_muc, mau: ['cụm từ'], anh_con }]. Cụm từ so với nhóm và tên tệp đã bỏ dấu, khớp theo từ.
// Không khớp quy tắc nào thì vào thư mục cần xem. Ảnh nhỏ bị bỏ qua.
export function phanLoaiTep(tep, quyTac) {
  const laAnh = DUOI_ANH.test(tep.ten);
  if (laAnh && Number(tep.kich_thuoc) < TOI_THIEU_ANH) return { bo_qua: true };
  const co = ` ${chuanHoa(`${tep.nhom || ''} ${tep.thu_muc || ''} ${tep.ten}`)} `;
  const quy = quyTac.find((q) => q.mau.some((mau) => co.includes(` ${chuanHoa(mau)} `)));
  const goc = quy?.thu_muc || THU_MUC_CAN_XEM;
  return { duong_dan: laAnh && quy?.anh_con ? [goc, quy.anh_con] : [goc], ten: tenPhanLoai(tep) };
}

export function kiemQuyTac(thoNho) {
  if (!Array.isArray(thoNho)) return [];
  return thoNho
    .filter((q) => q && typeof q.thu_muc === 'string' && q.thu_muc.trim() && Array.isArray(q.mau))
    .map((q) => ({ thu_muc: q.thu_muc.trim().replace(/[\\/]/g, '-'), mau: q.mau.map(String).filter(Boolean), ...(q.anh_con ? { anh_con: String(q.anh_con).replace(/[\\/]/g, '-') } : {}) }))
    .filter((q) => q.mau.length);
}

export function taoDiaChiDangNhapKho(clientId, goiLai, state) {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: goiLai,
    response_type: 'code',
    scope: ['openid', 'email', QUYEN_DRIVE].join(' '),
    access_type: 'offline',
    // select_account để chọn đúng tài khoản Drive khác, không tự lấy tài khoản đang đăng nhập.
    prompt: 'consent select_account',
    state,
  });
  return `${DIA_CHI_DANG_NHAP}?${q}`;
}

const gioVN = (thoiDiem) => new Date(Date.parse(thoiDiem) + LECH_VN_MS).toISOString().slice(11, 16);

// Một tệp cho mỗi ngày và mỗi nguồn; ghi lại cả ngày mỗi khi có tin mới.
export function vanBanTinNgay(nguon, ngay, tins) {
  const dong = [`# ${nguon === 'gmail' ? 'Thư Gmail' : 'Tin nhắn Zalo'} ngày ${ngay}`, '', `${tins.length} mục, giờ Việt Nam. Lưu tự động từ Sonicplan.`, ''];
  for (const t of tins) {
    dong.push(`## ${gioVN(t.thoi_diem)} - ${t.nguoi_gui || '(không rõ người gửi)'}${t.nhom ? ` (nhóm ${t.nhom})` : ''}`);
    if (t.tieu_de) dong.push(`Tiêu đề: ${t.tieu_de}`);
    dong.push('', cat(t.noi_dung || '', 6000), '');
  }
  return dong.join('\n');
}

// Không ghi giờ hiện tại vào nội dung, để nội dung chỉ đổi khi bộ nhớ thật sự đổi.
export function vanBanBoNho(hoSo, ghiNho) {
  const dong = ['# Bộ nhớ AI', '', 'Lưu tự động từ Sonicplan.', '', '## Hồ sơ', '', hoSo ? hoSo.trim() : '(chưa có)', '', '## Ghi nhớ', ''];
  if (!ghiNho.length) dong.push('(chưa có)');
  for (const loai of Object.keys(NHAN_GHI_NHO)) {
    const muc = ghiNho.filter((g) => g.loai === loai);
    if (!muc.length) continue;
    dong.push(`### ${NHAN_GHI_NHO[loai]}`, '');
    for (const g of muc) dong.push(`- **${g.tieu_de}**${g.ghim ? ' (ghim)' : ''}${g.da_duyet ? '' : ' (chờ duyệt)'}: ${String(g.noi_dung).replace(/\s*\n\s*/g, ' ')}`);
    dong.push('');
  }
  return dong.join('\n');
}

export function vanBanViec(viec) {
  const dong = ['# Việc', '', 'Việc đang mở và việc đóng trong 30 ngày qua. Lưu tự động từ Sonicplan.', ''];
  for (const trangThai of [['mo', 'Đang mở'], ['xong', 'Đã xong'], ['huy', 'Đã hủy']]) {
    const muc = viec.filter((v) => v.trang_thai === trangThai[0]);
    if (!muc.length) continue;
    dong.push(`## ${trangThai[1]} (${muc.length})`, '');
    for (const v of muc) {
      const han = v.han_ngay ? ` - hạn ${v.han_ngay}${v.gio_hen ? ` ${v.gio_hen}` : ''}` : '';
      dong.push(`- ${v.tieu_de}${han}${v.ghi_chu ? `\n  ${String(v.ghi_chu).replace(/\s*\n\s*/g, '\n  ')}` : ''}`);
    }
    dong.push('');
  }
  return dong.join('\n');
}

async function dauVan(chuoi) {
  const bam = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(chuoi));
  return [...new Uint8Array(bam).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Đăng nhập tài khoản Drive kho ----

async function datLaiKho(env, tc) {
  await env.CSDL.prepare('DELETE FROM kho_da_luu WHERE to_chuc_id = ?1').bind(tc).run();
  await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'kho_drive_thu_muc'`).bind(tc).run();
}

export async function hoanTatDangNhapKho(env, tc, code, goiLai) {
  const client = await docTichHop(env, tc, 'google_client');
  if (!client) throw new Error('Chưa khai Client ID và Secret ở thẻ Google.');
  const kq = await doiMa(client, { grant_type: 'authorization_code', code, redirect_uri: goiLai });
  if (!kq.refresh_token) throw new Error('Google không trả khóa làm mới. Gỡ quyền của ứng dụng ở myaccount.google.com/permissions bằng tài khoản Drive đó rồi chọn lại.');
  if (!String(kq.scope || '').includes(QUYEN_DRIVE)) throw new Error('Chưa tick quyền Drive ở màn hình Google. Chọn lại tài khoản và tick quyền Drive.');
  const email = emailTuIdToken(kq.id_token);
  const truoc = await docTichHop(env, tc, 'kho_drive');
  await luuTichHop(env, tc, 'kho_drive', { refresh_token: kq.refresh_token, email, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
  // Đổi sang tài khoản khác thì mã tệp cũ vô nghĩa, lưu lại từ đầu.
  if (!truoc || truoc.email !== email) await datLaiKho(env, tc);
  await ghiTinHieu(env, tc, 'kho', 'Vừa nối xong');
  return email;
}

export async function goKetNoiKho(env, tc) {
  const tk = await docTichHop(env, tc, 'kho_drive');
  if (tk?.refresh_token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tk.refresh_token)}`, { method: 'POST' }).catch(() => {});
  await xoaTichHop(env, tc, 'kho_drive');
  await env.CSDL.prepare('DELETE FROM tin_hieu WHERE to_chuc_id = ?1 AND nguon = ?2').bind(tc, 'kho').run();
}

export async function layTruyCapKho(env, tc) {
  const [client, tk] = [await docTichHop(env, tc, 'google_client'), await docTichHop(env, tc, 'kho_drive')];
  if (!client || !tk) return null;
  if (tk.truy_cap && tk.het_han > Date.now()) return tk.truy_cap;
  const kq = await doiMa(client, { grant_type: 'refresh_token', refresh_token: tk.refresh_token });
  await luuTichHop(env, tc, 'kho_drive', { ...tk, truy_cap: kq.access_token, het_han: Date.now() + (kq.expires_in - 120) * 1000 });
  return kq.access_token;
}

// Ảnh thu nhỏ do Drive tạo (ảnh trang đầu của Word, PDF, Excel, PowerPoint, ảnh thu nhỏ của ảnh).
// Chỉ nhận địa chỉ googleusercontent để không bị dùng làm cầu gọi máy chủ lạ.
export async function layAnhNhoDrive(env, tc, driveId) {
  const token = await layTruyCapKho(env, tc);
  if (!token) return null;
  const f = await goiGoogle(token, `www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?fields=thumbnailLink&supportsAllDrives=true`);
  if (!f.thumbnailLink) return null;
  const u = new URL(f.thumbnailLink);
  if (u.protocol !== 'https:' || !/(^|\.)googleusercontent\.com$/.test(u.hostname)) return null;
  const ph = await goiNgoai(f.thumbnailLink.replace(/=s\d+$/, '=s480'), { headers: { authorization: `Bearer ${token}` } });
  const mime = (ph.headers.get('content-type') || '').split(';')[0];
  if (!ph.ok || !/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return null;
  const bytes = new Uint8Array(await ph.arrayBuffer());
  return bytes.length && bytes.length <= 2 * 1024 * 1024 ? { bytes, mime } : null;
}

// ---- Ghi lên Drive ----

async function thuMucKho(env, tc, token, khoa, con = []) {
  let nho = {};
  try { nho = JSON.parse((await docCaiDat(env, tc, 'kho_drive_thu_muc')) || '{}'); } catch { nho = {}; }
  if (!nho.goc) nho.goc = await taoThuMuc(token, TEN_THU_MUC.goc, null);
  if (!nho[khoa]) nho[khoa] = await taoThuMuc(token, TEN_THU_MUC[khoa], nho.goc);
  let cha = nho[khoa];
  let duong = khoa;
  for (const ten of con) {
    duong += `/${ten}`;
    if (!nho[duong]) nho[duong] = await taoThuMuc(token, ten, cha);
    cha = nho[duong];
  }
  await ghiCaiDat(env, tc, 'kho_drive_thu_muc', JSON.stringify(nho));
  return cha;
}

// Mã thư mục gốc "Sonicplan kho", tạo nếu chưa có.
export async function thuMucGocKho(env, tc, token) {
  let nho = {};
  try { nho = JSON.parse((await docCaiDat(env, tc, 'kho_drive_thu_muc')) || '{}'); } catch { nho = {}; }
  if (!nho.goc) {
    nho.goc = await taoThuMuc(token, TEN_THU_MUC.goc, null);
    await ghiCaiDat(env, tc, 'kho_drive_thu_muc', JSON.stringify(nho));
  }
  return nho.goc;
}

// Công cụ ghi Drive dùng chung cho phần kho theo dự án (truyền vào để hai tệp không gọi vòng nhau).
export const congCuKho = (env, tc) => ({ dauVan, taoTepDrive, ghiNhoDaLuu, vanBanTinNgay, thuMucGocKho: (token) => thuMucGocKho(env, tc, token) });

async function docQuyTac(env, tc) {
  try { return kiemQuyTac(JSON.parse((await docCaiDat(env, tc, 'kho_quy_tac')) || '[]')); } catch { return []; }
}

async function ghiNhoDaLuu(env, tc, loai, ma, driveId, moc) {
  await env.CSDL.prepare(
    `INSERT INTO kho_da_luu (to_chuc_id, loai, ma, drive_id, moc, luc) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (to_chuc_id, loai, ma) DO UPDATE SET drive_id = excluded.drive_id, moc = excluded.moc, luc = excluded.luc`,
  ).bind(tc, loai, ma, driveId, moc, new Date().toISOString()).run();
}

async function taoTepDrive(token, ten, thuMuc, noiDung, loaiTep) {
  const { ranh, thanBody } = thanTaiLen({ name: ten, parents: [thuMuc] }, noiDung, loaiTep);
  const ph = await goiNgoai('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${ranh}` },
    body: thanBody,
  }, { hetGioMs: 60000 });
  const kq = await ph.json().catch(() => ({}));
  if (!ph.ok) throw new Error(`drive ${ph.status}: ${kq.error?.message || ''}`.trim());
  return kq.id;
}

// Lưu một tệp chữ; nếu lần trước đã lưu cùng nội dung thì bỏ qua, đã lưu bản khác thì ghi đè đúng tệp đó.
async function luuVanBan(env, tc, token, { loai, ma, ten, khoaThuMuc, noiDung }) {
  const moc = await dauVan(noiDung);
  const cu = await env.CSDL.prepare('SELECT drive_id, moc FROM kho_da_luu WHERE to_chuc_id = ?1 AND loai = ?2 AND ma = ?3').bind(tc, loai, ma).first();
  if (cu?.drive_id && cu.moc === moc) return false;
  const chu = new TextEncoder().encode(noiDung);
  let id = cu?.drive_id || null;
  if (id) {
    const ph = await goiNgoai(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'text/markdown; charset=UTF-8' },
      body: chu,
    }, { hetGioMs: 30000 });
    if (ph.status === 404) id = null; // người dùng đã xóa tệp trên Drive: tạo lại
    else if (!ph.ok) throw new Error(`drive ${ph.status}`);
  }
  if (!id) id = await taoTepDrive(token, ten, await thuMucKho(env, tc, token, khoaThuMuc), chu, 'text/markdown');
  await ghiNhoDaLuu(env, tc, loai, ma, id, moc);
  return true;
}

// Tệp đính kèm: tải lên đúng thư mục công việc với tên mới; tệp đã lên từ trước thì đổi tên và chuyển chỗ.
async function luuTep(env, tc, token) {
  if (!env.TEP) return 0;
  const quyTac = await docQuyTac(env, tc);
  const ds = (await env.CSDL.prepare(
    `SELECT t.id, t.ten, t.loai, t.kich_thuoc, t.thu_muc, t.r2_khoa, t.tao_luc, t.nguon, n.nhom AS nhom, k.drive_id, k.moc
     FROM tep t LEFT JOIN tin_nhan n ON n.id = t.tin_nhan_id
     LEFT JOIN kho_da_luu k ON k.to_chuc_id = t.to_chuc_id AND k.loai = 'tep' AND k.ma = CAST(t.id AS TEXT)
     WHERE t.to_chuc_id = ?1 AND t.r2_khoa IS NOT NULL ORDER BY t.id DESC LIMIT 300`,
  ).bind(tc).all()).results;
  let xong = 0;
  for (const t of ds) {
    if (xong >= TOI_DA_TEP) break;
    const pl = phanLoaiTep(t, quyTac);
    if (pl.bo_qua) {
      if (t.drive_id == null) await ghiNhoDaLuu(env, tc, 'tep', String(t.id), '', 'bo-qua');
      continue;
    }
    if (t.drive_id === '') continue; // bản gốc không còn hoặc đã bỏ qua
    const khoa = `${pl.duong_dan.join('/')}|${pl.ten}`;
    if (t.drive_id && t.moc === khoa) continue;
    const thuMuc = await thuMucKho(env, tc, token, 'phan_loai', pl.duong_dan);
    let id = t.drive_id || null;
    if (id) {
      try {
        const hien = await goiGoogle(token, `www.googleapis.com/drive/v3/files/${id}?fields=parents`);
        const cu = (hien.parents || []).filter((p) => p !== thuMuc).join(',');
        await goiGoogle(token, `www.googleapis.com/drive/v3/files/${id}?fields=id${cu ? `&removeParents=${cu}` : ''}&addParents=${thuMuc}`, { method: 'PATCH', body: { name: pl.ten } });
      } catch (e) {
        if (e.trangThai !== 404) throw e;
        id = null; // đã bị xóa trên Drive: tải lại
      }
    }
    if (!id) {
      const vat = await env.TEP.get(t.r2_khoa);
      if (!vat) {
        await ghiNhoDaLuu(env, tc, 'tep', String(t.id), '', 'mat');
        continue;
      }
      id = await taoTepDrive(token, pl.ten, thuMuc, await vat.arrayBuffer(), t.loai);
    }
    await ghiNhoDaLuu(env, tc, 'tep', String(t.id), id, khoa);
    xong++;
  }
  return xong;
}

async function luuTin(env, tc, token) {
  const nhom = (await env.CSDL.prepare(
    `SELECT nguon, substr(datetime(thoi_diem, '+7 hours'), 1, 10) AS ngay, COUNT(*) AS n, MAX(id) AS mx
     FROM tin_nhan WHERE to_chuc_id = ?1 AND an = 0 AND nguon IN ('zalo', 'gmail') GROUP BY nguon, ngay ORDER BY ngay DESC LIMIT 400`,
  ).bind(tc).all()).results;
  const daLuu = new Map((await env.CSDL.prepare(`SELECT ma, moc FROM kho_da_luu WHERE to_chuc_id = ?1 AND loai = 'tin_dau'`).bind(tc).all()).results.map((r) => [r.ma, r.moc]));
  const can = nhom.filter((g) => daLuu.get(`${g.nguon}|${g.ngay}`) !== `${g.n}:${g.mx}`).slice(0, TOI_DA_NGAY);
  let xong = 0;
  for (const g of can) {
    const tins = (await env.CSDL.prepare(
      `SELECT nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem FROM tin_nhan
       WHERE to_chuc_id = ?1 AND an = 0 AND nguon = ?2 AND substr(datetime(thoi_diem, '+7 hours'), 1, 10) = ?3 ORDER BY thoi_diem, id`,
    ).bind(tc, g.nguon, g.ngay).all()).results;
    await luuVanBan(env, tc, token, {
      loai: 'tin',
      ma: `${g.nguon}|${g.ngay}`,
      ten: `${g.ngay}_${g.nguon === 'gmail' ? 'Thu' : 'Zalo'}.md`,
      khoaThuMuc: g.nguon === 'gmail' ? 'thu' : 'tin',
      noiDung: vanBanTinNgay(g.nguon, g.ngay, tins),
    });
    // Dấu số tin và mã tin lớn nhất: ngày nào có tin mới thì khác dấu, lần sau lưu lại.
    await ghiNhoDaLuu(env, tc, 'tin_dau', `${g.nguon}|${g.ngay}`, '', `${g.n}:${g.mx}`);
    xong++;
  }
  return xong;
}

async function luuBoNho(env, tc, token) {
  const ghiNho = (await env.CSDL.prepare(
    `SELECT loai, tieu_de, noi_dung, ghim, da_duyet FROM ghi_nho WHERE to_chuc_id = ?1 ORDER BY ghim DESC, id`,
  ).bind(tc).all()).results;
  return (await luuVanBan(env, tc, token, { loai: 'bo_nho', ma: 'bo-nho-ai', ten: 'Bo-nho-AI.md', khoaThuMuc: 'bo_nho', noiDung: vanBanBoNho(await docHoSo(env, tc), ghiNho) })) ? 1 : 0;
}

async function luuViec(env, tc, token) {
  const viec = (await env.CSDL.prepare(
    `SELECT tieu_de, ghi_chu, han_ngay, gio_hen, trang_thai FROM viec
     WHERE to_chuc_id = ?1 AND (trang_thai = 'mo' OR cap_nhat_luc >= ?2) ORDER BY han_ngay IS NULL, han_ngay, id`,
  ).bind(tc, new Date(Date.now() - 30 * 86400000).toISOString()).all()).results;
  return (await luuVanBan(env, tc, token, { loai: 'viec', ma: 'viec', ten: 'Viec.md', khoaThuMuc: 'viec', noiDung: vanBanViec(viec) })) ? 1 : 0;
}

// Chạy mỗi 5 phút cho tổ chức đã nối Drive kho. Lỗi một phần không chặn các phần còn lại.
export async function dongBoKho(env, tc) {
  const token = await layTruyCapKho(env, tc);
  if (!token) return null;
  const kq = { tep: 0, tin: 0, bo_nho: 0, viec: 0, du_an: 0, loi: [] };
  const lam = async (ten, f) => {
    try { await f(); } catch (e) {
      kq.loi.push(`${ten}: ${String(e.message).slice(0, 100)}`);
      // Thư mục bị xóa trên Drive: quên mã đã nhớ để lượt sau tạo lại.
      if (e.trangThai === 404) await env.CSDL.prepare(`DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = 'kho_drive_thu_muc'`).bind(tc).run();
    }
  };
  await lam('Tệp', async () => { kq.tep = await luuTep(env, tc, token); });
  await lam('Tin nhắn và thư', async () => { kq.tin = await luuTin(env, tc, token); });
  await lam('Bộ nhớ AI', async () => { kq.bo_nho = await luuBoNho(env, tc, token); });
  await lam('Việc', async () => { kq.viec = await luuViec(env, tc, token); });
  await lam('Dự án', async () => { const r = await dongBoDuAn(env, tc, token, congCuKho(env, tc)); kq.du_an = r.so; kq.loi.push(...r.loi); });
  const moi = kq.tep + kq.tin + kq.bo_nho + kq.viec + kq.du_an;
  await ghiTinHieu(env, tc, 'kho', kq.loi.length ? `Lỗi ${kq.loi.join('; ')}` : moi ? `Đã lưu ${kq.tep} tệp, ${kq.tin} ngày tin và thư, ${kq.bo_nho} bộ nhớ, ${kq.viec} danh sách việc${kq.du_an ? `, ${kq.du_an} mục dự án` : ''}` : 'Đã đồng bộ, chưa có gì mới');
  return kq;
}
