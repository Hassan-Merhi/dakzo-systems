const LOCALES = new Set(['fr', 'ar', 'es']);

export async function handlePublicI18n(env, url) {
  if (!env.CMS_DB) return notFound();
  const locale = url.searchParams.get('locale');
  if (!LOCALES.has(locale)) return new Response(JSON.stringify({ error: 'Unsupported locale.' }), {
    status: 400,
    headers: jsonHeaders('no-store')
  });
  const path = normalizePath(url.searchParams.get('path') || '/');
  try {
    const publication = await env.CMS_DB.prepare(`
      SELECT entity_type, entity_id
      FROM cms_publications
      WHERE live_path=?1 AND is_live=1 LIMIT 1
    `).bind(path).first();
    if (!publication) return notFound();
    const translation = await env.CMS_DB.prepare(`
      SELECT strings_json, seo_title, seo_description
      FROM cms_translations
      WHERE entity_type=?1 AND entity_id=?2 AND locale=?3 AND is_complete=1 LIMIT 1
    `).bind(publication.entity_type, publication.entity_id, locale).first();
    if (!translation) return notFound();
    return new Response(JSON.stringify({
      strings: parseObject(translation.strings_json),
      seoTitle: translation.seo_title || '',
      seoDescription: translation.seo_description || ''
    }), { headers: jsonHeaders('public, max-age=0, s-maxage=60') });
  } catch {
    return notFound();
  }
}

function normalizePath(value) {
  const path = String(value || '/').split('?')[0].split('#')[0];
  if (path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}/`;
}
function parseObject(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function jsonHeaders(cacheControl) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff'
  };
}
function notFound() {
  return new Response(JSON.stringify({ error: 'Translation not found.' }), { status: 404, headers: jsonHeaders('no-store') });
}
