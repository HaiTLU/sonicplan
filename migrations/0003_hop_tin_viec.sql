-- Giai đoạn 1-3: hộp tin, việc, lịch, Telegram, sao lưu.
-- Chỉ cộng thêm bảng và cột, không xóa hay đổi kiểu dữ liệu cũ.

-- Mã hộp thư của tổ chức: thư gửi tới <ma_nhan>@<EMAIL_DOMAIN> vào hộp tin của tổ chức đó.
ALTER TABLE to_chuc ADD COLUMN ma_nhan TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS to_chuc_ma_nhan ON to_chuc (ma_nhan);
UPDATE to_chuc SET ma_nhan = 'namhai' WHERE id = 'tc_namhai' AND ma_nhan IS NULL;

-- Mã truy cập cho máy gửi tin Zalo và đường dẫn lịch. Chỉ lưu mã băm SHA-256,
-- mã thật chỉ hiện một lần lúc tạo.
CREATE TABLE IF NOT EXISTS khoa_truy_cap (
  ma_bam      TEXT PRIMARY KEY,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  loai        TEXT NOT NULL CHECK (loai IN ('zalo', 'lich')),
  tao_luc     TEXT NOT NULL,
  dung_luc    TEXT
);
CREATE INDEX IF NOT EXISTS khoa_truy_cap_to_chuc ON khoa_truy_cap (to_chuc_id, loai);

-- Trạng thái tách việc của từng tin: 0 chưa, 2 đang xử lý, 1 xong, 3 lỗi (bỏ qua).
ALTER TABLE tin_nhan ADD COLUMN da_tach INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tin_nhan ADD COLUMN tach_luc TEXT;
CREATE INDEX IF NOT EXISTS tin_nhan_cho_tach ON tin_nhan (da_tach, to_chuc_id, id);

-- Tệp lưu trong kho R2 của Cloudflare (thay Google Drive).
ALTER TABLE tep ADD COLUMN r2_khoa TEXT;
ALTER TABLE tep ADD COLUMN nguon TEXT;
ALTER TABLE tep ADD COLUMN nguoi_gui TEXT;

-- Thiết lập nhỏ theo tổ chức (mã chat Telegram, mốc báo việc...). Không chứa bí mật.
CREATE TABLE IF NOT EXISTS cai_dat (
  to_chuc_id  TEXT NOT NULL,
  khoa        TEXT NOT NULL,
  gia_tri     TEXT,
  PRIMARY KEY (to_chuc_id, khoa)
);

-- Lệnh đang chờ máy Mac lấy (ví dụ /tomtat gửi từ Telegram).
CREATE TABLE IF NOT EXISTS lenh_cho (
  to_chuc_id  TEXT PRIMARY KEY,
  lenh        TEXT NOT NULL,
  tu_luc      TEXT NOT NULL,
  nhan        TEXT,
  tao_luc     TEXT NOT NULL
);
