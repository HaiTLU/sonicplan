-- Nối Google: mỗi việc nhớ mã bên Google Tasks, và đã báo xong sang đó chưa.
ALTER TABLE viec ADD COLUMN google_task_id TEXT;
ALTER TABLE viec ADD COLUMN google_task_xong INTEGER NOT NULL DEFAULT 0;
