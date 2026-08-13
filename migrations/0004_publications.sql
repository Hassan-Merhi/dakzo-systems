PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cms_publications (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page','project','article')),
  entity_id TEXT NOT NULL,
  live_path TEXT NOT NULL UNIQUE,
  snapshot_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_publications_path ON cms_publications(live_path);
CREATE INDEX IF NOT EXISTS idx_cms_publications_published_at ON cms_publications(published_at);
