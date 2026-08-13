import { renderAdminPage } from './admin-page.js';

const encoder = new TextEncoder();
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const PROJECT_STATUSES = new Set(['draft', 'published', 'archived']);

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

async function handleAdminApi(request, env, auth, url) {
  const dbReady = Boolean(env.CMS_DB);
  const mediaReady = Boolean(env.MEDIA_BUCKET);

  if (url.pathname === '/api/admin/health' && request.method === 'GET') {
    return secureJson({ ok: true, email: auth.email, databaseReady: dbReady, mediaReady, storageReady: dbReady && mediaReady });
  }
  if (url.pathname === '/api/admin/content-model' && request.method === 'GET') {
    return secureJson({ entities: ['pages', 'projects', 'articles', 'media', 'revisions', 'activity'], databaseReady: dbReady, mediaReady });
  }

  if (url.pathname === '/api/admin/media' && request.method === 'GET') {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    return listMedia(env);
  }
  if (url.pathname === '/api/admin/media' && request.method === 'POST') {
    if (!dbReady || !mediaReady) return storageUnavailable(!dbReady ? 'D1 CMS database' : 'R2 media bucket');
    return uploadMedia(request, env, auth.email);
  }

  const mediaMatch = url.pathname.match(/^\/api\/admin\/media\/([^/]+)(?:\/(file))?$/);
  if (mediaMatch) {
    const mediaId = decodeURIComponent(mediaMatch[1]);
    if (mediaMatch[2] === 'file' && request.method === 'GET') {
      if (!dbReady || !mediaReady) return storageUnavailable(!dbReady ? 'D1 CMS database' : 'R2 media bucket');
      return getMediaFile(env, mediaId);
    }
    if (request.method === 'PATCH') {
      if (!dbReady) return storageUnavailable('D1 CMS database');
      return updateMedia(request, env, auth.email, mediaId);
    }
    if (request.method === 'DELETE') {
      if (!dbReady || !mediaReady) return storageUnavailable(!dbReady ? 'D1 CMS database' : 'R2 media bucket');
      return deleteMedia(env, auth.email, mediaId);
    }
  }

  if (url.pathname === '/api/admin/projects' && request.method === 'GET') {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    return listProjects(env);
  }
  if (url.pathname === '/api/admin/projects' && request.method === 'POST') {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    return createProject(request, env, auth.email);
  }

  const projectMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    if (!dbReady) return storageUnavailable('D1 CMS database');
    if (request.method === 'GET') return getProject(env, projectId);
    if (request.method === 'PATCH') return updateProject(request, env, auth.email, projectId);
    if (request.method === 'DELETE') return archiveProject(env, auth.email, projectId);
  }

  return secureJson({ error: 'Not found' }, 404);
}

async function listMedia(env) {
  const result = await env.CMS_DB.prepare(`
    SELECT id, object_key, filename, mime_type, byte_size, width, height, alt_text, uploaded_by, created_at
    FROM cms_media ORDER BY created_at DESC LIMIT 200
  `).all();
  return secureJson({ media: result.results || [] });
}

async function uploadMedia(request, env, actorEmail) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_UPLOAD_BYTES + 512 * 1024) return secureJson({ error: 'Upload is too large. Maximum image size is 8 MB.' }, 413);

  let form;
  try { form = await request.formData(); } catch { return secureJson({ error: 'Expected a multipart image upload.' }, 400); }
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return secureJson({ error: 'Choose an image to upload.' }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return secureJson({ error: 'Upload is too large. Maximum image size is 8 MB.' }, 413);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return secureJson({ error: 'Unsupported image type. Use JPG, PNG, WebP, AVIF, or GIF.' }, 415);

  const filename = cleanFilename(file.name || 'image');
  const altText = cleanText(form.get('alt_text'), 300);
  const folder = cleanFolder(form.get('folder'));
  const id = crypto.randomUUID();
  const objectKey = `media/${folder ? `${folder}/` : ''}${new Date().toISOString().slice(0, 10)}/${id}-${filename}`;

  await env.MEDIA_BUCKET.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type, cacheControl: 'private, max-age=0, no-store' },
    customMetadata: { originalName: filename, uploadedBy: actorEmail }
  });

  try {
    await env.CMS_DB.batch([
      env.CMS_DB.prepare(`
        INSERT INTO cms_media (id, object_key, filename, mime_type, byte_size, alt_text, uploaded_by)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `).bind(id, objectKey, filename, file.type, file.size, altText, actorEmail),
      activityStatement(env, actorEmail, 'media.upload', 'media', id, { filename, mimeType: file.type, byteSize: file.size })
    ]);
  } catch (error) {
    await env.MEDIA_BUCKET.delete(objectKey);
    throw error;
  }

  return secureJson({ ok: true, media: { id, filename, mime_type: file.type, byte_size: file.size, alt_text: altText, file_url: `/api/admin/media/${encodeURIComponent(id)}/file` } }, 201);
}

