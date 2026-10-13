-- Thư mục Drive của dự án: drive_link để bấm mở, drive_duong_dan là đường dẫn trong Drive (so với ThangLong_KB) để máy chạy Claude chép kết quả vào.
ALTER TABLE du_an ADD COLUMN drive_link TEXT;
ALTER TABLE du_an ADD COLUMN drive_duong_dan TEXT;
