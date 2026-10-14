-- Mã hội thoại của Zalo (threadId). Dùng để gom tin của một cuộc trò chuyện vào một mục,
-- kể cả tin mình gửi đi, không phụ thuộc tên hiển thị. Tin cũ để trống, vẫn gom theo tên.
ALTER TABLE tin_nhan ADD COLUMN ma_hoi_thoai TEXT;
CREATE INDEX IF NOT EXISTS tin_nhan_hoi_thoai ON tin_nhan (to_chuc_id, nguon, ma_hoi_thoai);
