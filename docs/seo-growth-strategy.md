# Dakzo Systems — Google SEO & Growth Strategy

## Technical foundation

The site is designed to expose one crawlable URL per meaningful service, project, and insight. Every page carries a unique title and meta description. `site/assets/site.js` adds canonical URLs, Open Graph/Twitter metadata, and Schema.org JSON-LD using the real deployed origin so preview/staging domains are not permanently hard-coded.

At build time, `scripts/build.mjs` discovers every `index.html` route and generates:

- `dist/sitemap.xml`
- `dist/robots.txt`

Production must set `SITE_URL` to the final HTTPS origin, for example `https://www.example.com`. The default is `https://dakzosystems.com` until the production domain is confirmed.

## Structured data

Every page receives Organization and WebSite JSON-LD. Insight pages marked with `data-content-type="article"` additionally receive Article JSON-LD with Dakzo Systems as publisher and author. Case-study and service-specific schema can be added when the production facts, URLs, screenshots, and product availability are confirmed.

## Search Console / indexing launch checklist

Search Console requires control of the final production domain and therefore cannot be verified from source code alone. At deployment:

1. Set `SITE_URL` to the canonical HTTPS domain and build production.
2. Verify the domain property in Google Search Console using DNS.
3. Submit `/sitemap.xml`.
4. Inspect the homepage, services, work, all three case studies, and the first insight URLs.
5. Confirm pages are indexable and rendered correctly.
6. Monitor Page indexing, Core Web Vitals, HTTPS, enhancements, impressions, clicks, queries, and manual/security actions.
7. Do not request indexing for duplicate, thin, staging, or private URLs.

## Keyword architecture

### Primary commercial themes

- custom software development
- custom software company
- custom ERP development
- ERP development company
- custom business software
- web application development
- mobile application development
- business automation software
- logistics software development
- delivery management software development
- fleet tracking software development
- inventory management software development

### Supporting informational themes

- custom ERP vs off-the-shelf ERP
- when custom software is worth it
- how logistics platforms work
- how fleet tracking systems work
- multi-location inventory systems
- ERP for import/export operations
- delivery management workflows
- business process automation

## Content rules

- Write for a real operational question before a keyword.
- One page owns one clear search intent; avoid near-duplicate doorway pages.
- Use project evidence and specific workflows rather than unsupported performance claims.
- Link insight content to the most relevant service or case study.
- Link service and case-study pages back to supporting guides where useful.
- Keep titles descriptive and natural; do not keyword-stuff headings or metadata.
- Add original screenshots, diagrams, examples, and measurable outcomes as they become publishable.

## Measurement

Track organic impressions, non-brand queries, indexed pages, CTR, qualified project inquiries, assisted conversions, referring domains, Core Web Vitals, and which service/case-study pages produce meaningful leads. Rankings are a diagnostic, not the sole success metric.
