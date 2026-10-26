-- Hòa Lạc PR5: ngân sách và EVM (Earned Value Management).
-- Số liệu thật của dự án còn khác nhau giữa các bản hồ sơ (TMĐT 1.612,245 tỷ ở bản 23/9 v14.2,
-- bản rà soát 24/9 tính lại khoảng 1.795,6 tỷ, bản 26/8 và tin Zalo nhóm nhắc 1.700-1.750 tỷ)
-- nên không tự chọn một bản làm chuẩn: mọi dòng ngân sách tạo ra ở đây để ngan_sach_du_kien NULL
-- và trang_thai_so_lieu = 'chua_thong_nhat' cho tới khi PM xác nhận bản nào đúng. Không có cơ chế
-- gán theo dòng cho đối tác (giống qlda_giao_doi_tac của WBS/pháp lý), nên api.js chặn hẳn đối tác.

CREATE TABLE IF NOT EXISTS qlda_ngan_sach_dong (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id         TEXT NOT NULL REFERENCES to_chuc (id),
  ten                TEXT NOT NULL,
  nhom               TEXT NOT NULL DEFAULT '',
  ngan_sach_du_kien  REAL,
  don_vi_tien        TEXT NOT NULL DEFAULT 'VND',
  nguon              TEXT NOT NULL DEFAULT '',
  trang_thai_so_lieu TEXT NOT NULL DEFAULT 'chua_thong_nhat'
                     CHECK (trang_thai_so_lieu IN ('chua_thong_nhat', 'da_xac_nhan')),
  ghi_chu            TEXT NOT NULL DEFAULT '',
  tao_boi            TEXT NOT NULL,
  tao_luc            TEXT NOT NULL,
  cap_nhat_luc       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_ngan_sach_dong_tc ON qlda_ngan_sach_dong (to_chuc_id, nhom);

CREATE TABLE IF NOT EXISTS qlda_giai_ngan (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id        TEXT NOT NULL REFERENCES to_chuc (id),
  ngan_sach_dong_id INTEGER REFERENCES qlda_ngan_sach_dong (id),
  so_tien           REAL NOT NULL,
  ngay              TEXT,
  noi_dung          TEXT NOT NULL DEFAULT '',
  tep_id            INTEGER REFERENCES tep (id),
  tao_boi           TEXT NOT NULL,
  tao_luc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_giai_ngan_tc ON qlda_giai_ngan (to_chuc_id, ngan_sach_dong_id);

-- EVM: mỗi dòng là một kỳ báo cáo. pv/ac/ev để NULL khi chưa đo được; cv/sv/cpi/spi tính lúc GET
-- trong api.js (không lưu cứng) để khỏi lệch khi số nguồn sửa lại.
CREATE TABLE IF NOT EXISTS qlda_evm (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id   TEXT NOT NULL REFERENCES to_chuc (id),
  ky           TEXT NOT NULL,
  pv           REAL,
  ac           REAL,
  ev           REAL,
  ghi_chu      TEXT NOT NULL DEFAULT '',
  tao_boi      TEXT NOT NULL,
  tao_luc      TEXT NOT NULL,
  cap_nhat_luc TEXT NOT NULL
);
-- Một kỳ chỉ một dòng, tránh UI phải gộp nhiều dòng trùng kỳ.
CREATE UNIQUE INDEX IF NOT EXISTS qlda_evm_ky ON qlda_evm (to_chuc_id, ky);
