# Multilingual Phases 4–7

Dakzo Systems uses English (US) as the default public language and supports French, Arabic, and Spanish through the global language selector established in Phases 1–3.

## Phase 4 — Every public page

The full-page translation layer covers the current public HTML inventory: homepage, About, Brand & Media, Contact, Insights index, all four current Insights articles, Privacy, Services, Solutions, Work, the HMD ERP/Congo Delivery/Moto Track case studies, and the 404 page.

The permanent coverage test extracts public visible text, metadata descriptions, and translatable `aria-label`, `placeholder`, `alt`, and `title` attributes. French, Arabic, and Spanish must expose the same translation key set.

## Phase 5 — Professional copy

Translations preserve company and product names where they are brands and use context-appropriate terminology for ERP, logistics, tracking, automation, system integration, inventory, and operational software. Long-form Insights and legal/privacy copy are translated as complete content, not just navigation labels.

## Phase 6 — Arabic RTL

Selecting Arabic sets `html[dir="rtl"]` and applies RTL-aware behavior to navigation, grids, cards, work links, forms, articles, footer, mobile layouts, CTA arrows, and capability borders. Technical content that should remain LTR—email/URL/tel values, code/preformatted text, and telemetry-style visuals—keeps LTR direction.

## Phase 7 — Forms, media, dynamic content, and CMS

The page layer translates form labels/options/placeholders, localized native validation messages, image alt text, metadata, shared dynamic controls, and project-brief UI. A MutationObserver handles UI inserted after page load.

CMS-rendered content can provide route-specific translations in `cms_translations`. Public translation responses are limited to live publications with completed locale records. Admin translation writes remain behind the existing Cloudflare Access and same-origin mutation boundary.

New CMS pages/projects/articles default to requiring completed French, Arabic, and Spanish records before they can be published. Existing seeded content remains compatible with the built-in translation dictionary during rollout.

## Performance

English (US) does not download the French/Arabic/Spanish full-page dictionaries. Each non-English locale is split into lazy chunks and loaded only after that language is selected. Production builds enforce separate budgets for core JS, locale chunks, CSS, and per-page HTML.

## Verification

`npm run verify` includes `scripts/i18n-pages-test.mjs`, which checks full-page translation coverage, equal locale key sets, RTL contracts, form validation coverage, CMS translation schema/API routing, publication guards, and production asset budgeting.
