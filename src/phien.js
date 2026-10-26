// Xác định ai đang dùng và đang làm việc trong tổ chức (khách) nào.
// Đăng nhập hiện dùng Cloudflare Access; khi bán cho khách ngoài sẽ thay bằng trang đăng nhập riêng,
// chỉ cần sửa hàm layEmail, phần còn lại của hệ thống chỉ dùng kết quả { nguoi_dung, to_chuc }.

import { kiemDangNhap } from './xac-thuc.js';

// Nhớ danh sách tổ chức của một email trong 30 giây (theo từng Worker đang chạy), để mỗi lần bấm
// không phải hỏi D1 lại. Đổi quyền thành viên có hiệu lực chậm nhất sau 30 giây.
const NHO_MS = 30000;
const nho = new Map();

async function docThanhVien(env, email) {
  const co = nho.get(email);
  if (co && Date.now() - co.luc < NHO_MS) return co.dong;
  const { results } = await env.CSDL.prepare(
    `SELECT n.id AS nguoi_dung_id, n.ten AS ten_nguoi_dung, t.id AS to_chuc_id, t.ten AS ten_to_chuc, t.goi, t.pham_vi_truy_cap, v.vai_tro
     FROM nguoi_dung n
     JOIN thanh_vien v ON v.nguoi_dung_id = n.id
     JOIN to_chuc t ON t.id = v.to_chuc_id
     WHERE n.email = ?1
     ORDER BY v.tao_luc`,
  ).bind(email).all();
  if (results.length) {
    if (nho.size > 200) nho.clear();
    nho.set(email, { luc: Date.now(), dong: results });
  }
  return results;
}

export async function xacDinhPhien(yeuCau, env) {
  const email = await layEmail(yeuCau, env);
  if (!email.duoc) return { duoc: false, ma: 401, ly_do: email.ly_do };

  const results = await docThanhVien(env, email.email);
  if (!results.length) return { duoc: false, ma: 403, ly_do: 'Tài khoản chưa được mời vào tổ chức nào' };

  // Một người có thể thuộc nhiều tổ chức; chọn theo tiêu đề x-to-chuc, mặc định tổ chức đầu tiên.
  const muon = yeuCau.headers.get('x-to-chuc');
  const dong = results.find((r) => r.to_chuc_id === muon) || results[0];
  return {
    duoc: true,
    email: email.email,
    nguoi_dung: { id: dong.nguoi_dung_id, ten: dong.ten_nguoi_dung },
    to_chuc: { id: dong.to_chuc_id, ten: dong.ten_to_chuc, goi: dong.goi, pham_vi_truy_cap: dong.pham_vi_truy_cap, vai_tro: dong.vai_tro },
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

// Quên danh sách tổ chức đã nhớ (sau khi xóa tổ chức) để lần bấm sau đọc lại từ D1.
export function quenPhien() {
  nho.clear();
}
