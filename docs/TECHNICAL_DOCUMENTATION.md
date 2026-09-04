# ACTRS Technical Documentation

**Amenfi Central Terminal Report System (ACTRS)** — Version 1.0

This is the single entry-point technical reference for ACTRS, written for
a developer or ICT professional who needs to understand, maintain, or
extend the codebase. It ties together and cross-references the deeper
per-topic documents already in `docs/` rather than duplicating them —
follow the links for full detail on any one area.

## 1. System Architecture

ACTRS is a **100% client-side, offline-first single-page application**.
There is no backend, no server, no database server, and no network
dependency for any core workflow. The entire shipped artifact is static
HTML/CSS/JS plus a service worker; Node.js/npm/Vite are *build-time*
tooling only and are never present at runtime.

The layered architecture (full rationale in `docs/ARCHITECTURE.md`):

```
Pages (src/pages)              — routed screens, one per module
Components / Layouts           — presentation only, no business logic
Hooks / Contexts                — cross-cutting state & data-access glue
Services (src/services)         — business logic + data access (repository
                                   pattern over Dexie)
Database (src/database)         — Dexie/IndexedDB schema + migrations only
```

**Rule of thumb: components render, services decide, the database
stores.** This boundary was checked and re-confirmed as part of Phase 6's
architecture review (`docs/PHASE6_QA_REVIEW.md` Module 1) and held up
with no violations found.

The guiding design principle behind the whole system: **subjects, grade
bands, learning areas, skills, report templates and assessment rules are
database records, not source code** — a curriculum change is a Settings
edit, not a redeploy. See `docs/ARCHITECTURE.md` Section 1 for the full
argument and Section 5 for exactly how a genuinely new future module
would be added without touching any existing file structurally.

## 2. Folder Structure

See `docs/DEPLOYMENT.md` Section 4 for the annotated folder tree. In
summary: `src/pages` (one file per screen), `src/services` (one file per
entity/module's business logic), `src/models` (one file per entity's
TypeScript types), `src/database` (the Dexie schema and default seed
data), `src/reporting` (report card templates), `src/components` (shared
UI building blocks), `src/hooks`/`src/contexts` (cross-cutting state),
`src/validation` (Zod schemas), `src/utils` (small stateless helpers),
`src/config` (branding/navigation/app-wide constants), and `src/styles`
(the theme and print stylesheets).

## 3. Database Schema & Entity Relationships

Full field-level reference: **`docs/DATABASE.md`**. In summary: 34 Dexie
tables at schema version 6, covering school/curriculum configuration,
student/guardian/enrollment/promotion records, assessment data (scored
and skill-checklist, kept in separate tables since they're structurally
different), generated reports (frozen, versioned snapshots), archives,
backups, and system/audit logs. Every foreign-key-style relationship
(e.g. a Class belonging to a Level, a ScoreRecord belonging to a Student/
Term/Subject) is enforced at the service layer on delete — see
`docs/DATABASE.md` "Referential integrity" for the complete table.

## 4. Service Layer

Every entity has a service in `src/services/`, most extending the
generic `BaseRepository<T>` (`src/services/BaseRepository.ts`) for
consistent `getAll`/`getById`/`create`/`update`/`remove`/`count`
semantics, then adding entity-specific business logic and integrity
guards on top (e.g. `TermService.remove()` blocking deletion of a term
with real data attached, or `ArchiveService.assertTermEditable()` being
called by every service that mutates per-term data). `BaseRepository`
itself intentionally contains **no domain/business logic whatsoever** —
this boundary has been deliberately preserved through every phase of the
project, including a standing decision not to add cross-cutting
side-effects (such as blanket audit-logging) to it, keeping each
subclass free to add exactly the guards its own entity needs (see
`AuditLogService`/`SystemLogService` overriding `update`/`remove` to make
themselves append-only, as one example — `docs/PHASE6_QA_REVIEW.md`
Module 9).

