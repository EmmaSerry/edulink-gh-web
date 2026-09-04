# Phase 5 — Records Management, Archives, Backup, Analytics & Production Readiness

Phase 5 is the final functional development phase: it does not redesign
any completed module, it adds the remaining enterprise features needed
to run ACTRS as a real production system, then closes with a dedicated
Production QA & Release Pass over the whole application (see the last
section of this document).

## The core design decision: archiving locks, it never duplicates

Every phase before this one already made most of ACTRS's historical data
append-only by construction: `Enrollment`/`PromotionHistoryEntry` rows
are never edited after the fact (Phase 2), and `GeneratedReport`/
`ReportVersionEntry` are frozen snapshots that are only ever superseded,
never overwritten (Phase 4). So "permanently archiving a term" does not
mean copying all of that into a second, parallel set of tables — that
would just create a second source of truth that could silently drift
from the original.

Instead, `ArchiveService.archiveTerm()`:

1. Writes one `TermArchiveEntry` row marking the term CLOSED, with a
   point-in-time summary (student/class/report counts) for the Archives
   browser to show without re-scanning every table.
2. Causes `ArchiveService.assertTermEditable()` to start rejecting writes
   for that term from every place that mutates per-term data:
   `ScoreRecordService.upsertField`, `SkillRecordService.upsertRating`,
   `ReportRecordService.upsertFields`, `EnrollmentService.assignClass`,
   `AssessmentSessionService.changeStatus` (reopening only), and
   `ReportGenerationService.generateForStudent` (regeneration only —
   reprinting an already-frozen version never goes through this method,
   so it is unaffected).

Viewing or reprinting an archived report card, and comparing academic
years, both read the **existing live tables** filtered by the archived
term/year. There is nothing extra to keep in sync, and no risk of the
archive disagreeing with the data it describes.

An accidental archive can be reversed ("Unarchive") — a deliberate,
logged safety valve, not a routine action.

## Data model (new in v6)

| Table | Purpose |
|---|---|
| `archives` | One row per archived term (see above). |
| `systemLogs` | General-purpose activity log for everything that doesn't belong to the Phase 3 `auditLogs` table (backup/restore/import/export/archive actions). |
| `exportHistory` | Bulk export runs from the Import & Export Centre (students/assessment-sheet/reports/statistics/configuration/archive), distinct from Phase 4's per-report `exportLogs`. |
| `diagnosticsSnapshots` | History of manually-triggered "Run Diagnostics" checks. |
| `performanceMetrics` | Best-effort local timing samples (search, batch report generation, PDF export). |
| `backupHistory` | Widened additively (Phase 0 table) — full/partial scope, format, restore outcome. |

## Backup & Restore (Module 2)

`BackupService` groups every Dexie table into 10 named modules (School
Profile, Academic Structure, Subjects, Learning Areas & Skills, Remarks
Bank, Settings & Report Templates, Students, Assessments, Reports,
Archives). A **Full Backup** selects all 10; a **Partial Backup** is any
subset. Meta/log tables (`systemLogs`, `exportHistory`, `importLogs`,
`backupHistory` itself, `diagnosticsSnapshots`, `performanceMetrics`)
are deliberately excluded from backup content — they describe what
happened on *this* installation, and restoring them onto another/later
installation would misrepresent its own history rather than preserve it.

> **Superseded in Phase 6** (`docs/PHASE6_QA_REVIEW.md`): on independent
> re-verification this reasoning did not hold up — it was applied
> inconsistently (`auditLogs` is the same kind of installation-history
> data and was never excluded), and the realistic use of Restore is
> disaster recovery onto the *same* installation, where an administrator
> wants their real log history back. Five of these six tables
> (`systemLogs`, `exportHistory`, `importLogs`, `diagnosticsSnapshots`,
> `performanceMetrics`) are now included in a new `systemData` backup
> module. `backupHistory` alone remains excluded, for the narrower,
> still-valid reason that it is uniquely self-referential (it is the
> catalogue of backups *of* this database).

JSON is the fully lossless, restorable format. Excel/CSV exports are
best-effort, human-readable (nested objects are JSON-stringified per
cell) and are for viewing/sharing outside ACTRS only — the restore
screen only accepts `.json` files, and says so.

**Restore safety** ("automatic rollback if restore fails") is provided
by IndexedDB's own transaction atomicity: every table clear-and-reinsert
for a restore happens inside one `db.transaction("rw", ...)`. If any
write throws partway through, Dexie/IndexedDB discards the entire
transaction as if nothing had been touched. This is deliberately *not*
reimplemented by hand — there is no safe way to improve on a native
guarantee with a bespoke snapshot/undo layer, and doing so would just be
another thing that could itself have a bug.

**ID preservation** — restored rows keep their original numeric primary
keys (Dexie honours an explicit `id` on `bulkAdd` once a table has been
cleared first), so cross-table references (e.g. an `Enrollment`'s
`studentId`) continue to resolve correctly even when only some modules
are restored.

