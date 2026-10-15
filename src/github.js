// Giao việc nhóm "AI tự làm" sang GitHub issue để Claude nhận làm. Token (quyền Issues: đọc ghi trên một kho)
// và tên kho do chủ tổ chức dán ở trang Kết nối, được mã hóa như khóa AI.

import { goiNgoai } from './goi-ngoai.js';

export function kiemCauHinhGithub({ token, repo, nhan }) {
  const t = String(token || '').trim();
  const r = String(repo || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  const n = String(nhan || '').trim() || 'viec-cho-claude';
  if (!/^(ghp_|github_pat_|gho_|ghs_)[\w]{20,}$/.test(t)) throw new Error('Token GitHub không đúng dạng. Chép nguyên chuỗi bắt đầu bằng github_pat_ hoặc ghp_.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(r) || r.split('/').some((x) => /^\.+$/.test(x))) throw new Error('Tên kho phải dạng chủ-kho/tên-kho, ví dụ HaiTLU/ThangLong_KB.');
  if (!/^[\w .:-]{1,50}$/.test(n)) throw new Error('Tên nhãn không hợp lệ.');
  return { token: t, repo: r, nhan: n };
}

export function thanIssue(viec, nhan) {
  const dong = [];
  if (viec.ghi_chu) dong.push(viec.ghi_chu);
  const han = viec.han_ngay ? `Hạn: ${viec.han_ngay}${viec.gio_hen ? ` ${viec.gio_hen}` : ''}` : '';
  dong.push([han, `Nguồn: Sonicplan, việc số ${viec.id}`].filter(Boolean).join('\n'));
  return { title: String(viec.tieu_de).slice(0, 200), body: dong.join('\n\n').slice(0, 6000), labels: [nhan] };
}

export async function goiGithub(cauHinh, duongDan, { method = 'GET', body } = {}) {
  const ph = await goiNgoai(`https://api.github.com${duongDan}`, {
    method,
    headers: { authorization: `Bearer ${cauHinh.token}`, accept: 'application/vnd.github+json', 'user-agent': 'Sonicplan', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const kq = await ph.json().catch(() => ({}));
  if (!ph.ok) {
    const goiY = ph.status === 401 ? 'Token sai hoặc hết hạn.' : ph.status === 403 || ph.status === 404 ? 'Token không có quyền Issues trên kho này, hoặc tên kho sai.' : '';
    throw new Error(`GitHub từ chối (${ph.status}). ${goiY} ${kq.message || ''}`.replace(/\s+/g, ' ').trim());
  }
  return kq;
}

// Thử token trước khi lưu: đọc được kho và kho bật Issues.
export async function thuGithub(cauHinh) {
  const kho = await goiGithub(cauHinh, `/repos/${cauHinh.repo}`);
  if (kho.has_issues === false) throw new Error('Kho này đã tắt Issues, bật ở Settings của kho.');
}

export async function taoIssue(cauHinh, viec) {
  const kq = await goiGithub(cauHinh, `/repos/${cauHinh.repo}/issues`, { method: 'POST', body: thanIssue(viec, cauHinh.nhan) });
  return { so: kq.number, duong_dan: kq.html_url };
}
