CREATE TABLE IF NOT EXISTS eden_sync_feeds (
  collection_id TEXT NOT NULL,
  db_name TEXT NOT NULL CHECK (db_name IN ('PROD', 'STAGE')),
  playlist_id TEXT,
  playlist BOOLEAN NOT NULL DEFAULT TRUE,
  api_key TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_sec INTEGER NOT NULL DEFAULT 3600,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (collection_id, db_name)
);

CREATE INDEX IF NOT EXISTS idx_eden_sync_feeds_enabled
  ON eden_sync_feeds(enabled);
