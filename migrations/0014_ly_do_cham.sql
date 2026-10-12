-- Lý do AI chấm độ nặng (một câu ngắn) và cờ việc ghi chưa rõ, để trang Hiệu suất giải thích được từng việc.
ALTER TABLE viec ADD COLUMN do_nang_ly_do TEXT;
ALTER TABLE viec ADD COLUMN chua_ro INTEGER;
