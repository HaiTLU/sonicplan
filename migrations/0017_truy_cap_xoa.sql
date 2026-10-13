-- Nhật ký ai đã xem, tải dữ liệu (Luật 91/2025/QH15: chứng minh việc xử lý dữ liệu; tham chiếu GDPR điều 30).
-- hanh_dong: mo_trang (lần đầu mở trang trong ngày), xuat_du_lieu, tai_tep. Không lưu địa chỉ IP.
CREATE TABLE IF NOT EXISTS nhat_ky_truy_cap (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL,
  email       TEXT NOT NULL,
  hanh_dong   TEXT NOT NULL,
  chi_tiet    TEXT,
  ngay        TEXT NOT NULL,
  luc         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_truy_cap ON nhat_ky_truy_cap (to_chuc_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_truy_cap_ngay ON nhat_ky_truy_cap (to_chuc_id, email, hanh_dong, ngay);
