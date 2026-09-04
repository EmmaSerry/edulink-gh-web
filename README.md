# ACTRS — Amenfi Central Terminal Report System

Offline-first, browser-based education management system that replaces the
Excel + Word Mail Merge workflow previously used to produce terminal report
cards for **KG1, KG2, Lower Primary, Upper Primary and JHS** at schools under
the **Wassa Amenfi Central Education Directorate**.

**Developed by:** Emmanuel Serry, ICT Coordinator, Wassa Amenfi Central
Education Directorate.

> **Current status: Version 1.0.0 — Official Production Release.**
> ACTRS is complete and certified production-ready for deployment in
> schools under the Wassa Amenfi Central Education Directorate. Version
> 1.0 is the result of eight phases of work (Phase 0 through Phase 7),
> the last two of which (`docs/PHASE6_QA_REVIEW.md`,
> `docs/PHASE7_CERTIFICATION.md`) were dedicated entirely to independent
> re-verification, defect correction, and final production packaging -
> introducing no new business features, only fixing what that review
> found and confirming everything else against the original
> requirements.
>
> **Start here:**
> [`docs/MASTER_PROJECT_BRIEF.md`](docs/MASTER_PROJECT_BRIEF.md) (the
> whole project in ~4 pages),
> [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) (for teachers/
> administrators),
> [`docs/ADMINISTRATOR_GUIDE.md`](docs/ADMINISTRATOR_GUIDE.md),
> [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (for ICT coordinators),
> [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md)
> and [`docs/DATABASE.md`](docs/DATABASE.md) (for developers),
> [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md),
> [`docs/PHASE7_CERTIFICATION.md`](docs/PHASE7_CERTIFICATION.md) (the
> Version 1.0 certification), and
> [`docs/PHASE7_ACCEPTANCE_TEST_REPORT.md`](docs/PHASE7_ACCEPTANCE_TEST_REPORT.md).
> The complete phase-by-phase development history remains in
> [`docs/ROADMAP.md`](docs/ROADMAP.md) and the per-phase documents from
> [`docs/PHASE1_CONFIGURATION.md`](docs/PHASE1_CONFIGURATION.md) through
> [`docs/PHASE6_QA_REVIEW.md`](docs/PHASE6_QA_REVIEW.md), plus
> [`docs/MAINTENANCE_GUIDE.md`](docs/MAINTENANCE_GUIDE.md),
> [`docs/DISASTER_RECOVERY.md`](docs/DISASTER_RECOVERY.md) and
> [`docs/FUTURE_ROADMAP.md`](docs/FUTURE_ROADMAP.md) for what comes
> after Version 1.0.

## Why this exists

The Amenfi Central circuit currently produces report cards from three Excel
workbooks (one per level) whose SUMMARY sheet is mail-merged into a matching
Word template via a hard-coded OLE DB connection. That works, but only on one
Windows PC with Microsoft Office installed, using an absolute file path that
breaks if the file moves. ACTRS reproduces the same grading logic and report
layouts inside a single browser-based application that runs fully offline on
any device, with no server and no Windows/Office dependency.

## Technology stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript, Bootstrap 5 |
| Local database | IndexedDB via Dexie.js |
| Forms & validation | React Hook Form + Zod |
| Reporting | jsPDF + html2canvas (implemented in Phase 4) |
| Packaging | Progressive Web App (installable, offline service worker) |
| Build tool | Vite (build-time only — see note below) |

**No PHP. No Python backend. No Node.js server at runtime. No SQL database.
No Firebase.** Vite is used only to *build* the static app (bundle
TypeScript/React into plain HTML/CSS/JS); once built, the app is a set of
static files plus a service worker and needs no server process to run.

## Getting started

This project was authored directly (not scaffolded via `npm create vite`)
because the development sandbox that produced it has no live npm registry
access. On your own machine, with normal internet access:

```bash
npm install      # fetches React, Dexie, Bootstrap, etc. per package.json
npm run dev      # starts the Vite dev server
npm run build    # type-checks (tsc -b) and produces the production build in dist/
npm run preview  # serves the production build locally to test PWA install
```

No environment variables or backend configuration are required — the app
works immediately after `npm install`.

## Project structure

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full rationale.
Summary:

```
src/
  components/   Reusable, presentation-only UI components
  pages/        One file per routed screen (Dashboard, Students, ...)
  layouts/       App shell (Sidebar, Topbar, AppLayout, AuthLayout)
  services/     Data-access layer (repository pattern over Dexie)
  database/     Dexie schema (db.ts) + default configuration seed (seed.ts)
  models/       TypeScript interfaces for every entity
  utils/        Small, pure, framework-free helper functions
  validation/   Zod schemas and reusable validators
  reporting/    Report template engine (Phase 4 — placeholder now)
  backups/      Export/import engine (Phase 5 — placeholder now)
  styles/       Design tokens / theme CSS
  config/       App-wide configuration: branding, navigation, level codes
  hooks/        Reusable React hooks
  contexts/     React context providers (app-wide state)
  assets/       Static assets bundled by Vite
docs/           Architecture & standards documentation
public/icons/   PWA icons and favicon
```

## Documentation index

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — software architecture & configuration-driven design
- [`docs/DATABASE.md`](docs/DATABASE.md) — Dexie/IndexedDB schema reference & migration playbook
- [`docs/UI_DESIGN_SYSTEM.md`](docs/UI_DESIGN_SYSTEM.md) — theme, components, layout rules
- [`docs/NAVIGATION.md`](docs/NAVIGATION.md) — navigation structure & how to add a module
- [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) — TypeScript/React conventions
- [`docs/PWA.md`](docs/PWA.md) — offline/installable app configuration
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phase plan and acceptance criteria

## Licence / ownership

Internal system developed for the Wassa Amenfi Central Education Directorate.
