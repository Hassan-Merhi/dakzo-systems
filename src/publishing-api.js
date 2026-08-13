import { livePathFor, loadDraftSnapshot } from './public-cms.js';
import { secureJson } from './cms-api.js';

const ENTITY_TYPES = new Set(['page', 'project', 'article']);
const PAGE_PATHS = new Map([
  ['home', '/'],
  ['about', '/about/'],
  ['services', '/services/'],
  ['solutions', '/solutions/'],
  ['contact', '/contact/']
]);

export async function handlePublishingApi(request, env, auth, url) {
  if (!url.pathname.startsWith('/api/admin/')) return null;
  if (!env.CMS_DB) return secureJson({ error: 'D1 CMS database binding is not configured.' }, 503);

  if (url.pathname === '/api/admin/revisions' && request.method === 'GET') {
    return listRevisions(env, url);
  }

  const restoreMatch = url.pathname.match(/^\/api\/admin\/revisions\/([^/]+)\/restore$/);
  if (restoreMatch && request.method === 'POST') {
    return restoreRevision(env, auth.email, decodeURIComponent(restoreMatch[1]));
  }

  const publishMatch = url.pathname.match(/^\/api\/admin\/(publish|unpublish)\/(page|project|article)\/([^/]+)$/);
  if (publishMatch && request.method === 'POST') {
    const action = publishMatch[1];
    const entityType = publishMatch[2];
    const entityId = decodeURIComponent(publishMatch[3]);
    return action === 'publish'
      ? publishEntity(env, auth.email, entityType, entityId)
      : unpublishEntity(env, auth.email, entityType, entityId);
  }

  const publicationMatch = url.pathname.match(/^\/api\/admin\/publication\/(page|project|article)\/([^/]+)$/);
  if (publicationMatch && request.method === 'GET') {
    return getPublication(env, publicationMatch[1], decodeURIComponent(publicationMatch[2]));
  }

  return null;
}

async function listRevisions(env, url) {
  const entityType = url.searchParams.get('entity_type');
  const entityId = url.searchParams.get('entity_id');
  if (!ENTITY_TYPES.has(entityType) || !entityId) return secureJson({ error: 'entity_type and entity_id are required.' }, 400);
  const result = await env.CMS_DB.prepare(`
    SELECT id, entity_type, entity_id, action, actor_email, created_at
    FROM cms_revisions
    WHERE entity_type=?1 AND entity_id=?2
    ORDER BY created_at DESC LIMIT 50
  `).bind(entityType, entityId).all();
  const publication = await env.CMS_DB.prepare(`
    SELECT live_path, version, published_by, published_at
    FROM cms_publications WHERE entity_type=?1 AND entity_id=?2 AND is_live=1
  `).bind(entityType, entityId).first();
  return secureJson({ revisions: result.results || [], publication: publication || null });
}

async function getPublication(env, entityType, entityId) {
  const row = await env.CMS_DB.prepare(`
    SELECT entity_type, entity_id, live_path, version, is_live, published_by, published_at
    FROM cms_publications WHERE entity_type=?1 AND entity_id=?2
  `).bind(entityType, entityId).first();
  return secureJson({ publication: row?.is_live ? row : null, tombstoned: Boolean(row && !row.is_live) });
}

