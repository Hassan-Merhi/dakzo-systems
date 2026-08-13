const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const CONTENT_STATUSES = new Set(['draft', 'published', 'archived']);

export async function handleAdminApi(request, env, auth, url) {
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
    const id = decodeURIComponent(mediaMatch[1]);
    if (mediaMatch[2] === 'file' && request.method === 'GET') {
      if (!dbReady || !mediaReady) return storageUnavailable(!dbReady ? 'D1 CMS database' : 'R2 media bucket');
      return getMediaFile(env, id);
    }
    if (request.method === 'PATCH') {
      if (!dbReady) return storageUnavailable('D1 CMS database');
      return updateMedia(request, env, auth.email, id);
    }
    if (request.method === 'DELETE') {
      if (!dbReady || !mediaReady) return storageUnavailable(!dbReady ? 'D1 CMS database' : 'R2 media bucket');
      return deleteMedia(env, auth.email, id);
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
    if (!dbReady) return storageUnavailable('D1 CMS database');
    const id = decodeURIComponent(projectMatch[1]);
    if (request.method === 'GET') return getProject(env, id);
    if (request.method === 'PATCH') return updateProject(request, env, auth.email, id);
    if (request.method === 'DELETE') return archiveProject(env, auth.email, id);
  }

  if (url.pathname === '/api/admin/pages' && request.method === 'GET') {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    return listPages(env);
  }
  const pageMatch = url.pathname.match(/^\/api\/admin\/pages\/([^/]+)$/);
  if (pageMatch) {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    const id = decodeURIComponent(pageMatch[1]);
    if (request.method === 'GET') return getPage(env, id);
    if (request.method === 'PATCH') return updatePage(request, env, auth.email, id);
  }

  if (url.pathname === '/api/admin/articles' && request.method === 'GET') {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    return listArticles(env);
  }
  if (url.pathname === '/api/admin/articles' && request.method === 'POST') {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    return createArticle(request, env, auth.email);
  }
  const articleMatch = url.pathname.match(/^\/api\/admin\/articles\/([^/]+)$/);
  if (articleMatch) {
    if (!dbReady) return storageUnavailable('D1 CMS database');
    const id = decodeURIComponent(articleMatch[1]);
    if (request.method === 'GET') return getArticle(env, id);
    if (request.method === 'PATCH') return updateArticle(request, env, auth.email, id);
    if (request.method === 'DELETE') return archiveArticle(env, auth.email, id);
  }

  return secureJson({ error: 'Not found' }, 404);
}

