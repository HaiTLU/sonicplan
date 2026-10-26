# Tiến độ - Sonicplan

Cập nhật: 11/10/2026.

## Kế hoạch đợt

- **Tệp sẽ sửa:** toàn bộ kho (mới).
- **Thứ tự làm:** cấu hình Worker và D1; bảng dữ liệu nhiều khách; kiểm đăng nhập Access; mã hóa khóa; hẹn giờ tự kiểm; trang Tình trạng và Nhật ký chạy; kiểm thử; tạo D1 thật; hướng dẫn đưa lên Cloudflare.
- **Rủi ro:** (1) kiểm vé Access sai thì hoặc khóa mất anh, hoặc để lọt người ngoài: có kiểm thử vé giả, vé sai AUD, sai nơi cấp, hết hạn, sửa nội dung; thiếu cấu hình Access thì từ chối hết. (2) Lộ dữ liệu giữa các khách: mọi truy vấn lọc `to_chuc_id`. (3) Dựng lại khi đẩy commit của dự án khác: đặt build watch paths là thư mục này.
- **Cách chứng minh đạt:** `npm test` 9/9 đạt; `npx wrangler deploy --dry-run` đóng gói được; chạy `wrangler dev`, gọi hẹn giờ thử thì nhật ký có dòng "xong" và đèn Hẹn giờ xanh; chụp ảnh 1366 và 390.

## Đã kiểm

- 11/10: `npm test` 9/9 đạt; chạy thử trên máy: `/api/suc-khoe` trả ok, hẹn giờ ghi nhật ký, `/api/tinh-trang` đúng, yêu cầu từ tên miền khác localhost không có vé thì 401; ảnh ở `/mnt/project-files/NenTangTuDong/`.
- 11/10: D1 thật có đủ 10 bảng và dòng anh là chủ tổ chức `tc_namhai`.

- 11/10 (đợt 2): thêm nhận tin Zalo, thư, tệp R2, AI tách việc, việc và lịch .ics, Telegram, dọn cuối ngày, sao lưu, canh Zalo, canh việc mất; bảng mới ở `migrations/0003`. `npm test` 17/17 đạt; đóng gói thử được.
- 11/10 (đợt 2): giao diện mới chạy thử với dữ liệu mẫu, chụp 6 trang ở 1366 và 390, sáng và tối; thêm việc, sửa việc, bảng lệnh Ctrl K chạy đúng, không lỗi JS.

## Bước tiếp

- Anh làm README bước 1-7 (bước 2, 3, 4 cần gửi lại Claude giá trị để ghi vào cấu hình).
- Claude: chạy migration 0003 trên D1 thật, tạo thùng R2 khi anh đã bật R2.

## Phân hệ Viện Hòa Lạc (/hoalac) - PR2: WBS/Gantt/CPM/baseline/stage gate/Kanban

- 26/10: nhánh `claude/hoalac-2-wbs` (tách từ nhánh `claude/hoalac` cũ vì PR1 đã gộp bằng squash-merge, không dùng lại được). Migration `0039_hoalac_wbs.sql` (giai đoạn, hạng mục có cột CPM, phụ thuộc FS/SS/FF/SF, baseline). `src/hoalac/wbs.js` tính CPM thuần (forward+backward, Kahn's algorithm chặn vòng tròn). `src/hoalac/api.js` thêm các API giai-doan/hang-muc/phu-thuoc/baseline. Giao diện `public/hoalac/` (Kanban kéo-thả, Gantt rút gọn theo CPM).
- 26/10: cố vấn (advisor) rà trước khi gộp, phát hiện và đã sửa: (1) thuộc tính HTML `draggable` là kiểu liệt kê, gán `true`/`false` (boolean JS) qua `h()` ra `draggable=""` không kéo được - sửa thành chuỗi `'true'`/`null`; (2) xóa hạng mục không dọn `nhom_id` của hạng mục con và không chặn khi hạng mục đã vào baseline, có thể vỡ ràng buộc khóa ngoài trên D1 thật (bộ kiểm dùng SQLite trong bộ nhớ tắt FK nên không bắt được) - đã thêm `UPDATE ... SET nhom_id = NULL` và trả 409 khi hạng mục nằm trong baseline; (3) thứ tự xóa bảng `qlda_*` trong `BANG_CUA_TO_CHUC` (xóa cả tổ chức) sai, cha đứng trước con - đã đổi thành con trước cha đúng quy ước có sẵn; (4) vài chỗ dọn mã nhỏ (import `fmt` thừa, biến `db` không dùng, tên hàm trùng, chặn chia 0 ở Gantt khi dự án toàn mốc).
- 26/10: thêm 2 ca kiểm cho các sửa ở mục (2): xóa hạng mục có con qua `nhom_id`, và chặn xóa khi đã vào baseline. `node --test test/hoalac-wbs.test.js test/hoalac-quyen.test.js` 25/25 đạt.
- Chưa làm: kiểm trực tiếp trên trình duyệt (`may-chu/chay.js` cục bộ, vai chủ và đối tác) theo yêu cầu của kế hoạch đã duyệt - sẽ đánh dấu UNVERIFIED trong báo cáo cuối nếu chưa kịp làm trước khi gộp PR2.

## Bước tiếp (Hòa Lạc)

- Kiểm trình duyệt thật rồi `npm run kiem` lần cuối, commit, đẩy nhánh `claude/hoalac-2-wbs`, mở PR2, tự gộp khi kiểm tự động đạt.
- Sau khi PR2 gộp: PR3 (RAID, migration 0040), PR4 (Pháp lý/Hợp đồng/Các bên, migration 0041 + nhập 24 việc/5 nhóm), PR5 (Ngân sách & EVM, migration 0042, số để trống chờ PM xác nhận bản TMĐT), PR6 (lịch .ics + hoàn thiện README).
