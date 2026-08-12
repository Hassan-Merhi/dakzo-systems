# Wave 3 Verification — Phases 10–15

## Deliverables

- [x] Phase 10 — Conversion system
- [x] Phase 11 — Technical Google SEO
- [x] Phase 12 — Structured data
- [x] Phase 13 — Search Console/indexing foundation
- [x] Phase 14 — Keyword strategy
- [x] Phase 15 — Dakzo Insights knowledge center

## Conversion acceptance

The project inquiry captures name, company, email, project type, timeline, budget, and problem details. It validates required fields in-browser, creates a portable project brief, and supports clipboard copy. The static site deliberately does not transmit personal data to an unconfigured third-party endpoint. A production contact destination can be connected after the official domain/contact channel is approved.

## SEO acceptance

- Unique page titles and meta descriptions are present on all Wave 3 content.
- Canonical URLs are generated from the deployed origin.
- Open Graph and Twitter metadata are generated consistently.
- Organization + WebSite Schema.org JSON-LD is present site-wide at runtime.
- Article JSON-LD is added to insight guides.
- Production build discovers all public index routes.
- Production build creates `sitemap.xml` and `robots.txt`.
- `SITE_URL` is the single deployment control for sitemap/robots canonical origin.
- Keyword and content rules are documented in `docs/seo-growth-strategy.md`.

## Search Console boundary

Source code is ready for Google Search Console, but domain-property verification and sitemap submission require control of the final production domain and its DNS/Search Console account. Those external actions must happen at deployment; they cannot be truthfully marked as externally verified from repository code alone.

## Initial knowledge center

Published four original guides:

1. Custom ERP vs. off-the-shelf ERP
2. When custom software is worth it
3. How logistics platforms connect operations
4. How fleet tracking systems work

Each guide targets a distinct user question, links to a relevant project/conversion path, and is marked as Article content for structured data.

## Automated verification

`npm run verify` validates the original Wave 1–2 requirements plus Wave 3 route existence, conversion behavior hooks, responsive styles, canonical/OG/schema logic, sitemap/robots generation code, and insight content assertions. The production build fails if fewer than ten crawlable routes are generated.
