# Wave 2 Verification — Phases 5–9

## Deliverables

- [x] Phase 5 — HMD ERP flagship case study
- [x] Phase 6 — Congo Delivery case study
- [x] Phase 7 — Moto Track case study
- [x] Phase 8 — Reusable future-project case-study system
- [x] Phase 9 — Dakik LLC corporate relationship

## Public routes added

- `/work/hmd-erp/`
- `/work/congo-delivery/`
- `/work/moto-track/`

## Portfolio requirements

- The Work page links directly to all three case studies.
- HMD ERP explains inventory, factory, containers/logistics, accounting/daybook, POS/sales, and payroll/people workflows without exposing confidential business data.
- Congo Delivery explains the delivery journey across order intake, dispatch, tracking, operational dashboards, customer experience, and scalable workflows.
- Moto Track explains tracking across live maps, fleet management, alerts, history, reporting, and mobile usage.
- `docs/case-study-system.md` defines a repeatable route, structure, content standard, and verification requirement for future projects.
- The About page identifies Dakzo Systems as the software and technology subsidiary of Dakik LLC and explains the parent → technology subsidiary → product relationship.

## Verification command

```bash
npm run verify
```

The automated suite now checks 10 public routes and Wave 2 portfolio/corporate assertions in addition to the Wave 1 accessibility, responsive, brand, navigation, and production-build baseline.

GitHub Actions runs the same `npm run verify` gate on every push to `main` and on pull requests.
