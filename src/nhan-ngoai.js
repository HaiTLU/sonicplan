// Địa chỉ cho dịch vụ khác (Zapier, Make, biểu mẫu, Apps Script) gửi việc vào: POST /nhan/viec kèm mã riêng.
// Mã chỉ lưu dạng băm ở cai_dat, hiện đúng một lần khi tạo.

import { kiemViec } from './api.js';
import { docCaiDat, ghiCaiDat, ghiTinHieu } from './hop-tin.js';
import { bam, json, loi, maNgauNhien } from './tien-ich.js';
import { themViec, xuLyVanBanTrucTiep } from './viec.js';

const KHOA_BAM = 'nhan_viec_bam';

export async function taoMaNhanViec(env, tc) {
  const ma = maNgauNhien(40);
  await ghiCaiDat(env, tc, KHOA_BAM, await bam(ma));
  return ma;
}

export function goMaNhanViec(env, tc) {
  return env.CSDL.prepare('DELETE FROM cai_dat WHERE to_chuc_id = ?1 AND khoa = ?2').bind(tc, KHOA_BAM).run();
}

export async function coMaNhanViec(env, tc) {
  return Boolean(await docCaiDat(env, tc, KHOA_BAM));
}

function layMa(yeuCau) {
  const m = (yeuCau.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return (m ? m[1] : yeuCau.headers.get('x-sonicplan-key') || '').trim();
}

// Hai dạng gửi vào:
//  - { tieu_de, han_ngay?, gio_hen?, ghi_chu? }: tạo việc ngay, trả { id, trung }.
//  - { noi_dung, nguoi_gui? }: văn bản tự do, AI đọc như một tin, trả 202.
export async function nhanViecNgoai(yeuCau, env, ctx) {
  if (yeuCau.method !== 'POST') return loi(405, 'Dùng POST.');
  const ma = layMa(yeuCau);
  if (ma.length < 20) return loi(401, 'Thiếu mã. Gửi kèm Authorization: Bearer <mã>.');
  const dong = await env.CSDL.prepare('SELECT to_chuc_id FROM cai_dat WHERE khoa = ?1 AND gia_tri = ?2').bind(KHOA_BAM, await bam(ma)).first();
  if (!dong) return loi(401, 'Mã không đúng hoặc đã bị gỡ. Tạo mã mới ở trang Kết nối.');
  const tc = dong.to_chuc_id;
  const than = await yeuCau.json().catch(() => null);
  if (!than || typeof than !== 'object') return loi(400, 'Gửi JSON, ví dụ {"tieu_de":"Nộp báo cáo","han_ngay":"2026-10-15"}.');

  if (than.tieu_de) {
    const k = kiemViec(than, { batBuocTieuDe: true });
    if (k.loi) return loi(400, k.loi);
    const r = await themViec(env, tc, { ...k.viec, han_ngay: k.viec.han_ngay ?? null, gio_hen: k.viec.gio_hen ?? null });
    await ghiTinHieu(env, tc, 'api-vao', `Nhận việc: ${k.viec.tieu_de.slice(0, 60)}`);
    return json({ id: r.id, trung: r.trung }, r.trung ? 200 : 201);
  }
  const noiDung = String(than.noi_dung || than.text || '').trim();
  if (noiDung.length < 4) return loi(400, 'Gửi tieu_de (tạo việc ngay) hoặc noi_dung (để AI đọc).');
  ctx.waitUntil(
    xuLyVanBanTrucTiep(env, tc, { nguon: 'api', nguoi_gui: String(than.nguoi_gui || 'Dịch vụ ngoài').slice(0, 100), noi_dung: noiDung })
      .then((kq) => ghiTinHieu(env, tc, 'api-vao', kq.tat ? 'Khâu tách việc đang tắt' : `AI đọc tin, ${kq.viec.filter((v) => !v.trung).length} việc mới`))
      .catch((e) => ghiTinHieu(env, tc, 'api-vao', `Lỗi: ${String(e.message).slice(0, 100)}`)),
  );
  return json({ da_nhan: true }, 202);
}
