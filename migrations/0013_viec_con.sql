-- Việc con do AI chia từ việc lớn (người dùng duyệt bằng nút trước khi tạo).
ALTER TABLE viec ADD COLUMN viec_cha_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_viec_cha ON viec (to_chuc_id, viec_cha_id);
