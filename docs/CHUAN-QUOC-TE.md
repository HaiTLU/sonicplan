# Sonicplan theo chuẩn quốc tế: bảng kiểm

Rà lần đầu 13/10/2026 (giai đoạn 2 của kế hoạch `_EXPORTS/2026-10-13_Sonicplan_KeHoachChuanQuocTe.md`). Mục tiêu là làm đúng chuẩn và tự kiểm được, chưa xin chứng nhận. Mỗi lần thêm tính năng lớn, rà lại bảng này.

Ký hiệu: Đạt, Một phần, Chưa.

## Bảo mật: OWASP ASVS 5.0 mức 1

| Mục | Yêu cầu | Tình trạng | Bằng chứng |
|---|---|---|---|
| Đăng nhập | Mọi trang và API phải đăng nhập | Đạt | Cloudflare Access đứng trước tên miền; Worker kiểm vé JWT (`src/xac-thuc.js`, kiểm thử `test/khung.test.js`) |
| Phân quyền | Không đọc được dữ liệu tổ chức khác | Đạt | Mọi truy vấn lọc `to_chuc_id`; việc chỉ chủ tổ chức làm được kiểm `vai_tro` |
| Chống giả mạo yêu cầu (CSRF) | Lệnh ghi phải đến từ chính trang | Đạt | `cungNguon` trong `src/index.js`, kiểm thử `test/du-lieu.test.js` |
| Địa chỉ cho máy gọi | Có mã riêng, so bằng bản băm | Đạt | `/nhan/*` kiểm mã băm; Telegram kiểm `secret_token`; Claude Code dùng mã một lần cho mỗi lượt |
| Lưu khóa | Khóa của khách mã hóa khi lưu | Đạt | AES-GCM bằng `KHOA_MA_HOA` (`src/ma-hoa.js`) |
| Tiêu đề bảo mật | CSP, HSTS, nosniff, chặn nhúng | Đạt | `public/_headers`; API trả `nosniff` |
| Báo lỗi | Không lộ chi tiết kỹ thuật cho người dùng | Đạt | `loi()` trong `src/tien-ich.js` chỉ trả một câu tiếng Việt |
| Thư viện | Cập nhật bản vá | Đạt | Dependabot hằng tuần; mã chạy không dùng gói npm ngoài |
| Nhật ký | Ghi lại tác vụ tự chạy, lỗi, và ai xem, tải dữ liệu | Đạt | `nhat_ky_chay`; `nhat_ky_truy_cap` ghi lần mở trang đầu mỗi ngày, tải toàn bộ dữ liệu, tải tệp; xem ở trang Dữ liệu của bạn; giữ 1 năm, không lưu IP |
| Giới hạn tần suất | Chống gọi dồn dập | Một phần | Claude Code tối đa 20 lượt mỗi 24 giờ; các API khác dựa vào Access |

## Truy cập cho người khuyết tật: WCAG 2.2 mức AA

| Mục | Tình trạng | Ghi chú |
|---|---|---|
| Tương phản chữ 4.5:1 | Đạt | Đã tính lại mọi màu chữ trên mọi nền, sáng và tối; 13/10 sửa `--phu`, `--mo`, `--on` ở giao diện sáng (trước đó 3,8-4,4:1) |
| Dùng được bằng bàn phím, thấy viền chọn | Đạt | `:focus-visible` toàn trang; ngăn kéo là `<dialog>` |
| Bỏ qua thanh điều hướng | Đạt | Liên kết "Bỏ qua thanh điều hướng" |
| Ngôn ngữ trang | Đạt | `<html lang="vi">` |
| Giảm chuyển động | Đạt | `prefers-reduced-motion` |
| Tên cho nút và biểu đồ | Đạt | `aria-label`, `role="img"` cho biểu đồ |
| Thông báo trạng thái | Đạt | Vùng `aria-live` cho thông báo và tiến độ Claude |
| Kiểm tự động bằng axe | Đạt | Việc `tro-nang` trong CI chạy `scripts/kiem-tro-nang.mjs`: 13 trang, sáng và tối, rộng 1280 và 390; lỗi mức serious, critical làm PR đỏ |

## Dữ liệu cá nhân: Luật 91/2025/QH15, Nghị định 356/2025, tham chiếu GDPR

| Mục | Tình trạng | Ghi chú |
|---|---|---|
| Nói rõ lưu gì, ai xem, giữ bao lâu | Đạt | Trang "Dữ liệu của bạn" (Cài đặt) |
| Quyền tải dữ liệu về | Đạt | Nút "Tải toàn bộ dữ liệu", `/api/du-lieu/xuat`, không xuất khóa và mã băm |
| Quyền xóa | Đạt | Xóa từng mục trên trang; chủ tổ chức tự xóa cả tổ chức ở trang Dữ liệu của bạn: hỏi 2 lần (hộp xác nhận, gõ lại tên), tự sao lưu và đọc lại bản sao trước khi xóa, giữ tệp và bản sao 30 ngày rồi tự xóa hẳn. Thử trên cơ sở dữ liệu thử (`test/xoa-to-chuc.test.js`), chưa bấm trên dữ liệu thật |
| Hồ sơ đánh giá tác động, điều khoản | Bản nháp | Bản nháp chính sách và đánh giá tác động ở `_EXPORTS/2026-10-13_Sonicplan_HoSoDuLieuCaNhan_BanNhap.md`; cần người có chuyên môn pháp lý duyệt trước khi bán |

## Sao lưu và khôi phục

Thử khôi phục 13/10/2026: tải bản sao lưu `sao-luu/tc_namhai/2026-10-12.json` từ R2 (593 KB), dựng cơ sở dữ liệu trống từ `migrations/`, nạp lại: 54 việc, 617 tin, 25 tệp, 11 ghi nhớ vào đủ, không lỗi. Phát hiện bản sao lưu thiếu dự án, lịch sử dự án và kết quả Claude: đã thêm vào tác vụ `sao-luu`. Thử lại mỗi tháng.

## Phát hành

| Mục | Tình trạng |
|---|---|
| Kiểm thử tự động cho mọi PR | Đạt (`.github/workflows/kiem-tra.yml`) |
| Đánh số phiên bản SemVer, nhật ký thay đổi | Đạt (`package.json`, `CHANGELOG.md`) |
| Quay lại bản cũ | Đạt (Cloudflare giữ các bản Worker trước) |
