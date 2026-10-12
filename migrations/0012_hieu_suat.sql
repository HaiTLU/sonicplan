-- Đo hiệu suất: độ nặng, thời lượng ước tính, giờ bắt đầu, hạn ban đầu (trước khi bị dời cuối ngày).
-- do_nang: nhe | vua | nang | rat_nang. do_nang_nguon: ai | tay (tay thì AI không ghi đè).
ALTER TABLE viec ADD COLUMN do_nang TEXT;
ALTER TABLE viec ADD COLUMN phut_uoc INTEGER;
ALTER TABLE viec ADD COLUMN do_nang_nguon TEXT;
ALTER TABLE viec ADD COLUMN bat_dau_luc TEXT;
ALTER TABLE viec ADD COLUMN han_goc TEXT;
UPDATE viec SET han_goc = han_ngay WHERE han_goc IS NULL;
CREATE TRIGGER IF NOT EXISTS viec_han_goc_them AFTER INSERT ON viec WHEN NEW.han_goc IS NULL AND NEW.han_ngay IS NOT NULL
BEGIN UPDATE viec SET han_goc = NEW.han_ngay WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS viec_han_goc_sua AFTER UPDATE OF han_ngay ON viec WHEN NEW.han_goc IS NULL AND NEW.han_ngay IS NOT NULL
BEGIN UPDATE viec SET han_goc = NEW.han_ngay WHERE id = NEW.id; END;
CREATE INDEX IF NOT EXISTS idx_viec_xong ON viec (to_chuc_id, trang_thai, xong_luc);
