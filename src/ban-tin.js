// Các bản tin theo giờ: bản tin 8h sáng, nhắc 17h, báo cáo tuần thứ Hai, gợi ý cho việc mới.
// Cả ba cùng chạy mỗi giờ và tự xem giờ Việt Nam; không đúng giờ thì trả bo_qua để khỏi ghi nhật ký.

import { goiYViec, NHOM_THEO_SO } from './ai.js';
import { docCaiDat } from './hop-tin.js';
import { docTichHop } from './tich-hop.js';
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

export async function banTinNgay(env, bayGio) {
  const gio = gioVN(bayGio);
  if (gio !== 8 && gio !== 17) return { bo_qua: true };
  const homNay = ngayVN(bayGio);
  let soBao = 0;
  for (const tc of await cacToChuc(env)) {
    const { results } = await env.CSDL.prepare(
      `SELECT tieu_de, han_ngay, gio_hen FROM viec WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND han_ngay IS NOT NULL`,
    ).bind(tc.id).all();
    let luuY = '';
    if (gio === 8) {
      try {
        const pt = JSON.parse((await docCaiDat(env, tc.id, 'phan_tich_cuoi')) || 'null');
        if (pt && Date.parse(bayGio) - Date.parse(pt.luc) < 24 * 3600000) luuY = pt.noi_dung;
      } catch { /* bỏ qua phân tích hỏng */ }
    }
    const noiDung = dungBanTin(results, homNay, gio === 8, luuY);
    if (noiDung && (await baoToChuc(env, tc.id, noiDung))) soBao++;
  }
  return { so_muc: soBao, ghi_chu: soBao ? `Gửi bản tin cho ${soBao} tổ chức` : 'Không có việc nào cần nhắc' };
}

export async function baoCaoTuan(env, bayGio) {
  const thu = new Date(Date.parse(bayGio) + 7 * 3600000).getUTCDay();
  if (thu !== 1 || gioVN(bayGio) !== 8) return { bo_qua: true };
  const homNay = ngayVN(bayGio);
  const tuan = new Date(Date.parse(bayGio) - 7 * 86400000).toISOString();
  let soBao = 0;
  for (const tc of await cacToChuc(env)) {
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
    if (await baoToChuc(env, tc.id, dong.join('\n'))) soBao++;
  }
  return { so_muc: soBao, ghi_chu: `Gửi báo cáo tuần cho ${soBao} tổ chức` };
}

const SO_LAN_LOI = (ghiChu) => (String(ghiChu || '').match(/\[Gợi ý: lỗi/g) || []).length;
const TOI_DA_GOI_Y = 5;

// Mỗi giờ gợi ý tối đa 5 việc mới, mỗi việc một lần. AI lỗi hai lần thì bỏ hẳn việc đó.
export async function goiYMoi(env, bayGio) {
  let soViec = 0;
  let soLoi = 0;
  for (const tc of await cacToChuc(env)) {
    const { results } = await env.CSDL.prepare(
      `SELECT id, tieu_de, han_ngay, ghi_chu FROM viec
       WHERE to_chuc_id = ?1 AND trang_thai = 'mo' AND tao_luc >= ?2 AND (ghi_chu IS NULL OR ghi_chu NOT LIKE '%[Gợi ý] Nhóm%')
       ORDER BY id DESC LIMIT 40`,
    ).bind(tc.id, new Date(Date.parse(bayGio) - 60 * 86400000).toISOString()).all();
    const chon = results.filter((v) => SO_LAN_LOI(v.ghi_chu) < 2).slice(0, TOI_DA_GOI_Y);
    if (!chon.length) continue;
    const ngoai = await docTichHop(env, tc.id, 'ai');
    for (const v of chon) {
      try {
        const boiCanh = results.filter((x) => x.id !== v.id).map((x) => x.tieu_de);
        const kq = await goiYViec(env, v, boiCanh, { ngoai });
        await env.CSDL.prepare(
          `UPDATE viec SET ghi_chu = COALESCE(ghi_chu || char(10) || char(10), '') || ?3, nhom = ?4, cap_nhat_luc = ?5 WHERE id = ?1 AND to_chuc_id = ?2`,
        ).bind(v.id, tc.id, kq.ghi_them, NHOM_THEO_SO[kq.nhom], bayGio).run();
        await baoToChuc(env, tc.id, `Việc mới: ${v.tieu_de}\n${kq.ghi_them}\n(Đã ghi vào ghi chú của việc)`.slice(0, 3900));
        soViec++;
      } catch (e) {
        console.error('Gợi ý việc lỗi', v.id, e);
        soLoi++;
        const lan = SO_LAN_LOI(v.ghi_chu) + 1;
        await env.CSDL.prepare(
          `UPDATE viec SET ghi_chu = COALESCE(ghi_chu || char(10), '') || ?3 WHERE id = ?1 AND to_chuc_id = ?2`,
        ).bind(v.id, tc.id, `[Gợi ý: lỗi ${gioDayDuVN(bayGio)}]`).run();
        if (lan >= 2) await baoToChuc(env, tc.id, `Không soạn được gợi ý cho việc: ${v.tieu_de} (AI lỗi ${lan} lần). Đã bỏ qua việc này, bạn xem tay giúp.`);
      }
    }
  }
  if (!soViec && !soLoi) return { bo_qua: true };
  return { so_muc: soViec, ghi_chu: `Gợi ý ${soViec} việc${soLoi ? `, lỗi ${soLoi}` : ''}` };
}
