PRAGMA foreign_keys = ON;

-- Existing seeded CMS records remain publishable during migration. New records
-- default to requiring complete French, Arabic, and Spanish translations.
ALTER TABLE cms_pages ADD COLUMN i18n_required INTEGER NOT NULL DEFAULT 1 CHECK (i18n_required IN (0,1));
ALTER TABLE cms_projects ADD COLUMN i18n_required INTEGER NOT NULL DEFAULT 1 CHECK (i18n_required IN (0,1));
ALTER TABLE cms_articles ADD COLUMN i18n_required INTEGER NOT NULL DEFAULT 1 CHECK (i18n_required IN (0,1));
UPDATE cms_pages SET i18n_required=0;
UPDATE cms_projects SET i18n_required=0;
UPDATE cms_articles SET i18n_required=0;

CREATE TABLE IF NOT EXISTS cms_translations (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page','project','article')),
  entity_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('fr','ar','es')),
  strings_json TEXT NOT NULL DEFAULT '{}',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_cms_translations_entity ON cms_translations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cms_translations_ready ON cms_translations(locale, is_complete, updated_at);

CREATE TRIGGER IF NOT EXISTS cms_publications_require_i18n_insert
BEFORE INSERT ON cms_publications
WHEN NEW.is_live=1
  AND (
    (NEW.entity_type='page' AND EXISTS(SELECT 1 FROM cms_pages WHERE id=NEW.entity_id AND i18n_required=1)) OR
    (NEW.entity_type='project' AND EXISTS(SELECT 1 FROM cms_projects WHERE id=NEW.entity_id AND i18n_required=1)) OR
    (NEW.entity_type='article' AND EXISTS(SELECT 1 FROM cms_articles WHERE id=NEW.entity_id AND i18n_required=1))
  )
  AND (SELECT COUNT(*) FROM cms_translations WHERE entity_type=NEW.entity_type AND entity_id=NEW.entity_id AND locale IN ('fr','ar','es') AND is_complete=1) < 3
BEGIN
  SELECT RAISE(ABORT, 'TRANSLATIONS_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS cms_publications_require_i18n_update
BEFORE UPDATE OF is_live, snapshot_json ON cms_publications
WHEN NEW.is_live=1
  AND (
    (NEW.entity_type='page' AND EXISTS(SELECT 1 FROM cms_pages WHERE id=NEW.entity_id AND i18n_required=1)) OR
    (NEW.entity_type='project' AND EXISTS(SELECT 1 FROM cms_projects WHERE id=NEW.entity_id AND i18n_required=1)) OR
    (NEW.entity_type='article' AND EXISTS(SELECT 1 FROM cms_articles WHERE id=NEW.entity_id AND i18n_required=1))
  )
  AND (SELECT COUNT(*) FROM cms_translations WHERE entity_type=NEW.entity_type AND entity_id=NEW.entity_id AND locale IN ('fr','ar','es') AND is_complete=1) < 3
BEGIN
  SELECT RAISE(ABORT, 'TRANSLATIONS_REQUIRED');
END;
