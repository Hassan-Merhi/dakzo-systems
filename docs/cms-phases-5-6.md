# Dakzo CMS Phases 5–6

## Phase 5 — Page & Homepage Editor

The private `/admin` CMS now exposes controlled editors for the five core website pages:

- Homepage
- About
- Services
- Solutions
- Contact

Each page can manage its title, CMS status, hero eyebrow and heading, intro copy, featured project, structured sections, primary and secondary CTAs, canonical path, social image, SEO title, and SEO description.

Core page slugs are intentionally not editable in the admin. This prevents accidental route and navigation breakage.

Page writes use the D1 binding and are batched with a revision snapshot and activity record. The CMS stores draft/published/archived state, but public rendering remains on the existing static templates until Phase 7 adds explicit preview/publish behavior.

## Phase 6 — Dakzo Insights CMS

The admin now supports creating and editing Insights articles with:

- title and URL slug
- excerpt
- category
- draft/published/archived CMS state
- featured R2 media
- related Dakzo project
- long-form article body
- key takeaways
- SEO title and description
- archive action
- revision snapshots and activity logging

Article body content is stored as structured plain text rather than executable HTML. This keeps the future public renderer in control of markup and reduces content-injection risk.

## Migration 0003

`migrations/0003_pages_insights.sql` seeds the CMS with the existing core-page content model and the four original Dakzo Insights guides:

- `custom-erp-vs-off-the-shelf`
- `when-custom-software-is-worth-it`
- `how-logistics-platforms-work`
- `how-fleet-tracking-systems-work`

The seeded articles are linked to HMD ERP, Congo Delivery, and Moto Track where relevant.

## Deployment order

The account-specific Cloudflare resources from Phases 1–4 are still required:

1. Bind a D1 database as `CMS_DB`.
2. Bind an R2 bucket as `MEDIA_BUCKET`.
3. Configure Cloudflare Access variables `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`.
4. Optionally set `ADMIN_EMAILS` as a comma-separated allowlist.
5. Apply migrations in order: `0001_cms.sql`, `0002_media_projects.sql`, `0003_pages_insights.sql`.
6. Deploy the Worker with its static `dist` assets.

No Cloudflare resource IDs are committed because they are account-specific.

## Verification

`npm run verify` now includes Worker syntax validation plus the existing public-site lint/tests/build/launch audit and CMS assertions covering Phases 1–6.
