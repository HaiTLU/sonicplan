-- Lượt chạy ở máy bị bỏ dở vì máy chủ khởi động lại (triển khai bản mới, mất điện) thì tự xếp lại hàng đợi tối đa 2 lần thay vì báo lỗi.
ALTER TABLE luot_claude ADD COLUMN bo_do INTEGER NOT NULL DEFAULT 0;
