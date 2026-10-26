-- Phân hệ Viện Hòa Lạc, PR2: giai đoạn (stage gate), hạng mục (WBS), phụ thuộc (CPM), baseline.
-- Mốc thời gian theo ngày dương lịch (lưu dạng 'YYYY-MM-DD'), không tính ngày nghỉ: đơn giản nhất
-- cho một dự án xây dựng theo mốc hợp đồng, không phải dây chuyền sản xuất theo ca.

CREATE TABLE IF NOT EXISTS qlda_giai_doan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  ten         TEXT NOT NULL,
  thu_tu      INTEGER NOT NULL DEFAULT 0,
  trang_thai  TEXT NOT NULL DEFAULT 'chua_mo' CHECK (trang_thai IN ('chua_mo', 'dang_mo', 'da_qua_cong')),
  tao_luc     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_giai_doan_tc ON qlda_giai_doan (to_chuc_id, thu_tu);

-- CPM: som_bd/som_kt (forward pass), muon_bd/muon_kt (backward pass), du_truoc_ngay = muon_bd - som_bd,
-- tren_duong_gang = 1 khi du_truoc_ngay = 0. Các cột này là bộ nhớ đệm, src/hoalac/wbs.js tính lại
-- và ghi đè mỗi khi hạng mục hoặc phụ thuộc đổi; không tự sửa tay.
CREATE TABLE IF NOT EXISTS qlda_hang_muc (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id      TEXT NOT NULL REFERENCES to_chuc (id),
  giai_doan_id    INTEGER REFERENCES qlda_giai_doan (id),
  nhom_id         INTEGER REFERENCES qlda_hang_muc (id),
  ma              TEXT NOT NULL DEFAULT '',
  ten             TEXT NOT NULL,
  mo_ta           TEXT NOT NULL DEFAULT '',
  la_moc          INTEGER NOT NULL DEFAULT 0,
  thoi_gian_ngay  INTEGER NOT NULL DEFAULT 1,
  ngay_bat_dau    TEXT,
  ngay_ket_thuc   TEXT,
  tien_do_pt      INTEGER NOT NULL DEFAULT 0,
  trang_thai      TEXT NOT NULL DEFAULT 'chua_lam' CHECK (trang_thai IN ('chua_lam', 'dang_lam', 'xong', 'tam_dung')),
  phu_trach       TEXT NOT NULL DEFAULT '',
  som_bd          INTEGER,
  som_kt          INTEGER,
  muon_bd         INTEGER,
  muon_kt         INTEGER,
  du_truoc_ngay   INTEGER,
  tren_duong_gang INTEGER NOT NULL DEFAULT 0,
  tao_luc         TEXT NOT NULL,
  cap_nhat_luc    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_hang_muc_tc ON qlda_hang_muc (to_chuc_id, giai_doan_id);
CREATE INDEX IF NOT EXISTS qlda_hang_muc_nhom ON qlda_hang_muc (to_chuc_id, nhom_id);

-- loai: FS (trước xong mới bắt đầu), SS (cùng bắt đầu), FF (cùng xong), SF (trước xong thì sau mới xong).
-- do_tre_ngay có thể âm (chồng lấn được phép) theo CPM cổ điển.
CREATE TABLE IF NOT EXISTS qlda_phu_thuoc (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id      TEXT NOT NULL REFERENCES to_chuc (id),
  truoc_id        INTEGER NOT NULL REFERENCES qlda_hang_muc (id),
  sau_id          INTEGER NOT NULL REFERENCES qlda_hang_muc (id),
  loai            TEXT NOT NULL DEFAULT 'FS' CHECK (loai IN ('FS', 'SS', 'FF', 'SF')),
  do_tre_ngay     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (truoc_id, sau_id)
);
CREATE INDEX IF NOT EXISTS qlda_phu_thuoc_tc ON qlda_phu_thuoc (to_chuc_id);

CREATE TABLE IF NOT EXISTS qlda_baseline (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  ten         TEXT NOT NULL,
  ghi_chu     TEXT NOT NULL DEFAULT '',
  tao_boi     TEXT NOT NULL,
  tao_luc     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qlda_baseline_tc ON qlda_baseline (to_chuc_id, tao_luc DESC);

CREATE TABLE IF NOT EXISTS qlda_baseline_hang_muc (
  baseline_id   INTEGER NOT NULL REFERENCES qlda_baseline (id),
  hang_muc_id   INTEGER NOT NULL REFERENCES qlda_hang_muc (id),
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  ngay_bat_dau  TEXT,
  ngay_ket_thuc TEXT,
  PRIMARY KEY (baseline_id, hang_muc_id)
);
