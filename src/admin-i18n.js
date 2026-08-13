import { secureJson } from './cms-api.js';

const TYPES = new Set(['page', 'project', 'article']);
const LOCALES = new Set(['fr', 'ar', 'es']);

export async function handleAdminI18n(request, env, auth, url) {
  if (!url.pathname.startsWith('/api/admin/translations/')) return null;
  if (!env.CMS_DB) return secureJson({ error: 'D1 CMS database binding is not configured.' }, 503);

  const match = url.pathname.match(/^\/api\/admin\/translations\/(page|project|article)\/([^/]+)(?:\/(fr|ar|es))?$/);
  if (!match) return secureJson({ error: 'Invalid translation route.' }, 404);
  const entityType = match[1];
  const entityId = decodeURIComponent(match[2]);
  const locale = match[3] || null;
  if (!TYPES.has(entityType)) return secureJson({ error: 'Unsupported entity type.' }, 400);

  if (request.method === 'GET' && !locale) {
    const result = await env.CMS_DB.prepare(`
      SELECT locale, strings_json, seo_title, seo_description, is_complete, updated_at
      FROM cms_translations WHERE entity_type=?1 AND entity_id=?2 ORDER BY locale
    `).bind(entityType, entityId).all();
    return secureJson({ translations: (result.results || []).map(row => ({
      locale: row.locale,
      strings: parseObject(row.strings_json),
      seoTitle: row.seo_title || '',
      seoDescription: row.seo_description || '',
      isComplete: Boolean(row.is_complete),
      updatedAt: row.updated_at
    })) });
  }

  if (request.method === 'PUT' && locale && LOCALES.has(locale)) {
    let body;
    try { body = await request.json(); } catch { return secureJson({ error: 'Valid JSON body required.' }, 400); }
    const strings = cleanStrings(body?.strings);
    const seoTitle = String(body?.seoTitle || '').trim().slice(0, 180);
    const seoDescription = String(body?.seoDescription || '').trim().slice(0, 400);
    const isComplete = body?.isComplete === true ? 1 : 0;
    if (isComplete && Object.keys(strings).length === 0) {
      return secureJson({ error: 'A completed translation must include translated strings.' }, 400);
    }
    const now = new Date().toISOString();
    await env.CMS_DB.prepare(`
      INSERT INTO cms_translations(id,entity_type,entity_id,locale,strings_json,seo_title,seo_description,is_complete,updated_at)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
      ON CONFLICT(entity_type,entity_id,locale) DO UPDATE SET
        strings_json=excluded.strings_json,
        seo_title=excluded.seo_title,
        seo_description=excluded.seo_description,
        is_complete=excluded.is_complete,
        updated_at=excluded.updated_at
    `).bind(crypto.randomUUID(), entityType, entityId, locale, JSON.stringify(strings), seoTitle, seoDescription, isComplete, now).run();
    return secureJson({ ok: true, locale, isComplete: Boolean(isComplete), updatedAt: now, actor: auth.email });
  }

  return secureJson({ error: 'Method not allowed.' }, 405);
}

function cleanStrings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output = {};
  for (const [source, translated] of Object.entries(value).slice(0, 1500)) {
    const key = String(source).trim();
    const text = String(translated ?? '').trim();
    if (key && text) output[key.slice(0, 2000)] = text.slice(0, 10000);
  }
  return output;
}
function parseObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