async function publishEntity(env, actorEmail, entityType, entityId) {
  const snapshot = await loadDraftSnapshot(env, entityType, entityId);
  if (!snapshot) return secureJson({ error: 'Content record not found.' }, 404);
  if (snapshot.status === 'archived') return secureJson({ error: 'Archived content must be restored to draft before publishing.' }, 409);

  const livePath = livePathFor(entityType, snapshot);
  if (!livePath) return secureJson({ error: 'Unable to determine a public path for this content.' }, 400);
  if (entityType === 'page') {
    const expectedPath = PAGE_PATHS.get(snapshot.slug);
    if (!expectedPath || livePath !== expectedPath) {
      return secureJson({ error: `Core page ${snapshot.slug} must keep its canonical path ${expectedPath || ''}.` }, 409);
    }
  }

  const collision = await env.CMS_DB.prepare(`
    SELECT entity_type, entity_id FROM cms_publications
    WHERE live_path=?1 AND NOT (entity_type=?2 AND entity_id=?3) LIMIT 1
  `).bind(livePath, entityType, entityId).first();
  if (collision) return secureJson({ error: 'That live URL is already reserved by another CMS record.' }, 409);

  const currentPublication = await env.CMS_DB.prepare(`
    SELECT version FROM cms_publications WHERE entity_type=?1 AND entity_id=?2
  `).bind(entityType, entityId).first();
  const version = Number(currentPublication?.version || 0) + 1;
  const now = new Date().toISOString();
  const publishedSnapshot = { ...snapshot, status: 'published', published_at: now, updated_at: now };

  await env.CMS_DB.batch([
    revisionStatement(env, entityType, entityId, publishedSnapshot, 'publish', actorEmail),
    env.CMS_DB.prepare(`
      INSERT INTO cms_publications(entity_type,entity_id,live_path,snapshot_json,version,is_live,published_by,published_at)
      VALUES(?1,?2,?3,?4,?5,1,?6,?7)
      ON CONFLICT(entity_type,entity_id) DO UPDATE SET
        live_path=excluded.live_path,
        snapshot_json=excluded.snapshot_json,
        version=excluded.version,
        is_live=1,
        published_by=excluded.published_by,
        published_at=excluded.published_at
    `).bind(entityType, entityId, livePath, JSON.stringify(publishedSnapshot), version, actorEmail, now),
    statusStatement(env, entityType, entityId, 'published', now, now),
    activityStatement(env, actorEmail, `${entityType}.publish`, entityType, entityId, { livePath, version })
  ]);

  return secureJson({ ok: true, publication: { entity_type: entityType, entity_id: entityId, live_path: livePath, version, published_by: actorEmail, published_at: now } });
}

async function unpublishEntity(env, actorEmail, entityType, entityId) {
  const snapshot = await loadDraftSnapshot(env, entityType, entityId);
  if (!snapshot) return secureJson({ error: 'Content record not found.' }, 404);
  const current = await env.CMS_DB.prepare(`
    SELECT live_path, version, is_live, published_by, published_at
    FROM cms_publications WHERE entity_type=?1 AND entity_id=?2
  `).bind(entityType, entityId).first();

  const livePath = current?.live_path || livePathFor(entityType, snapshot);
  if (!livePath) return secureJson({ error: 'Unable to determine the public path to unpublish.' }, 400);
  const version = Number(current?.version || 1);
  const now = new Date().toISOString();

  await env.CMS_DB.batch([
    revisionStatement(env, entityType, entityId, snapshot, 'unpublish', actorEmail),
    env.CMS_DB.prepare(`
      INSERT INTO cms_publications(entity_type,entity_id,live_path,snapshot_json,version,is_live,published_by,published_at)
      VALUES(?1,?2,?3,?4,?5,0,?6,?7)
      ON CONFLICT(entity_type,entity_id) DO UPDATE SET
        live_path=excluded.live_path,
        snapshot_json=excluded.snapshot_json,
        is_live=0,
        published_by=excluded.published_by,
        published_at=excluded.published_at
    `).bind(entityType, entityId, livePath, JSON.stringify(snapshot), version, actorEmail, now),
    statusStatement(env, entityType, entityId, 'draft', null, now),
    activityStatement(env, actorEmail, `${entityType}.unpublish`, entityType, entityId, { livePath, version })
  ]);
  return secureJson({ ok: true, publication: null, tombstoned: true, live_path: livePath });
}

