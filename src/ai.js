// Gọi Workers AI của Cloudflare: tách việc từ tin nhắn và tóm tắt tin. Không cần khóa ngoài.
// Đổi mô hình bằng biến AI_MODEL trong wrangler.jsonc.

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
export function loiNhacTachViec(tin, homNay, tenNguoiDung) {
  const he = [
    `Bạn là trợ lý của ${tenNguoiDung || 'người dùng'}. Đọc các tin nhắn và thư dưới đây, chỉ lấy ra những VIỆC mà người dùng cần làm hoặc cần theo dõi: lời nhờ, yêu cầu, hạn nộp, cuộc họp, lịch hẹn.`,
    'Bỏ qua: chào hỏi, cảm ơn, quảng cáo, thông báo tự động không cần làm gì, tin chỉ để biết.',
    `Hôm nay là ${homNay} (giờ Việt Nam). Đổi "mai", "thứ 6", "cuối tuần" thành ngày cụ thể dạng YYYY-MM-DD.`,
    'gio_hen dạng HH:MM 24 giờ nếu tin nói rõ giờ (ví dụ "trước 14h" thì 14:00), không có thì null.',
    'tieu_de ngắn gọn, bắt đầu bằng động từ, tiếng Việt, tối đa 80 ký tự. ghi_chu ghi ai nhờ và chi tiết cần nhớ.',
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
  return [
    { role: 'system', content: he },
    { role: 'user', content: noiDung },
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

export async function tachViec(env, tin, homNay, tenNguoiDung) {
  const phanHoi = await env.AI.run(moHinh(env), {
    messages: loiNhacTachViec(tin, homNay, tenNguoiDung),
    response_format: { type: 'json_schema', json_schema: KHUON_VIEC },
    max_tokens: 1500,
    temperature: 0.1,
  });
  return docKetQuaViec(phanHoi);
}

export async function tomTatTin(env, tin, nhan) {
  const noiDung = tin
    .map((t) => `${t.time || t.thoi_diem} ${t.thread || t.nhom || ''} ${t.sender || t.nguoi_gui || ''}: ${t.text || t.noi_dung || ''}`)
    .join('\n')
    .slice(0, 24000);
  const phanHoi = await env.AI.run(moHinh(env), {
    messages: [
      {
        role: 'system',
        content:
          'Tóm tắt các tin nhắn Zalo dưới đây bằng tiếng Việt, gạch đầu dòng theo từng nhóm hoặc người. Nêu rõ việc cần làm, hạn, ai nhờ. Ngắn gọn, tối đa 25 dòng, không bịa thêm.',
      },
      { role: 'user', content: `Khoảng thời gian: ${nhan || ''}\n\n${noiDung || '(không có tin nào)'}` },
    ],
    max_tokens: 1200,
    temperature: 0.2,
  });
  return String(phanHoi?.response ?? '').trim();
}
