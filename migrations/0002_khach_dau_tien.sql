-- Khách đầu tiên: anh Nam Hải. Chạy lại không sinh trùng.
INSERT OR IGNORE INTO to_chuc (id, ten, goi, tao_luc)
VALUES ('tc_namhai', 'Nam Hải', 'noi_bo', '2026-10-11T00:00:00Z');

INSERT OR IGNORE INTO nguoi_dung (id, email, ten, tao_luc)
VALUES ('nd_namhai', 'hainnam@gmail.com', 'Nguyễn Nam Hải', '2026-10-11T00:00:00Z');

INSERT OR IGNORE INTO thanh_vien (to_chuc_id, nguoi_dung_id, vai_tro, tao_luc)
VALUES ('tc_namhai', 'nd_namhai', 'chu', '2026-10-11T00:00:00Z');
