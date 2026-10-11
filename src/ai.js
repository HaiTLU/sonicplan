// Tách việc từ tin nhắn và tóm tắt tin. Mặc định dùng Workers AI của Cloudflare, không cần khóa.
// Tổ chức dán khóa Claude hoặc loại tương thích OpenAI ở trang Kết nối thì dùng dịch vụ đó,
// lỗi thì tự quay về Workers AI. Đổi mô hình mặc định bằng biến AI_MODEL trong wrangler.jsonc.

import { chayAiNgoai } from './tich-hop.js';

const MO_HINH_MAC_DINH = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const KHUON_VIEC = {
  type: 'object',
  properties: {
    viec: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tieu_de: { type: 'string' },
          han_ngay: { type: ['string', 'null'] },
          gio_hen: { type: ['string', 'null'] },
          ghi_chu: { type: ['string', 'null'] },
          tin_so: { type: ['integer', 'null'] },
        },
        required: ['tieu_de'],
      },
    },
  },
  required: ['viec'],
};

export function moHinh(env) {
  return env.AI_MODEL || MO_HINH_MAC_DINH;
}

// tin: [{ so, nguon, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem }]. homNay: 'YYYY-MM-DD' giờ VN.
export function loiNhacTachViec(tin, homNay, tenNguoiDung, daCo = []) {
  const he = [
    `Bạn là trợ lý của ${tenNguoiDung || 'người dùng'}. Đầu vào là một lô tin từ Zalo hoặc thư. Mỗi tin có nguồn, người gửi ("Tôi" là chính người dùng), giờ gửi và nội dung.`,
    'Chỉ lấy những gì liên quan đến người dùng: việc giao cho họ, việc họ hứa làm, cuộc họp hoặc hẹn họ cần dự. Thư gửi nhiều người thì chỉ lấy phần giao cho họ hoặc cho tất cả người nhận. Bỏ qua việc của người khác, chào hỏi, cảm ơn, quảng cáo, bản tin, thông báo tự động, hóa đơn, trừ khi có hạn họ phải làm. Chỉ dùng thông tin có trong tin, không suy diễn.',
    `Hôm nay là ${homNay} (giờ Việt Nam). Hiểu "mai", "thứ Sáu", "tuần sau" theo giờ gửi của tin đó, đổi sang ngày cụ thể dạng YYYY-MM-DD.`,
    'gio_hen dạng HH:MM 24 giờ nếu tin nêu giờ cụ thể (ví dụ "trước 14h chiều nay" thì 14:00, "2h chiều" thì 14:00), không nêu thì null.',
    'tieu_de ngắn gọn, bắt đầu bằng động từ, tiếng Việt, không biểu tượng, tối đa 80 ký tự.',
    'ghi_chu: với Zalo ghi tên cuộc trò chuyện và người gửi; với thư ghi 1-2 câu tóm tắt ngữ cảnh (ai yêu cầu, để làm gì, chi tiết như địa điểm, số lượng, tài liệu hoặc tệp đính kèm), rồi ghi "Nguồn: thư của <người gửi>, tiêu đề <tiêu đề>".',
    'Danh sách "Đã có sẵn" là việc đã nằm trong danh sách việc của người dùng. Nếu một việc trong tin có cùng nội dung với mục đã có, dù diễn đạt khác, thì KHÔNG trích lại. Chỉ trích lại khi tin nêu thông tin mới (đổi giờ, đổi hạn, việc khác hẳn).',
    'tin_so là số thứ tự của tin chứa việc. Không có việc nào thì trả mảng rỗng. Chỉ trả JSON.',
  ].join('\n');
  const noiDung = tin
    .map((t) => {
      const dau = [`[${t.so}]`, t.nguon === 'zalo' ? 'Zalo' : 'Thư', t.thoi_diem, t.nhom ? `nhóm "${t.nhom}"` : '', `từ ${t.nguoi_gui || 'không rõ'}`]
        .filter(Boolean)
        .join(' ');
      return `${dau}\n${t.tieu_de ? `Tiêu đề: ${t.tieu_de}\n` : ''}${String(t.noi_dung || '').slice(0, 3000)}`;
    })
    .join('\n\n---\n\n');
  const co = daCo.length ? `\n\nĐã có sẵn (${Math.min(daCo.length, 80)} việc gần đây):\n${JSON.stringify(daCo.slice(0, 80))}` : '';
  return [
    { role: 'system', content: he },
    { role: 'user', content: noiDung + co },
  ];
}

