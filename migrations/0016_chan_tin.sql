-- Chặn nguồn tin (Spam): nhóm Zalo, người gửi hoặc địa chỉ thư không hiện trong Hộp tin
-- và không bao giờ được tính thành việc. Chỉ cộng thêm bảng và cột.
CREATE TABLE IF NOT EXISTS nguon_chan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id TEXT NOT NULL,
  nguon      TEXT NOT NULL CHECK (nguon IN ('zalo', 'gmail')),
  loai       TEXT NOT NULL CHECK (loai IN ('nhom', 'nguoi', 'dia_chi')),
  gia_tri    TEXT NOT NULL,
  nhan       TEXT NOT NULL,
  tao_luc    TEXT NOT NULL,
  UNIQUE (to_chuc_id, nguon, loai, gia_tri)
);

-- an = 1: tin thuộc nguồn đã chặn, không hiện và không đưa cho AI. Bỏ chặn thì an về 0.
ALTER TABLE tin_nhan ADD COLUMN an INTEGER NOT NULL DEFAULT 0;
