// Các bản tin theo giờ: bản tin 8h sáng, nhắc 17h, báo cáo tuần thứ Hai, gợi ý cho việc mới.
// Cả ba cùng chạy mỗi giờ và tự xem giờ Việt Nam; không đúng giờ thì trả bo_qua để khỏi ghi nhật ký.

import { goiYViec, NHOM_THEO_SO } from './ai.js';
import { keHoachNgayAi, phanTichTuanAi } from './ai.js';
import { docCaiDat } from './hop-tin.js';
import { docLuong } from './luong.js';
import { docTichHop } from './tich-hop.js';
import { docHoSo, ghiNhoChoAi } from './ghi-nho.js';
import { laViecRo } from './viec.js';
import { baoToChuc } from './telegram.js';
import { congNgay, gioVN, ngayVN } from './tien-ich.js';

export async function cacToChuc(env) {
  const { results } = await env.CSDL.prepare('SELECT id, ten FROM to_chuc').all();
  return results;
}

const ngayNgan = (ngay) => `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}`;
const dongViec = (v) => `- ${v.tieu_de}${v.han_ngay ? ` (hạn ${ngayNgan(v.han_ngay)}${v.gio_hen ? ` ${v.gio_hen}` : ''})` : ''}`;
const khoi = (tieuDe, ds) => (ds.length ? `${tieuDe} (${ds.length}):\n${ds.map(dongViec).join('\n')}` : '');

// "HH:mm dd/MM" theo giờ Việt Nam.
export function gioDayDuVN(iso) {
  const d = new Date(Date.parse(iso) + 7 * 3600000).toISOString();
  return `${d.slice(11, 16)} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

// Dựng nội dung bản tin. 8h: quá hạn, hạn hôm nay, hạn trong 3 ngày tới. 17h: chỉ quá hạn và hạn hôm nay.
// Không có khối nào thì trả chuỗi rỗng (không gửi).
export function dungBanTin(viec, homNay, buoiSang, luuY = '') {
  const co = viec.filter((v) => v.han_ngay).sort((a, b) => a.han_ngay.localeCompare(b.han_ngay));
  const qua = co.filter((v) => v.han_ngay < homNay);
  const nay = co.filter((v) => v.han_ngay === homNay);
  const sap = co.filter((v) => v.han_ngay > homNay && v.han_ngay <= congNgay(homNay, 3));
  const cacKhoi = [khoi('Quá hạn', qua), khoi('Hạn hôm nay', nay), buoiSang ? khoi('Đến hạn trong 3 ngày tới', sap) : ''].filter(Boolean);
  if (!cacKhoi.length) return '';
  if (buoiSang && luuY) cacKhoi.push(`Lưu ý từ tin mới:\n${luuY}`);
  return `${buoiSang ? `Bản tin sáng ${ngayNgan(homNay)}` : 'Việc còn mở cuối ngày'}\n\n${cacKhoi.join('\n\n')}`;
}

export async function banTinNgay(env, bayGio, { ep = false } = {}) {
  const gio = gioVN(bayGio);
  const homNay = ngayVN(bayGio);
  let soBao = 0;
  let coGio = false;
  for (const tc of await cacToChuc(env)) {
    const lg = await docLuong(env, tc.id);
    const sang = ep || gio === lg.nguong.gio_ban_tin;
    if (!lg.bat['ban-tin'] || (!sang && gio !== lg.nguong.gio_nhac_chieu)) continue;
    coGio = true;
    const { results } = await env.CSDL.prepare(
      `SELECT tieu_de, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay IS NOT NULL`,
    ).bind(tc.id).all();
    let luuY = '';
    if (sang) {
      try {
        const pt = JSON.parse((await docCaiDat(env, tc.id, 'phan_tich_cuoi')) || 'null');
        if (pt && Date.parse(bayGio) - Date.parse(pt.luc) < 24 * 3600000) luuY = pt.noi_dung;
      } catch { /* bỏ qua phân tích hỏng */ }
    }
    let noiDung = dungBanTin(results, homNay, sang, luuY);
    // Kế hoạch trong ngày do AI lập; AI lỗi thì bản tin vẫn gửi như cũ.
    if (sang && noiDung) {
      try {
        const [moRong, gn] = await Promise.all([
          env.CSDL.prepare(`SELECT tieu_de, han_ngay, gio_hen, uu_tien FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' ORDER BY han_ngay IS NULL, han_ngay, gio_hen LIMIT 40`).bind(tc.id).all(),
          ghiNhoChoAi(env, tc.id, results.map((v) => v.tieu_de).join(' ')),
        ]);
        const keHoach = await keHoachNgayAi(env, moRong.results, gn, homNay, { ngoai: await docTichHop(env, tc.id, 'ai'), hoSo: await docHoSo(env, tc.id) });
        if (keHoach) noiDung += `\n\nKế hoạch hôm nay:\n${keHoach}`;
      } catch (e) {
        console.error('Lập kế hoạch ngày lỗi', e);
      }
    }
    if (noiDung && (await baoToChuc(env, tc.id, noiDung))) soBao++;
  }
  if (!coGio) return { bo_qua: true };
  return { so_muc: soBao, ghi_chu: soBao ? `Gửi bản tin cho ${soBao} tổ chức` : 'Không có việc nào cần nhắc' };
}

