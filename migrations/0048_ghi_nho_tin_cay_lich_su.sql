-- Bộ nhớ hai tầng, bước 2: độ tin cậy dạng số, hiệu lực, hạn dùng, nguồn tham chiếu và lịch sử phiên bản.
-- Chỉ cộng thêm: không xóa hay đổi cột cũ.
ALTER TABLE ghi_nho ADD COLUMN do_tin_cay_so REAL;
ALTER TABLE ghi_nho ADD COLUMN het_hieu_luc_luc TEXT;
ALTER TABLE ghi_nho ADD COLUMN han_dung TEXT;
ALTER TABLE ghi_nho ADD COLUMN nguon_tham_chieu TEXT;
ALTER TABLE ghi_nho ADD COLUMN so_lan_thay INTEGER NOT NULL DEFAULT 1;

-- Mục cũ: 'cao' tương ứng 0.8, 'thap' tương ứng 0.4.
UPDATE ghi_nho SET do_tin_cay_so = CASE do_tin_cay WHEN 'cao' THEN 0.8 ELSE 0.4 END WHERE do_tin_cay_so IS NULL;

-- Mỗi lần nội dung đổi thì ghi bản cũ, để biết vì sao AI "nghĩ" như vậy. Xóa thật mục thì xóa cả lịch sử.
CREATE TABLE IF NOT EXISTS bo_nho_lich_su (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL,
  ghi_nho_id  INTEGER NOT NULL,
  tieu_de     TEXT NOT NULL,
  noi_dung    TEXT NOT NULL,
  ly_do       TEXT,
  luc         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bo_nho_lich_su_theo_muc ON bo_nho_lich_su (to_chuc_id, ghi_nho_id);