// Đọc kết quả mô hình; mô hình đôi khi trả chuỗi có chữ thừa quanh JSON.
export function docKetQuaViec(phanHoi) {
  let du = phanHoi?.response ?? phanHoi;
  if (typeof du === 'string') {
    const dau = du.indexOf('{');
    const cuoi = du.lastIndexOf('}');
    if (dau < 0 || cuoi < dau) return [];
    try {
      du = JSON.parse(du.slice(dau, cuoi + 1));
    } catch {
      return [];
    }
  }
  const ds = Array.isArray(du?.viec) ? du.viec : [];
  return ds
    .filter((v) => v && typeof v.tieu_de === 'string' && v.tieu_de.trim())
    .map((v) => ({
      tieu_de: v.tieu_de.trim().slice(0, 200),
      han_ngay: /^\d{4}-\d{2}-\d{2}$/.test(v.han_ngay || '') ? v.han_ngay : null,
      gio_hen: /^([01]\d|2[0-3]):[0-5]\d$/.test(v.gio_hen || '') ? v.gio_hen : null,
      ghi_chu: typeof v.ghi_chu === 'string' ? v.ghi_chu.slice(0, 1000) : null,
      tin_so: Number.isInteger(v.tin_so) ? v.tin_so : null,
    }));
}

// Chạy AI: ưu tiên dịch vụ ngoài của tổ chức (ngoai), lỗi thì dùng Workers AI và gọi baoLoi(thongBao).
export async function chayAi(env, { ngoai, baoLoi }, messages, { maxTokens, nhietDo, khuon }) {
  if (ngoai) {
    try {
      return await chayAiNgoai(ngoai, messages, { maxTokens, nhietDo, json: Boolean(khuon) });
    } catch (e) {
      console.error('AI ngoài lỗi, dùng Workers AI', e);
      if (baoLoi) await baoLoi(String(e.message || e).slice(0, 150));
    }
  }
  const phanHoi = await env.AI.run(moHinh(env), {
    messages,
    ...(khuon ? { response_format: { type: 'json_schema', json_schema: khuon } } : {}),
    max_tokens: maxTokens,
    temperature: nhietDo,
  });
  return phanHoi?.response ?? phanHoi;
}

export async function tachViec(env, tin, homNay, tenNguoiDung, tuyChon = {}) {
  const tra = await chayAi(env, tuyChon, loiNhacTachViec(tin, homNay, tenNguoiDung, tuyChon.daCo || []), { maxTokens: 1500, nhietDo: 0.1, khuon: KHUON_VIEC });
  return docKetQuaViec(tra);
}

export async function tomTatTin(env, tin, nhan, tuyChon = {}) {
  const noiDung = tin
    .map((t) => `${t.time || t.thoi_diem} ${t.thread || t.nhom || ''} ${t.sender || t.nguoi_gui || ''}: ${t.text || t.noi_dung || ''}`)
    .join('\n')
    .slice(0, 24000);
  const tra = await chayAi(
    env,
    tuyChon,
    [
      {
        role: 'system',
        content: [
          'Bạn tóm tắt tin nhắn Zalo cho người dùng. Đầu vào: danh sách tin (cuộc trò chuyện, người gửi - "Tôi" là người dùng, giờ UTC, nội dung).',
          'Viết tiếng Việt dễ hiểu, văn bản thuần (không in đậm, không ký hiệu markdown), gạch đầu dòng bằng "- ", tối đa 3500 ký tự.',
          'Mục 1 "Việc và cuộc hẹn của bạn": việc giao cho người dùng, việc họ hứa làm, cuộc hẹn họ cần dự; ghi cuộc trò chuyện, người gửi, hạn hoặc giờ (giờ Việt Nam). Không có thì ghi "Không có".',
          'Mục 2 "Theo từng cuộc trò chuyện": mỗi cuộc có nội dung đáng chú ý thì 1-3 gạch đầu dòng; bỏ chào hỏi, cảm ơn, quảng cáo.',
          'Chỉ dùng thông tin trong tin nhắn, không suy diễn. Không có tin nào thì chỉ trả lời "Không có tin Zalo nào trong khoảng này".',
        ].join('\n'),
      },
      { role: 'user', content: `Khoảng thời gian: ${nhan || ''}\n\n${noiDung || '(không có tin nào)'}` },
    ],
    { maxTokens: 1400, nhietDo: 0.2 },
  );
  return String(typeof tra === 'string' ? tra : tra?.response ?? '').trim().slice(0, 3500);
}

