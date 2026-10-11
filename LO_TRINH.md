# Lộ trình - Sonicplan

Cập nhật: 11/10/2026. 5 phần cố định: Đang làm, Còn lại, Ưu tiên (anh xếp), Yêu cầu mới, Đã xong. Mỗi đợt một PR, xong đợt dừng báo anh.

- Địa chỉ chạy thật: chưa có (chờ anh nối kho GitHub với Cloudflare, README bước 1).
- Quyết định của anh phải giữ (11/10/2026): dự án cá nhân, coi như công ty riêng tên Sonicplan, không dùng phông, màu, tên hay tài nguyên của nơi anh làm việc; chỉ dùng Cloudflare (Worker, D1, Access), không dùng Supabase; không dùng n8n, chỉ lấy mô hình 5 luồng; làm sẵn cho nhiều khách để sau này bán; mỗi giai đoạn gửi kế hoạch và chờ duyệt rồi mới làm.
- Trước khi bán phải có quyết định của anh về: lập công ty và ai đứng tên, hồ sơ dữ liệu cá nhân (Luật 91/2025/QH15), cách nhận thư (chuyển tiếp thay vì xin quyền Gmail), Zalo OA chính thức. Xem kế hoạch mục 4.

## 1. Đang làm

- Giai đoạn 0: nền tảng (PR đầu tiên). Chờ anh nối Cloudflare với GitHub và bật Access.

## 2. Còn lại

| # | Việc | Ai làm | Nguồn |
|---|---|---|---|
| 1 | Nối kho với Cloudflare, bật Access, gửi team domain và AUD | Anh | README, mục "Đưa lên Cloudflare" |
| 2 | Ghi team domain và AUD vào `wrangler.jsonc`, kiểm trang chạy thật | Claude | như trên |
| 3 | Giai đoạn 1: Hộp tin (chuyển tiếp thư qua Email Routing, tin Zalo từ Mac, lưu tệp Drive) | Claude | Kế hoạch mục 3 |
| 4 | Giai đoạn 2: Việc và AI, Lịch, Telegram | Claude | Kế hoạch mục 3 |
| 5 | Giai đoạn 3: dọn cuối ngày, sao lưu, cảnh báo | Claude | Kế hoạch mục 3 |
| 6 | Giai đoạn 4: chạy song song n8n rồi chuyển hẳn | Claude, anh chọn ngày | Kế hoạch mục 3 |
| 7 | Giai đoạn 5: mở bán | Claude, anh quyết mục 4 | Kế hoạch mục 3, 4 |

## 3. Ưu tiên

1. Đưa giai đoạn 0 lên chạy thật.
2. Giai đoạn 1 đến 5 theo thứ tự.

## 4. Yêu cầu mới chưa xếp lịch

- Không có.

## 5. Đã xong

| Ngày | Việc | PR |
|---|---|---|
| 11/10 | Giai đoạn 0 trong kho tài liệu cũ (khung, bảng nhiều khách, Access, hẹn giờ tự kiểm) | kho tài liệu cá nhân, PR 659 |
| 11/10 | Đổi tên thành Sonicplan, tách sang kho riêng, giao diện mới (Be Vietnam Pro, dải Nhịp hôm nay) | khởi tạo kho |
| 11/10 | Tạo D1 `tro-ly-rieng` (APAC), dựng bảng 0001 và 0002 qua kết nối Cloudflare | - |
| 11/10 | Hộp tin Zalo và thư, tệp R2, AI tách việc, lịch .ics, Telegram, dọn cuối ngày, sao lưu; giao diện tối nhiều trang (Tổng quan, Hộp tin, Việc, Tệp, Kết nối, Nhật ký) | PR đầu tiên của kho |
