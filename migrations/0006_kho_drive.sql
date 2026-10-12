-- Kho Drive: ghi lại mục nào đã lưu sang Drive kho, và dấu để biết khi nào phải lưu lại.
-- loai: tep | tin (tin nhắn, thư theo ngày) | bo_nho | viec.
CREATE TABLE IF NOT EXISTS kho_da_luu (
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  loai        TEXT NOT NULL,
  ma          TEXT NOT NULL,
  drive_id    TEXT NOT NULL,
  moc         TEXT,
  luc         TEXT NOT NULL,
  PRIMARY KEY (to_chuc_id, loai, ma)
);
