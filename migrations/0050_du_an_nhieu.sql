-- Khu "Dự án" chứa nhiều dự án: mỗi dự án là một tổ chức có pham_vi_truy_cap = 'hoalac'.
-- Mọi bảng qlda_* đã lọc theo to_chuc_id nên dữ liệu các dự án tự tách nhau; ở đây chỉ thêm cột
-- loại dự án, các phần được bật, và bảng sản phẩm bàn giao cho dự án nghiên cứu (ví dụ Ipsos).
-- Chỉ thêm, không chép lại bảng nào.

-- loai_du_an: xay_dung (công trình, có pháp lý, ngân sách) hoặc nghien_cuu (thuê đơn vị nghiên cứu, nhận bàn giao).
ALTER TABLE to_chuc ADD COLUMN loai_du_an TEXT NOT NULL DEFAULT 'xay_dung' CHECK (loai_du_an IN ('xay_dung', 'nghien_cuu'));
-- phan_bat: danh sách tab được bật, cách nhau bằng dấu phẩy (kanban,gantt,raid,phap-ly,ngan-sach,ban-giao); rỗng là bật hết.
ALTER TABLE to_chuc ADD COLUMN phan_bat TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS qlda_san_pham_ban_giao (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id        TEXT NOT NULL REFERENCES to_chuc (id),
  ten               TEXT NOT NULL,
  mo_ta             TEXT NOT NULL DEFAULT '',
  ben_giao_id       INTEGER REFERENCES qlda_ben_lien_quan (id),
  han               TEXT,
  ngay_giao         TEXT,
  trang_thai        TEXT NOT NULL DEFAULT 'chua_giao'
                    CHECK (trang_thai IN ('chua_giao', 'da_giao', 'dang_xem', 'yeu_cau_sua', 'da_duyet')),
  ghi_chu           TEXT NOT NULL DEFAULT '',
  tao_boi           TEXT NOT NULL,
  tao_luc           TEXT NOT NULL,
  cap_nhat_luc      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_san_pham_ban_giao_tc ON qlda_san_pham_ban_giao (to_chuc_id, han);
