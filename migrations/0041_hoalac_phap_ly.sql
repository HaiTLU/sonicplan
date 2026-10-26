-- Phân hệ Viện Hòa Lạc, PR4: pháp lý, hợp đồng tư vấn, các bên liên quan, RACI, văn bản đi/đến, họp.
-- qlda_thu_tuc ánh xạ 24 việc/5 nhóm A-E của tệp kế hoạch dự án gốc (scripts/nhap-hoalac.mjs nhập sau khi
-- PR này gộp); dùng chung cơ chế gán đối tác qlda_giao_doi_tac (loai='thu_tuc') đã có từ PR1.

CREATE TABLE IF NOT EXISTS qlda_ben_lien_quan (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id        TEXT NOT NULL REFERENCES to_chuc (id),
  ten               TEXT NOT NULL,
  loai              TEXT NOT NULL DEFAULT 'tu_van' CHECK (loai IN ('noi_bo', 'tu_van', 'co_quan_nha_nuoc', 'khac')),
  don_vi            TEXT NOT NULL DEFAULT '',
  vai_tro           TEXT NOT NULL DEFAULT '',
  lien_he           TEXT NOT NULL DEFAULT '',
  muc_do_anh_huong  TEXT CHECK (muc_do_anh_huong IS NULL OR muc_do_anh_huong IN ('cao', 'trung_binh', 'thap')),
  ghi_chu           TEXT NOT NULL DEFAULT '',
  tao_boi           TEXT NOT NULL,
  tao_luc           TEXT NOT NULL,
  cap_nhat_luc      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_ben_lien_quan_tc ON qlda_ben_lien_quan (to_chuc_id, ten);

-- vai_tro: R (Responsible), A (Accountable), C (Consulted), I (Informed). hoat_dong là văn bản tự do vì
-- RACI ở đây trải khắp cả thủ tục, hợp đồng, họp, không ràng vào đúng một bảng.
CREATE TABLE IF NOT EXISTS qlda_raci (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id        TEXT NOT NULL REFERENCES to_chuc (id),
  hoat_dong         TEXT NOT NULL,
  ben_lien_quan_id  INTEGER NOT NULL REFERENCES qlda_ben_lien_quan (id),
  vai_tro           TEXT NOT NULL CHECK (vai_tro IN ('R', 'A', 'C', 'I')),
  ghi_chu           TEXT NOT NULL DEFAULT '',
  tao_boi           TEXT NOT NULL,
  tao_luc           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_raci_tc ON qlda_raci (to_chuc_id, ben_lien_quan_id);

CREATE TABLE IF NOT EXISTS qlda_hop_dong (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id        TEXT NOT NULL REFERENCES to_chuc (id),
  ten               TEXT NOT NULL,
  ben_lien_quan_id  INTEGER REFERENCES qlda_ben_lien_quan (id),
  so_hop_dong       TEXT NOT NULL DEFAULT '',
  gia_tri           REAL,
  don_vi_tien       TEXT NOT NULL DEFAULT 'VND',
  ngay_ky           TEXT,
  ngay_bat_dau      TEXT,
  ngay_ket_thuc     TEXT,
  trang_thai        TEXT NOT NULL DEFAULT 'du_thao' CHECK (trang_thai IN ('du_thao', 'da_ky', 'dang_thuc_hien', 'da_hoan_thanh', 'da_huy')),
  tep_id            INTEGER REFERENCES tep (id),
  ghi_chu           TEXT NOT NULL DEFAULT '',
  tao_boi           TEXT NOT NULL,
  tao_luc           TEXT NOT NULL,
  cap_nhat_luc      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_hop_dong_tc ON qlda_hop_dong (to_chuc_id, trang_thai);

-- trang_thai theo STATES của tệp kế hoạch gốc. ma_nguon giữ mã việc gốc (vd 'a1') để nhap-hoalac.mjs
-- đối chiếu khi nhập, không dùng để tham chiếu khóa ngoại (khóa ngoại dùng id tự tăng, scoped to_chuc_id).
CREATE TABLE IF NOT EXISTS qlda_thu_tuc (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id              TEXT NOT NULL REFERENCES to_chuc (id),
  ma_nguon                TEXT NOT NULL DEFAULT '',
  nhom                    TEXT NOT NULL CHECK (nhom IN ('A', 'B', 'C', 'D', 'E')),
  ten                     TEXT NOT NULL,
  don_vi_phu_trach        TEXT NOT NULL DEFAULT '',
  nguon                   TEXT NOT NULL DEFAULT '',
  can_cu                  TEXT NOT NULL DEFAULT '',
  diem_chua_ro            TEXT NOT NULL DEFAULT '',
  so_ngay                 INTEGER,
  la_moc                  INTEGER NOT NULL DEFAULT 0,
  ngay_co_dinh            TEXT,
  ngay_bat_dau_thuc_te    TEXT,
  ngay_hoan_thanh_thuc_te TEXT,
  trang_thai              TEXT NOT NULL DEFAULT 'todo' CHECK (trang_thai IN ('todo', 'doing', 'wait', 'done', 'block')),
  ghi_chu                 TEXT NOT NULL DEFAULT '',
  tao_boi                 TEXT NOT NULL,
  tao_luc                 TEXT NOT NULL,
  cap_nhat_luc            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_thu_tuc_tc ON qlda_thu_tuc (to_chuc_id, nhom);

CREATE TABLE IF NOT EXISTS qlda_thu_tuc_phu_thuoc (
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  truoc_id      INTEGER NOT NULL REFERENCES qlda_thu_tuc (id),
  sau_id        INTEGER NOT NULL REFERENCES qlda_thu_tuc (id),
  PRIMARY KEY (truoc_id, sau_id)
);
CREATE INDEX IF NOT EXISTS qlda_thu_tuc_phu_thuoc_tc ON qlda_thu_tuc_phu_thuoc (to_chuc_id);

-- Tái dùng bảng tep có sẵn cho tệp văn bản đính kèm (tep_id, nullable); bảng này chỉ giữ phần siêu dữ
-- liệu công văn (số hiệu, trích yếu, nơi gửi/nhận) mà tep không có.
CREATE TABLE IF NOT EXISTS qlda_van_ban (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id            TEXT NOT NULL REFERENCES to_chuc (id),
  loai                  TEXT NOT NULL CHECK (loai IN ('den', 'di')),
  so_hieu               TEXT NOT NULL DEFAULT '',
  trich_yeu             TEXT NOT NULL,
  noi_gui               TEXT NOT NULL DEFAULT '',
  noi_nhan              TEXT NOT NULL DEFAULT '',
  ngay_van_ban          TEXT,
  ngay_nhan_gui         TEXT,
  lien_quan_thu_tuc_id  INTEGER REFERENCES qlda_thu_tuc (id),
  tep_id                INTEGER REFERENCES tep (id),
  ghi_chu               TEXT NOT NULL DEFAULT '',
  tao_boi               TEXT NOT NULL,
  tao_luc               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_van_ban_tc ON qlda_van_ban (to_chuc_id, loai, ngay_van_ban);

CREATE TABLE IF NOT EXISTS qlda_hop (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  tieu_de       TEXT NOT NULL,
  thoi_gian     TEXT NOT NULL,
  dia_diem      TEXT NOT NULL DEFAULT '',
  thanh_phan    TEXT NOT NULL DEFAULT '',
  noi_dung      TEXT NOT NULL DEFAULT '',
  tep_id        INTEGER REFERENCES tep (id),
  tao_boi       TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_hop_tc ON qlda_hop (to_chuc_id, thoi_gian);

CREATE TABLE IF NOT EXISTS qlda_hop_viec (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  hop_id        INTEGER NOT NULL REFERENCES qlda_hop (id),
  noi_dung      TEXT NOT NULL,
  phu_trach     TEXT NOT NULL DEFAULT '',
  han           TEXT,
  trang_thai    TEXT NOT NULL DEFAULT 'chua_xong' CHECK (trang_thai IN ('chua_xong', 'dang_lam', 'xong')),
  tao_boi       TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_hop_viec_tc ON qlda_hop_viec (to_chuc_id, hop_id);
