-- Bản cập nhật tuần của từng dự án cho trang tổng hợp Ban Giám hiệu (học mẫu cập nhật trạng thái của Asana).
-- Mỗi dự án mỗi tuần một bản; tuan là ngày thứ Hai của tuần theo giờ Việt Nam (YYYY-MM-DD).
-- AI chỉ soạn nháp trả về trình duyệt, không ghi bảng này; chỉ chủ dự án lưu, nên BGH chỉ thấy bản đã được người sửa.
-- Đèn xanh, vàng, đỏ không lưu ở đây: luôn tính từ số liệu (src/hoalac/danh-muc.js) để chỉ có một đèn.
CREATE TABLE IF NOT EXISTS qlda_cap_nhat_tuan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  tuan          TEXT NOT NULL,
  noi_dung      TEXT NOT NULL DEFAULT '',
  nguoi_viet    TEXT NOT NULL,
  tao_luc       TEXT NOT NULL,
  cap_nhat_luc  TEXT NOT NULL,
  UNIQUE (to_chuc_id, tuan)
);
