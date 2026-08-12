# Dakzo Systems Case Study System

Every new Dakzo Systems project should be publishable without redesigning the portfolio.

## Route convention

Create each case study at:

`site/work/<project-slug>/index.html`

Example:

`site/work/new-platform/index.html`

## Required structure

1. **Metadata**
   - Unique `<title>`
   - Unique meta description
   - Dakzo favicon, shared stylesheet, and shared site script
2. **Case-study hero**
   - Product/category eyebrow
   - One clear H1
   - Short summary describing what the system is and why it exists
   - Link back to `/work/`
3. **Challenge / Product / Approach**
   - Three cards explaining the problem, the product response, and the product/engineering approach
4. **Platform areas**
   - Describe the primary workflows or capabilities rather than listing generic features
5. **What it demonstrates**
   - Explain what the project proves about Dakzo Systems' capability
6. **Conversion**
   - Link to `/contact/` with a project-relevant CTA
7. **Shared footer**
   - Link the three flagship systems directly and preserve the Dakik LLC relationship

## Content rules

- Describe only capabilities that are accurate for the project.
- Avoid invented performance metrics, client outcomes, customer counts, revenue figures, or confidential operational data.
- Explain the operational problem before explaining technology.
- Keep each project useful as proof of capability and as a future search landing page.
- Use screenshots only after sensitive data has been removed or replaced.

## Portfolio index

When adding a project, also add a card and direct link from `site/work/index.html`.

## Verification

Add the new route to `scripts/test.mjs` so CI confirms the page exists and its internal links resolve.
