-- Nút "Spam" trong Hộp tin: chặn một nhóm Zalo, một người gửi Zalo hoặc một địa chỉ thư.
-- Tin của nguồn bị chặn vẫn lưu (spam = 1) nhưng không hiện, không đếm và không đưa cho AI tách việc.
ALTER TABLE tin_nhan ADD COLUMN spam INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tin_spam ON tin_nhan (to_chuc_id, spam, id);

-- loai: 'nhom' (nhóm Zalo), 'ca-nhan' (người gửi Zalo), 'thu' (địa chỉ thư, viết thường).
-- viec_huy: danh sách id việc đang mở đã hủy khi chặn, để bỏ chặn thì mở lại đúng những việc đó.
CREATE TABLE IF NOT EXISTS chan_tin (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  nguon       TEXT NOT NULL CHECK (nguon IN ('zalo', 'gmail')),
  loai        TEXT NOT NULL CHECK (loai IN ('nhom', 'ca-nhan', 'thu')),
  ten         TEXT NOT NULL,
  so_tin      INTEGER NOT NULL DEFAULT 0,
  viec_huy    TEXT NOT NULL DEFAULT '[]',
  tao_luc     TEXT NOT NULL,
  UNIQUE (to_chuc_id, nguon, loai, ten)
);
