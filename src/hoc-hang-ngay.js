import { docCaiDat, ghiCaiDat } from './hop-tin.js';
import { deXuatLoiDan } from './loi-dan-tuan.js';
import { ngayVN } from './tien-ich.js';
import { docLuong } from './luong.js';
import { kiemUngVien } from './rao-chan-hoc.js';

const KHOA_TU_TAT = 'hoc_hang_ngay_tu_tat';
const KHOA_BAT_LAI = 'hoc_hang_ngay_bat_lai';
const TOI_THIEU_VIEC_MOI_KY = 5; // kỳ ít việc hơn thì tỷ lệ chưa đáng tin để tự tắt
const NGAY_TRA_LAI = 7; // sau khi người dùng bật lại, chưa xét tự tắt trong ngần này ngày

// Tập kịch bản thử nhỏ có đáp án đã biết, chạy không cần gọi AI. Hỏng ca nào nghĩa là rào chắn đã lỏng: vòng học phải dừng.
export const KICH_BAN_THU = [
  { ten: 'quy tắc việc bình thường được nhận', ung_vien: { noi_dung: 'Tin nhóm Lớp A chưa nhận lời thì không tạo việc ăn uống' }, mong: true },
  { ten: 'quy tắc về hạn được nhận', ung_vien: { noi_dung: 'Việc có hạn trong tin gửi từ thư thì lấy đúng ngày hạn đó', do_tin: 0.9 }, mong: true },
  { ten: 'mật khẩu bị chặn', ung_vien: { noi_dung: 'Tin có mật khẩu wifi thì ghi lại vào việc' }, mong: false },
  { ten: 'nới quyền bị chặn', ung_vien: { noi_dung: 'Việc từ Zalo thì tự duyệt, bỏ qua bước xác nhận' }, mong: false },
  { ten: 'độ tin 0.3 bị chặn', ung_vien: { noi_dung: 'Tin kiểu đặt bàn thì tạo việc', do_tin: 0.3 }, mong: false },
];

export function chayKichBanThu(kiem = kiemUngVien, cacCa = KICH_BAN_THU) {
  const hong = cacCa.filter((c) => kiem(c.ung_vien, {}).ok !== c.mong).map((c) => c.ten);
  return { tong: cacCa.length, dat: cacCa.length - hong.length, hong };
}

const tyLe = (ky) => (ky && ky.so_viec > 0 ? ky.da_sua / ky.so_viec : null);

// Tự tắt khi tỷ lệ việc AI bị sửa tăng hai kỳ liền (xa -> truoc -> gan), mỗi kỳ đủ số việc. Hàm thuần.
export function nenTuTat({ xa, truoc, gan }) {
  if (![xa, truoc, gan].every((k) => k && k.so_viec >= TOI_THIEU_VIEC_MOI_KY)) return { tat: false };
  const [a, b, c] = [tyLe(xa), tyLe(truoc), tyLe(gan)];
  if (c > b && b > a) return { tat: true, ly_do: `Tỷ lệ việc AI bị sửa tăng hai kỳ liền: ${(a * 100).toFixed(0)}% -> ${(b * 100).toFixed(0)}% -> ${(c * 100).toFixed(0)}%.` };
  return { tat: false };
}

async function tuTatVong(env, tc, bayGio, lyDo) {
  await ghiCaiDat(env, tc, 'luong_bat_hoc-hang-ngay', '0'); // dùng đúng công tắc ở trang Luồng; người dùng bật lại ở đó
  await ghiCaiDat(env, tc, KHOA_TU_TAT, JSON.stringify({ luc: bayGio, ly_do: lyDo }));
}

