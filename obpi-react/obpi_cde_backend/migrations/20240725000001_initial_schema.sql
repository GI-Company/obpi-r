CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Standard', 'Limited')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    parent_id INTEGER,
    name TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK(node_type IN ('dir', 'file')),
    disk_path TEXT UNIQUE,
    size INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    original_path TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES files (id) ON DELETE CASCADE,
    UNIQUE (owner_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_files_parent ON files (parent_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files (owner_id);
