const ENTITY_TYPES = new Set(['page', 'project', 'article']);

export async function handlePublicCms(request, env, url) {
  if (!env.CMS_DB) return null;

  if (url.pathname.startsWith('/cms-media/')) {
    if (!env.MEDIA_BUCKET) return null;
    return getPublicMedia(env, decodeURIComponent(url.pathname.slice('/cms-media/'.length)));
  }

  const publication = await env.CMS_DB.prepare(`
    SELECT entity_type, entity_id, live_path, snapshot_json, version, published_at
    FROM cms_publications WHERE live_path = ?1 LIMIT 1
  `).bind(normalizePath(url.pathname)).first();

  if (!publication) return null;
  const snapshot = parseObject(publication.snapshot_json);
  if (!snapshot.id || !ENTITY_TYPES.has(publication.entity_type)) return null;

  return renderCmsDocument(snapshot, publication.entity_type, {
    origin: url.origin,
    preview: false,
    version: publication.version,
    publishedAt: publication.published_at
  });
}

export async function renderPreviewResponse(env, entityType, entityId, origin) {
  if (!env.CMS_DB || !ENTITY_TYPES.has(entityType)) return null;
  const snapshot = await loadDraftSnapshot(env, entityType, entityId);
  if (!snapshot) return null;
  return renderCmsDocument(snapshot, entityType, { origin, preview: true, version: null, publishedAt: null });
}

export async function loadDraftSnapshot(env, entityType, entityId) {
  if (!ENTITY_TYPES.has(entityType)) return null;
  if (entityType === 'page') {
    const row = await env.CMS_DB.prepare('SELECT * FROM cms_pages WHERE id=?1').bind(entityId).first();
    return row ? serializePage(row) : null;
  }
  if (entityType === 'project') {
    const row = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id=?1').bind(entityId).first();
    return row ? serializeProject(row) : null;
  }
  const row = await env.CMS_DB.prepare('SELECT * FROM cms_articles WHERE id=?1').bind(entityId).first();
  return row ? serializeArticle(row) : null;
}

export function livePathFor(entityType, snapshot) {
  if (entityType === 'page') return normalizePath(snapshot.canonical_path || '/');
  if (entityType === 'project') return normalizePath(`/work/${snapshot.slug}/`);
  if (entityType === 'article') return normalizePath(`/insights/${snapshot.slug}/`);
  return null;
}

