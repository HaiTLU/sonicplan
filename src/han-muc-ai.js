// Hạn mức ngày của Workers AI (gói miễn phí 10.000 neuron/ngày, đặt lại 0:00 UTC = 7:00 giờ Việt Nam).
// Hết hạn mức thì mọi lần gọi trong ngày đều lỗi 429, nên ghi lại để dừng gọi tới lúc đặt lại, giữ tin ở hàng chờ
// thay vì bỏ, và hiện lên trang Tổng quan. Sự cố 16/10/2026: bản thật hết hạn mức lúc 04:45 UTC, tin chờ quá 6 giờ bị bỏ.

import { docCaiDat, ghiCaiDat } from './hop-tin.js';

export const KHOA_HET_HAN_MUC = 'ai_het_han_muc_den';

// Lỗi 429 của Workers AI báo hết hạn mức ngày; lỗi 429 vì gọi dồn dập (không có chữ này) vẫn là lỗi tạm thời.
const DAU_HET_HAN_MUC = /daily free allocation|used up your daily|exceeded your daily/i;

export function laHetHanMucNgay(loi) {
  return Boolean(loi?.hetHanMuc) || DAU_HET_HAN_MUC.test(String(loi?.message ?? loi ?? ''));
}

// Lỗi ném ra khi đang tạm dừng: chưa gọi Workers AI lần nào, nên người gọi không coi là sự cố mới.
export class TamDungHanMuc extends Error {
  constructor(den) {
    super(`Workers AI đã hết hạn mức ngày, tạm dừng gọi tới ${den}`);
    this.hetHanMuc = true;
    this.tamDung = true;
    this.den = den;
  }
}

// Lần đặt lại kế tiếp: 0:00 UTC của ngày sau.
export function lucDatLaiHanMuc(bayGio = new Date()) {
  const d = new Date(bayGio);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString();
}

// Mốc đặt lại nếu đang tạm dừng, không thì null.
export async function docHetHanMuc(env, bayGio = new Date()) {
  if (!env?.CSDL) return null;
  const den = await docCaiDat(env, '', KHOA_HET_HAN_MUC).catch(() => null);
  return den && Date.parse(den) > new Date(bayGio).getTime() ? den : null;
}

export async function ghiHetHanMuc(env, bayGio = new Date()) {
  const den = lucDatLaiHanMuc(bayGio);
  if (env?.CSDL) await ghiCaiDat(env, '', KHOA_HET_HAN_MUC, den).catch((e) => console.error('Ghi mốc hết hạn mức lỗi', e));
  return den;
}

// "7:00 ngày 17/10" (giờ Việt Nam) cho dòng báo trên giao diện.
export function moTaLucDatLai(den) {
  const vn = new Date(Date.parse(den) + 7 * 3600000);
  return `${String(vn.getUTCHours()).padStart(2, '0')}:${String(vn.getUTCMinutes()).padStart(2, '0')} ngày ${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
}