async function getMediaFile(env, id) {
  const row = await env.CMS_DB.prepare('SELECT object_key, filename, mime_type FROM cms_media WHERE id = ?1').bind(id).first();
  if (!row) return secureJson({ error: 'Media not found.' }, 404);
  const object = await env.MEDIA_BUCKET.get(row.object_key);
  if (!object || !('body' in object)) return secureJson({ error: 'Stored media object is missing.' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', row.mime_type || headers.get('content-type') || 'application/octet-stream');
  headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  headers.set('cache-control', 'private, no-store');
  headers.set('etag', object.httpEtag);
  headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

async function updateMedia(request, env, actorEmail, id) {
  const current = await env.CMS_DB.prepare('SELECT * FROM cms_media WHERE id = ?1').bind(id).first();
  if (!current) return secureJson({ error: 'Media not found.' }, 404);
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const filename = body.value.filename === undefined ? current.filename : cleanFilename(body.value.filename);
  const altText = body.value.alt_text === undefined ? current.alt_text : cleanText(body.value.alt_text, 300);
  if (!filename) return secureJson({ error: 'Filename is required.' }, 400);
  await env.CMS_DB.batch([
    env.CMS_DB.prepare('UPDATE cms_media SET filename = ?1, alt_text = ?2 WHERE id = ?3').bind(filename, altText, id),
    activityStatement(env, actorEmail, 'media.update', 'media', id, { filename, altText })
  ]);
  return secureJson({ ok: true, media: { ...current, filename, alt_text: altText } });
}

async function deleteMedia(env, actorEmail, id) {
  const current = await env.CMS_DB.prepare('SELECT * FROM cms_media WHERE id = ?1').bind(id).first();
  if (!current) return secureJson({ error: 'Media not found.' }, 404);
  const likeId = `%${id}%`;
  const projectUse = await env.CMS_DB.prepare('SELECT COUNT(*) AS count FROM cms_projects WHERE hero_media_id = ?1 OR content_json LIKE ?2').bind(id, likeId).first();
  const articleUse = await env.CMS_DB.prepare('SELECT COUNT(*) AS count FROM cms_articles WHERE featured_media_id = ?1 OR content_json LIKE ?2').bind(id, likeId).first();
  const pageUse = await env.CMS_DB.prepare('SELECT COUNT(*) AS count FROM cms_pages WHERE social_image_key = ?1 OR body_json LIKE ?2').bind(id, likeId).first();
  const used = Number(projectUse?.count || 0) + Number(articleUse?.count || 0) + Number(pageUse?.count || 0);
  if (used) return secureJson({ error: 'This image is still used by website content. Remove it from that content before deleting it.' }, 409);

  await env.MEDIA_BUCKET.delete(current.object_key);
  await env.CMS_DB.batch([
    env.CMS_DB.prepare('DELETE FROM cms_media WHERE id = ?1').bind(id),
    activityStatement(env, actorEmail, 'media.delete', 'media', id, { filename: current.filename })
  ]);
  return secureJson({ ok: true });
}

async function listProjects(env) {
  const result = await env.CMS_DB.prepare(`
    SELECT id, slug, name, summary, status, industry, project_type, hero_media_id, content_json,
           seo_title, seo_description, published_at, created_at, updated_at
    FROM cms_projects ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, updated_at DESC, name ASC
  `).all();
  return secureJson({ projects: (result.results || []).map(serializeProject) });
}

async function getProject(env, id) {
  const project = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  if (!project) return secureJson({ error: 'Project not found.' }, 404);
  return secureJson({ project: serializeProject(project) });
}

async function createProject(request, env, actorEmail) {
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const validation = await validateProjectInput(env, parsed.value, null);
  if (!validation.ok) return secureJson({ error: validation.error }, 400);
  const data = validation.value;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const snapshot = { id, ...data, created_at: now, updated_at: now };

  try {
    await env.CMS_DB.batch([
      env.CMS_DB.prepare(`
        INSERT INTO cms_projects (
          id, slug, name, summary, status, industry, project_type, hero_media_id, content_json,
          seo_title, seo_description, published_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      `).bind(id, data.slug, data.name, data.summary, data.status, data.industry, data.project_type, data.hero_media_id,
        JSON.stringify(data.content), data.seo_title, data.seo_description, data.status === 'published' ? now : null, now, now),
      revisionStatement(env, 'project', id, snapshot, 'create', actorEmail),
      activityStatement(env, actorEmail, 'project.create', 'project', id, { slug: data.slug, name: data.name })
    ]);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) return secureJson({ error: 'That project slug is already in use.' }, 409);
    throw error;
  }

  return secureJson({ ok: true, project: serializeProject({ ...snapshot, content_json: JSON.stringify(data.content), published_at: data.status === 'published' ? now : null }) }, 201);
}

async function updateProject(request, env, actorEmail, id) {
  const current = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  if (!current) return secureJson({ error: 'Project not found.' }, 404);
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const merged = {
    ...serializeProject(current),
    ...parsed.value,
    content: parsed.value.content === undefined ? parseJsonObject(current.content_json) : parsed.value.content
  };
  const validation = await validateProjectInput(env, merged, id);
  if (!validation.ok) return secureJson({ error: validation.error }, 400);
  const data = validation.value;
  const now = new Date().toISOString();
  const publishedAt = data.status === 'published' ? (current.published_at || now) : null;

  try {
    await env.CMS_DB.batch([
      revisionStatement(env, 'project', id, serializeProject(current), 'update', actorEmail),
      env.CMS_DB.prepare(`
        UPDATE cms_projects SET slug = ?1, name = ?2, summary = ?3, status = ?4, industry = ?5, project_type = ?6,
          hero_media_id = ?7, content_json = ?8, seo_title = ?9, seo_description = ?10, published_at = ?11, updated_at = ?12
        WHERE id = ?13
      `).bind(data.slug, data.name, data.summary, data.status, data.industry, data.project_type, data.hero_media_id,
        JSON.stringify(data.content), data.seo_title, data.seo_description, publishedAt, now, id),
      activityStatement(env, actorEmail, 'project.update', 'project', id, { slug: data.slug, name: data.name, status: data.status })
    ]);
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) return secureJson({ error: 'That project slug is already in use.' }, 409);
    throw error;
  }

  const updated = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  return secureJson({ ok: true, project: serializeProject(updated) });
}

async function archiveProject(env, actorEmail, id) {
  const current = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  if (!current) return secureJson({ error: 'Project not found.' }, 404);
  const now = new Date().toISOString();
  await env.CMS_DB.batch([
    revisionStatement(env, 'project', id, serializeProject(current), 'update', actorEmail),
    env.CMS_DB.prepare("UPDATE cms_projects SET status = 'archived', published_at = NULL, updated_at = ?1 WHERE id = ?2").bind(now, id),
    activityStatement(env, actorEmail, 'project.archive', 'project', id, { slug: current.slug, name: current.name })
  ]);
  return secureJson({ ok: true });
}

async function validateProjectInput(env, input, currentId) {
  const name = cleanText(input.name, 120);
  const slug = normalizeSlug(input.slug || name);
  const summary = cleanText(input.summary, 700);
  const status = String(input.status || 'draft');
  const industry = cleanText(input.industry, 120);
  const projectType = cleanText(input.project_type ?? input.projectType, 120);
  const heroMediaId = cleanNullableId(input.hero_media_id ?? input.heroMediaId);
  const seoTitle = cleanText(input.seo_title ?? input.seoTitle, 120);
  const seoDescription = cleanText(input.seo_description ?? input.seoDescription, 320);
  const content = normalizeProjectContent(input.content);

  if (!name) return { ok: false, error: 'Project name is required.' };
  if (!slug) return { ok: false, error: 'Project slug is required.' };
  if (!PROJECT_STATUSES.has(status)) return { ok: false, error: 'Invalid project status.' };
  if (heroMediaId && !(await mediaExists(env, heroMediaId))) return { ok: false, error: 'Selected hero image no longer exists.' };
  for (const mediaId of content.galleryMediaIds) if (!(await mediaExists(env, mediaId))) return { ok: false, error: 'A selected gallery image no longer exists.' };

  const duplicate = await env.CMS_DB.prepare('SELECT id FROM cms_projects WHERE slug = ?1 AND (?2 IS NULL OR id <> ?2) LIMIT 1').bind(slug, currentId).first();
  if (duplicate) return { ok: false, error: 'That project slug is already in use.' };

  return { ok: true, value: { slug, name, summary, status, industry, project_type: projectType, hero_media_id: heroMediaId, content, seo_title: seoTitle, seo_description: seoDescription } };
}

async function mediaExists(env, id) {
  return Boolean(await env.CMS_DB.prepare('SELECT id FROM cms_media WHERE id = ?1 LIMIT 1').bind(id).first());
}

function serializeProject(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary || '',
    status: row.status,
    industry: row.industry || '',
    project_type: row.project_type || '',
    hero_media_id: row.hero_media_id || null,
    content: parseJsonObject(row.content_json),
    seo_title: row.seo_title || '',
    seo_description: row.seo_description || '',
    published_at: row.published_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeProjectContent(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const gallery = Array.isArray(source.galleryMediaIds) ? [...new Set(source.galleryMediaIds.map(cleanNullableId).filter(Boolean))].slice(0, 40) : [];
  const sections = Array.isArray(source.sections) ? source.sections.slice(0, 20).map(section => ({
    title: cleanText(section?.title, 120),
    body: cleanText(section?.body, 2000)
  })).filter(section => section.title || section.body) : [];
  return { galleryMediaIds: gallery, sections };
}

function revisionStatement(env, entityType, entityId, snapshot, action, actorEmail) {
  return env.CMS_DB.prepare(`
    INSERT INTO cms_revisions (id, entity_type, entity_id, snapshot_json, action, actor_email)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `).bind(crypto.randomUUID(), entityType, entityId, JSON.stringify(snapshot), action, actorEmail);
}

function activityStatement(env, actorEmail, action, entityType, entityId, metadata) {
  return env.CMS_DB.prepare(`
    INSERT INTO cms_activity (id, actor_email, action, entity_type, entity_id, metadata_json)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `).bind(crypto.randomUUID(), actorEmail, action, entityType, entityId, JSON.stringify(metadata || {}));
}

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 128 * 1024) return { ok: false, response: secureJson({ error: 'Request payload is too large.' }, 413) };
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape');
    return { ok: true, value };
  } catch {
    return { ok: false, response: secureJson({ error: 'Expected a JSON object.' }, 400) };
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
    const allow = String(env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
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
  const signature = base64UrlBytes(parts[2]);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!verified) throw new Error('signature');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || (payload.nbf && payload.nbf > now + 60)) throw new Error('time');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(audience)) throw new Error('audience');
  if (payload.iss && payload.iss.replace(/\/$/, '') !== domain) throw new Error('issuer');
  return payload;
}

function decodePart(value) { return new TextDecoder().decode(base64UrlBytes(value)); }
function base64UrlBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function isMutation(method) { return method === 'POST' || method === 'PATCH' || method === 'DELETE'; }
function isSameOriginMutation(request, url) { return request.headers.get('origin') === url.origin; }
function cleanText(value, max) { return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max); }
function cleanNullableId(value) { const text = cleanText(value, 120); return text || null; }
function cleanFilename(value) {
  const text = cleanText(value, 180).replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9._() -]+/g, '-').replace(/\s+/g, ' ').trim();
  return text || 'image';
}
function cleanFolder(value) { return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9/_-]+/g, '-').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/'); }
function normalizeSlug(value) { return cleanText(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function parseJsonObject(value) { try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
function storageUnavailable(name) { return secureJson({ error: `${name} binding is not configured.`, storageReady: false }, 503); }
function adminHeaders(type) {
  const headers = new Headers({
    'content-type': type,
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  });
  if (type.startsWith('text/html')) headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return headers;
}
function secureJson(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: adminHeaders('application/json; charset=utf-8') }); }
