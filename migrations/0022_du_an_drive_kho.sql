-- Lưu mọi thứ của dự án vào Drive kho: mã thư mục dự án do Sonicplan tạo (rỗng nghĩa là chưa bật).
ALTER TABLE du_an ADD COLUMN drive_kho_id TEXT;
