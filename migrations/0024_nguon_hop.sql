-- Thêm nguồn tin "hop" (ghi âm và biên bản họp lấy từ một thư mục Google Drive).
-- Cột nguon của tin_nhan có ràng buộc CHECK chỉ nhận zalo, gmail; SQLite không sửa được CHECK
-- nên dựng lại bảng, giữ nguyên id để việc, tệp và ghi nhớ vẫn trỏ đúng tin.
-- Bỏ hẳn CHECK để nguồn mới sau này không phải dựng lại bảng; mã ứng dụng tự kiểm nguồn.
PRAGMA defer_foreign_keys = true;

CREATE TABLE tin_nhan_moi (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  nguon       TEXT NOT NULL,
  ma_goc      TEXT NOT NULL,
  nguoi_gui   TEXT,
  nhom        TEXT,
  tieu_de     TEXT,
  noi_dung    TEXT,
  thoi_diem   TEXT NOT NULL,
  da_xem      INTEGER NOT NULL DEFAULT 0,
  tao_luc     TEXT NOT NULL,
  da_tach     INTEGER NOT NULL DEFAULT 0,
  tach_luc    TEXT,
  an          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (to_chuc_id, nguon, ma_goc)
);

INSERT INTO tin_nhan_moi (id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem, da_xem, tao_luc, da_tach, tach_luc, an)
  SELECT id, to_chuc_id, nguon, ma_goc, nguoi_gui, nhom, tieu_de, noi_dung, thoi_diem, da_xem, tao_luc, da_tach, tach_luc, an FROM tin_nhan;

DROP TABLE tin_nhan;
ALTER TABLE tin_nhan_moi RENAME TO tin_nhan;

CREATE INDEX IF NOT EXISTS tin_nhan_thoi_diem ON tin_nhan (to_chuc_id, thoi_diem DESC);
CREATE INDEX IF NOT EXISTS tin_nhan_cho_tach ON tin_nhan (da_tach, to_chuc_id, id);
CREATE INDEX IF NOT EXISTS tin_nhan_chua_xem ON tin_nhan (to_chuc_id, da_xem, an);

PRAGMA defer_foreign_keys = false;