async function listMedia(env) {
  const result = await env.CMS_DB.prepare(`SELECT id, object_key, filename, mime_type, byte_size, width, height, alt_text, uploaded_by, created_at FROM cms_media ORDER BY created_at DESC LIMIT 200`).all();
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
      env.CMS_DB.prepare(`INSERT INTO cms_media (id, object_key, filename, mime_type, byte_size, alt_text, uploaded_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(id, objectKey, filename, file.type, file.size, altText, actorEmail),
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
  const parsed = await readJson(request);
  if (!parsed.ok) return parsed.response;
  const filename = parsed.value.filename === undefined ? current.filename : cleanFilename(parsed.value.filename);
  const altText = parsed.value.alt_text === undefined ? current.alt_text : cleanText(parsed.value.alt_text, 300);
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
  const result = await env.CMS_DB.prepare(`SELECT id, slug, name, summary, status, industry, project_type, hero_media_id, content_json, seo_title, seo_description, published_at, created_at, updated_at FROM cms_projects ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, updated_at DESC, name ASC`).all();
  return secureJson({ projects: (result.results || []).map(serializeProject) });
}
async function getProject(env, id) {
  const row = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  return row ? secureJson({ project: serializeProject(row) }) : secureJson({ error: 'Project not found.' }, 404);
}
async function createProject(request, env, actorEmail) {
  const parsed = await readJson(request); if (!parsed.ok) return parsed.response;
  const validation = await validateProjectInput(env, parsed.value, null); if (!validation.ok) return secureJson({ error: validation.error }, 400);
  const data = validation.value; const id = crypto.randomUUID(); const now = new Date().toISOString();
  const snapshot = { id, ...data, created_at: now, updated_at: now };
  try {
    await env.CMS_DB.batch([
      env.CMS_DB.prepare(`INSERT INTO cms_projects (id, slug, name, summary, status, industry, project_type, hero_media_id, content_json, seo_title, seo_description, published_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`).bind(id, data.slug, data.name, data.summary, data.status, data.industry, data.project_type, data.hero_media_id, JSON.stringify(data.content), data.seo_title, data.seo_description, data.status === 'published' ? now : null, now, now),
      revisionStatement(env, 'project', id, snapshot, 'create', actorEmail),
      activityStatement(env, actorEmail, 'project.create', 'project', id, { slug: data.slug, name: data.name })
    ]);
  } catch (error) { if (isUniqueError(error)) return secureJson({ error: 'That project slug is already in use.' }, 409); throw error; }
  return secureJson({ ok: true, project: { ...snapshot, published_at: data.status === 'published' ? now : null } }, 201);
}
async function updateProject(request, env, actorEmail, id) {
  const current = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  if (!current) return secureJson({ error: 'Project not found.' }, 404);
  const parsed = await readJson(request); if (!parsed.ok) return parsed.response;
  const merged = { ...serializeProject(current), ...parsed.value, content: parsed.value.content === undefined ? parseJsonObject(current.content_json) : parsed.value.content };
  const validation = await validateProjectInput(env, merged, id); if (!validation.ok) return secureJson({ error: validation.error }, 400);
  const data = validation.value; const now = new Date().toISOString(); const publishedAt = data.status === 'published' ? (current.published_at || now) : null;
  try {
    await env.CMS_DB.batch([
      revisionStatement(env, 'project', id, serializeProject(current), 'update', actorEmail),
      env.CMS_DB.prepare(`UPDATE cms_projects SET slug=?1,name=?2,summary=?3,status=?4,industry=?5,project_type=?6,hero_media_id=?7,content_json=?8,seo_title=?9,seo_description=?10,published_at=?11,updated_at=?12 WHERE id=?13`).bind(data.slug, data.name, data.summary, data.status, data.industry, data.project_type, data.hero_media_id, JSON.stringify(data.content), data.seo_title, data.seo_description, publishedAt, now, id),
      activityStatement(env, actorEmail, 'project.update', 'project', id, { slug: data.slug, name: data.name, status: data.status })
    ]);
  } catch (error) { if (isUniqueError(error)) return secureJson({ error: 'That project slug is already in use.' }, 409); throw error; }
  return getProject(env, id);
}
async function archiveProject(env, actorEmail, id) {
  const current = await env.CMS_DB.prepare('SELECT * FROM cms_projects WHERE id = ?1').bind(id).first();
  if (!current) return secureJson({ error: 'Project not found.' }, 404);
  const now = new Date().toISOString();
  await env.CMS_DB.batch([
    revisionStatement(env, 'project', id, serializeProject(current), 'update', actorEmail),
    env.CMS_DB.prepare("UPDATE cms_projects SET status='archived', published_at=NULL, updated_at=?1 WHERE id=?2").bind(now, id),
    activityStatement(env, actorEmail, 'project.archive', 'project', id, { slug: current.slug, name: current.name })
  ]);
  return secureJson({ ok: true });
}
async function validateProjectInput(env, input, currentId) {
  const name = cleanText(input.name, 120); const slug = normalizeSlug(input.slug || name); const summary = cleanText(input.summary, 700);
  const status = String(input.status || 'draft'); const industry = cleanText(input.industry, 120); const projectType = cleanText(input.project_type ?? input.projectType, 120);
  const heroMediaId = cleanNullableId(input.hero_media_id ?? input.heroMediaId); const seoTitle = cleanText(input.seo_title ?? input.seoTitle, 120); const seoDescription = cleanText(input.seo_description ?? input.seoDescription, 320);
  const content = normalizeProjectContent(input.content);
  if (!name) return { ok: false, error: 'Project name is required.' }; if (!slug) return { ok: false, error: 'Project slug is required.' }; if (!CONTENT_STATUSES.has(status)) return { ok: false, error: 'Invalid project status.' };
  if (heroMediaId && !(await mediaExists(env, heroMediaId))) return { ok: false, error: 'Selected hero image no longer exists.' };
  for (const mediaId of content.galleryMediaIds) if (!(await mediaExists(env, mediaId))) return { ok: false, error: 'A selected gallery image no longer exists.' };
  const duplicate = await env.CMS_DB.prepare('SELECT id FROM cms_projects WHERE slug=?1 AND (?2 IS NULL OR id<>?2) LIMIT 1').bind(slug, currentId).first();
  if (duplicate) return { ok: false, error: 'That project slug is already in use.' };
  return { ok: true, value: { slug, name, summary, status, industry, project_type: projectType, hero_media_id: heroMediaId, content, seo_title: seoTitle, seo_description: seoDescription } };
}
function serializeProject(row) { return { id:row.id,slug:row.slug,name:row.name,summary:row.summary||'',status:row.status,industry:row.industry||'',project_type:row.project_type||'',hero_media_id:row.hero_media_id||null,content:parseJsonObject(row.content_json),seo_title:row.seo_title||'',seo_description:row.seo_description||'',published_at:row.published_at||null,created_at:row.created_at,updated_at:row.updated_at }; }
function normalizeProjectContent(value) { const source=isObject(value)?value:{}; const gallery=Array.isArray(source.galleryMediaIds)?[...new Set(source.galleryMediaIds.map(cleanNullableId).filter(Boolean))].slice(0,40):[]; const sections=Array.isArray(source.sections)?source.sections.slice(0,20).map(s=>({title:cleanText(s?.title,120),body:cleanText(s?.body,2000)})).filter(s=>s.title||s.body):[]; return { galleryMediaIds:gallery, sections }; }

async function listPages(env) {
  const result = await env.CMS_DB.prepare(`SELECT id,slug,title,status,body_json,seo_title,seo_description,canonical_path,social_image_key,published_at,created_at,updated_at FROM cms_pages ORDER BY CASE slug WHEN 'home' THEN 0 WHEN 'about' THEN 1 WHEN 'services' THEN 2 WHEN 'solutions' THEN 3 WHEN 'contact' THEN 4 ELSE 5 END, title ASC`).all();
  return secureJson({ pages: (result.results || []).map(serializePage) });
}
async function getPage(env, id) { const row=await env.CMS_DB.prepare('SELECT * FROM cms_pages WHERE id=?1').bind(id).first(); return row?secureJson({page:serializePage(row)}):secureJson({error:'Page not found.'},404); }
async function updatePage(request, env, actorEmail, id) {
  const current=await env.CMS_DB.prepare('SELECT * FROM cms_pages WHERE id=?1').bind(id).first(); if(!current)return secureJson({error:'Page not found.'},404);
  const parsed=await readJson(request); if(!parsed.ok)return parsed.response;
  const merged={...serializePage(current),...parsed.value,body:parsed.value.body===undefined?parseJsonObject(current.body_json):parsed.value.body};
  const validation=await validatePageInput(env,merged); if(!validation.ok)return secureJson({error:validation.error},400);
  const data=validation.value; const now=new Date().toISOString(); const publishedAt=data.status==='published'?(current.published_at||now):null;
  await env.CMS_DB.batch([
    revisionStatement(env,'page',id,serializePage(current),'update',actorEmail),
    env.CMS_DB.prepare(`UPDATE cms_pages SET title=?1,status=?2,body_json=?3,seo_title=?4,seo_description=?5,canonical_path=?6,social_image_key=?7,published_at=?8,updated_at=?9 WHERE id=?10`).bind(data.title,data.status,JSON.stringify(data.body),data.seo_title,data.seo_description,data.canonical_path,data.social_image_key,publishedAt,now,id),
    activityStatement(env,actorEmail,'page.update','page',id,{slug:current.slug,title:data.title,status:data.status})
  ]);
  return getPage(env,id);
}
async function validatePageInput(env,input){
  const title=cleanText(input.title,120); const status=String(input.status||'draft'); const seoTitle=cleanText(input.seo_title??input.seoTitle,120); const seoDescription=cleanText(input.seo_description??input.seoDescription,320);
  const canonicalPath=cleanCanonicalPath(input.canonical_path??input.canonicalPath); const socialImageKey=cleanNullableId(input.social_image_key??input.socialImageKey); const body=normalizePageBody(input.body);
  if(!title)return{ok:false,error:'Page title is required.'}; if(!CONTENT_STATUSES.has(status))return{ok:false,error:'Invalid page status.'}; if(!canonicalPath)return{ok:false,error:'Canonical path is required.'};
  if(socialImageKey&&!(await mediaExists(env,socialImageKey)))return{ok:false,error:'Selected social image no longer exists.'};
  return{ok:true,value:{title,status,body,seo_title:seoTitle,seo_description:seoDescription,canonical_path:canonicalPath,social_image_key:socialImageKey}};
}
function serializePage(row){return{id:row.id,slug:row.slug,title:row.title,status:row.status,body:parseJsonObject(row.body_json),seo_title:row.seo_title||'',seo_description:row.seo_description||'',canonical_path:row.canonical_path||'/',social_image_key:row.social_image_key||null,published_at:row.published_at||null,created_at:row.created_at,updated_at:row.updated_at};}
function normalizePageBody(value){const s=isObject(value)?value:{};return{heroEyebrow:cleanText(s.heroEyebrow,120),heroTitle:cleanText(s.heroTitle,220),intro:cleanText(s.intro,1800),featuredProjectSlug:normalizeSlug(s.featuredProjectSlug),sections:Array.isArray(s.sections)?s.sections.slice(0,16).map(x=>({heading:cleanText(x?.heading,140),body:cleanText(x?.body,2400)})).filter(x=>x.heading||x.body):[],primaryCta:{label:cleanText(s.primaryCta?.label,100),href:cleanInternalHref(s.primaryCta?.href)},secondaryCta:{label:cleanText(s.secondaryCta?.label,100),href:cleanInternalHref(s.secondaryCta?.href)}};}

async function listArticles(env){const result=await env.CMS_DB.prepare(`SELECT id,slug,title,excerpt,status,content_json,featured_media_id,seo_title,seo_description,published_at,created_at,updated_at FROM cms_articles ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, COALESCE(published_at,updated_at) DESC`).all();return secureJson({articles:(result.results||[]).map(serializeArticle)});}
async function getArticle(env,id){const row=await env.CMS_DB.prepare('SELECT * FROM cms_articles WHERE id=?1').bind(id).first();return row?secureJson({article:serializeArticle(row)}):secureJson({error:'Article not found.'},404);}
async function createArticle(request,env,actorEmail){
  const parsed=await readJson(request);if(!parsed.ok)return parsed.response;const validation=await validateArticleInput(env,parsed.value,null);if(!validation.ok)return secureJson({error:validation.error},400);
  const d=validation.value,id=crypto.randomUUID(),now=new Date().toISOString(),publishedAt=d.status==='published'?now:null,snapshot={id,...d,published_at:publishedAt,created_at:now,updated_at:now};
  try{await env.CMS_DB.batch([
    env.CMS_DB.prepare(`INSERT INTO cms_articles(id,slug,title,excerpt,status,content_json,featured_media_id,seo_title,seo_description,published_at,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`).bind(id,d.slug,d.title,d.excerpt,d.status,JSON.stringify(d.content),d.featured_media_id,d.seo_title,d.seo_description,publishedAt,now,now),
    revisionStatement(env,'article',id,snapshot,'create',actorEmail),activityStatement(env,actorEmail,'article.create','article',id,{slug:d.slug,title:d.title,status:d.status})
  ]);}catch(error){if(isUniqueError(error))return secureJson({error:'That article slug is already in use.'},409);throw error;}return getArticle(env,id);
}
async function updateArticle(request,env,actorEmail,id){
  const current=await env.CMS_DB.prepare('SELECT * FROM cms_articles WHERE id=?1').bind(id).first();if(!current)return secureJson({error:'Article not found.'},404);
  const parsed=await readJson(request);if(!parsed.ok)return parsed.response;const merged={...serializeArticle(current),...parsed.value,content:parsed.value.content===undefined?parseJsonObject(current.content_json):parsed.value.content};
  const validation=await validateArticleInput(env,merged,id);if(!validation.ok)return secureJson({error:validation.error},400);const d=validation.value,now=new Date().toISOString(),publishedAt=d.status==='published'?(current.published_at||now):null;
  try{await env.CMS_DB.batch([
    revisionStatement(env,'article',id,serializeArticle(current),'update',actorEmail),
    env.CMS_DB.prepare(`UPDATE cms_articles SET slug=?1,title=?2,excerpt=?3,status=?4,content_json=?5,featured_media_id=?6,seo_title=?7,seo_description=?8,published_at=?9,updated_at=?10 WHERE id=?11`).bind(d.slug,d.title,d.excerpt,d.status,JSON.stringify(d.content),d.featured_media_id,d.seo_title,d.seo_description,publishedAt,now,id),
    activityStatement(env,actorEmail,'article.update','article',id,{slug:d.slug,title:d.title,status:d.status})
  ]);}catch(error){if(isUniqueError(error))return secureJson({error:'That article slug is already in use.'},409);throw error;}return getArticle(env,id);
}
async function archiveArticle(env,actorEmail,id){const current=await env.CMS_DB.prepare('SELECT * FROM cms_articles WHERE id=?1').bind(id).first();if(!current)return secureJson({error:'Article not found.'},404);const now=new Date().toISOString();await env.CMS_DB.batch([revisionStatement(env,'article',id,serializeArticle(current),'update',actorEmail),env.CMS_DB.prepare("UPDATE cms_articles SET status='archived',published_at=NULL,updated_at=?1 WHERE id=?2").bind(now,id),activityStatement(env,actorEmail,'article.archive','article',id,{slug:current.slug,title:current.title})]);return secureJson({ok:true});}
async function validateArticleInput(env,input,currentId){
  const title=cleanText(input.title,180),slug=normalizeSlug(input.slug||title),excerpt=cleanText(input.excerpt,700),status=String(input.status||'draft'),featuredMediaId=cleanNullableId(input.featured_media_id??input.featuredMediaId),seoTitle=cleanText(input.seo_title??input.seoTitle,120),seoDescription=cleanText(input.seo_description??input.seoDescription,320),content=normalizeArticleContent(input.content);
  if(!title)return{ok:false,error:'Article title is required.'};if(!slug)return{ok:false,error:'Article slug is required.'};if(!CONTENT_STATUSES.has(status))return{ok:false,error:'Invalid article status.'};if(featuredMediaId&&!(await mediaExists(env,featuredMediaId)))return{ok:false,error:'Selected featured image no longer exists.'};
  if(content.relatedProjectSlug){const related=await env.CMS_DB.prepare('SELECT id FROM cms_projects WHERE slug=?1 LIMIT 1').bind(content.relatedProjectSlug).first();if(!related)return{ok:false,error:'Selected related project no longer exists.'};}
  const duplicate=await env.CMS_DB.prepare('SELECT id FROM cms_articles WHERE slug=?1 AND (?2 IS NULL OR id<>?2) LIMIT 1').bind(slug,currentId).first();if(duplicate)return{ok:false,error:'That article slug is already in use.'};
  return{ok:true,value:{slug,title,excerpt,status,content,featured_media_id:featuredMediaId,seo_title:seoTitle,seo_description:seoDescription}};
}
function serializeArticle(row){return{id:row.id,slug:row.slug,title:row.title,excerpt:row.excerpt||'',status:row.status,content:parseJsonObject(row.content_json),featured_media_id:row.featured_media_id||null,seo_title:row.seo_title||'',seo_description:row.seo_description||'',published_at:row.published_at||null,created_at:row.created_at,updated_at:row.updated_at};}
function normalizeArticleContent(value){const s=isObject(value)?value:{};return{category:cleanText(s.category,80),body:cleanText(s.body,24000),relatedProjectSlug:normalizeSlug(s.relatedProjectSlug),takeaways:Array.isArray(s.takeaways)?s.takeaways.slice(0,12).map(v=>cleanText(v,400)).filter(Boolean):[]};}

async function mediaExists(env,id){return Boolean(await env.CMS_DB.prepare('SELECT id FROM cms_media WHERE id=?1 LIMIT 1').bind(id).first());}
function revisionStatement(env,entityType,entityId,snapshot,action,actorEmail){return env.CMS_DB.prepare(`INSERT INTO cms_revisions(id,entity_type,entity_id,snapshot_json,action,actor_email) VALUES(?1,?2,?3,?4,?5,?6)`).bind(crypto.randomUUID(),entityType,entityId,JSON.stringify(snapshot),action,actorEmail);}
function activityStatement(env,actorEmail,action,entityType,entityId,metadata){return env.CMS_DB.prepare(`INSERT INTO cms_activity(id,actor_email,action,entity_type,entity_id,metadata_json) VALUES(?1,?2,?3,?4,?5,?6)`).bind(crypto.randomUUID(),actorEmail,action,entityType,entityId,JSON.stringify(metadata||{}));}
async function readJson(request){const length=Number(request.headers.get('content-length')||0);if(length>256*1024)return{ok:false,response:secureJson({error:'Request payload is too large.'},413)};try{const value=await request.json();if(!isObject(value))throw new Error('shape');return{ok:true,value};}catch{return{ok:false,response:secureJson({error:'Expected a JSON object.'},400)}}}
function isObject(value){return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
function isUniqueError(error){return String(error?.message||'').toLowerCase().includes('unique');}
function cleanText(value,max){return String(value??'').replace(/\u0000/g,'').trim().slice(0,max);}
function cleanNullableId(value){const text=cleanText(value,120);return text||null;}
function cleanFilename(value){const text=cleanText(value,180).replace(/[\\/]/g,'-').replace(/[^a-zA-Z0-9._() -]+/g,'-').replace(/\s+/g,' ').trim();return text||'image';}
function cleanFolder(value){return cleanText(value,80).toLowerCase().replace(/[^a-z0-9/_-]+/g,'-').replace(/^\/+|\/+$/g,'').replace(/\/{2,}/g,'/');}
function normalizeSlug(value){return cleanText(value,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function cleanCanonicalPath(value){const raw=cleanText(value,180);if(!raw)return'';const path=raw.startsWith('/')?raw:`/${raw}`;return path.replace(/\s+/g,'').replace(/\/{2,}/g,'/');}
function cleanInternalHref(value){const raw=cleanText(value,240);return raw.startsWith('/')&&!raw.startsWith('//')?raw:'';}
function parseJsonObject(value){try{const parsed=JSON.parse(value||'{}');return isObject(parsed)?parsed:{};}catch{return{};}}
function storageUnavailable(name){return secureJson({error:`${name} binding is not configured.`,storageReady:false},503);}

export function adminHeaders(type){const headers=new Headers({'content-type':type,'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive','x-frame-options':'DENY','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()'});if(type.startsWith('text/html'))headers.set('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");return headers;}
export function secureJson(body,status=200){return new Response(JSON.stringify(body),{status,headers:adminHeaders('application/json; charset=utf-8')});}
