-- Đề xuất chỉ lưu trong Sonicplan, không sửa nguồn second-brain.
CREATE TABLE IF NOT EXISTS dashboard_de_xuat (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 to_chuc_id TEXT NOT NULL REFERENCES to_chuc(id),
 tieu_de TEXT NOT NULL,
 truoc TEXT NOT NULL,
 sau TEXT NOT NULL,
 nguon TEXT NOT NULL,
 phien_ban TEXT NOT NULL DEFAULT '',
 nguoi_de_xuat TEXT NOT NULL,
 trang_thai TEXT NOT NULL DEFAULT 'draft' CHECK(trang_thai IN ('draft','approved','rejected')),
 tao_luc TEXT NOT NULL,
 cap_nhat_luc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dashboard_de_xuat_tc ON dashboard_de_xuat(to_chuc_id,cap_nhat_luc DESC);
