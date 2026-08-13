import { secureJson } from './cms-api.js';

export const REQUIRED_TABLES = [
  'cms_pages',
  'cms_projects',
  'cms_articles',
  'cms_media',
  'cms_revisions',
  'cms_activity',
  'cms_publications'
];

export async function handleProductionReadiness(env, auth) {
  const bindings = {
    database: Boolean(env.CMS_DB),
    media: Boolean(env.MEDIA_BUCKET),
    accessTeamDomain: Boolean(env.ACCESS_TEAM_DOMAIN),
    accessAudience: Boolean(env.ACCESS_AUD),
    adminAllowlistConfigured: Boolean(String(env.ADMIN_EMAILS || '').trim())
  };

  const schema = {
    checked: false,
    tables: [],
    missingTables: [...REQUIRED_TABLES],
    publicationColumns: [],
    publicationColumnsReady: false,
    error: null
  };
  const content = {
    checked: false,
    pages: 0,
    projects: 0,
    articles: 0,
    seedFloorReady: false,
    error: null
  };
  const media = { checked: false, reachable: false, error: null };

  if (env.CMS_DB) {
    try {
      const tableResult = await env.CMS_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cms_%' ORDER BY name").all();
      schema.tables = (tableResult.results || []).map(row => row.name).filter(Boolean);
      schema.missingTables = REQUIRED_TABLES.filter(name => !schema.tables.includes(name));
      if (schema.tables.includes('cms_publications')) {
        const columnResult = await env.CMS_DB.prepare('PRAGMA table_info(cms_publications)').all();
        schema.publicationColumns = (columnResult.results || []).map(row => row.name).filter(Boolean);
        schema.publicationColumnsReady = ['entity_type', 'entity_id', 'live_path', 'snapshot_json', 'version', 'is_live', 'published_by', 'published_at'].every(name => schema.publicationColumns.includes(name));
      }
      schema.checked = true;
    } catch (error) {
      schema.error = safeError(error);
    }

    if (!schema.missingTables.includes('cms_pages') && !schema.missingTables.includes('cms_projects') && !schema.missingTables.includes('cms_articles')) {
      try {
        const counts = await env.CMS_DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM cms_pages) AS pages,
            (SELECT COUNT(*) FROM cms_projects) AS projects,
            (SELECT COUNT(*) FROM cms_articles) AS articles
        `).first();
        content.pages = Number(counts?.pages || 0);
        content.projects = Number(counts?.projects || 0);
        content.articles = Number(counts?.articles || 0);
        content.seedFloorReady = content.pages >= 5 && content.projects >= 3 && content.articles >= 4;
        content.checked = true;
      } catch (error) {
        content.error = safeError(error);
      }
    }
  }

  if (env.MEDIA_BUCKET) {
    try {
      await env.MEDIA_BUCKET.head('__dakzo_cms_readiness_probe__');
      media.checked = true;
      media.reachable = true;
    } catch (error) {
      media.checked = true;
      media.error = safeError(error);
    }
  }

  const result = evaluateProductionReadiness({ bindings, schema, content, media });
  return secureJson({
    ...result,
    checkedAt: new Date().toISOString(),
    authenticatedAdmin: auth.email,
    requiredMigration: '0004_publications.sql',
    bindings,
    schema,
    content,
    media,
    notes: [
      bindings.adminAllowlistConfigured ? 'ADMIN_EMAILS allowlist is configured.' : 'ADMIN_EMAILS is optional but recommended for a single-owner admin.',
      'No secret values, Access tokens, database identifiers, or R2 object keys are returned by this endpoint.'
    ]
  });
}

export function evaluateProductionReadiness({ bindings, schema, content, media }) {
  const checks = {
    access: Boolean(bindings.accessTeamDomain && bindings.accessAudience),
    databaseBinding: Boolean(bindings.database),
    mediaBinding: Boolean(bindings.media),
    schema: Boolean(schema.checked && schema.missingTables.length === 0 && schema.publicationColumnsReady),
    seededContent: Boolean(content.checked && content.seedFloorReady),
    mediaReachable: Boolean(media.checked && media.reachable)
  };
  return {
    ready: Object.values(checks).every(Boolean),
    checks,
    blockers: Object.entries(checks).filter(([, value]) => !value).map(([name]) => name)
  };
}

function safeError(error) {
  const text = String(error?.message || error || 'Unknown readiness error');
  return text.replace(/[\r\n]+/g, ' ').slice(0, 240);
}
