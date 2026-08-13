# Dakzo CMS Phase 8 — Production Migration & Final QA

Phase 8 closes the CMS build with a production-readiness gate, migration order, smoke-test checklist, and rollback procedure.

## Required Cloudflare resources

The deployed Worker must have these bindings/variables:

- `CMS_DB` — Cloudflare D1 database binding
- `MEDIA_BUCKET` — Cloudflare R2 bucket binding
- `ACCESS_TEAM_DOMAIN` — Cloudflare Access team domain
- `ACCESS_AUD` — Cloudflare Access application audience
- `ADMIN_EMAILS` — optional comma-separated administrator allowlist; recommended for a single-owner admin

No account IDs, secrets, Access JWTs, or database identifiers belong in the repository.

## Migration order

Apply every migration once, in order, to the production D1 database:

1. `migrations/0001_cms.sql`
2. `migrations/0002_media_projects.sql`
3. `migrations/0003_pages_insights.sql`
4. `migrations/0004_publications.sql`

The Phase 8 production gate requires all seven CMS tables and the Phase 7 `cms_publications.is_live` column.

Typical Wrangler flow after the real D1 database is bound as `CMS_DB`:

```bash
npx wrangler d1 execute <DATABASE_NAME> --remote --file=migrations/0001_cms.sql
npx wrangler d1 execute <DATABASE_NAME> --remote --file=migrations/0002_media_projects.sql
npx wrangler d1 execute <DATABASE_NAME> --remote --file=migrations/0003_pages_insights.sql
npx wrangler d1 execute <DATABASE_NAME> --remote --file=migrations/0004_publications.sql
```

Use the real database name from the Cloudflare account. Do not copy placeholder IDs into `wrangler.jsonc`.

## Deployment gate

After deployment, sign in through Cloudflare Access and open `/admin/`.

On the Dashboard, run **Production readiness**. A READY result requires:

- Access team domain and audience configured
- `CMS_DB` binding present
- `MEDIA_BUCKET` binding present and reachable
- all required CMS tables present
- publication schema includes `is_live`
- at least five seeded core pages
- at least three seeded projects
- at least four seeded Insights articles

The endpoint is authenticated and returns booleans/counts only; it does not expose secret configuration values.

## Final smoke tests

Run these in production after the gate is READY:

1. Sign into `/admin/` through Cloudflare Access.
2. Upload a disposable WebP/JPG image and confirm its private preview works.
3. Update its alt text, then delete the disposable asset.
4. Open HMD ERP, save a harmless draft-only text change, and confirm the public page remains unchanged.
5. Open **Preview draft** and confirm the draft is visible with a private preview banner.
6. Restore the original text if needed.
7. Publish one controlled content change and confirm the public route switches to the new version.
8. Create another draft edit and confirm the published snapshot remains live.
9. Open revision history and restore an earlier revision; confirm it returns as Draft rather than publishing automatically.
10. Verify Homepage, About, Services, Solutions, Contact, Work, HMD ERP, Congo Delivery, Moto Track, Insights, and one article on phone and desktop widths.
11. Confirm dark mode, language selector, Arabic RTL, keyboard navigation, focus indicators, and reduced-motion behavior still work.
12. Confirm sitemap/robots/public canonical URLs still point at the intended production domain before Search Console submission.

## Rollback

If a CMS publication is wrong:

1. Open its revision history.
2. Restore the desired revision to Draft.
3. Preview it.
4. Publish that restored draft.

If the CMS runtime itself has a production problem:

1. Roll the Worker deployment back to the previous known-good Cloudflare version.
2. Do not delete the D1 database or R2 bucket.
3. Preserve publication snapshots and revisions for recovery.
4. Fix the Worker in GitHub, run `npm run verify`, and redeploy only after the exact commit is green.

## Definition of complete

Repo-side Phase 8 is complete when the Phase 8 tests and the full `npm run verify` chain pass on the exact merged `main` commit. Cloudflare production activation is complete only after the authenticated Production readiness card reports READY in the deployed Worker and the production smoke tests above are executed against the real account bindings.
