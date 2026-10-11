-- Khung dữ liệu giai đoạn 0, làm sẵn cho nhiều khách (mỗi khách là một "tổ chức").
-- Mọi bảng dữ liệu có cột to_chuc_id; mọi câu truy vấn phải lọc theo cột này.
-- Thời điểm lưu dạng chuỗi ISO 8601 giờ UTC, ví dụ 2026-10-11T02:30:00Z.

CREATE TABLE IF NOT EXISTS to_chuc (
  id        TEXT PRIMARY KEY,
  ten       TEXT NOT NULL,
  goi       TEXT NOT NULL DEFAULT 'dung_thu',
  tao_luc   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nguoi_dung (
  id        TEXT PRIMARY KEY,
  email     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ten       TEXT,
  tao_luc   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thanh_vien (
  to_chuc_id     TEXT NOT NULL REFERENCES to_chuc (id),
  nguoi_dung_id  TEXT NOT NULL REFERENCES nguoi_dung (id),
  vai_tro        TEXT NOT NULL DEFAULT 'thanh_vien' CHECK (vai_tro IN ('chu', 'thanh_vien')),
  tao_luc        TEXT NOT NULL,
  PRIMARY KEY (to_chuc_id, nguoi_dung_id)
);

-- Kết nối của từng khách tới Gmail, Drive, Lịch, Telegram, Zalo, AI.
-- cau_hinh_ma_hoa: khóa và mã truy cập đã mã hóa bằng KHOA_MA_HOA (src/ma-hoa.js), không lưu chữ thường.
CREATE TABLE IF NOT EXISTS ket_noi (
  to_chuc_id       TEXT NOT NULL REFERENCES to_chuc (id),
  loai             TEXT NOT NULL CHECK (loai IN ('gmail', 'drive', 'lich', 'telegram', 'zalo', 'ai')),
  trang_thai       TEXT NOT NULL DEFAULT 'chua_noi' CHECK (trang_thai IN ('chua_noi', 'dang_chay', 'loi', 'tat')),
  cau_hinh_ma_hoa  TEXT,
  cap_nhat_luc     TEXT NOT NULL,
  PRIMARY KEY (to_chuc_id, loai)
);

-- Mốc tín hiệu gần nhất của từng nguồn. to_chuc_id rỗng là tín hiệu của cả hệ thống (hẹn giờ).
CREATE TABLE IF NOT EXISTS tin_hieu (
  to_chuc_id  TEXT NOT NULL DEFAULT '',
  nguon       TEXT NOT NULL,
  lan_cuoi    TEXT NOT NULL,
  ghi_chu     TEXT,
  PRIMARY KEY (to_chuc_id, nguon)
);

-- Mỗi lần một tác vụ hẹn giờ chạy là một dòng. to_chuc_id rỗng là tác vụ của cả hệ thống.
CREATE TABLE IF NOT EXISTS nhat_ky_chay (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL DEFAULT '',
  tac_vu      TEXT NOT NULL,
  bat_dau     TEXT NOT NULL,
  ket_thuc    TEXT,
  trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('dang_chay', 'xong', 'loi')),
  so_muc      INTEGER NOT NULL DEFAULT 0,
  ghi_chu     TEXT
);
CREATE INDEX IF NOT EXISTS nhat_ky_chay_tac_vu ON nhat_ky_chay (to_chuc_id, tac_vu, id DESC);

-- Tin Zalo và thư Gmail (giai đoạn 1).
CREATE TABLE IF NOT EXISTS tin_nhan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  nguon       TEXT NOT NULL CHECK (nguon IN ('zalo', 'gmail')),
  ma_goc      TEXT NOT NULL,
  nguoi_gui   TEXT,
  nhom        TEXT,
  tieu_de     TEXT,
  noi_dung    TEXT,
  thoi_diem   TEXT NOT NULL,
  da_xem      INTEGER NOT NULL DEFAULT 0,
  tao_luc     TEXT NOT NULL,
  UNIQUE (to_chuc_id, nguon, ma_goc)
);
CREATE INDEX IF NOT EXISTS tin_nhan_thoi_diem ON tin_nhan (to_chuc_id, thoi_diem DESC);

-- Tệp đính kèm đã lưu lên Drive của khách (giai đoạn 1).
CREATE TABLE IF NOT EXISTS tep (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id   TEXT NOT NULL REFERENCES to_chuc (id),
  tin_nhan_id  INTEGER REFERENCES tin_nhan (id),
  ten          TEXT NOT NULL,
  loai         TEXT,
  kich_thuoc   INTEGER,
  drive_id     TEXT,
  duong_dan    TEXT,
  thu_muc      TEXT,
  tao_luc      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tep_to_chuc ON tep (to_chuc_id, id DESC);

-- Việc (giai đoạn 2). Giờ hẹn lưu riêng, không phụ thuộc Google Tasks.
CREATE TABLE IF NOT EXISTS viec (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id      TEXT NOT NULL REFERENCES to_chuc (id),
  tieu_de         TEXT NOT NULL,
  ghi_chu         TEXT,
  han_ngay        TEXT,
  gio_hen         TEXT,
  nhom            TEXT CHECK (nhom IN ('claude_tu_lam', 'claude_chuan_bi', 'anh_tu_lam')),
  trang_thai      TEXT NOT NULL DEFAULT 'mo' CHECK (trang_thai IN ('mo', 'xong', 'huy')),
  tin_nhan_id     INTEGER REFERENCES tin_nhan (id),
  lich_event_id   TEXT,
  github_issue    INTEGER,
  tao_luc         TEXT NOT NULL,
  cap_nhat_luc    TEXT NOT NULL,
  xong_luc        TEXT
);
CREATE INDEX IF NOT EXISTS viec_han ON viec (to_chuc_id, trang_thai, han_ngay);
