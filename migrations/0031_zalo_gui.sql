-- Hàng đợi gửi tin Zalo: người dùng soạn trong Sonicplan (bấm gửi tay), chương trình Zalo trên máy Mac nhận lệnh và gửi thật.
-- trang_thai: cho (chờ máy Mac lấy), dang (máy Mac đã lấy, đang gửi), xong, loi. tep_ids: danh sách id bảng tep (JSON), tệp lưu ở kho tệp.
CREATE TABLE IF NOT EXISTS zalo_gui (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id TEXT NOT NULL,
  khoa TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  loai TEXT NOT NULL,
  noi_dung TEXT NOT NULL DEFAULT '',
  tep_ids TEXT NOT NULL DEFAULT '[]',
  trang_thai TEXT NOT NULL DEFAULT 'cho',
  loi TEXT,
  tao_luc TEXT NOT NULL,
  cap_nhat_luc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_zalo_gui_hang ON zalo_gui (to_chuc_id, trang_thai, id);