export async function baoCaoTuan(env, bayGio, { ep = false } = {}) {
  const thu = new Date(Date.parse(bayGio) + 7 * 3600000).getUTCDay();
  if (thu !== 1 && !ep) return { bo_qua: true };
  const homNay = ngayVN(bayGio);
  const tuan = new Date(Date.parse(bayGio) - 7 * 86400000).toISOString();
  let soBao = 0;
  let coGio = false;
  for (const tc of await cacToChuc(env)) {
    const lg = await docLuong(env, tc.id);
    if (!lg.bat['bao-cao-tuan'] || (!ep && gioVN(bayGio) !== lg.nguong.gio_ban_tin)) continue;
    coGio = true;
    const dem = (dieuKien, ...thamSo) =>
      env.CSDL.prepare(`SELECT COUNT(*) AS n FROM viec WHERE to_chuc_id = ?1 AND ${dieuKien}`).bind(tc.id, ...thamSo).first().then((r) => r.n);
    const [xong, mo, qua, tuTin, loiGoiY] = await Promise.all([
      dem(`trang_thai = 'xong' AND xong_luc >= ?2`, tuan),
      dem(`trang_thai = 'mo'`),
      dem(`trang_thai = 'mo' AND han_ngay < ?2`, homNay),
      dem(`tin_nhan_id IS NOT NULL AND tao_luc >= ?2`, tuan),
      env.CSDL.prepare(
        `SELECT tieu_de FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND ghi_chu LIKE '%[Gợi ý: lỗi%[Gợi ý: lỗi%' LIMIT 5`,
      ).bind(tc.id).all(),
    ]);
    const zalo = await env.CSDL.prepare(`SELECT lan_cuoi FROM tin_hieu WHERE to_chuc_id = ?1 AND nguon = 'zalo'`).bind(tc.id).first();
    let tinHieu = 'chưa có dữ liệu';
    if (zalo?.lan_cuoi) {
      const gioIm = Math.floor((Date.parse(bayGio) - Date.parse(zalo.lan_cuoi)) / 3600000);
      tinHieu = `${gioDayDuVN(zalo.lan_cuoi)}${gioIm >= 6 ? ` (đã ${gioIm} tiếng, kiểm tra máy Mac)` : ' (bình thường)'}`;
    }
    const dong = [
      `Báo cáo tuần (${ngayNgan(congNgay(homNay, -7))} - ${ngayNgan(homNay)})`,
      '',
      'Việc:',
      `- Xong trong tuần: ${xong}`,
      `- Còn mở: ${mo}, trong đó quá hạn: ${qua}`,
      `- Việc mới tách từ tin trong tuần: ${tuTin}`,
      '',
      `Zalo: máy Mac gửi tín hiệu lần cuối ${tinHieu}`,
    ];
    if (loiGoiY.results.length) dong.push('', `Việc AI không soạn được gợi ý (${loiGoiY.results.length}): ${loiGoiY.results.map((v) => v.tieu_de).join('; ')}`);
    // Phân tích tuần do AI viết từ số liệu thật; lỗi thì báo cáo vẫn gửi phần số liệu.
    try {
      const [muon, quaHan, nguoi, duAn] = await env.CSDL.batch([
        env.CSDL.prepare(`SELECT tieu_de FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'xong' AND xong_luc >= ?2 AND han_ngay IS NOT NULL AND date(datetime(xong_luc, '+7 hours')) > han_ngay LIMIT 8`).bind(tc.id, tuan),
        env.CSDL.prepare(`SELECT tieu_de FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay < ?2 ORDER BY han_ngay LIMIT 8`).bind(tc.id, homNay),
        env.CSDL.prepare(`SELECT t.nguoi_gui AS ten, COUNT(*) AS so FROM viec v JOIN tin_nhan t ON t.id = v.tin_nhan_id WHERE v.to_chuc_id = ?1 AND v.tao_luc >= ?2 AND COALESCE(t.nguoi_gui, '') <> '' GROUP BY t.nguoi_gui ORDER BY so DESC LIMIT 4`).bind(tc.id, tuan),
        env.CSDL.prepare(`SELECT tieu_de FROM ghi_nho WHERE to_chuc_id = ?1 AND loai = 'du_an' AND cap_nhat_luc < ?2 LIMIT 6`).bind(tc.id, tuan),
      ]);
      const pt = await phanTichTuanAi(env, { xong, mo, qua, xong_muon: muon.results.map((v) => v.tieu_de), qua_han: quaHan.results.map((v) => v.tieu_de), nguoi_giao_nhieu_viec: nguoi.results, du_an_khong_cap_nhat_tuan_nay: duAn.results.map((v) => v.tieu_de) }, { ngoai: await docTichHop(env, tc.id, 'ai'), hoSo: await docHoSo(env, tc.id) });
      if (pt) dong.push('', `Phân tích:\n${pt}`);
    } catch (e) {
      console.error('Phân tích tuần lỗi', e);
    }
    if (await baoToChuc(env, tc.id, dong.join('\n'))) soBao++;
  }
  if (!coGio) return { bo_qua: true };
  return { so_muc: soBao, ghi_chu: `Gửi báo cáo tuần cho ${soBao} tổ chức` };
}

