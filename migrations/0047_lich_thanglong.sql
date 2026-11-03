-- Lịch của tài khoản thanglong (chỉ đọc): mã sự kiện nguồn của việc tạo từ đó, để không tạo trùng.
ALTER TABLE viec ADD COLUMN lich_tlu_event_id TEXT;
CREATE INDEX IF NOT EXISTS viec_lich_tlu_event ON viec (to_chuc_id, lich_tlu_event_id) WHERE lich_tlu_event_id IS NOT NULL;
