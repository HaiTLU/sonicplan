-- Mỗi lần giao một việc cho Claude Code (chạy trên GitHub Actions của khách) là một lượt.
-- ma_bam: băm của mã dùng một lần mà lượt chạy gửi kèm khi báo kết quả về /nhan/claude.
CREATE TABLE IF NOT EXISTS luot_claude (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  viec_id       INTEGER NOT NULL REFERENCES viec (id),
  trang_thai    TEXT NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'dang_lam', 'xong', 'loi')),
  dan           TEXT,
  ket_qua       TEXT,
  nhanh         TEXT,
  pr            TEXT,
  nhat_ky       TEXT,
  danh_gia      TEXT CHECK (danh_gia IN ('dat', 'lam_lai')),
  ma_bam        TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_luot_claude_viec ON luot_claude (to_chuc_id, viec_id, id);
