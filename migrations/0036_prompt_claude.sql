-- Thợ Claude chỉ soạn prompt cho người dùng dán sang Claude khác, không tự làm việc trong Sonicplan.
-- Prompt đã soạn lưu ở đây để mở lại và sao chép lại, không tốn thêm lần gọi AI.
CREATE TABLE prompt_claude (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id  TEXT NOT NULL REFERENCES to_chuc (id),
  viec_id     INTEGER NOT NULL,
  viec_ids    TEXT NOT NULL,
  noi_dung    TEXT NOT NULL,
  model       TEXT,
  dan         TEXT,
  tao_luc     TEXT NOT NULL
);
CREATE INDEX idx_prompt_claude_viec ON prompt_claude (to_chuc_id, viec_id, id);

-- Các lượt chạy trực tiếp đang chờ hoặc đang làm sẽ không bao giờ chạy nữa: đóng lại để không treo nhãn "Claude đang làm".
UPDATE luot_claude SET trang_thai = 'loi', ket_qua = COALESCE(ket_qua, 'Sonicplan không còn chạy Claude trực tiếp. Dùng nút "Soạn prompt" rồi dán sang Claude khác.') WHERE trang_thai IN ('cho', 'dang_lam');
