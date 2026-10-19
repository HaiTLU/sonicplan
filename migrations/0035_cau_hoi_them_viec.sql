-- Ô hỏi "Có thêm việc này không?": AI phân vân một tin có nên thành việc. Chưa tạo việc, đề xuất nằm trong de_xuat (JSON)
-- và viec_id = 0 cho tới khi người dùng bấm Thêm. tin_nhan_id để không hỏi lại một tin.
ALTER TABLE cau_hoi_ai ADD COLUMN de_xuat TEXT;
ALTER TABLE cau_hoi_ai ADD COLUMN tin_nhan_id INTEGER;
