import { renderAdminPage } from './admin-page.js';
import { handleAdminApi, adminHeaders, secureJson } from './cms-api.js';
import { handlePublishingApi } from './publishing-api.js';
import { handlePublicCms, renderPreviewResponse } from './public-cms.js';
import { injectPhase7Admin } from './admin-phase7.js';
import { injectPhase8Admin } from './admin-phase8.js';
import { handleProductionReadiness } from './production-readiness.js';
import { handlePublicI18n } from './public-i18n.js';
import { handleAdminI18n } from './admin-i18n.js';

const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/admin') return Response.redirect(`${url.origin}/admin/`, 308);

    if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/api/admin/')) {
      const auth = await authenticateAccess(request, env);
      if (!auth.ok) return secureJson({ error: auth.error }, auth.status);

      const previewMatch = url.pathname.match(/^\/admin\/preview\/(page|project|article)\/([^/]+)$/);
      if (previewMatch && request.method === 'GET') {
        const preview = await renderPreviewResponse(env, previewMatch[1], decodeURIComponent(previewMatch[2]), url.origin);
        return preview || secureJson({ error: 'Draft preview not found.' }, 404);
      }

      if (url.pathname.startsWith('/api/admin/')) {
        if (isMutation(request.method) && !isSameOriginMutation(request, url)) {
          return secureJson({ error: 'Cross-origin admin mutations are not allowed.' }, 403);
        }

        if (url.pathname === '/api/admin/production-readiness' && request.method === 'GET') {
          return handleProductionReadiness(env, auth);
        }

        const i18nResponse = await handleAdminI18n(request, env, auth, url);
        if (i18nResponse) return i18nResponse;

        const archiveMatch = request.method === 'DELETE' ? url.pathname.match(/^\/api\/admin\/(projects|articles)\/([^/]+)$/) : null;
        if (archiveMatch) {
          const entityType = archiveMatch[1] === 'projects' ? 'project' : 'article';
          const entityId = decodeURIComponent(archiveMatch[2]);
          const unpublishUrl = new URL(`/api/admin/unpublish/${entityType}/${encodeURIComponent(entityId)}`, url.origin);
          const unpublishRequest = new Request(unpublishUrl, { method: 'POST', headers: { origin: url.origin, 'content-type': 'application/json' }, body: '{}' });
          const unpublishResponse = await handlePublishingApi(unpublishRequest, env, auth, unpublishUrl);
          if (unpublishResponse && !unpublishResponse.ok) return unpublishResponse;
        }

        const publishingResponse = await handlePublishingApi(request, env, auth, url);
        if (publishingResponse) return publishingResponse;
        const cmsRequest = await forceDraftContentSave(request, url);
        return handleAdminApi(cmsRequest, env, auth, url);
      }

      if (url.pathname === '/admin/' || url.pathname === '/admin/index.html') {
        const response = new Response(renderAdminPage({
          email: auth.email,
          databaseReady: Boolean(env.CMS_DB),
          mediaReady: Boolean(env.MEDIA_BUCKET)
        }), { headers: adminHeaders('text/html; charset=utf-8') });
        return injectPhase8Admin(await injectPhase7Admin(response));
      }
      return secureJson({ error: 'Not found' }, 404);
    }

    if (url.pathname === '/api/i18n' && request.method === 'GET') return handlePublicI18n(env, url);
    const tombstone = await unpublishedCmsTombstone(env, url.pathname);
    if (tombstone) return tombstone;
    const cmsResponse = await handlePublicCms(request, env, url);
    if (cmsResponse) return cmsResponse;
    return env.ASSETS.fetch(request);
  }
};

async function unpublishedCmsTombstone(env, pathname) {
  if (!env.CMS_DB) return null;
  const normalized = normalizePublicPath(pathname);
  const row = await env.CMS_DB.prepare('SELECT is_live FROM cms_publications WHERE live_path=?1 LIMIT 1').bind(normalized).first();
  if (!row || row.is_live) return null;
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Content unavailable | Dakzo Systems</title></head><body><main><h1>Content unavailable</h1><p>This Dakzo Systems content is not currently published.</p><p><a href="/">Return to Dakzo Systems</a></p></main></body></html>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', 'x-content-type-options': 'nosniff' }
  });
}

async function forceDraftContentSave(request, url) {
  if (request.method !== 'POST' && request.method !== 'PATCH') return request;
  if (!/^\/api\/admin\/(?:pages|projects|articles)(?:\/[^/]+)?$/.test(url.pathname)) return request;
  if (!String(request.headers.get('content-type') || '').includes('application/json')) return request;
  try {
    const body = await request.clone().json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return request;
    body.status = 'draft';
    const headers = new Headers(request.headers);
    headers.set('content-type', 'application/json');
    return new Request(request, { body: JSON.stringify(body), headers });
  } catch {
    return request;
  }
}

async function authenticateAccess(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { ok: false, status: 503, error: 'Admin authentication is not configured.' };
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, status: 401, error: 'Cloudflare Access authentication required.' };
  try {
    const payload = await verifyAccessJwt(token, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
    const email = payload.email || payload.sub;
    if (!email) return { ok: false, status: 403, error: 'Authenticated identity has no email.' };
    const allow = String(env.ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (allow.length && !allow.includes(String(email).toLowerCase())) return { ok: false, status: 403, error: 'This identity is not an approved Dakzo administrator.' };
    return { ok: true, email: String(email) };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired Cloudflare Access token.' };
  }
}

async function verifyAccessJwt(token, teamDomain, audience) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('jwt');
  const header = JSON.parse(decodePart(parts[0]));
  const payload = JSON.parse(decodePart(parts[1]));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('alg');
  const domain = teamDomain.replace(/\/$/, '');
  const certs = await fetch(`${domain}/cdn-cgi/access/certs`, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!certs.ok) throw new Error('certs');
  const jwks = await certs.json();
  const jwk = (jwks.keys || []).find(key => key.kid === header.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlBytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!verified) throw new Error('signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || (payload.nbf && payload.nbf > now + 60)) throw new Error('time');
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(audience)) throw new Error('audience');
  if (payload.iss && payload.iss.replace(/\/$/, '') !== domain) throw new Error('issuer');
  return payload;
}

function decodePart(value) { return new TextDecoder().decode(base64UrlBytes(value)); }
function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function normalizePublicPath(value) {
  const path = String(value || '/').split('?')[0].split('#')[0];
  if (path === '/') return '/';
  return `/${path.replace(/^\/+|\/+$/g, '')}/`;
}
function isMutation(method) { return method === 'POST' || method === 'PATCH' || method === 'DELETE'; }
function isSameOriginMutation(request, url) { return request.headers.get('origin') === url.origin; }
