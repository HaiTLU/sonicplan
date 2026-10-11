-- Giai đoạn A: bộ nhớ lâu dài và nhắc việc theo giờ hẹn. Chỉ cộng thêm.

-- Điều hệ thống nhớ về người, dự án, quyết định. AI chỉ thêm hoặc cập nhật; người dùng sửa, ghim, xóa.
CREATE TABLE IF NOT EXISTS ghi_nho (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  loai          TEXT NOT NULL CHECK (loai IN ('nguoi', 'du_an', 'quyet_dinh', 'su_that')),
  tieu_de       TEXT NOT NULL,
  noi_dung      TEXT NOT NULL,
  tin_nhan_id   INTEGER,
  nguon         TEXT NOT NULL DEFAULT 'ai' CHECK (nguon IN ('ai', 'tay')),
  do_tin_cay    TEXT NOT NULL DEFAULT 'cao' CHECK (do_tin_cay IN ('cao', 'thap')),
  ghim          INTEGER NOT NULL DEFAULT 0,
  da_duyet      INTEGER NOT NULL DEFAULT 0,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ghi_nho_duy_nhat ON ghi_nho (to_chuc_id, loai, tieu_de);
CREATE INDEX IF NOT EXISTS ghi_nho_theo_loai ON ghi_nho (to_chuc_id, loai, cap_nhat_luc);

-- Mỗi lời nhắc chỉ gửi một lần: khóa chính là (việc, loại nhắc).
CREATE TABLE IF NOT EXISTS nhac_da_gui (
  viec_id  INTEGER NOT NULL,
  loai     TEXT NOT NULL,
  luc      TEXT NOT NULL,
  PRIMARY KEY (viec_id, loai)
);

-- Mức ưu tiên do AI gán: cao, vua, thap.
ALTER TABLE viec ADD COLUMN uu_tien TEXT;
