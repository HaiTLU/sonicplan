-- Dự án: nhãn gom việc theo mảng, kèm nhãn nguồn của việc và lịch sử từng việc.
CREATE TABLE IF NOT EXISTS du_an (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id TEXT NOT NULL REFERENCES to_chuc (id),
  ten TEXT NOT NULL,
  tu_khoa TEXT NOT NULL DEFAULT '[]',
  thu_tu INTEGER NOT NULL DEFAULT 0,
  tao_luc TEXT NOT NULL,
  UNIQUE (to_chuc_id, ten)
);
ALTER TABLE viec ADD COLUMN du_an_id INTEGER;
ALTER TABLE viec ADD COLUMN nguon TEXT;
CREATE TABLE IF NOT EXISTS viec_su_kien (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id TEXT NOT NULL,
  viec_id INTEGER NOT NULL,
  du_an_id INTEGER,
  loai TEXT NOT NULL,
  noi_dung TEXT,
  tin_nhan_id INTEGER,
  luc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_viec_su_kien_duan ON viec_su_kien (to_chuc_id, du_an_id, luc);
CREATE INDEX IF NOT EXISTS idx_viec_du_an ON viec (to_chuc_id, du_an_id);
UPDATE viec SET nguon = COALESCE((SELECT t.nguon FROM tin_nhan t WHERE t.id = viec.tin_nhan_id), 'tay') WHERE nguon IS NULL;
INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, tin_nhan_id, luc)
  SELECT to_chuc_id, id, 'tao', tieu_de, tin_nhan_id, tao_luc FROM viec;
INSERT INTO viec_su_kien (to_chuc_id, viec_id, loai, noi_dung, luc)
  SELECT to_chuc_id, id, 'xong', tieu_de, xong_luc FROM viec WHERE trang_thai = 'xong' AND xong_luc IS NOT NULL;
