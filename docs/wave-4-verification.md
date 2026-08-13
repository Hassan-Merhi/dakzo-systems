# Wave 4 Verification — Phases 16–18

## Deliverables

- [x] Phase 16 — Performance & mobile hardening
- [x] Phase 17 — Security & production hardening
- [x] Phase 18 — Production and local-presence readiness

## Automated acceptance gate

Run:

```bash
npm run verify
```

Wave 4 extends the existing lint, functional, accessibility, responsive, conversion, SEO, and production-build checks with:

- every crawlable page has a mobile viewport
- every public page remains below the HTML size budget
- first-party JavaScript and CSS remain below explicit transfer-size budgets
- production pages avoid third-party executable scripts
- production output includes `404.html`, `health.json`, privacy, and security disclosure resources
- Render is configured to deploy only after linked CI checks pass
- security headers cover clickjacking, MIME sniffing, referrer leakage, browser permissions, HSTS, opener isolation, and a restrictive content security policy
- static assets receive bounded browser caching without unsafe immutable caching on unhashed filenames
- the privacy page accurately reflects the browser-only project brief behavior

## Performance baseline

The website is intentionally static and dependency-light. Performance work should preserve this property:

- no client framework is required for public navigation
- no third-party font dependency
- no third-party analytics or advertising scripts in the current build
- JavaScript is deferred
- SVG brand assets remain compact
- Render serves static output from its CDN with platform compression and HTTP/2

Budgets are enforced by `scripts/build.mjs` and `scripts/test.mjs` so later waves cannot silently add large payloads.

## Production baseline

`render.yaml` is the deployment source of truth. It defines:

- static runtime
- `npm run build`
- `dist` as the publish directory
- pull-request previews
- `checksPass` automatic deployment
- production response headers

The final custom domain must be verified before launch. `SITE_URL` remains the single build-time canonical-domain setting.

## Local-presence rule

Dakzo Systems must not publish a physical address, local-business structured data, or create a Google Business Profile unless the underlying location and customer-contact eligibility are verified. Until then, the site should describe Dakzo accurately as a software and technology company without inventing a storefront or office.
