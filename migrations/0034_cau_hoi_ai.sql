-- Ô hỏi ý kiến trên Telegram khi AI chưa chắc về một chi tiết của việc (giờ, hạn, người, dự án, loại việc, có phải việc không).
-- trang_thai: moi (chờ gửi), cho (đã gửi, chờ trả lời), xong (đã trả lời), bo (bỏ qua hoặc không gửi được), het_han (quá 3 ngày không ai trả lời).
CREATE TABLE IF NOT EXISTS cau_hoi_ai (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL,
  viec_id     INTEGER NOT NULL,
  loai        TEXT NOT NULL,
  cau_hoi     TEXT NOT NULL,
  lua_chon    TEXT NOT NULL DEFAULT '[]',
  boi_canh    TEXT,
  tin_trich   TEXT,
  trang_thai  TEXT NOT NULL DEFAULT 'moi',
  tra_loi     TEXT,
  tg_tin_id   INTEGER,
  tao_luc     TEXT NOT NULL,
  tra_loi_luc TEXT
);
CREATE INDEX IF NOT EXISTS cau_hoi_ai_trang_thai ON cau_hoi_ai (to_chuc_id, trang_thai);
CREATE INDEX IF NOT EXISTS cau_hoi_ai_tin ON cau_hoi_ai (to_chuc_id, tg_tin_id);
