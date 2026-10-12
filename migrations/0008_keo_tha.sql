-- Kéo thả thẻ việc: thứ tự tay trong cột, và cờ báo Google Tasks, Lịch cần cập nhật khi đổi hạn.
ALTER TABLE viec ADD COLUMN thu_tu INTEGER;
ALTER TABLE viec ADD COLUMN can_dong_bo INTEGER NOT NULL DEFAULT 0;
