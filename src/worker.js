import { renderAdminPage } from './admin-page.js';
import { handleAdminApi, adminHeaders, secureJson } from './cms-api.js';

const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/admin') return Response.redirect(`${url.origin}/admin/`, 308);

    if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/api/admin/')) {
      const auth = await authenticateAccess(request, env);
      if (!auth.ok) return secureJson({ error: auth.error }, auth.status);

      if (url.pathname.startsWith('/api/admin/')) {
        if (isMutation(request.method) && !isSameOriginMutation(request, url)) {
          return secureJson({ error: 'Cross-origin admin mutations are not allowed.' }, 403);
        }
        return handleAdminApi(request, env, auth, url);
      }

      if (url.pathname === '/admin/' || url.pathname === '/admin/index.html') {
        return new Response(renderAdminPage({
          email: auth.email,
          databaseReady: Boolean(env.CMS_DB),
          mediaReady: Boolean(env.MEDIA_BUCKET)
        }), { headers: adminHeaders('text/html; charset=utf-8') });
      }
      return secureJson({ error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

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
function isMutation(method) { return method === 'POST' || method === 'PATCH' || method === 'DELETE'; }
function isSameOriginMutation(request, url) { return request.headers.get('origin') === url.origin; }