const NHAN_NGAN = { 1: 'AI tự làm', 2: 'AI chuẩn bị, bạn quyết định', 3: 'bạn tự làm' };
const SO_LAN_LOI = (ghiChu) => (String(ghiChu || '').match(/\[Gợi ý: lỗi/g) || []).length;

// Mỗi giờ gợi ý tối đa 5 việc mới, mỗi việc một lần. AI lỗi hai lần thì bỏ hẳn việc đó.
export async function goiYMoi(env, bayGio) {
  let soViec = 0;
  let soLoi = 0;
  for (const tc of await cacToChuc(env)) {
    const lg = await docLuong(env, tc.id);
    if (!lg.bat['goi-y']) continue;
    const { results } = await env.CSDL.prepare(
      `SELECT id, tieu_de, han_ngay, ghi_chu FROM viec
       WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tao_luc >= ?2 AND (ghi_chu IS NULL OR ghi_chu NOT LIKE '%[Gợi ý] Nhóm%')
       ORDER BY id DESC LIMIT 40`,
    ).bind(tc.id, new Date(Date.parse(bayGio) - 60 * 86400000).toISOString()).all();
    // Việc quá mơ hồ (tên một chữ, không hạn, không ghi chú) không phải việc thật: bỏ qua, không gợi ý.
    const chon = results.filter((v) => laViecRo(v) && SO_LAN_LOI(v.ghi_chu) < 2).slice(0, lg.nguong.goi_y_toi_da);
    if (!chon.length) continue;
    const ngoai = await docTichHop(env, tc.id, 'ai');
    const hoSo = await docHoSo(env, tc.id);
    const dong = [];
    for (const v of chon) {
      try {
        const boiCanh = results.filter((x) => x.id !== v.id).map((x) => x.tieu_de);
        const kq = await goiYViec(env, v, boiCanh, { ngoai, hoSo });
        await env.CSDL.prepare(
          `UPDATE viec SET ghi_chu = COALESCE(ghi_chu || char(10) || char(10), '') || ?3, nhom = ?4, cap_nhat_luc = ?5 WHERE id = ?1 AND to_chuc_id = ?2`,
        ).bind(v.id, tc.id, kq.ghi_them, NHOM_THEO_SO[kq.nhom], bayGio).run();
        const buoc = /^1\. (.+)$/m.exec(kq.ghi_them)?.[1];
        dong.push(`- ${v.tieu_de}${v.han_ngay ? ` (hạn ${v.han_ngay})` : ''}: ${NHAN_NGAN[kq.nhom] || 'xem trong ghi chú'}${buoc ? `. Bước tiếp: ${buoc}` : ''}`);
        soViec++;
      } catch (e) {
        console.error('Gợi ý việc lỗi', v.id, e);
        soLoi++;
        await env.CSDL.prepare(
          `UPDATE viec SET ghi_chu = COALESCE(ghi_chu || char(10), '') || ?3 WHERE id = ?1 AND to_chuc_id = ?2`,
        ).bind(v.id, tc.id, `[Gợi ý: lỗi ${gioDayDuVN(bayGio)}]`).run();
      }
    }
    // Một tin gộp cho cả lượt, chỉ việc thật và bước tiếp theo. Lỗi AI chỉ ghi vào Nhật ký, không nhắn.
    if (dong.length) await baoToChuc(env, tc.id, `Việc mới (${dong.length}):\n${dong.join('\n')}`.slice(0, 3900));
  }
  if (!soViec && !soLoi) return { bo_qua: true };
  return { so_muc: soViec, ghi_chu: `Gợi ý ${soViec} việc${soLoi ? `, lỗi ${soLoi}` : ''}` };
}
