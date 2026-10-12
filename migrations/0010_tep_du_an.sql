-- Phân loại tệp theo dự án: du_an_nguon là 'tu_dong' (hệ thống gán) hoặc 'tay' (người dùng chọn, không bị đổi lại).
ALTER TABLE tep ADD COLUMN du_an_id INTEGER;
ALTER TABLE tep ADD COLUMN du_an_nguon TEXT;