export async function trangThaiHoc(env, tc, bayGio = new Date().toISOString()) {
  const den = Date.parse(bayGio);
  async function ky(tu, toi) {
    const r = await env.CSDL.prepare(
      `SELECT COUNT(*) AS so_viec, COALESCE(SUM(CASE WHEN EXISTS (
         SELECT 1 FROM viec_su_kien e WHERE e.to_chuc_id=v.to_chuc_id AND e.viec_id=v.id
         AND e.loai IN ('huy','sua_ten','doi_du_an','doi_nhom','sua_han')
         AND COALESCE(e.noi_dung,'') NOT LIKE 'Gỡ vì%' AND e.luc < ?3
       ) THEN 1 ELSE 0 END),0) AS da_sua
       FROM viec v WHERE v.to_chuc_id=?1 AND COALESCE(v.nguon,'tay')<>'tay'
         AND v.tao_luc>=?2 AND v.tao_luc<?3`,
    ).bind(tc, new Date(tu).toISOString(), new Date(toi).toISOString()).first();
    return { tu: new Date(tu).toISOString(), den: new Date(toi).toISOString(), ...r };
  }
  const ngay = 86400000;
  const gan = await ky(den - 7 * ngay, den);
  const truoc = await ky(den - 14 * ngay, den - 7 * ngay);
  const xa = await ky(den - 21 * ngay, den - 14 * ngay);
  const tra = await env.CSDL.prepare(`SELECT COUNT(*) AS n FROM cau_hoi_ai WHERE to_chuc_id=?1 AND trang_thai='xong' AND tra_loi_luc>=?2 AND tra_loi_luc<?3`)
    .bind(tc, new Date(den - 7 * ngay).toISOString(), bayGio).first();
  let lanCuoi = null;
  try { lanCuoi = JSON.parse(await docCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi')); } catch { /* chưa chạy */ }
  let tuTat = null;
  try { tuTat = JSON.parse(await docCaiDat(env, tc, KHOA_TU_TAT)); } catch { /* chưa tự tắt */ }
  return { bat: (await docLuong(env, tc)).bat['hoc-hang-ngay'], lan_cuoi: lanCuoi, tu_tat: tuTat, gan, truoc, xa, so_tra_loi: tra.n,
    luu_y: 'Đây là số việc AI tạo đã bị sửa hoặc hủy trong từng kỳ, không phải tỷ lệ chính xác. Việc chưa sửa có thể chưa được xem; hai kỳ chưa chứng minh tác dụng của bài học.' };
}

// Khóa có hạn để cron chạy lại không gọi AI trùng; lỗi thì lần sau thử lại.
export async function hocHangNgay(env, tc, bayGio = new Date().toISOString(), deXuat = deXuatLoiDan) {
  const ngay = ngayVN(bayGio);
  let cu = null;
  try { cu = JSON.parse(await docCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi')); } catch { /* chưa có */ }
  if (cu?.ngay === ngay) return { bo_qua: true };
  const khoa = 'hoc_hang_ngay_khoa';
  const hetHan = new Date(Date.parse(bayGio) - 20 * 60000).toISOString();
  const k = await env.CSDL.prepare(
    `INSERT INTO cai_dat (to_chuc_id,khoa,gia_tri) VALUES (?1,?2,?3)
     ON CONFLICT(to_chuc_id,khoa) DO UPDATE SET gia_tri=excluded.gia_tri WHERE cai_dat.gia_tri < ?4`,
  ).bind(tc, khoa, bayGio, hetHan).run();
  if (!k.meta.changes) return { bo_qua: true };
  try {
    const moi = await docCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi');
    if (moi && JSON.parse(moi).ngay === ngay) return { bo_qua: true };
    // Công tắc đang bật mà còn dấu tự tắt nghĩa là người dùng vừa bật lại: xóa dấu, nghỉ xét tự tắt một thời gian.
    if (await docCaiDat(env, tc, KHOA_TU_TAT)) {
      await env.CSDL.prepare('DELETE FROM cai_dat WHERE to_chuc_id=?1 AND khoa=?2').bind(tc, KHOA_TU_TAT).run();
      await ghiCaiDat(env, tc, KHOA_BAT_LAI, bayGio);
    }
    // Tự phản tư 1: kịch bản thử. Rào chắn lỏng thì không đề xuất gì hôm nay.
    const thu = chayKichBanThu();
    if (thu.hong.length) {
      const lyDo = `Kịch bản thử hỏng: ${thu.hong.join(', ')}.`;
      await tuTatVong(env, tc, bayGio, lyDo);
      const ketQua = { ngay, luc: bayGio, tu_tat: true, ly_do: lyDo };
      await ghiCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi', JSON.stringify(ketQua));
      return ketQua;
    }
    // Tự phản tư 2: tỷ lệ sửa tệ đi hai kỳ liền thì dừng, chờ người dùng xem lại.
    const thongKe = await trangThaiHoc(env, tc, bayGio);
    const batLai = await docCaiDat(env, tc, KHOA_BAT_LAI);
    const nghi = batLai && Date.parse(bayGio) - Date.parse(batLai) < NGAY_TRA_LAI * 86400000;
    const xet = nghi ? { tat: false } : nenTuTat(thongKe);
    if (xet.tat) {
      await tuTatVong(env, tc, bayGio, xet.ly_do);
      const ketQua = { ngay, luc: bayGio, tu_tat: true, ly_do: xet.ly_do };
      await ghiCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi', JSON.stringify(ketQua));
      return ketQua;
    }
    const ds = await deXuat(env, tc, bayGio);
    const ketQua = { ngay, luc: bayGio, cho_duyet: ds.length, so_tra_loi: thongKe.so_tra_loi };
    await ghiCaiDat(env, tc, 'hoc_hang_ngay_lan_cuoi', JSON.stringify(ketQua));
    return ketQua;
  } finally {
    await env.CSDL.prepare('DELETE FROM cai_dat WHERE to_chuc_id=?1 AND khoa=?2 AND gia_tri=?3').bind(tc, khoa, bayGio).run();
  }
}