Key non-CRUD services: `AssessmentCalculationEngine.ts` (pure functions,
no Dexie access at all — see Section 8), `ReportDataService.ts` (resolves
a class's live data into a template-ready snapshot), `ReportGenerationService.ts`
(writes/versions `GeneratedReport`/`ReportVersionEntry`), `ArchiveService.ts`
(the term-locking guard), `BackupService.ts` (backup/restore), `ImportService.ts`/
`ConfigImportExportService.ts` (bulk data import with validation), and
`SystemLogService.ts` (the unified activity feed).

## 5. Component Hierarchy

`src/layouts/AppLayout.tsx` (Sidebar + Topbar shell, permanent, never
changes per-module) wraps every routed page. Shared building blocks
(`Card`, `Modal`, `PageHeader`, `EmptyState`, `LoadingSpinner`,
`DataTable`, `FormField`, `Breadcrumb`, `StatusBadge`) live in
`src/components/` and are used consistently across every module — see
`docs/UI_DESIGN_SYSTEM.md` for the visual design tokens they share, and
`docs/PHASE6_QA_REVIEW.md` Module 6 for the UI-consistency review that
verified this (and fixed the shared `Modal`'s accessibility once, for
every one of its ~16 callers at once).

## 6. Routing & State Management

Routing: `react-router-dom`, all routes declared in `src/App.tsx`. Since
Phase 7, every route is wrapped in `React.lazy` behind one shared
`<Suspense>` boundary — see "Production build" (Section 12) for why.

State management is deliberately simple, matching a single-user,
single-device, offline application: `dexie-react-hooks`'s `useLiveQuery`
reads data reactively straight from IndexedDB (no separate client-side
cache/store to keep in sync — Dexie *is* the state), React's own
`useState`/`useReducer` handle transient UI state, and two small React
Contexts (`ToastContext`, `ConfirmContext`) handle the two genuinely
cross-cutting UI concerns (notifications, confirmation dialogs). There is
no Redux/Zustand/global client store — deliberately, since there is no
server state to reconcile against and Dexie's reactive queries already
provide "the UI always reflects the database" for free.

## 7. Report Engine

`src/reporting/templateRegistry.tsx` maps a `ReportTemplateCode` to its
React component (`LowerPrimaryReportTemplate`, `UpperPrimaryReportTemplate`,
`JHSReportTemplate`, `KGReportTemplate`), all built on shared layout
pieces (`ScoredReportLayout`, `ReportHeader`, `SignatureBlock`,
`ReportPage`). `ReportDataService.buildClassSnapshots()` is the single
place that resolves a class's live data (students, scores or skill
ratings, remarks, school/term info) into the `ReportSnapshot` shape every
template renders from — templates themselves never touch Dexie or
perform any calculation. A `ReportSnapshot` is a plain, serializable
object, which is also exactly what gets frozen into a `GeneratedReport`/
`ReportVersionEntry` when a report is generated (see Section 9's
"frozen snapshot" note).

## 8. Calculation Engine

`src/services/AssessmentCalculationEngine.ts` is deliberately a set of
**pure, framework-free functions** — no Dexie, no React, nothing but
plain data in and plain data out (`computeSubjectTotal`,
`findGradeBand`, `computeCompetitionRanking`, `computeOverallForStudent`).
This is what makes the engine independently verifiable (see the
executable proof scripts in `scripts/`, e.g. `verify_e2e_scored_lifecycle.mjs`,
which faithfully reproduce and test this exact code) and guarantees a
subject total/grade/rank can never silently drift out of sync with the
raw scores it's derived from, since none of it is ever stored — it is
always computed fresh, every time.

## 9. Import/Export Engine

