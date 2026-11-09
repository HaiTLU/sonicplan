-- Nhật ký hành động cấp hệ thống: mọi lựa chọn của người dùng (nút Telegram, thao tác web) và tín hiệu im lặng,
-- làm dữ liệu cho bộ rút kinh nghiệm (src/rut-kinh-nghiem.js). Chỉ cộng thêm, không đổi bảng cũ.
-- Không lưu nội dung tin gốc; ly_do, truoc, sau cắt tối đa 200 ký tự lúc ghi.
CREATE TABLE IF NOT EXISTS nhat_ky_hanh_dong (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL,
  nguon       TEXT NOT NULL CHECK (nguon IN ('telegram', 'web', 'he_thong')),
  loai        TEXT NOT NULL,
  viec_id     INTEGER,
  truoc       TEXT,
  sau         TEXT,
  boi_canh    TEXT,
  ly_do       TEXT,
  luc         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS nhat_ky_hanh_dong_theo_luc ON nhat_ky_hanh_dong (to_chuc_id, luc);
CREATE INDEX IF NOT EXISTS nhat_ky_hanh_dong_theo_viec ON nhat_ky_hanh_dong (to_chuc_id, viec_id, loai);
