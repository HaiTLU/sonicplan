-- Sao: đánh dấu quan trọng cho việc và dự án (1 = có sao).
ALTER TABLE viec ADD COLUMN sao INTEGER NOT NULL DEFAULT 0;
ALTER TABLE du_an ADD COLUMN sao INTEGER NOT NULL DEFAULT 0;
