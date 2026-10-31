-- Bộ nhớ hai tầng: tìm ghi nhớ bằng FTS5 thay cho LIKE. Chỉ cộng thêm, không đổi cột hay xóa dữ liệu.
-- Bảng ghi_nho là nơi duy nhất giữ dữ liệu; ghi_nho_fts chỉ là chỉ mục phản chiếu (external content).
-- remove_diacritics 2 gộp "văn bản" với "van ban" nhưng KHÔNG gộp "đ" với "d": mã tìm kiếm tự thêm biến thể.
CREATE VIRTUAL TABLE IF NOT EXISTS ghi_nho_fts USING fts5(
  tieu_de, noi_dung, content='ghi_nho', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS ghi_nho_fts_ai AFTER INSERT ON ghi_nho BEGIN
  INSERT INTO ghi_nho_fts (rowid, tieu_de, noi_dung) VALUES (new.id, new.tieu_de, new.noi_dung);
END;

CREATE TRIGGER IF NOT EXISTS ghi_nho_fts_ad AFTER DELETE ON ghi_nho BEGIN
  INSERT INTO ghi_nho_fts (ghi_nho_fts, rowid, tieu_de, noi_dung) VALUES ('delete', old.id, old.tieu_de, old.noi_dung);
END;

CREATE TRIGGER IF NOT EXISTS ghi_nho_fts_au AFTER UPDATE OF tieu_de, noi_dung ON ghi_nho BEGIN
  INSERT INTO ghi_nho_fts (ghi_nho_fts, rowid, tieu_de, noi_dung) VALUES ('delete', old.id, old.tieu_de, old.noi_dung);
  INSERT INTO ghi_nho_fts (rowid, tieu_de, noi_dung) VALUES (new.id, new.tieu_de, new.noi_dung);
END;

-- Lấp dữ liệu hiện có.
INSERT INTO ghi_nho_fts (ghi_nho_fts) VALUES ('rebuild');
