ALTER TABLE files ADD COLUMN is_trashed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE files ADD COLUMN trashed_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_files_trashed ON files (owner_id, is_trashed);
