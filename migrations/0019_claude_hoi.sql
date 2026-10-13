-- Giao Claude cả dự án (một lượt gộp nhiều việc) và câu hỏi Claude hỏi lại người dùng.
-- lo_id: lượt chính của lần gộp; các việc khác trong lần gộp có một dòng riêng trỏ về lượt chính để thẻ việc hiện cùng kết quả.
-- cau_hoi: JSON mảng câu hỏi Claude cần người dùng trả lời (tách từ cuối kết quả).
ALTER TABLE luot_claude ADD COLUMN lo_id INTEGER;
ALTER TABLE luot_claude ADD COLUMN cau_hoi TEXT;
CREATE INDEX IF NOT EXISTS idx_luot_claude_lo ON luot_claude (lo_id);
