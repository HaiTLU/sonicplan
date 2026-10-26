-- Phân hệ Viện Hòa Lạc, PR3: RAID (rủi ro, vấn đề, thay đổi, quyết định, bài học).
-- Đối tác không thấy RAID (không như hạng mục, không có cơ chế gán từng dòng cho đối tác):
-- mọi thao tác RAID trả 403 cho vai_tro = 'doi_tac' (kiểm ở src/hoalac/api.js).

-- Ma trận rủi ro 5x5: xac_suat và tac_dong 1-5, mức độ = xac_suat * tac_dong tính lúc đọc
-- (không lưu cột tính sẵn, tránh lệch khi sửa một trong hai số).
CREATE TABLE IF NOT EXISTS qlda_rui_ro (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id   TEXT NOT NULL REFERENCES to_chuc (id),
  ten          TEXT NOT NULL,
  mo_ta        TEXT NOT NULL DEFAULT '',
  xac_suat     INTEGER NOT NULL DEFAULT 3 CHECK (xac_suat BETWEEN 1 AND 5),
  tac_dong     INTEGER NOT NULL DEFAULT 3 CHECK (tac_dong BETWEEN 1 AND 5),
  bien_phap    TEXT NOT NULL DEFAULT '',
  phu_trach    TEXT NOT NULL DEFAULT '',
  hang_muc_id  INTEGER REFERENCES qlda_hang_muc (id),
  trang_thai   TEXT NOT NULL DEFAULT 'mo' CHECK (trang_thai IN ('mo', 'dang_xu_ly', 'da_dong')),
  tao_boi      TEXT NOT NULL,
  tao_luc      TEXT NOT NULL,
  cap_nhat_luc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_rui_ro_tc ON qlda_rui_ro (to_chuc_id, trang_thai);

CREATE TABLE IF NOT EXISTS qlda_van_de (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id   TEXT NOT NULL REFERENCES to_chuc (id),
  ten          TEXT NOT NULL,
  mo_ta        TEXT NOT NULL DEFAULT '',
  muc_do       TEXT NOT NULL DEFAULT 'trung' CHECK (muc_do IN ('thap', 'trung', 'cao')),
  phu_trach    TEXT NOT NULL DEFAULT '',
  rui_ro_id    INTEGER REFERENCES qlda_rui_ro (id),
  hang_muc_id  INTEGER REFERENCES qlda_hang_muc (id),
  trang_thai   TEXT NOT NULL DEFAULT 'mo' CHECK (trang_thai IN ('mo', 'dang_xu_ly', 'da_dong')),
  tao_boi      TEXT NOT NULL,
  tao_luc      TEXT NOT NULL,
  cap_nhat_luc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_van_de_tc ON qlda_van_de (to_chuc_id, trang_thai);

-- Luồng duyệt một chiều: de_xuat -> xem_xet -> duyet hoặc tu_choi (kiểm ở api.js, không lùi lại được).
CREATE TABLE IF NOT EXISTS qlda_thay_doi (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id   TEXT NOT NULL REFERENCES to_chuc (id),
  ten          TEXT NOT NULL,
  mo_ta        TEXT NOT NULL DEFAULT '',
  ly_do        TEXT NOT NULL DEFAULT '',
  anh_huong    TEXT NOT NULL DEFAULT '',
  hang_muc_id  INTEGER REFERENCES qlda_hang_muc (id),
  trang_thai   TEXT NOT NULL DEFAULT 'de_xuat' CHECK (trang_thai IN ('de_xuat', 'xem_xet', 'duyet', 'tu_choi')),
  ghi_chu_duyet TEXT NOT NULL DEFAULT '',
  de_xuat_boi  TEXT NOT NULL,
  duyet_boi    TEXT,
  tao_luc      TEXT NOT NULL,
  cap_nhat_luc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_thay_doi_tc ON qlda_thay_doi (to_chuc_id, trang_thai);

CREATE TABLE IF NOT EXISTS qlda_quyet_dinh (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id      TEXT NOT NULL REFERENCES to_chuc (id),
  ten             TEXT NOT NULL,
  noi_dung        TEXT NOT NULL DEFAULT '',
  can_cu          TEXT NOT NULL DEFAULT '',
  nguoi_quyet_dinh TEXT NOT NULL DEFAULT '',
  ngay_quyet_dinh TEXT,
  hang_muc_id     INTEGER REFERENCES qlda_hang_muc (id),
  tao_boi         TEXT NOT NULL,
  tao_luc         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_quyet_dinh_tc ON qlda_quyet_dinh (to_chuc_id, tao_luc DESC);

CREATE TABLE IF NOT EXISTS qlda_bai_hoc (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id      TEXT NOT NULL REFERENCES to_chuc (id),
  ten             TEXT NOT NULL,
  mo_ta           TEXT NOT NULL DEFAULT '',
  loai            TEXT NOT NULL DEFAULT 'tot' CHECK (loai IN ('tot', 'chua_tot')),
  de_xuat_ap_dung TEXT NOT NULL DEFAULT '',
  giai_doan_id    INTEGER REFERENCES qlda_giai_doan (id),
  tao_boi         TEXT NOT NULL,
  tao_luc         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_bai_hoc_tc ON qlda_bai_hoc (to_chuc_id, tao_luc DESC);
