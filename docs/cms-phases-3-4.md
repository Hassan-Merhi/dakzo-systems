# Dakzo CMS — Phases 3–4

## Delivered

### Phase 3 — Media Library

- Private media UI under `/admin/`
- R2-backed image upload through the Worker binding `MEDIA_BUCKET`
- D1 metadata in `cms_media`
- JPG, PNG, WebP, AVIF, and GIF allowlist
- 8 MB per-image application limit
- SVG upload rejection by design
- Alt-text and display-filename editing
- Authenticated image preview URLs
- Delete protection while media is referenced by CMS content
- Activity records for upload, edit, and delete actions

### Phase 4 — Project Manager

- D1-backed project list/create/update/archive APIs
- Seed records for HMD ERP, Congo Delivery, and Moto Track
- New future-project creation
- Draft / published / archived state
- Industry and project type fields
- Hero-media selection
- Gallery-media selection
- Structured content sections
- SEO title and description
- Revision snapshots and activity records written with project mutations
- Duplicate-slug and missing-media validation

## Required Cloudflare bindings

The Worker deliberately fails closed when storage bindings are absent.

Create and bind these resources to the `dakzo-systems` Worker:

- D1 database binding: `CMS_DB`
- R2 bucket binding: `MEDIA_BUCKET`

The concrete Cloudflare resource IDs are account-specific and must not be committed as invented placeholders.

## D1 migration order

Apply migrations in numeric order to the production D1 database:

1. `migrations/0001_cms.sql`
2. `migrations/0002_media_projects.sql`

The second migration is idempotent and seeds the three current Dakzo portfolio projects using stable IDs.

## Cloudflare Access variables

The Phase 2 security boundary remains required:

- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`
- `ADMIN_EMAILS` (optional comma-separated allowlist)

The admin page and every `/api/admin/*` route validate a Cloudflare Access JWT before rendering or executing.

## Safety rules

- Admin is not part of the public static `site/` tree.
- Admin responses are `noindex`, `no-store`, and frame-denied.
- Mutation requests require same-origin browser requests in addition to Access authentication.
- Project writes use D1 prepared statements and batches.
- Media is stored through the in-process R2 binding, not Cloudflare REST credentials.
- Public case-study templates are intentionally not switched to CMS data in Phases 3–4; that happens in the later page migration/publish phases so admin edits cannot unexpectedly rewrite the live public site yet.
