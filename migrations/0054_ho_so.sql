-- Kho hồ sơ của khu Dự án (học Procore, Autodesk Build): mỗi hồ sơ nằm trong một thư mục chuẩn, có thể
-- gắn với một thủ tục pháp lý, một hợp đồng hoặc một sản phẩm bàn giao, và có nhiều phiên bản.
-- Tệp lưu ở kho tệp (R2 trên Cloudflare, thư mục du-lieu/tep trên VPS) qua bảng tep.
-- Không có xóa: hồ sơ không dùng nữa thì đặt nhãn 'het_hieu_luc' cho phiên bản mới nhất.

CREATE TABLE IF NOT EXISTS qlda_ho_so (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  thu_muc       TEXT NOT NULL CHECK (thu_muc IN ('phap_ly', 'hop_dong', 'van_ban', 'bien_ban_hop', 'ban_giao', 'khac')),
  ten           TEXT NOT NULL,
  mo_ta         TEXT NOT NULL DEFAULT '',
  thu_tuc_id    INTEGER REFERENCES qlda_thu_tuc (id) ON DELETE SET NULL,
  hop_dong_id   INTEGER REFERENCES qlda_hop_dong (id) ON DELETE SET NULL,
  ban_giao_id   INTEGER REFERENCES qlda_san_pham_ban_giao (id) ON DELETE SET NULL,
  han_hieu_luc  TEXT,
  tao_boi       TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_ho_so_tc ON qlda_ho_so (to_chuc_id, thu_muc, id);

CREATE TABLE IF NOT EXISTS qlda_ho_so_phien_ban (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  ho_so_id      INTEGER NOT NULL REFERENCES qlda_ho_so (id),
  so            INTEGER NOT NULL,
  tep_id        INTEGER NOT NULL REFERENCES tep (id),
  trang_thai    TEXT NOT NULL DEFAULT 'du_thao' CHECK (trang_thai IN ('du_thao', 'cho_duyet', 'da_duyet', 'het_hieu_luc')),
  ghi_chu       TEXT NOT NULL DEFAULT '',
  doi_boi       TEXT,
  doi_luc       TEXT,
  tao_boi       TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  UNIQUE (ho_so_id, so)
);
CREATE INDEX IF NOT EXISTS qlda_ho_so_phien_ban_tc ON qlda_ho_so_phien_ban (to_chuc_id, ho_so_id, so);
