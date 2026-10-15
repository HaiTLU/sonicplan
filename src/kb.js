// Ghép dự án Sonicplan với thư mục trong ThangLong_KB và đặt tên thư mục làm việc của từng việc.
// Thư mục Claude được ghi chỉ nằm trong 01_Projects/<dự án>/Sonicplan/ hoặc _INBOX/Sonicplan/.

export const GOC_DU_AN = '01_Projects';
export const GOC_HOP_THU = '_INBOX/Sonicplan';

const bo = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');

// "Đào tạo Ngắn hạn" và "DaoTao_NganHan" cùng thành "daotaonganhan".
export const chuanTen = (s) => bo(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Tên dùng làm thư mục: không dấu, mỗi từ viết hoa chữ đầu, nối bằng gạch dưới.
export function tenThuMuc(s, toiDa = 40) {
  const tu = bo(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  return (tu.map((t) => t[0].toUpperCase() + t.slice(1)).join('_') || 'Khong_Ten').slice(0, toiDa).replace(/_+$/, '');
}

// Gợi ý thư mục KB cho một dự án: trùng tên hoặc tên này nằm trong tên kia (ít nhất 5 ký tự). Không khớp thì null.
export function goiYThuMuc(tenDuAn, dsThuMuc) {
  const a = chuanTen(tenDuAn);
  if (a.length < 3) return null;
  let tot = null;
  for (const t of dsThuMuc) {
    const b = chuanTen(t);
    if (!b) continue;
    if (a === b) return t;
    if (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a))) tot = tot && chuanTen(tot).length >= b.length ? tot : t;
  }
  return tot;
}

// Thư mục gốc (không có dấu / ở cuối) hợp lệ: 01_Projects/<tên> hoặc _INBOX/Sonicplan/<tên>; không ra ngoài, không ký tự lạ.
const ONE = '[\\p{L}\\p{N}_\\-. \\[\\]()]+';
const RE_THU_MUC = new RegExp(`^(?:${GOC_DU_AN}/${ONE}|${GOC_HOP_THU}(?:/${ONE})?)$`, 'u');
export function kiemThuMucKb(s) {
  const t = String(s || '').trim().replace(/\/+$/, '');
  if (!t || t.length > 200 || t.split('/').some((p) => p === '..' || p === '.' || p.startsWith('.'))) return null;
  return RE_THU_MUC.test(t) ? t : null;
}

// Thư mục chứa mọi việc của dự án: dự án ghép vào 01_Projects thì thêm /Sonicplan, còn _INBOX thì dùng luôn.
export function thuMucGocDuAn(kbThuMuc, tenDuAn) {
  const t = kiemThuMucKb(kbThuMuc);
  if (!t) return `${GOC_HOP_THU}/${tenThuMuc(tenDuAn || 'Chua_Xep_Du_An')}`;
  return t.startsWith(`${GOC_DU_AN}/`) ? `${t}/Sonicplan` : t;
}

// Thư mục làm việc của một việc: <gốc dự án>/<YYMMDD>_<tên việc>_<mã việc>.
export function thuMucLamViec(kbThuMuc, tenDuAn, viec, bayGio = new Date()) {
  const d = new Date(new Date(bayGio).getTime() + 7 * 3600000).toISOString().slice(2, 10).replace(/-/g, '');
  return `${thuMucGocDuAn(kbThuMuc, tenDuAn)}/${d}_${tenThuMuc(viec.tieu_de, 36)}_v${viec.id}`;
}
