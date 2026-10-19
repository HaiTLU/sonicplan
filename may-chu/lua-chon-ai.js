// Lựa chọn nhà cung cấp AI (Claude hay FPT AI), lưu ở một tệp JSON trong thư mục dữ liệu để đổi được ngay từ trang Kết nối, không cần khởi động lại.
// Giá trị: chung = 'claude' | 'fpt'; tach_viec, soan_prompt = 'chung' | 'claude' | 'fpt' (chung = theo ô chung).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const PHAN_AI = ['tach_viec', 'soan_prompt'];

export function chuanLuaChon(v, macDinh = 'claude') {
  const nha = (x) => (x === 'fpt' ? 'fpt' : x === 'claude' ? 'claude' : null);
  const kq = { chung: nha(v?.chung) || macDinh };
  for (const p of PHAN_AI) {
    const x = nha(v?.[p]);
    if (x && x !== kq.chung) kq[p] = x; // trùng ô chung thì bỏ, giữ tệp gọn
  }
  if (v?.tat_claude === true) kq.tat_claude = true; // tắt hẳn Claude Code: không dùng Claude làm dự phòng
  return kq;
}

export function moLuaChonAi(tep, macDinh = 'claude') {
  let hienTai;
  try {
    hienTai = chuanLuaChon(JSON.parse(readFileSync(tep, 'utf8')), macDinh);
  } catch {
    hienTai = chuanLuaChon({}, macDinh); // chưa có tệp hoặc tệp hỏng thì theo mặc định
  }
  return {
    doc: () => hienTai,
    ghi(v) {
      const moi = chuanLuaChon(v, macDinh);
      mkdirSync(dirname(tep), { recursive: true });
      writeFileSync(`${tep}.tmp`, JSON.stringify(moi));
      renameSync(`${tep}.tmp`, tep);
      hienTai = moi;
      return moi;
    },
  };
}
