-- Kiểu xem "Theo trạng thái" của trang Việc (PM chọn 22/11/2026): người dùng kéo thẻ để tự đánh dấu tiến độ.
-- Chỉ cộng một cột, mặc định NULL, không đổi dữ liệu cũ. NULL nghĩa là chưa đặt: giao diện tự suy
-- (việc có ô hỏi AI đang chờ trả lời vào "Chờ anh duyệt", còn lại "Chưa làm").
-- Sao lưu trước khi gộp: du-lieu/sonicplan.sqlite.truoc-tien-do-viec-<YYMMDD> (VACUUM INTO).
ALTER TABLE viec ADD COLUMN tien_do TEXT CHECK (tien_do IN ('chua_lam', 'dang_lam', 'cho_duyet'));
