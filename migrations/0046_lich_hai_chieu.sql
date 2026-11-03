-- Lịch hai chiều: nhớ thời điểm `updated` của sự kiện Google Lịch ở lần Sonicplan ghi gần nhất,
-- để lần kéo về sau nhận ra thay đổi do chính mình đẩy lên. Chỉ cộng một cột, không đổi hay xóa dữ liệu.
ALTER TABLE viec ADD COLUMN lich_cap_nhat TEXT;
