-- Tệp đi kèm lượt Claude do người dùng chỉnh lúc giao: {"them":[id tệp tự thêm], "bo":[id tệp tự tìm được nhưng bỏ chọn]} (JSON, NULL là không chỉnh gì).
ALTER TABLE luot_claude ADD COLUMN tep_tuy TEXT;
