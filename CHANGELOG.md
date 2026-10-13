# Nhật ký thay đổi

Ghi theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [SemVer](https://semver.org/lang/vi/): số giữa tăng khi thêm tính năng, số cuối tăng khi sửa lỗi.

## [1.3.0] - 2026-10-13

### Thêm
- Nút "Spam" khi đọc tin và ở đầu hội thoại Zalo: ẩn cả nhóm Zalo, người gửi Zalo hoặc địa chỉ thư. Tin cũ và tin mới của họ không hiện, không đếm, không tách thành việc; việc đang mở tạo từ các tin đó bị hủy. Mục "Đã chặn" trong Hộp tin để bỏ chặn (tin hiện lại, việc mở lại).
- Nhật ký ai xem, tải dữ liệu ở trang Dữ liệu của bạn.
- Chủ tổ chức tự xóa cả tổ chức: hỏi hai lần, sao lưu trước, giữ bản sao 30 ngày.
- Kiểm tra trợ năng tự động bằng axe-core trong CI.

## [1.2.0] - 2026-10-13

### Đổi
- Gom 11 mục thành 4 mục chính: Hôm nay, Hộp tin, Dự án, Cài đặt; mỗi mục có thanh mục con dưới tiêu đề. Điện thoại có 4 nút ở đáy. Đường dẫn cũ vẫn mở được.
- Màu chữ phụ ở giao diện sáng đậm hơn để đủ tương phản 4.5:1 (WCAG 2.2 AA).

### Thêm
- Trang "Dữ liệu của bạn": lưu gì, ai xem, giữ bao lâu; nút tải toàn bộ dữ liệu dạng JSON.
- Chặn lệnh ghi gửi từ trang khác (chống giả mạo yêu cầu).
- Sao lưu hằng đêm có thêm dự án, lịch sử dự án, kết quả Claude.
- Bảng kiểm chuẩn quốc tế: `docs/CHUAN-QUOC-TE.md`.

## [1.1.0] - 2026-10-13

### Thêm
- Giao việc cho Claude Code: nút "Giao Claude" trong ngăn sửa việc, Claude chạy trên GitHub Actions của kho đã nối, kết quả (lời trả lời, tệp, PR, nhật ký) hiện ngay trong việc; duyệt bằng nút Đạt hoặc Làm lại; Telegram báo khi xong.
- Nút "Cài luồng Claude" ở trang Kết nối tự cài workflow vào kho.
- Kiểm tra tự động trên GitHub cho mọi PR (kiểm thử và đóng gói thử), Dependabot cập nhật thư viện hằng tuần.
- Tiêu đề bảo mật cho trang (CSP, HSTS, nosniff, chặn nhúng trang).

## [1.0.0] - 2026-10-12

Bản dùng thật đầu tiên trên plan.sonicrec.app: hộp tin Zalo và Gmail, AI tách việc, việc, dự án, ghi nhớ, tệp, luồng, đồng bộ Google, Telegram, hiệu suất và chế độ game.