Before any restore, `previewRestore()` parses the file without writing
anything and reports exactly which tables/record counts would change
and which existing data would be replaced (conflict detection).

## Import & Export Centre (Module 3)

Student import/export already existed (Phase 2's `ImportService`/
`ExportService`, reused as-is, just wrapped so it logs consistently
alongside every other export type). `ConfigImportExportService` adds the
same parse → validate → commit shape for Subjects, Learning Areas,
Skills and the Remarks Bank, using a fixed, downloadable-template header
contract rather than Phase 2's full drag-and-drop column mapper — these
sheets are a handful of columns each, so this keeps the module small
without losing per-row validation and error reporting.

`CenterExportService` adds Assessment Sheet (SBA/Exam/Total/Grade per
subject for a class+term) and Statistics (subject/class averages,
grade-band distribution, pass rate) as new purpose-built spreadsheets;
Configuration and Archives export both delegate to `BackupService`'s
module grouping rather than inventing a third way to serialize the same
tables.

## Dashboard & Analytics (Module 4)

`AnalyticsService` reads directly from the raw score/enrollment tables
(never through the heavier per-student `ReportSnapshot` builder used for
report cards, which also resolves remarks/rankings/signatures that these
aggregate views don't need) so it stays fast at scale — each function
does indexed table reads plus a single in-memory pass, never a
per-student query loop.

"Pass rate" is defined relative to the school's own configured grade
bands (a subject entry "passes" if its band is anything other than the
lowest-scoring active band for that level) — never a hard-coded numeric
cutoff, consistent with how the report cards themselves look up grade
bands. Visualizations (student distribution by level/gender, grade-band
distribution, performance trend across terms) are dependency-free SVG/
CSS components (`MiniBarChart`, `MiniDonut`, new `MiniLineChart`) — no
charting library was added to the Phase 0 tech stack, matching how the
existing Dashboard already worked.

Promotion statistics and academic-year comparison live under Archives
("Compare academic years") rather than the main Dashboard, since
promotion decisions are naturally year-end/year-scoped rather than
within-term.

## Global Search (Module 5)

`GlobalSearchService` searches Students, Classes, Academic Years, Terms,
Subjects, Skills, Remarks, Assessments and Reports directly against
Dexie (no separate search-index table — a few thousand rows scanned in
memory is fast enough client-side, and a persisted index would just be
another place for data to go stale). Results are capped per category,
grouped, and reachable from every page via a debounced (200ms) search
box in the shared Topbar.

## System Logs & Audit (Module 6)

`SystemLogService.getUnifiedFeed()` merges every append-only log table
ACTRS keeps — the new general-purpose `systemLogs` table (backup,
restore, import, export, archive actions) plus the existing Phase 3
`auditLogs` (assessment actions) and Phase 4 `printLogs`/`exportLogs`
(report actions) — into one chronological, filterable feed (by date,
module, action text, performer), rather than duplicating those actions
into a second table where the two logs could disagree about what
happened.

**Scope note:** broad "every field edit anywhere" configuration-change
logging (e.g. instrumenting every Settings CRUD call individually) was
deliberately not added in this pass — it would have touched roughly a
dozen already-complete configuration pages/services for comparatively
low additional value, a larger blast radius than this phase's brief
("do not redesign completed modules") supports. Backup, restore, import,
export and archive actions — the activities the brief calls out
explicitly — are fully covered.

## Application Diagnostics (Module 7)

`DiagnosticsService` reports database version, IndexedDB support,
storage usage/quota (`navigator.storage.estimate()`), persisted-storage
grant, service worker status, installed cache names, last backup date,
record counts, and browser/screen info, plus specific troubleshooting
guidance generated from those findings (e.g. "no backup has ever been
created", "storage usage is above 85% of quota"). A "Run Diagnostics"
action optionally saves a short history row; a "Clear cache & reload"
action clears Cache Storage and unregisters the service worker without
touching any IndexedDB data.

## Performance Optimization (Module 8)

Two previously-sequential query patterns were parallelized:
`AnalyticsService.getClassAverages` (one roster fetch per class) and
`compareAcademicYears` (one score fetch per term) now use `Promise.all`
instead of a `for` loop of awaits — both scale with the number of
classes/terms a larger school (20+ academic years, many classes) would
have. Best-effort local timing capture (`performanceMetrics` table) was
added to global search, batch report generation and PDF generation, and
is surfaced on the Diagnostics page.

**Honesty about sandbox limits:** this sandbox has no real browser and
no npm registry access, so no live benchmark against an actual
5,000-student dataset could be run here (the same constraint documented
in every previous phase). The optimizations above are justified by code
review (removing real sequential-await patterns), not by a fabricated
benchmark number. Recommended next step: seed a realistic dataset and
profile in a real browser before full rollout — the Diagnostics page's
performance-samples table exists precisely to make that easy to observe
in the field.

## PWA Completion (Module 9)

The manifest, service worker registration and offline asset caching
(Workbox `generateSW`, `registerType: "autoUpdate"`) already existed
from the Phase 0 foundation. This phase added the missing user-visible
half of "update detection" — an `UpdatePrompt` banner (via
`virtual:pwa-register/react`) offering "Reload now" when a new version
has finished downloading in the background, and an "installed for
offline use" confirmation on first successful install — plus a "Clear
cache & reload" cache-management action on the Diagnostics page.

## Help Centre & About (Module 10)

`Help.tsx` was rewritten from the Phase 0 placeholder into a real user
manual (Getting Started, System Configuration, Student Registration,
Assessment Entry, Report Generation, Backup & Restore, FAQ,
Troubleshooting), linking to the actual routes in this build rather than
generic text. `About.tsx` already displayed version/phase/developer
information dynamically from `useAppInfo()` and needed no structural
change, only the version bump that ships with this phase.

## Testing performed

- Import-resolution check across all 190+ source files (custom Python
  checker resolving every `@alias` path and relative import).
- Full-project unused-import/local sweep (the project's `tsconfig`
  enables `noUnusedLocals`/`noUnusedParameters`).
- Manual code review of every new service for the specific integrity
  guarantees claimed above (archive write-locking, restore transaction
  atomicity, id-preserving bulk restore, pass-rate definition).
- Live-browser verification (actual restore under real IndexedDB quota
  behaviour, the service-worker update flow end-to-end, timing against
  a 5,000+ student dataset) — could not be run in this sandbox (no npm
  registry access, no real browser); documented here as the first step
  after `npm install` in a real environment, consistent with every
  previous phase's testing section.

## Out of scope (per the brief)

- User authentication / access control (explicitly out of scope).
- Cloud sync or any hosted backend (ACTRS remains 100% local/offline).
- School-wide analytics beyond one installation (multi-school reporting
  would need the optional Phase 6 hosted-backend path noted in
  `docs/ROADMAP.md`).

## Production QA & Release Pass

Performed as a dedicated final pass after all ten Phase 5 modules were
built, per the user's explicit request to review the whole system before
calling it done — not just this phase's own new code. Findings:

- **Navigation/routing completeness** — cross-checked every entry in
  `NAV_ITEMS` against `App.tsx`'s route table. As of this phase every
  nav item (including the five new Phase 5 ones) resolves to a real
  page; none fall through to `<PlaceholderPage>` any more. That fallback
  mechanism itself was deliberately left in place (not deleted) since
  it is exactly what would pick up a genuinely new future module.
- **Stale documentation found and fixed** — `App.tsx`'s routing comment
  still said "Archives and Backup & Restore remain placeholders - out
  of scope per Phase 4"; corrected to reflect that Phase 5 built them.
- **UI consistency gap found and fixed** — the five new Phase 5 pages
  (Archives, Backup & Restore, Import & Export Centre, System Logs,
  Diagnostics) were missing the `<Breadcrumb>` every other functional
  module page (Settings, Students, Terms, Assessments, Report Cards,
  ...) uses; added for consistency.
- **Regression check on guarded existing services** — re-read
  `PromotionService.promote()` to confirm the new archived-term guard
  added to `EnrollmentService.assignClass()` only blocks promoting a
  student *into* an already-archived destination term (the correct,
  intended behaviour), not the normal promotion path. Confirmed
  `ClassReportManager`/`ReportPreview` render the new `TERM_ARCHIVED`
  validation issue through the same generic `issues.map(i => i.message)`
  handling every other validation issue already uses, with no special-
  casing required and no crash risk.
- **Confirmed no leftover partial edits** — an earlier attempt to add
  blanket create/update/remove logging to `BaseRepository` (which would
  have touched ~19 services) was abandoned mid-way as too broad a change
  for this pass's stated goal of not redesigning completed modules;
  verified the file is back to its original, unmodified state.
- **Calculation/report fidelity re-verified** — re-ran both executable
  proofs from earlier phases after every Phase 5 change:
  `scripts/verify_jhs_bug_fix.mjs` (JHS Social Studies/Science position
  independence) and `scripts/verify_kg_no_calculations.py` (KG template
  contains no scored-level concepts). Both still pass with no changes
  required, confirming Phase 5 did not disturb Phase 3/4's grading logic.
- **Full-project static verification** — the import-resolution and
  unused-import/local sweeps were re-run after every batch of changes
  throughout this phase (not just at the end), catching one genuinely
  unused import (`GuardianService` in `StudentService.ts`, dead since an
  earlier phase) which was removed as a verified defect.
- **Version bump** — `1.0.0`, reflecting that all five planned phases
  are now complete and the system is being called production-ready.

## Acceptance criteria checklist

See `docs/ROADMAP.md` → "Acceptance criteria checklist (Phase 5)" for
the full, checkbox-by-checkbox list.
