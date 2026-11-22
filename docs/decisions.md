# Quyết định kỹ thuật

## 2026-11-22 - Cột trạng thái trang Việc

- **Thêm cột `viec.tien_do` (migration 0056) thay vì đổi `trang_thai`.** `trang_thai` (`mo`, `xong`, `huy`) đang được Telegram, lịch, nhắc việc, vòng học dùng; thêm giá trị mới sẽ làm lệch các nơi đó. Cột mới có `CHECK`, mặc định NULL, không đụng dữ liệu cũ.
- **"Đang làm" không suy được từ dữ liệu sẵn có.** Không có cột hay sự kiện nào cho biết người dùng đã bắt đầu một việc; trạng thái lượt Claude (`luot_claude`) đã ngừng ghi từ migration 0036. Vì vậy người dùng tự đặt bằng cách kéo thẻ.
- **"Chờ anh duyệt" suy từ ô hỏi AI đang chờ (`cau_hoi_ai` `moi`/`cho`).** Đề bài gốc nêu `claude_trang_thai` là `xong` hoặc `hoi`, nhưng cột này không có trong CSDL và API không trả. Ô hỏi AI là tín hiệu còn sống gần nhất với "Claude đang hỏi lại".
- **Tiến độ người dùng đặt thắng suy luận.** Kéo thẻ là ý định rõ của người dùng; nếu suy luận thắng thì thẻ vừa kéo sẽ bật về cột cũ.
- **Tab lưu ở `cai_dat` theo người dùng (`viec_tab:<id>`), không tạo bảng mới.** Theo tiền lệ `tq_bo_cuc:<id>` của trang Tổng quan; máy tính và điện thoại dùng chung. Máy chủ chỉ giữ trường đã biết, giao diện kiểm lại từng giá trị theo danh sách hợp lệ.
- **Nhãn ưu tiên dùng `--loi` làm nền, `--nen` làm chữ.** Hai token có sẵn, tự đổi theo sáng tối, tương phản đo được 6,85:1 và 9,23:1.
