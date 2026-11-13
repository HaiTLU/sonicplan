-- Đợt thanh toán của hợp đồng (khu Dự án). so_tien để trống được cho tới khi PM nhập số đã thống nhất.
-- Điều kiện thanh toán gắn với một hạng mục hoặc một sản phẩm bàn giao; "đủ điều kiện" tính lúc đọc,
-- không lưu cứng. Khi đánh dấu đã trả, api tạo một dòng qlda_giai_ngan và lưu mã vào giai_ngan_id.

CREATE TABLE IF NOT EXISTS qlda_dot_thanh_toan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  hop_dong_id   INTEGER NOT NULL REFERENCES qlda_hop_dong (id),
  ten           TEXT NOT NULL,
  thu_tu        INTEGER NOT NULL DEFAULT 0,
  so_tien       REAL,
  han           TEXT,
  hang_muc_id   INTEGER REFERENCES qlda_hang_muc (id) ON DELETE SET NULL,
  ban_giao_id   INTEGER REFERENCES qlda_san_pham_ban_giao (id) ON DELETE SET NULL,
  dieu_kien     TEXT NOT NULL DEFAULT '',
  trang_thai    TEXT NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'da_de_nghi', 'da_tra', 'huy')),
  ngay_tra      TEXT,
  giai_ngan_id  INTEGER REFERENCES qlda_giai_ngan (id),
  ghi_chu       TEXT NOT NULL DEFAULT '',
  tao_boi       TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_dot_thanh_toan_tc ON qlda_dot_thanh_toan (to_chuc_id, hop_dong_id, thu_tu);
CREATE INDEX IF NOT EXISTS qlda_dot_thanh_toan_han ON qlda_dot_thanh_toan (to_chuc_id, trang_thai, han);
