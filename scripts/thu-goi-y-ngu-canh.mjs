// Thử AI thật cho gợi ý xử lý việc có ngữ cảnh (nghi trùng, dự án, việc giống đã xong). Không đụng dữ liệu thật:
// dựng CSDL tạm trong bộ nhớ từ migrations/, nạp vài việc mẫu rồi gọi tác vụ gợi ý hằng giờ.
// Chạy trên máy có CF_ACCOUNT_ID và CF_AI_TOKEN (VPS: `set -a; . may-chu/.env; set +a; node scripts/thu-goi-y-ngu-canh.mjs`).
// Thêm --gia để chạy bằng AI giả, chỉ kiểm luồng của chính tập lệnh này (không phải thử AI thật).
// Mỗi lần gọi AI tính vào hạn mức Workers AI: tập lệnh gọi 3 lần. Có điều kiện sai thì thoát mã 1.
import { d1, dungCsdl } from '../test/csdl-thu.js';
import { goiYMoi } from '../src/ban-tin.js';
import { moAi } from '../may-chu/lop-ai.js';

const gia = process.argv.includes('--gia');
const AI = gia
  ? { run: async (_m, d) => ({ response: JSON.stringify({ nhom: 2, lyDo: 'giả', cacBuoc: [/Nghi trùng \(hệ thống gắn cờ\)/.test(d.messages[1].content) ? 'Kiểm tra việc nghi trùng, gộp nếu đúng' : 'Soạn nội dung', 'Gửi'] }) }) }
  : moAi({ taiKhoan: process.env.CF_ACCOUNT_ID, token: process.env.CF_AI_TOKEN });
if (!AI) { console.error('Thiếu CF_ACCOUNT_ID hoặc CF_AI_TOKEN. Dùng --gia để chỉ kiểm luồng.'); process.exit(2); }

const db = dungCsdl();
const env = { CSDL: d1(db), AI };
const bay = new Date().toISOString();
const truoc = (ngay) => new Date(Date.now() - ngay * 86400000).toISOString();
db.exec("INSERT INTO to_chuc (id, ten, tao_luc) VALUES ('tc1', 'Thử', '2026-01-01')");
db.exec("INSERT INTO du_an (id, to_chuc_id, ten, tao_luc) VALUES (1, 'tc1', 'AI Lab Hòa Lạc', 'x')");
const them = db.prepare("INSERT INTO viec (id, to_chuc_id, tieu_de, trang_thai, du_an_id, tao_luc, cap_nhat_luc, xong_luc) VALUES (?, 'tc1', ?, ?, ?, ?, ?, ?)");
them.run(1, 'Gửi hợp đồng thuê mặt bằng cho đối tác', 'mo', 1, truoc(3), truoc(3), null);
them.run(2, 'Gửi bản hợp đồng thuê mặt bằng đã ký cho kế toán', 'mo', 1, bay, bay, null); // việc nghi trùng với việc 1
them.run(3, 'Chuẩn bị bài giảng Marketing số cho khóa tháng 12', 'mo', null, bay, bay, null); // việc không cờ
them.run(4, 'Gửi hợp đồng thuê thiết bị cho kế toán', 'xong', 1, truoc(10), truoc(10), truoc(2)); // việc giống đã xong
db.prepare("INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc) VALUES ('tc1', 2, 'nghi_trung', 'Có thể trùng việc #1 \"Gửi hợp đồng thuê mặt bằng cho đối tác\" (giống 62%)', ?)").run(bay);

const kq = await goiYMoi(env, bay);
const ghiChu = (id) => db.prepare('SELECT ghi_chu FROM viec WHERE id = ?').get(id)?.ghi_chu || '';
const nghi = ghiChu(2);
const thuong = ghiChu(3);
const dieuKien = [
  ['Tác vụ gợi ý xử lý được cả hai việc mở có ghi chú', kq.so_muc >= 2],
  ['Việc nghi trùng có phần [Gợi ý]', /\[Gợi ý\] Nhóm/.test(nghi)],
  ['Việc nghi trùng nhắc kiểm tra, gộp hoặc việc trùng', /trùng|gộp|kiểm tra lại|việc #1|hợp đồng thuê mặt bằng cho đối tác/i.test(nghi)],
  ['Việc không cờ có phần [Gợi ý] và không nói về trùng', /\[Gợi ý\] Nhóm/.test(thuong) && !/trùng|gộp/i.test(thuong)],
];
console.log('--- Gợi ý cho việc nghi trùng ---\n' + nghi + '\n\n--- Gợi ý cho việc không cờ ---\n' + thuong + '\n');
let sai = 0;
for (const [ten, ok] of dieuKien) { console.log(`${ok ? 'ĐÚNG' : 'SAI '}  ${ten}`); if (!ok) sai++; }
console.log(gia ? '\n(Chạy bằng AI giả: chỉ kiểm luồng tập lệnh, chưa phải thử AI thật.)' : '');
process.exit(sai ? 1 : 0);
