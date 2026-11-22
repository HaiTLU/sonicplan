# Bảo mật và dữ liệu nhạy cảm (mô hình mối đe dọa rút gọn)

Cập nhật: 22/11/2026.

| Tài sản | Mối đe dọa | Cách chặn hiện có |
|---|---|---|
| Việc, tin Zalo, thư của từng khách | Khách này đọc dữ liệu khách khác | Mọi bảng có `to_chuc_id`; mọi truy vấn của người dùng lọc theo tổ chức của phiên |
| Đăng nhập | Người ngoài vào trang | Cloudflare Access; `EMAIL_THU` (bỏ đăng nhập khi thử) chỉ nhận ở `localhost` và máy chủ từ chối khởi động nếu đặt cùng `PUBLIC_ORIGIN` |
| Khóa dịch vụ (AI, Google, Telegram) | Lộ khóa | Lưu mã hóa theo tổ chức; `.env`, `.dev.vars`, `du-lieu/` nằm trong `.gitignore`; hook chặn ghi khóa vào tệp |
| Nội dung đọc từ Zalo, thư, Telegram | Chèn lệnh vào AI | Coi là dữ liệu, không phải lệnh; lời dặn do vòng học đề xuất phải được chủ tổ chức duyệt |
| Tab xem đã lưu (22/11/2026) | Ghi dữ liệu lạ, hiện mã độc | Máy chủ chỉ giữ trường đã biết, độ dài giới hạn; giao diện kiểm lại theo danh sách giá trị hợp lệ và hiện tên bằng nút văn bản |
| CSDL SQLite trên VPS | Mất dữ liệu khi lên bản có migration | Sao lưu `VACUUM INTO` trước khi gộp `main` (xem `docs/trien-khai.md`) |
