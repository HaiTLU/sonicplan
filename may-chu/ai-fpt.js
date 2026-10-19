// Gọi AI qua FPT AI Marketplace (serverless inference, tương thích OpenAI chat completions) cho mọi tác vụ AI của máy chủ trên Mac.
// Khóa chỉ đọc từ biến môi trường FPT_AI_API_KEY, không ghi vào mã, nhật ký hay cơ sở dữ liệu. Thiếu khóa thì không mở lớp này (moAiFpt trả undefined).
// Lỗi (sai khóa, hết hạn mức, quá giờ, trả lời cụt) thì ném lỗi để chayAi báo rõ và quay về Claude.
// Tài liệu: https://docs.fptcloud.com/docs/fpt-ai-factory/services/serverless-inference/tutorials/call-the-api/
import { kiemDiaChiTruocGoi } from '../src/dia-chi-an-toan.js';

export const FPT_DIA_CHI_MAC_DINH = 'https://mkp-api.fptcloud.com/v1';
// Chưa kiểm bằng khóa thật: tên model phải trùng danh mục model của tài khoản FPT, đổi bằng FPT_AI_MODEL và FPT_AI_MODEL_MANH.
export const FPT_MODEL_NHE = 'gemma-3-27b-it';
export const FPT_MODEL_MANH = 'gpt-oss-120b';

// Tên model Claude mà chỗ gọi truyền vào (haiku, sonnet...) đổi thành bậc nhẹ hay mạnh: Haiku hoặc không nêu = nhẹ, còn lại = mạnh.
export function chonBac(model) {
  const m = String(model || '').toLowerCase();
  return /sonnet|opus|fable/.test(m) ? 'manh' : 'nhe';
}

// Bỏ phần suy nghĩ <think>...</think> của model suy luận, giữ phần trả lời.
export function boSuyNghi(chu) {
  return String(chu || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
}

export function moAiFpt({ khoa, diaChi = FPT_DIA_CHI_MAC_DINH, modelNhe = FPT_MODEL_NHE, modelManh = FPT_MODEL_MANH, hetGioMs = 90000, toiDaCungLuc = 3, fetchHam = fetch }) {
  const k = String(khoa || '').trim();
  if (!k) return undefined;
  const goc = String(diaChi || FPT_DIA_CHI_MAC_DINH).trim().replace(/\/+$/, '');
  let khongCoJson = false; // gateway từ chối response_format một lần thì thôi gửi, khỏi tốn thêm lần gọi lỗi
  let dangChay = 0;
  const hangCho = [];
  const xinLuot = () => (dangChay < toiDaCungLuc ? (dangChay++, Promise.resolve()) : new Promise((r) => hangCho.push(r)));
  const traLuot = () => { const r = hangCho.shift(); if (r) r(); else dangChay--; };

  async function goi(model, messages, { maxTokens, nhietDo, json }) {
    const guiMot = async (coJson) => {
      const t0 = Date.now();
      const ph = await fetchHam(`${goc}/chat/completions`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${k}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: nhietDo, ...(coJson ? { response_format: { type: 'json_object' } } : {}) }),
        signal: AbortSignal.timeout(hetGioMs),
      });
      const d = await ph.json().catch(() => ({}));
      return { ph, d, giay: Math.round((Date.now() - t0) / 100) / 10 };
    };
    let r = await guiMot(json && !khongCoJson);
    if (!r.ph.ok && json && !khongCoJson && (r.ph.status === 400 || r.ph.status === 422)) {
      khongCoJson = true;
      console.error(`FPT AI ${model} không nhận response_format (${r.ph.status}), từ nay gọi không kèm`);
      r = await guiMot(false);
    }
    if (!r.ph.ok) {
      const goiY = r.ph.status === 401 ? 'Khóa sai hoặc đã bị thu hồi.' : r.ph.status === 403 ? 'Khóa không được dùng model này.' : r.ph.status === 404 ? 'Sai tên model hoặc địa chỉ.' : r.ph.status === 429 ? 'Hết hạn mức hoặc hết số dư, thử lại sau.' : '';
      throw new Error(`FPT AI từ chối (${r.ph.status}). ${goiY} ${String(r.d?.error?.message || r.d?.message || '').slice(0, 150)}`.replace(/\s+/g, ' ').trim());
    }
    const u = r.d.usage || {};
    console.log(`Token FPT AI ${model}: vào ${u.prompt_tokens ?? '?'}, ra ${u.completion_tokens ?? '?'}, ${r.giay} giây`);
    return { chu: boSuyNghi(r.d.choices?.[0]?.message?.content), cat: r.d.choices?.[0]?.finish_reason === 'length' };
  }

  return {
    ten: `FPT AI (${modelNhe} / ${modelManh})`,
    // messages: [{ role, content }]. tuyChon.model: tên Claude do chỗ gọi truyền (chọn bậc), maxTokens, nhietDo, khuon (có thì xin JSON).
    async chay(messages, { model, maxTokens = 1500, nhietDo = 0.1, khuon = false } = {}) {
      await kiemDiaChiTruocGoi(goc);
      const mo = chonBac(model) === 'manh' ? modelManh : modelNhe;
      await xinLuot();
      try {
        let kq = await goi(mo, messages, { maxTokens, nhietDo, json: Boolean(khuon) });
        if (kq.cat) kq = await goi(mo, messages, { maxTokens: maxTokens * 2, nhietDo, json: Boolean(khuon) }); // cụt thì hỏi lại một lần với gấp đôi
        if (kq.cat) throw new Error(`FPT AI trả lời bị cắt giữa chừng (quá ${maxTokens * 2} token)`);
        if (!kq.chu) throw new Error('FPT AI trả lời rỗng');
        return kq.chu;
      } finally {
        traLuot();
      }
    },
  };
}