async function restoreRevision(env, actorEmail, revisionId) {
  const revision = await env.CMS_DB.prepare(`
    SELECT id, entity_type, entity_id, snapshot_json, action, actor_email, created_at
    FROM cms_revisions WHERE id=?1
  `).bind(revisionId).first();
  if (!revision) return secureJson({ error: 'Revision not found.' }, 404);
  if (!ENTITY_TYPES.has(revision.entity_type)) return secureJson({ error: 'Revision type is not restorable.' }, 400);

  const snapshot = parseObject(revision.snapshot_json);
  const current = await loadDraftSnapshot(env, revision.entity_type, revision.entity_id);
  if (!current) return secureJson({ error: 'The content record for this revision no longer exists.' }, 409);
  const now = new Date().toISOString();

  const restore = restoreStatement(env, revision.entity_type, revision.entity_id, snapshot, now);
  if (!restore) return secureJson({ error: 'Revision snapshot is invalid.' }, 400);
  await env.CMS_DB.batch([
    revisionStatement(env, revision.entity_type, revision.entity_id, current, 'restore', actorEmail),
    restore,
    activityStatement(env, actorEmail, `${revision.entity_type}.restore`, revision.entity_type, revision.entity_id, { revisionId, revisionAction: revision.action, revisionCreatedAt: revision.created_at })
  ]);
  return secureJson({ ok: true, restored_revision_id: revisionId, status: 'draft' });
}

function restoreStatement(env, entityType, entityId, snapshot, now) {
  if (entityType === 'page') {
    if (!snapshot.title || !snapshot.canonical_path) return null;
    return env.CMS_DB.prepare(`
      UPDATE cms_pages SET title=?1,status='draft',body_json=?2,seo_title=?3,seo_description=?4,
        canonical_path=?5,social_image_key=?6,published_at=NULL,updated_at=?7 WHERE id=?8
    `).bind(snapshot.title, JSON.stringify(snapshot.body || {}), snapshot.seo_title || '', snapshot.seo_description || '', snapshot.canonical_path, snapshot.social_image_key || null, now, entityId);
  }
  if (entityType === 'project') {
    if (!snapshot.name || !snapshot.slug) return null;
    return env.CMS_DB.prepare(`
      UPDATE cms_projects SET slug=?1,name=?2,summary=?3,status='draft',industry=?4,project_type=?5,
        hero_media_id=?6,content_json=?7,seo_title=?8,seo_description=?9,published_at=NULL,updated_at=?10 WHERE id=?11
    `).bind(snapshot.slug, snapshot.name, snapshot.summary || '', snapshot.industry || '', snapshot.project_type || '', snapshot.hero_media_id || null, JSON.stringify(snapshot.content || {}), snapshot.seo_title || '', snapshot.seo_description || '', now, entityId);
  }
  if (entityType === 'article') {
    if (!snapshot.title || !snapshot.slug) return null;
    return env.CMS_DB.prepare(`
      UPDATE cms_articles SET slug=?1,title=?2,excerpt=?3,status='draft',content_json=?4,featured_media_id=?5,
        seo_title=?6,seo_description=?7,published_at=NULL,updated_at=?8 WHERE id=?9
    `).bind(snapshot.slug, snapshot.title, snapshot.excerpt || '', JSON.stringify(snapshot.content || {}), snapshot.featured_media_id || null, snapshot.seo_title || '', snapshot.seo_description || '', now, entityId);
  }
  return null;
}

function statusStatement(env, entityType, entityId, status, publishedAt, updatedAt) {
  const table = entityType === 'page' ? 'cms_pages' : entityType === 'project' ? 'cms_projects' : 'cms_articles';
  return env.CMS_DB.prepare(`UPDATE ${table} SET status=?1,published_at=?2,updated_at=?3 WHERE id=?4`).bind(status, publishedAt, updatedAt, entityId);
}

function revisionStatement(env, entityType, entityId, snapshot, action, actorEmail) {
  return env.CMS_DB.prepare(`
    INSERT INTO cms_revisions(id,entity_type,entity_id,snapshot_json,action,actor_email)
    VALUES(?1,?2,?3,?4,?5,?6)
  `).bind(crypto.randomUUID(), entityType, entityId, JSON.stringify(snapshot), action, actorEmail);
}

function activityStatement(env, actorEmail, action, entityType, entityId, metadata) {
  return env.CMS_DB.prepare(`
    INSERT INTO cms_activity(id,actor_email,action,entity_type,entity_id,metadata_json)
    VALUES(?1,?2,?3,?4,?5,?6)
  `).bind(crypto.randomUUID(), actorEmail, action, entityType, entityId, JSON.stringify(metadata || {}));
}

function parseObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
