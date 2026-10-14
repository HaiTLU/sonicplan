-- Ảnh đại diện dự án: icon (một biểu tượng chọn sẵn) và khóa ảnh tải lên trong kho tệp (rỗng nghĩa là chưa có).
ALTER TABLE du_an ADD COLUMN icon TEXT;
ALTER TABLE du_an ADD COLUMN anh_khoa TEXT;
