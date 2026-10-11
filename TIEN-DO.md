# Tiến độ - Sonicplan, giai đoạn 0

Cập nhật: 11/10/2026.

## Kế hoạch đợt

- **Tệp sẽ sửa:** toàn bộ kho (mới).
- **Thứ tự làm:** cấu hình Worker và D1; bảng dữ liệu nhiều khách; kiểm đăng nhập Access; mã hóa khóa; hẹn giờ tự kiểm; trang Tình trạng và Nhật ký chạy; kiểm thử; tạo D1 thật; hướng dẫn đưa lên Cloudflare.
- **Rủi ro:** (1) kiểm vé Access sai thì hoặc khóa mất anh, hoặc để lọt người ngoài: có kiểm thử vé giả, vé sai AUD, sai nơi cấp, hết hạn, sửa nội dung; thiếu cấu hình Access thì từ chối hết. (2) Lộ dữ liệu giữa các khách: mọi truy vấn lọc `to_chuc_id`. (3) Dựng lại khi đẩy commit của dự án khác: đặt build watch paths là thư mục này.
- **Cách chứng minh đạt:** `npm test` 9/9 đạt; `npx wrangler deploy --dry-run` đóng gói được; chạy `wrangler dev`, gọi hẹn giờ thử thì nhật ký có dòng "xong" và đèn Hẹn giờ xanh; chụp ảnh 1366 và 390.

## Đã kiểm

- 11/10: `npm test` 9/9 đạt; chạy thử trên máy: `/api/suc-khoe` trả ok, hẹn giờ ghi nhật ký, `/api/tinh-trang` đúng, yêu cầu từ tên miền khác localhost không có vé thì 401; ảnh ở `/mnt/project-files/NenTangTuDong/`.
- 11/10: D1 thật có đủ 10 bảng và dòng anh là chủ tổ chức `tc_namhai`.

## Bước tiếp

- Anh làm README bước 1-3, gửi team domain và AUD.
