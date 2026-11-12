-- Đề xuất cập nhật dự án do AI tách từ tin nhắn Telegram (lệnh /duan). Đề xuất chỉ là bản chờ:
-- bảng dữ liệu dự án (qlda_hang_muc, qlda_rui_ro) chỉ đổi khi người gửi lệnh bấm Duyệt.
-- to_chuc_id: dự án (phạm vi 'hoalac'); noi_nhan: tổ chức chính có nhóm Telegram nhận đề xuất;
-- nguoi_gui_tg: mã người dùng Telegram đã gửi lệnh, chỉ người này bấm duyệt được.
-- du_lieu: JSON thay đổi đã kiểm (loai cap_nhat_hang_muc | rui_ro_moi | dong_rui_ro).
CREATE TABLE IF NOT EXISTS qlda_de_xuat (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  to_chuc_id    TEXT NOT NULL REFERENCES to_chuc (id),
  noi_nhan      TEXT NOT NULL,
  nguoi_gui_tg  TEXT NOT NULL,
  loai          TEXT NOT NULL CHECK (loai IN ('cap_nhat_hang_muc', 'rui_ro_moi', 'dong_rui_ro')),
  du_lieu       TEXT NOT NULL,
  mo_ta         TEXT NOT NULL DEFAULT '',
  trang_thai    TEXT NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'duyet', 'bo')),
  tao_luc       TEXT NOT NULL,
  xu_ly_luc     TEXT
);
CREATE INDEX IF NOT EXISTS qlda_de_xuat_tc ON qlda_de_xuat (to_chuc_id, trang_thai);
