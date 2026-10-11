// Xác định ai đang dùng và đang làm việc trong tổ chức (khách) nào.
// Đăng nhập hiện dùng Cloudflare Access; khi bán cho khách ngoài sẽ thay bằng trang đăng nhập riêng,
// chỉ cần sửa hàm layEmail, phần còn lại của hệ thống chỉ dùng kết quả { nguoi_dung, to_chuc }.

import { kiemDangNhap } from './xac-thuc.js';

export async function xacDinhPhien(yeuCau, env) {
  const email = await layEmail(yeuCau, env);
  if (!email.duoc) return { duoc: false, ma: 401, ly_do: email.ly_do };

  const { results } = await env.CSDL.prepare(
    `SELECT n.id AS nguoi_dung_id, n.ten AS ten_nguoi_dung, t.id AS to_chuc_id, t.ten AS ten_to_chuc, t.goi, v.vai_tro
     FROM nguoi_dung n
     JOIN thanh_vien v ON v.nguoi_dung_id = n.id
     JOIN to_chuc t ON t.id = v.to_chuc_id
     WHERE n.email = ?1
     ORDER BY v.tao_luc`,
  ).bind(email.email).all();
  if (!results.length) return { duoc: false, ma: 403, ly_do: 'Tài khoản chưa được mời vào tổ chức nào' };

  // Một người có thể thuộc nhiều tổ chức; chọn theo tiêu đề x-to-chuc, mặc định tổ chức đầu tiên.
  const muon = yeuCau.headers.get('x-to-chuc');
  const dong = results.find((r) => r.to_chuc_id === muon) || results[0];
  return {
    duoc: true,
    email: email.email,
    nguoi_dung: { id: dong.nguoi_dung_id, ten: dong.ten_nguoi_dung },
    to_chuc: { id: dong.to_chuc_id, ten: dong.ten_to_chuc, goi: dong.goi, vai_tro: dong.vai_tro },
    cac_to_chuc: results.map((r) => ({ id: r.to_chuc_id, ten: r.ten_to_chuc })),
  };
}

async function layEmail(yeuCau, env) {
  const url = new URL(yeuCau.url);
  // Chạy thử trên máy (wrangler dev): bỏ qua Access, dùng EMAIL_THU trong .dev.vars.
  if (env.EMAIL_THU && ['localhost', '127.0.0.1'].includes(url.hostname)) {
    return { duoc: true, email: env.EMAIL_THU.toLowerCase() };
  }
  return kiemDangNhap(yeuCau, env);
}