`ImportService.ts` (student bulk import) and `ConfigImportExportService.ts`
(Subjects/Learning Areas/Skills/Remarks Bank import-export) both follow a
"parse → validate with per-row errors → commit only the valid rows"
three-step flow, so a bad spreadsheet never partially corrupts the
database — every row is validated (including within-file and
against-database duplicate detection) before anything is written.
`ExportService.ts`/`CenterExportService.ts` handle outbound xlsx/csv/json
exports; since Phase 6 (`docs/PHASE6_QA_REVIEW.md` Module 9), every
xlsx/csv export sanitizes cell values through `src/utils/spreadsheetSafety.ts`
before writing, closing a spreadsheet-formula-injection risk.

## 10. Backup Engine

`BackupService.ts` groups every Dexie table into named modules (see
`docs/DATABASE.md` "Backup modules" for the complete, current list — this
was corrected in Phase 6 after finding five tables had been silently
excluded from every backup). A **Full Backup** is JSON (the only format
Restore actually reads back), with xlsx/csv as human-readable-only
exports. `Restore` always runs inside one Dexie read-write transaction
(clear-then-bulk-re-add per selected table), so a failure partway through
leaves the existing database completely untouched — this atomicity is
provided natively by IndexedDB, not hand-rolled.

## 11. PWA Architecture

Full detail in `docs/PWA.md`. In summary: `vite-plugin-pwa` generates the
manifest and a Workbox service worker at build time, with
`registerType: "autoUpdate"` so installed copies pick up a new deployment
automatically. `navigateFallback` (added Phase 6, replacing an earlier,
incomplete per-URL caching rule) guarantees every route works offline,
including ones never visited before going offline — essential for a
client-routed SPA with no server. Since Phase 7, ACTRS also offers its
own explicit "Install ACTRS" action (`src/hooks/useInstallPrompt.ts`) on
the About page, rather than relying solely on a browser's own
often-low-visibility install affordance.

## 12. Production build

`npm run build` runs `tsc -b && vite build`. Vite/Rollup apply JS/CSS
minification and tree-shaking by default; since Phase 7 these are pinned
explicitly in `vite.config.ts` (`minify: "esbuild"`, `cssMinify: true`)
rather than left implicit. **Route-level code splitting** (`React.lazy`
across every route, added Phase 6) is the single highest-leverage
performance change in the project: first paint no longer needs to load
jsPDF, html2canvas or SheetJS/xlsx (three sizeable libraries, only
transitively needed by report/export/backup pages) until one of those
pages is actually opened. A `maximumFileSizeToCacheInBytes` override
(5MB, versus Workbox's 2MB default) guards against any one chunk ever
being silently skipped from offline precache. This sandbox has no
installed `node_modules` and cannot run a real `vite build` to measure
actual bundle sizes — this should be the first thing checked in a real
build environment (see `docs/DEPLOYMENT.md`).

## 13. Key architectural decisions — the reasoning

- **Archiving locks, it never duplicates** (`docs/PHASE5_PRODUCTION.md`):
  a closed term's data is never copied into a second table — that would
  create a second source of truth that could silently drift from the
  original. Instead, `ArchiveService.assertTermEditable()` is called from
  every mutating service method for per-term data, rejecting writes for
  an archived term. Viewing/reprinting reads the same live tables,
  filtered by the archived term — there is nothing extra to keep in
  sync.
- **Frozen report snapshots, never overwritten** (`docs/PHASE4_REPORTS.md`):
  `GeneratedReport` (the current version) is upserted, but every
  generation also appends an immutable `ReportVersionEntry` — so a report
  printed months ago can always be reproduced exactly, even after later
  score corrections regenerate a new current version.
- **`BaseRepository` stays intentionally minimal**: a standing project
  decision, re-affirmed explicitly in Phase 6, against adding blanket
  cross-cutting behaviour (such as automatic audit-logging) to the shared
  repository base — each entity's own service adds exactly the behaviour
  it needs, keeping the base class simple, predictable, and safe to
  reason about for every subclass at once.
- **No client-side global store**: Dexie's reactive `useLiveQuery` already
  makes the database the single source of truth the UI reads from
  directly — adding a second, separate client-side store would only
  create a second place state could disagree with the database.
