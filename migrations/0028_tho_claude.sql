-- Thợ Claude chạy trên máy riêng: lượt có thể chạy ở máy (noi_chay = 'may') thay vì GitHub Actions,
-- tự xếp hàng từ việc nhóm Claude (tu_dong = 1), ghép dự án Sonicplan với thư mục ThangLong_KB.
ALTER TABLE luot_claude ADD COLUMN noi_chay TEXT NOT NULL DEFAULT 'github';
ALTER TABLE luot_claude ADD COLUMN tu_dong INTEGER NOT NULL DEFAULT 0;
ALTER TABLE luot_claude ADD COLUMN tiep_luot INTEGER;
ALTER TABLE luot_claude ADD COLUMN thu_muc_lam TEXT;
ALTER TABLE luot_claude ADD COLUMN drive_duong_dan TEXT;
ALTER TABLE luot_claude ADD COLUMN bat_dau_luc TEXT;
ALTER TABLE luot_claude ADD COLUMN ket_thuc_luc TEXT;
CREATE INDEX idx_luot_claude_may ON luot_claude (noi_chay, trang_thai, id);
ALTER TABLE du_an ADD COLUMN kb_thu_muc TEXT;
ALTER TABLE du_an ADD COLUMN kb_duyet INTEGER NOT NULL DEFAULT 0;
