-- Chỉ mục cho trang Tổng quan: lọc theo khoảng thời gian thay vì quét cả bảng.
CREATE INDEX IF NOT EXISTS nhat_ky_chay_bat_dau ON nhat_ky_chay (to_chuc_id, bat_dau);
CREATE INDEX IF NOT EXISTS viec_tao_luc ON viec (to_chuc_id, tao_luc);
CREATE INDEX IF NOT EXISTS tin_nhan_chua_xem ON tin_nhan (to_chuc_id, da_xem, an);
