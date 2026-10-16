-- Ảnh đại diện Zalo của từng cuộc trò chuyện và từng người gửi trong nhóm. Ảnh tải về lưu ở kho tệp (r2_khoa), không để trình duyệt tải từ máy chủ Zalo.
-- ma: 'nhom:<mã nhóm>', 'ca-nhan:<mã người>' (khớp tin_nhan.ma_hoi_thoai) hoặc 'nguoi:<mã người>' (người gửi trong nhóm).
CREATE TABLE IF NOT EXISTS anh_dai_dien (
  to_chuc_id TEXT NOT NULL,
  ma TEXT NOT NULL,
  ten TEXT,
  url_goc TEXT,
  r2_khoa TEXT,
  cap_nhat_luc TEXT NOT NULL,
  PRIMARY KEY (to_chuc_id, ma)
);
CREATE INDEX IF NOT EXISTS idx_anh_dai_dien_ten ON anh_dai_dien (to_chuc_id, ten);