export function renderCmsDocument(snapshot, entityType, options = {}) {
  const origin = String(options.origin || '').replace(/\/$/, '');
  const livePath = livePathFor(entityType, snapshot) || '/';
  const title = entityTitle(entityType, snapshot);
  const description = entityDescription(entityType, snapshot);
  const canonical = `${origin}${livePath}`;
  const previewBanner = options.preview ? `<div style="position:sticky;top:0;z-index:1000;padding:10px 18px;background:#fff3bf;color:#3d3200;border-bottom:1px solid #e8cf62;font:700 13px/1.4 Inter,system-ui;text-align:center">Private draft preview · not public until you press Publish</div>` : '';
  const robots = options.preview ? 'noindex,nofollow,noarchive' : 'index,follow';
  const body = entityType === 'page' ? renderPage(snapshot) : entityType === 'project' ? renderProject(snapshot) : renderArticle(snapshot);
  const schema = entityType === 'article' ? articleSchema(snapshot, canonical) : organizationSchema(origin);

  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${escAttr(description)}"><meta name="robots" content="${robots}"><meta name="theme-color" content="#0b1020"><link rel="canonical" href="${escAttr(canonical)}"><meta property="og:title" content="${escAttr(title)}"><meta property="og:description" content="${escAttr(description)}"><meta property="og:url" content="${escAttr(canonical)}"><meta property="og:type" content="${entityType === 'article' ? 'article' : 'website'}"><link rel="icon" href="/assets/logo-mark.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css"><style>.cms-media{width:100%;border-radius:28px;box-shadow:var(--shadow);background:#e8edf7}.cms-article{max-width:820px}.cms-article p{font-size:1.08rem;color:var(--ink-soft);margin:0 0 24px}.cms-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.cms-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.cms-gallery img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px}.cms-takeaways{display:grid;gap:12px;padding:0;list-style:none}.cms-takeaways li{padding:18px 20px;background:var(--white);border:1px solid var(--line);border-radius:14px}.cms-live-note{color:var(--muted);font-size:.82rem}@media(max-width:640px){.cms-gallery{grid-template-columns:1fr}}</style><script type="application/ld+json">${safeJson(schema)}</script></head><body>${previewBanner}${header()}<main id="main">${body}</main>${footer()}<script src="/assets/site.js" defer></script></body></html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': options.preview ? 'no-store' : 'public, max-age=0, s-maxage=60',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': options.preview ? 'noindex, nofollow, noarchive' : 'index, follow',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}

async function getPublicMedia(env, id) {
  if (!id) return new Response('Not found', { status: 404 });
  const row = await env.CMS_DB.prepare('SELECT object_key, mime_type FROM cms_media WHERE id=?1').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  const object = await env.MEDIA_BUCKET.get(row.object_key);
  if (!object || !('body' in object)) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type', row.mime_type || headers.get('content-type') || 'application/octet-stream');
  headers.set('cache-control', 'public, max-age=86400, immutable');
  headers.set('etag', object.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

function renderPage(page) {
  const body = page.body || {};
  const sections = (body.sections || []).map((section, index) => `<article class="card"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><h3>${esc(section.heading)}</h3><p>${esc(section.body)}</p></article>`).join('');
  const primary = cta(body.primaryCta, 'button');
  const secondary = cta(body.secondaryCta, 'button secondary');
  const featured = body.featuredProjectSlug ? `<p class="hero-note">Featured project: <a class="card-link" href="/work/${encodeURIComponent(body.featuredProjectSlug)}/">${esc(labelFromSlug(body.featuredProjectSlug))}</a></p>` : '';
  return `<section class="page-hero"><div class="container"><div class="eyebrow">${esc(body.heroEyebrow || 'Dakzo Systems')}</div><h1>${esc(body.heroTitle || page.title)}</h1><p>${esc(body.intro || '')}</p><div class="hero-actions" style="margin-top:28px">${primary}${secondary}</div>${featured}</div></section>${sections ? `<section class="section"><div class="container"><div class="grid-3">${sections}</div></div></section>` : ''}`;
}

function renderProject(project) {
  const content = project.content || {};
  const hero = project.hero_media_id ? `<div><img class="cms-media" src="/cms-media/${encodeURIComponent(project.hero_media_id)}" alt="${escAttr(project.name)} project image"></div>` : `<div class="system-card" aria-hidden="true"><div class="system-top"><span>Dakzo Systems</span><span class="status-dot">Case study</span></div><div class="dashboard"><div class="dash-tile dash-wide"><strong>${esc(project.name)}</strong><span>${esc(project.project_type || 'Digital system')}</span></div></div></div>`;
  const sections = (content.sections || []).map((section, index) => `<article class="card"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><h3>${esc(section.title)}</h3><p>${esc(section.body)}</p></article>`).join('');
  const gallery = (content.galleryMediaIds || []).map(id => `<img loading="lazy" src="/cms-media/${encodeURIComponent(id)}" alt="${escAttr(project.name)} screenshot">`).join('');
  return `<section class="hero"><div class="container hero-grid"><div><div class="eyebrow">${esc(project.industry || 'Dakzo project')}</div><h1>${esc(project.name)}</h1><p>${esc(project.summary || '')}</p><div class="cms-meta"><span class="tag">${esc(project.project_type || 'Software')}</span><span class="tag">${esc(project.industry || 'Technology')}</span></div><div class="hero-actions" style="margin-top:28px"><a class="button" href="/contact/">Start a project</a><a class="button secondary" href="/work/">More work</a></div></div>${hero}</div></section>${sections ? `<section class="section"><div class="container"><div class="section-head"><div class="kicker">Inside the system</div><div><h2>Built around the operating problem.</h2><p>${esc(project.summary || '')}</p></div></div><div class="grid-3">${sections}</div></div></section>` : ''}${gallery ? `<section class="section"><div class="container"><div class="section-head"><div class="kicker">Product views</div><div><h2>Selected interface imagery.</h2></div></div><div class="cms-gallery">${gallery}</div></div></section>` : ''}`;
}

function renderArticle(article) {
  const content = article.content || {};
  const paragraphs = String(content.body || '').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean).map(text => `<p>${esc(text)}</p>`).join('');
  const image = article.featured_media_id ? `<div style="margin-top:38px"><img class="cms-media" src="/cms-media/${encodeURIComponent(article.featured_media_id)}" alt="${escAttr(article.title)}"></div>` : '';
  const takeaways = (content.takeaways || []).map(item => `<li>${esc(item)}</li>`).join('');
  const related = content.relatedProjectSlug ? `<div class="cta-panel"><div class="kicker">Related Dakzo system</div><h2>${esc(labelFromSlug(content.relatedProjectSlug))}</h2><p>See how this thinking connects to a real Dakzo Systems product.</p><a class="button" href="/work/${encodeURIComponent(content.relatedProjectSlug)}/">View project</a></div>` : '';
  return `<section class="page-hero"><div class="container"><div class="eyebrow">${esc(content.category || 'Dakzo Insights')}</div><h1>${esc(article.title)}</h1><p>${esc(article.excerpt || '')}</p>${image}</div></section><section class="section"><div class="container cms-article">${paragraphs}${takeaways ? `<div style="margin-top:42px"><div class="kicker">Key takeaways</div><ul class="cms-takeaways">${takeaways}</ul></div>` : ''}${related}</div></section>`;
}

function cta(value, className) {
  const label = String(value?.label || '').trim();
  const href = String(value?.href || '').trim();
  if (!label || !href.startsWith('/') || href.startsWith('//')) return '';
  return `<a class="${className}" href="${escAttr(href)}">${esc(label)}</a>`;
}

function header() {
  return `<a class="skip-link" href="#main">Skip to main content</a><header class="site-header"><div class="container header-row"><a class="brand" href="/" aria-label="Dakzo Systems home"><img src="/assets/logo-mark.svg" alt="" width="40" height="40"><span class="brand-copy">Dakzo Systems<small>A Dakik LLC Company</small></span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Open navigation" data-menu-toggle><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><nav class="nav" id="primary-nav" aria-label="Primary navigation" data-nav><a href="/solutions/">Solutions</a><a href="/services/">Services</a><a href="/work/">Work</a><a href="/about/">About</a><a href="/insights/">Insights</a><a class="nav-cta" href="/contact/">Start a project</a></nav></div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand"><a class="brand" href="/"><img src="/assets/logo-mark.svg" alt="" width="40" height="40"><span class="brand-copy">Dakzo Systems<small>A Dakik LLC Company</small></span></a><p>We design and build custom software, applications, websites, business systems, logistics technology, and automation.</p></div><div class="footer-col"><h2>Company</h2><a href="/about/">About</a><a href="/work/">Work</a><a href="/insights/">Insights</a></div><div class="footer-col"><h2>Build</h2><a href="/services/">Services</a><a href="/solutions/">Solutions</a><a href="/contact/">Start a project</a></div><div class="footer-col"><h2>Selected systems</h2><a href="/work/hmd-erp/">HMD ERP</a><a href="/work/congo-delivery/">Congo Delivery</a><a href="/work/moto-track/">Moto Track</a></div></div><div class="footer-bottom"><span>© <span data-year></span> Dakzo Systems. A Dakik LLC Company.</span><span>Custom software built around real operations.</span></div></div></footer>`;
}

function entityTitle(type, snapshot) {
  if (type === 'page') return snapshot.seo_title || snapshot.title || 'Dakzo Systems';
  if (type === 'project') return snapshot.seo_title || `${snapshot.name || 'Project'} | Dakzo Systems`;
  return snapshot.seo_title || `${snapshot.title || 'Dakzo Insights'} | Dakzo Systems`;
}
function entityDescription(type, snapshot) {
  if (snapshot.seo_description) return snapshot.seo_description;
  if (type === 'page') return snapshot.body?.intro || '';
  if (type === 'project') return snapshot.summary || '';
  return snapshot.excerpt || '';
}
function articleSchema(article, canonical) {
  return { '@context':'https://schema.org', '@type':'Article', headline:article.title || '', description:article.excerpt || '', mainEntityOfPage:canonical, publisher:{ '@type':'Organization', name:'Dakzo Systems' } };
}
function organizationSchema(origin) { return { '@context':'https://schema.org', '@type':'Organization', name:'Dakzo Systems', url:origin || undefined, parentOrganization:{ '@type':'Organization', name:'Dakik LLC' } }; }
function serializePage(row) { return { id:row.id,slug:row.slug,title:row.title,status:row.status,body:parseObject(row.body_json),seo_title:row.seo_title||'',seo_description:row.seo_description||'',canonical_path:row.canonical_path||'/',social_image_key:row.social_image_key||null,published_at:row.published_at||null,created_at:row.created_at,updated_at:row.updated_at }; }
function serializeProject(row) { return { id:row.id,slug:row.slug,name:row.name,summary:row.summary||'',status:row.status,industry:row.industry||'',project_type:row.project_type||'',hero_media_id:row.hero_media_id||null,content:parseObject(row.content_json),seo_title:row.seo_title||'',seo_description:row.seo_description||'',published_at:row.published_at||null,created_at:row.created_at,updated_at:row.updated_at }; }
function serializeArticle(row) { return { id:row.id,slug:row.slug,title:row.title,excerpt:row.excerpt||'',status:row.status,content:parseObject(row.content_json),featured_media_id:row.featured_media_id||null,seo_title:row.seo_title||'',seo_description:row.seo_description||'',published_at:row.published_at||null,created_at:row.created_at,updated_at:row.updated_at }; }
function parseObject(value) { try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
function normalizePath(value) { const path = String(value || '/').split('?')[0].split('#')[0]; if (path === '/') return '/'; return `/${path.replace(/^\/+|\/+$/g, '')}/`; }
function labelFromSlug(value) { return String(value || '').split('-').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function escAttr(value) { return esc(value).replace(/`/g, '&#96;'); }
function safeJson(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