const KHUON_GOI_Y = {
  type: 'object',
  properties: {
    nhom: { type: 'integer' },
    lyDo: { type: 'string' },
    cacBuoc: { type: 'array', items: { type: 'string' } },
    banNhap: { type: 'string' },
  },
  required: ['nhom', 'lyDo', 'cacBuoc'],
};

export const NHAN_NHOM = { 1: 'AI tự làm được', 2: 'AI chuẩn bị, bạn quyết định', 3: 'bạn tự làm' };
export const NHOM_THEO_SO = { 1: 'claude_tu_lam', 2: 'claude_chuan_bi', 3: 'anh_tu_lam' };

// Phân một việc vào 3 nhóm và soạn các bước nên làm. Trả { nhom, ghi_them } hoặc ném lỗi.
export async function goiYViec(env, viec, boiCanh, tuyChon = {}) {
  const he = [
    'Bạn là trợ lý của người dùng. Với một việc mới, hãy phân nhóm và soạn gợi ý để họ xong việc.',
    'nhom: 1 = AI tự làm được toàn bộ (soạn văn bản, tra cứu, tổng hợp, làm bảng); 2 = AI chỉ chuẩn bị, cần người dùng quyết định hoặc ký (tờ trình, duyệt, trả lời đối tác); 3 = người dùng phải tự làm (họp, gặp người, gọi điện, đi lại). Chọn nhóm sát nhất.',
    'lyDo: một câu. cacBuoc: 3-5 bước ngắn nên làm để xong việc, theo thứ tự, tính cả hạn và việc đang mở. banNhap: bản nháp ngắn (dưới 600 ký tự) nếu việc cần soạn chữ như tin nhắn trả lời hay email, còn không thì để trống.',
    'Chỉ dùng thông tin có trong đầu vào, không suy diễn. AI chỉ soạn nháp, không tự gửi ra ngoài. Viết tiếng Việt dễ hiểu, không biểu tượng, dùng gạch ngắn. Chỉ trả JSON.',
  ].join('\n');
  const nguoiDung = [
    `Việc: ${viec.tieu_de}`,
    `Hạn: ${viec.han_ngay || 'chưa có'}`,
    `Ghi chú của việc: ${viec.ghi_chu || '(không có)'}`,
    `Các việc khác đang mở: ${JSON.stringify(boiCanh.slice(0, 40))}`,
  ].join('\n');
  const tra = await chayAi(env, tuyChon, [{ role: 'system', content: he }, { role: 'user', content: nguoiDung }], { maxTokens: 900, nhietDo: 0.3, khuon: KHUON_GOI_Y });
  return docGoiY(tra);
}

export function docGoiY(phanHoi) {
  let du = phanHoi?.response ?? phanHoi;
  if (typeof du === 'string') {
    const dau = du.indexOf('{');
    const cuoi = du.lastIndexOf('}');
    if (dau < 0 || cuoi < dau) throw new Error('AI không trả JSON');
    du = JSON.parse(du.slice(dau, cuoi + 1));
  }
  const nhom = [1, 2, 3].includes(du?.nhom) ? du.nhom : 2;
  const buoc = (Array.isArray(du?.cacBuoc) ? du.cacBuoc : []).map((b) => String(b).trim()).filter(Boolean).slice(0, 5);
  if (!buoc.length) throw new Error('AI không đưa ra bước nào');
  const dong = [`[Gợi ý] Nhóm ${nhom}: ${NHAN_NHOM[nhom]}. ${String(du.lyDo || '').trim()}`.trim(), ...buoc.map((b, i) => `${i + 1}. ${b}`)];
  const nhap = String(du.banNhap || '').trim().slice(0, 600);
  if (nhap) dong.push(`Bản nháp: ${nhap}`);
  return { nhom, ghi_them: dong.join('\n') };
}
