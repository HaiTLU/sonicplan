-- Thông báo trên web: chuông trong trang (bảng thong_bao) và thông báo đẩy của trình duyệt (bảng dang_ky_day, Web Push).
-- Thông báo tính theo tổ chức. Giữ tối đa 200 dòng mỗi tổ chức, dòng cũ tự xóa khi có dòng mới.
CREATE TABLE IF NOT EXISTS thong_bao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id TEXT NOT NULL,
  loai TEXT NOT NULL,
  tieu_de TEXT NOT NULL,
  noi_dung TEXT,
  duong_dan TEXT,
  viec_id INTEGER,
  tao_luc TEXT NOT NULL,
  da_doc_luc TEXT
);
CREATE INDEX IF NOT EXISTS thong_bao_to_chuc ON thong_bao (to_chuc_id, id);

-- Mỗi trình duyệt (máy tính, điện thoại) bấm "Bật thông báo" là một dòng. Dịch vụ đẩy báo địa chỉ hết hạn thì xóa dòng.
CREATE TABLE IF NOT EXISTS dang_ky_day (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  thiet_bi TEXT,
  tao_luc TEXT NOT NULL,
  lan_cuoi TEXT,
  so_loi INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dang_ky_day_to_chuc ON dang_ky_day (to_chuc_id);
