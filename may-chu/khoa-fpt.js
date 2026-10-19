// Khóa FPT AI nhập ở trang Kết nối: mã hóa bằng KHOA_MA_HOA rồi lưu ở một tệp trong thư mục dữ liệu (quyền 0600), không vào D1, mã hay log.
// Khóa lưu ở đây đứng trước biến môi trường FPT_AI_API_KEY; gỡ khóa thì quay về biến môi trường (nếu có).
// env.FPT_AI là getter: đổi khóa có hiệu lực ngay, không cần khởi động lại.
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { giaiMaEnv, maHoa } from '../src/ma-hoa.js';
import { kiemTenMayCongKhai } from '../src/dia-chi-an-toan.js';
import { moAiFpt, FPT_DIA_CHI_MAC_DINH, FPT_MODEL_NHE, FPT_MODEL_MANH } from './ai-fpt.js';

export function moKhoaFpt({ tep, cfg = {}, env, moAi = moAiFpt }) {
  const mac = { diaChi: cfg.FPT_AI_BASE_URL || undefined, modelNhe: cfg.FPT_AI_MODEL || undefined, modelManh: cfg.FPT_AI_MODEL_MANH || undefined };
  let luu = null; // { khoa, dia_chi, model, model_manh } đã giải mã, chỉ nằm trong bộ nhớ
  let ai = moAi({ khoa: cfg.FPT_AI_API_KEY, ...mac });
  let nguon = ai ? 'bien_moi_truong' : null;

  const dung = (c) => moAi({ khoa: c.khoa, diaChi: c.dia_chi || mac.diaChi, modelNhe: c.model || mac.modelNhe, modelManh: c.model_manh || mac.modelManh });
  const ap = (c) => { luu = c; ai = dung(c); nguon = 'giao_dien'; };
  const veBienMoiTruong = () => { luu = null; ai = moAi({ khoa: cfg.FPT_AI_API_KEY, ...mac }); nguon = ai ? 'bien_moi_truong' : null; };

  // Đọc khóa đã lưu lúc khởi động. Lỗi (thiếu hoặc đổi KHOA_MA_HOA) thì ghi rõ và dùng biến môi trường.
  const khoiDong = (async () => {
    let tho;
    try { tho = readFileSync(tep, 'utf8'); } catch { return; }
    try {
      ap(await giaiMaEnv(tho.trim(), env));
    } catch (e) {
      console.error('Không đọc được khóa FPT AI đã lưu (KHOA_MA_HOA đổi?), dùng biến môi trường nếu có:', e.message);
    }
  })();

  return {
    khoiDong,
    lay: () => ai,
    thongTin: () => ({ nguon, dia_chi: luu?.dia_chi || mac.diaChi || FPT_DIA_CHI_MAC_DINH, model: luu?.model || mac.modelNhe || FPT_MODEL_NHE, model_manh: luu?.model_manh || mac.modelManh || FPT_MODEL_MANH }),
    // Kiểm khóa bằng một câu hỏi ngắn trước khi lưu; sai thì ném lỗi, không lưu gì.
    async ghi({ khoa, dia_chi: diaChi, model, model_manh: modelManh }) {
      const k = String(khoa || '').trim();
      if (k.length < 20) throw new Error('Khóa API không đúng, chép nguyên chuỗi FPT đưa.');
      if (!env.KHOA_MA_HOA) throw new Error('Máy chủ chưa có KHOA_MA_HOA nên chưa lưu khóa được.');
      const dc = String(diaChi || '').trim().replace(/\/+$/, '');
      if (dc) {
        if (!/^https:\/\/[^\s]+$/.test(dc)) throw new Error('Địa chỉ phải bắt đầu bằng https://');
        try { kiemTenMayCongKhai(dc); } catch (e) { throw new Error(e.message.replace('Địa chỉ ', 'Địa chỉ dịch vụ ')); }
      }
      const c = { khoa: k, ...(dc ? { dia_chi: dc } : {}), ...(String(model || '').trim() ? { model: String(model).trim() } : {}), ...(String(modelManh || '').trim() ? { model_manh: String(modelManh).trim() } : {}) };
      const thu = dung(c);
      const tra = await thu.chay([{ role: 'user', content: 'Trả lời đúng một chữ: ok' }], { maxTokens: 64, nhietDo: 0 });
      if (!String(tra).trim()) throw new Error('FPT AI không trả lời.');
      mkdirSync(dirname(tep), { recursive: true });
      writeFileSync(`${tep}.tmp`, await maHoa(c, env.KHOA_MA_HOA), { mode: 0o600 });
      renameSync(`${tep}.tmp`, tep);
      try { chmodSync(tep, 0o600); } catch { /* hệ tệp không hỗ trợ quyền */ }
      ap(c);
    },
    xoa() {
      try { writeFileSync(tep, '', { mode: 0o600 }); } catch { /* chưa có tệp thì thôi */ }
      veBienMoiTruong();
    },
  };
}
