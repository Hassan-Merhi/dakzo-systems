# Dakzo Systems Launch Runbook — Phase 22

## Purpose

Phase 22 is the final repository-level QA and launch-readiness gate. A green repository means the site is technically ready to deploy; it does not claim that DNS, a production custom domain, Google Search Console ownership, or a Google Business Profile has already been configured externally.

## Automated launch gate

Run:

```bash
npm run verify
```

The verification gate must pass before a production deployment. It covers:

- HTML/content linting
- internal route and link resolution
- brand and portfolio assertions
- responsive and reduced-motion assertions
- accessibility baseline checks
- conversion/privacy assertions
- SEO metadata and structured-data assertions
- production sitemap and robots generation
- security and hosting configuration assertions
- performance size budgets
- Wave 5 authority/brand assertions
- Wave 6 launch audit

## Code gate

- No broken internal routes.
- No unresolved TODO, FIXME, localhost, or example-domain placeholders in production output.
- No executable third-party scripts unless intentionally approved and reviewed.
- Build output must be deterministic from the repository.
- GitHub Actions must be green on the exact commit being deployed.

## Website gate

- Homepage, Solutions, Services, Work, About, Insights, Contact, Privacy, project case studies, and insight articles resolve.
- Custom 404 page exists and is noindex.
- Mobile viewport is present on every public page.
- Keyboard focus is visible.
- Mobile navigation exposes and updates ARIA expanded state.
- Reduced-motion preferences are respected.
- Images and SVG project artwork have accessible text alternatives or semantic title/description metadata.

## SEO gate

- Each public page has a title and meta description.
- Canonical URLs are generated from the deployed origin.
- Open Graph and Twitter metadata are present.
- Organization, WebSite, and Article structured data are present where applicable.
- `sitemap.xml` and `robots.txt` are generated from `SITE_URL`.
- Search Console verification is performed only after the final production domain is live.

## Performance gate

Current repository budgets are intentionally small:

- JavaScript: 8 KiB maximum for `site.js`
- combined core CSS: 20 KiB maximum
- HTML: 16 KiB maximum per page
- Wave 5 project SVGs: 12 KiB maximum each

A production browser check should still be performed after deployment for Core Web Vitals, because real network, browser, hosting, and device conditions cannot be truthfully certified by a repository-only static test.

## Security gate

- HTTPS-only production deployment.
- HSTS configured at the hosting layer.
- Content Security Policy present.
- X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and Cross-Origin-Opener-Policy present.
- Security disclosure file published at `/.well-known/security.txt`.
- Privacy page matches the site’s actual data flow.
- No physical location or Google Business Profile is published unless Dakzo genuinely satisfies Google eligibility requirements.

## Content gate

Before a public launch, a human should verify:

- company name and Dakik LLC relationship
- all product descriptions
- logos and visual identity
- spelling and grammar
- contact details once approved
- project claims for accuracy
- no confidential screenshots or customer data
- no fabricated testimonials, metrics, offices, awards, or clients

## External launch checklist

These steps happen outside the Git repository and therefore remain external prerequisites:

1. Connect the final production domain.
2. Set `SITE_URL` to that exact canonical HTTPS origin for the production build.
3. Verify HTTPS and production response headers.
4. Run a real-browser mobile and desktop smoke test.
5. Verify ownership in Google Search Console.
6. Submit the generated sitemap.
7. Inspect the homepage and flagship case-study URLs in Search Console.
8. Connect only verified social profiles.
9. Create a Google Business Profile only if Dakzo is genuinely eligible.
10. Record the production launch date as the baseline for Phase 23 measurement.

## Launch decision

A green repository plus the completed external checklist means **Launch Ready**. A green repository alone means **Code Ready / External Launch Steps Pending**.
