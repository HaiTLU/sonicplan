-- Dọn cuối ngày dời việc chưa xong sang mai: đếm số lần tự dời để việc bị dời mãi không lặng lẽ thoát khỏi mục Quá hạn.
-- Hạn gốc đã có ở cột han_goc (0012). Người dùng tự đặt hạn mới thì số đếm về 0.
ALTER TABLE viec ADD COLUMN so_lan_doi INTEGER NOT NULL DEFAULT 0;
