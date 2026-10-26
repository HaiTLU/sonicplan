-- Nền cho phân hệ quản lý dự án lớn (Viện Hòa Lạc), dùng chung cơ chế nhiều khách của Sonicplan
-- nhưng cách ly hẳn khỏi phần còn lại: mỗi tổ chức có một "phạm vi truy cập", chỉ 'hoalac' mới
-- vào được đường dẫn /hoalac và /api/hoalac (src/index.js kiểm), và chỉ /hoalac mới thấy phạm vi đó.
PRAGMA defer_foreign_keys = true;

ALTER TABLE to_chuc ADD COLUMN pham_vi_truy_cap TEXT NOT NULL DEFAULT 'chung' CHECK (pham_vi_truy_cap IN ('chung', 'hoalac'));

-- thanh_vien.vai_tro có CHECK chỉ nhận chu, thanh_vien; cần thêm doi_tac (tư vấn bên ngoài, chỉ thấy
-- phần được giao). SQLite không sửa CHECK tại chỗ nên dựng lại bảng (mẫu: 0024_nguon_hop.sql).
-- Vai trò hợp lệ kiểm ở tầng ứng dụng (src/api/chung.js), không còn CHECK ở đây.
CREATE TABLE thanh_vien_moi (
  to_chuc_id     TEXT NOT NULL REFERENCES to_chuc (id),
  nguoi_dung_id  TEXT NOT NULL REFERENCES nguoi_dung (id),
  vai_tro        TEXT NOT NULL DEFAULT 'thanh_vien',
  tao_luc        TEXT NOT NULL,
  PRIMARY KEY (to_chuc_id, nguoi_dung_id)
);
INSERT INTO thanh_vien_moi SELECT * FROM thanh_vien;
DROP TABLE thanh_vien;
ALTER TABLE thanh_vien_moi RENAME TO thanh_vien;

-- Đối tác chỉ thấy đúng hạng mục hoặc thủ tục được gán ở đây (chưa gán thì không thấy gì, không
-- báo lỗi để không lộ là hạng mục có tồn tại). loai/doi_tuong_id trỏ tới bảng của PR2/PR4.
CREATE TABLE IF NOT EXISTS qlda_giao_doi_tac (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id     TEXT NOT NULL REFERENCES to_chuc (id),
  nguoi_dung_id  TEXT NOT NULL REFERENCES nguoi_dung (id),
  loai           TEXT NOT NULL CHECK (loai IN ('hang_muc', 'thu_tuc')),
  doi_tuong_id   INTEGER NOT NULL,
  tao_luc        TEXT NOT NULL,
  UNIQUE (to_chuc_id, nguoi_dung_id, loai, doi_tuong_id)
);
CREATE INDEX IF NOT EXISTS qlda_giao_doi_tac_nguoi ON qlda_giao_doi_tac (to_chuc_id, nguoi_dung_id);

PRAGMA defer_foreign_keys = false;
