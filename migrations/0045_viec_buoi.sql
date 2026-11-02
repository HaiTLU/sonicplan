-- Buổi của việc chưa có giờ cụ thể: 'sang' (8-12h), 'chieu' (13-17h), 'ca_ngay'. NULL = cả ngày. Chỉ cộng thêm một cột, không đổi hay xóa dữ liệu.
ALTER TABLE viec ADD COLUMN buoi TEXT;
