// Nhận thư qua HTTP cho máy chủ Node: Email Worker nhỏ (email-worker/) nhận thư từ Cloudflare Email Routing
// rồi POST thư thô tới /nhan/thu, vì hàm email() của Worker chỉ chạy trên Cloudflare.
// Tự kiểm bằng mã THU_MA (Bearer), không qua Access. Chưa đặt THU_MA thì từ chối hết.

import { nhanThu } from './nhan-thu.js';
import { bam, json, loi } from './tien-ich.js';

const TOI_DA = 25 * 1024 * 1024;

const giaiMa = (s) => {
  try {
    return decodeURIComponent(s || '');
  } catch {
    return '';
  }
};

export async function nhanThuQuaHttp(yeuCau, env, ctx) {
  if (yeuCau.method !== 'POST') return loi(405, 'Dùng POST.');
  const m = (yeuCau.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  const ma = (m ? m[1] : '').trim();
  if (!env.THU_MA || String(env.THU_MA).length < 20 || ma.length < 20 || (await bam(ma)) !== (await bam(env.THU_MA))) {
    return loi(401, 'Sai mã.');
  }
  const raw = new Uint8Array(await yeuCau.arrayBuffer());
  if (!raw.byteLength) return loi(400, 'Thư rỗng.');
  if (raw.byteLength > TOI_DA) return json({ tu_choi: 'Thư quá lớn.' });
  let tuChoi = null;
  const thu = {
    to: giaiMa(yeuCau.headers.get('x-thu-to')),
    from: giaiMa(yeuCau.headers.get('x-thu-from')),
    raw,
    setReject: (ly) => {
      tuChoi = ly;
    },
  };
  await nhanThu(thu, env, ctx);
  return json(tuChoi ? { tu_choi: tuChoi } : { ok: true });
}
