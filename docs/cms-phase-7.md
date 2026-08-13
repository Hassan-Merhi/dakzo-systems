# Dakzo CMS Phase 7 — Preview, Publish & Revisions

Phase 7 separates editing from the live website.

## Workflow

1. Edit a page, project, or Insights article in `/admin`.
2. Save. Content is forced to **draft** even if an older CMS version is live.
3. Use **Preview draft** to open a private, noindex rendering of the saved draft.
4. Use **Publish** to promote that exact saved snapshot to the public URL.
5. Continue editing new drafts without changing the live snapshot.
6. Use **Unpublish** to remove the CMS-controlled URL from the public site.
7. Use **Revision history** to restore an older snapshot into the editor as a draft. Restore never republishes automatically.

## Publication storage

`migrations/0004_publications.sql` adds `cms_publications`.

Each entity has one publication record containing:

- entity type and ID
- live path
- immutable published snapshot JSON
- publication version
- live/unpublished tombstone state
- publisher identity
- publish timestamp

The tombstone state is intentional. The original Dakzo website is static, so deleting a publication would otherwise reveal the previous static page underneath. An unpublished tombstone prevents that fallback and returns a non-indexable 404 for the CMS-controlled URL.

## Public rendering

Published CMS snapshots are rendered by the Worker using the existing Dakzo design assets. Public output includes:

- responsive Dakzo header/footer
- canonical URL
- SEO title and description
- Open Graph metadata
- safe escaped editor text
- Article structured data for Insights
- public R2 media delivery through `/cms-media/<id>`

Routes without an active CMS publication continue to fall through to the original static asset, preserving existing pages until they are explicitly published through the CMS.

## Security

- Admin preview remains behind Cloudflare Access.
- Preview responses are `noindex, nofollow, noarchive` and `no-store`.
- Saves are forced to draft at the Worker boundary.
- Publish/unpublish/restore are same-origin authenticated admin mutations.
- Revision restore affects draft state only.
- Uploaded editor text is escaped before public HTML rendering.

## Deployment

After applying `0001`, `0002`, and `0003`, apply:

`migrations/0004_publications.sql`

The existing `CMS_DB`, `MEDIA_BUCKET`, `ACCESS_TEAM_DOMAIN`, and `ACCESS_AUD` configuration remains required.
