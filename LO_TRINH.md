# Lộ trình - Sonicplan

Cập nhật: 05/11/2026. 5 phần cố định: Đang làm, Còn lại, Ưu tiên (anh xếp), Yêu cầu mới, Đã xong. Mỗi đợt một PR, xong đợt dừng báo anh.

- Địa chỉ chạy thật: plan.sonicrec.app và plan.sonicapp.top; máy chủ chạy trên VPS `tlu-prod-web-02`, CSDL là tệp sqlite trên VPS (xem `TIEN-DO.md`).
- Quyết định của anh phải giữ (11/10/2026): dự án cá nhân, coi như công ty riêng tên Sonicplan, không dùng phông, màu, tên hay tài nguyên của nơi anh làm việc; chỉ dùng Cloudflare (Worker, D1, Access), không dùng Supabase (ghi chú 05/11/2026: thực tế máy chủ nay chạy trên VPS với CSDL sqlite, vẫn dùng Cloudflare Access; nếu anh muốn sửa quyết định này cho khớp thì báo Claude); không dùng n8n, chỉ lấy mô hình 5 luồng; làm sẵn cho nhiều khách để sau này bán; mỗi giai đoạn gửi kế hoạch và chờ duyệt rồi mới làm.
- Trước khi bán phải có quyết định của anh về: lập công ty và ai đứng tên, hồ sơ dữ liệu cá nhân (Luật 91/2025/QH15), cách nhận thư (chuyển tiếp thay vì xin quyền Gmail), Zalo OA chính thức. Xem kế hoạch mục 4.

## 1. Đang làm

- Đưa lịch hai chiều và lịch `thanglong` vào dùng thật, theo dõi nhật ký đồng bộ.
- Thử chế độ đồng bộ Google `tu-chia` (PR #149) với Google thật trước khi gộp.

## 2. Còn lại

| # | Việc | Ai làm | Nguồn |
|---|---|---|---|
| 1 | Kiểm tab Ngân sách của /hoalac trên trình duyệt ba vai trò | Claude | `TIEN-DO.md`, PR5 |
| 2 | Sửa PUT `qlda_hop_dong` không xóa được khóa ngoại về trống | Claude | `TIEN-DO.md`, PR4 |
| 3 | Xác nhận bản TMĐT chuẩn để nhập số ngân sách Hòa Lạc | Anh | `TIEN-DO.md`, PR5 |
| 4 | Gộp Dependabot #152 sau khi CI chạy lại; xem rồi đóng hoặc gộp #134 | Anh quyết | PR đang mở |
| 5 | Trước khi bán: lập công ty và ai đứng tên, hồ sơ dữ liệu cá nhân, cách nhận thư, Zalo OA chính thức | Anh | Kế hoạch mục 4 |

## 3. Ưu tiên

1. Thử #149 với Google thật rồi quyết định gộp hay bỏ.
2. Việc còn treo của /hoalac (còn lại 1 đến 3).
3. Các giai đoạn mở bán theo quyết định của anh.

## 4. Yêu cầu mới chưa xếp lịch

- Không có.

## 5. Đã xong

| Ngày | Việc | PR |
|---|---|---|
| 11/10 | Giai đoạn 0 trong kho tài liệu cũ (khung, bảng nhiều khách, Access, hẹn giờ tự kiểm) | kho tài liệu cá nhân, PR 659 |
| 11/10 đến 12/10 | Đổi tên Sonicplan, tách kho riêng; hộp tin Zalo và thư, tệp R2, AI tách việc, lịch .ics, Telegram, dọn cuối ngày, sao lưu; Drive kho | PR đầu tiên của kho và các PR kế tiếp |
| 19/10 | Trung tâm điều hành kéo thả và trí nhớ; gỡ lớp FPT AI | #128, #130 |
| 22/10 đến 23/10 | Cập nhật máy chủ hỗ trợ systemd trên VPS | #133 |
| 26/10 đến 27/10 | Phân hệ Viện Hòa Lạc /hoalac (6 PR) và Access riêng | #135 đến #140 |
| 31/10 đến 01/11 | Tìm ghi nhớ FTS5; vòng học tập hằng ngày; giao diện Liquid Glass v2 | #142 đến #146 |
| 02/11 đến 03/11 | Việc theo buổi; sửa Lịch Google 400; lịch hai chiều; lịch thanglong | #147, #148, #150, #151 |
| 05/11 | Sửa tương phản chữ phụ, CI tro-nang xanh lại | #153 |
