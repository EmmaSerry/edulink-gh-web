# Phase 6 — Production Quality Assurance, System Integration & Optimization

Phase 6 introduces **no new business features**. Its entire purpose is
the line-by-line engineering review the project brief called for before
authorizing Phase 7 (Production Release & Deployment): independently
re-verifying every workflow, calculation, report, database operation,
UI screen and generated output against the original project
requirements, rather than assuming any of it is correct simply because
an earlier phase built it — and fixing whatever that review finds.

This document is the required Phase 6 deliverable: a summary of every
finding, the fix applied (or the reasoning for leaving something as-is),
the performance work, the testing performed, and a final production
readiness assessment.

## Methodology

Every one of the brief's 14 modules was reviewed in the same disciplined
order: read the actual current source code directly (never trust an
earlier phase's doc comment as ground truth), cross-check suspected
issues with targeted greps/searches before acting, apply a fix only once
a defect is independently confirmed and the fix is minimal and
behaviour-preserving, and log every finding — including "investigated,
not a defect" ones — so nothing is silently skipped.

This sandbox has no real browser and no installed `node_modules` (the
npm registry is unreachable), so anywhere the brief calls for executable
verification, the existing pattern from earlier phases was extended:
hand-transcribed, faithful reproductions of the actual algorithm/guard
being tested, run as plain Node/Python scripts and checked into
`scripts/` so they can be re-run in any future phase. Four such scripts
exist after this phase (two pre-existing, two new — see "Testing
performed" below).

One standing constraint carried over from earlier in this project was
respected throughout: `BaseRepository.ts` was never modified. Where a
fix needed to restrict behaviour that class provides (see the audit/
system log finding below), it was done with a narrow override in the
one specific subclass that needed it, not by changing the shared base.

## Findings & fixes, by module

### Module 1 — Architecture Review

Ten items of confirmed-dead code were removed: the entire `AppContext`/
`AppProvider` (zero consumers anywhere), the whole `src/backups/`
placeholder folder left over from Phase 0 (superseded by the real
`BackupService.ts`), `useAssessmentCompletion.ts`, `validation/
guardianSchema.ts`, dead exports from `validation/common.ts`, and
`utils/constants.ts` in its entirety — the last one particularly
important, since its `MAX_SUBJECT_SCORE = 50` silently **contradicted**
`AssessmentCalculationEngine`'s own real, actually-used
`MAX_SUBJECT_SCORE = 100`, a landmine that could have misled a future
maintainer into "fixing" the wrong one. A component was renamed
(`StatusBadgeStudent.tsx` → `StudentStatusBadge.tsx`) to match its own
export, and five duplicate implementations of "download a Blob as a
file" (across `BackupService`, `CenterExportService`, `ExportService`,
`PdfService`, `ConfigImportExportService`) were consolidated into one
shared `src/utils/downloadBlob.ts`.

### Module 2 — Database Integrity Review

**High severity, fixed:** `TermService.remove()` only checked
scores/skill-ratings/report-records before allowing a hard delete — it
never checked enrollments, assessment sessions, generated reports, or
(critically) whether the term had already been **archived**. A user
could previously delete an archived term outright, directly violating
the "historical records can never be corrupted" guarantee the entire
Phase 5 Archives module exists to provide. Fixed: `remove()` now checks
all six tables that reference a term, with a distinct, explicit error
when the term is archived. Every other config entity's `remove()`
(academic year, class, level, learning area, skill, subject) was
verified to already have correct, complete guards.

### Module 3 — Business Logic Workflow Validation

**Medium severity, fixed:** `PromotionModal.tsx`'s "Starting term"
dropdown listed every term in the system regardless of the separately
selected academic year — the only place in the app where two
independent fields both determine a year with no cross-validation. A
user could pick a year and a term belonging to a *different* year,
leaving the resulting `PromotionHistoryEntry.academicYearId` and the
actual `Enrollment.academicYearId` silently inconsistent. Fixed by
filtering the term dropdown to the selected year and resetting a
now-invalid term selection automatically. The full registration →
enrollment → promotion → assessment → report → archive → backup →
restore chain was traced end to end; no further inconsistencies found.

### Module 4 — GES & NaCCA Compliance Re-verification

Independently re-read (not just re-ran the existing proof for) the
actual `ReportDataService.ts` code path that builds scored-level report
data: confirmed the per-subject ranking map is keyed and computed
independently per `subjectId` by construction, so the historical "JHS
Social Studies reads Science's position" bug class is structurally
impossible, not just accidentally avoided. Confirmed the KG report's
`attendancePercentage` field is the one deliberate, documented exception
to "no percentages in KG" (attendance is not an assessment concept), and
that `KGReportTemplate.tsx` renders it as "X / Y days", never as a
percentage figure. `computeSubjectTotal`, `findGradeBand` and
`computeCompetitionRanking` were all re-verified against the documented
Excel workflow — all correct, unchanged.

### Module 5 — Report Template Review

Every report-template file (`ScoredReportLayout`, `KGReportTemplate`,
`ReportHeader`, `SignatureBlock`, `ReportPage`, all three scored-level
wrappers) was reviewed line-by-line against the full checklist
(branding, student info, attendance, subject order, calculations, grade
bands, remarks, signatures, vacation/reopening dates, promotion
information, layout/typography/print quality) — everything present and
correctly wired, no gaps. One small dead CSS class
(`.actrs-report-page-shadow-only-screen`, zero references anywhere) was
removed from `report-print.css`.

### Module 6 — UI Consistency Review

**Fixed, medium/high severity:** `StudentProfile.tsx`'s "Assessment
History" and "Report Card History" tabs were still showing their
original Phase-0 placeholder text ("will appear here starting Phase 3/
4") on one of the most-visited screens in the app, despite the real
score, skill-rating and generated-report data having existed since
Phase 3/4. This wasn't stale text — it actively hid real historical data
from users. Both tabs are now wired to live Dexie queries, with a "View"
link straight into the frozen Report Preview for each generated version.

**Fixed, systemic:** the shared `Modal.tsx` component — which backs
roughly 16 Add/Edit dialogs across the whole app — had no Escape-to-
close handling and no dialog accessibility semantics (`role`,
`aria-modal`, `aria-labelledby`, initial focus). Fixed once in the
shared component; every existing caller benefits immediately with no
per-page changes.

Confirmed no raw hex colours leak into app UI code outside the three
places that legitimately need them (`theme.css`, `report-print.css`,
the fixed NaCCA medal-colour legend). Confirmed the toast system is
consistently accessible everywhere. One minor, low-severity item
(a handful of pages flashing an empty state for a few milliseconds
before their first Dexie query resolves) was reviewed and deliberately
left as-is — imperceptible on a local IndexedDB-backed app, and not
worth touching a dozen files for.

### Module 7 — Performance Optimization

**Fixed:** `ClassService.remove()` did a full-table scan
(`db.enrollments.filter(...)`) on every class-deletion attempt even
though `classId` is an indexed field — changed to an indexed `.where()`
lookup.

**Fixed, significant:** every page in `App.tsx` was a static top-level
import, meaning first paint had to load the entire app in one bundle,
including jsPDF, html2canvas and SheetJS/xlsx — three sizeable libraries
only ever needed once a report/export/backup screen is opened.
Converted all 26 routes to `React.lazy` behind one shared `<Suspense>`
boundary, so Vite now code-splits each page into its own chunk fetched
on first visit. Every lazy-wrapped export was individually verified to
exist and match exactly before finalizing.

**Fixed, defensive:** Workbox's default 2MB-per-file precache limit was
never overridden; if a chunk (the report/export tooling bundle
especially) ever exceeded it, it would be silently skipped from
precache with no build error, and that page would simply fail to open
offline. Set explicitly to 5MB, comfortably above any realistic chunk
size.

`ReportDataService`'s batch report/PDF generation path (the one place
per-class iteration over every enrolled student was a real N+1 risk) was
audited and confirmed already efficient — no change needed.

This sandbox has no installed `node_modules` and cannot run a real
`vite build`, so actual bundle-size/chunk-size measurements were not
possible here; the 5MB precache margin was set defensively for exactly
this reason, and real bundle sizes should be checked as the first step
after `npm install` in a real environment (see "Testing performed").

### Module 8 — Offline & PWA Re-validation

**Fixed, high severity:** the PWA's Workbox config had no
`navigateFallback`. The only navigation rule cached each visited URL
individually — which only ever helps a URL already visited once while
online. Since ACTRS is a fully client-routed SPA with no server, a
fresh navigation to any not-yet-visited route while offline (a student
deep link, or simply reopening the installed app) would fail outright,
contradicting the app's own offline-first premise for exactly the
scenario most likely in real school use. Replaced with Workbox's
purpose-built `navigateFallback: "/index.html"`, which serves the
already-precached shell for any navigation and lets client-side routing
take over — genuinely offline-safe for every route, visited or not.

**Fixed, user-facing:** `Topbar.tsx`'s connectivity badge was a
hardcoded `<span>Offline</span>` with no state behind it at all — it
said "Offline" unconditionally regardless of the device's actual
connection. Added a small `navigator.onLine`-backed hook so the badge
now reflects reality.

`UpdatePrompt.tsx`, the manifest icon references, and `DiagnosticsService`'s
dynamic cache-name enumeration were all confirmed correct.

### Module 9 — Security & Data Integrity Review

**Fixed:** `PhotoService.upload()` accepted any `File` with zero
validation (the `accept="image/*"` picker hint is not an enforced
restriction). Added an explicit MIME-type check and a 15MB size cap,
both with clear user-facing messages — and fixed `StudentProfile.tsx`'s
photo-upload error handler, which was the one place in the app that
discarded the real error message instead of following the
`err instanceof Error ? err.message : ...` convention used everywhere
else.

**Fixed, significant:** every xlsx/csv export (`ExportService`,
`CenterExportService`, `BackupService`'s xlsx/csv branch) passed
free-text field values straight into `XLSX.utils.json_to_sheet` with no
sanitization — a value starting with `=`, `+`, `-` or `@` can be
auto-evaluated as a formula by Excel when the file is later opened, a
real risk given Ghanaian phone numbers are commonly written with a
leading `+`. Added a shared, OWASP-standard sanitization utility
(`src/utils/spreadsheetSafety.ts`) and wired it into all three export
call sites. Confirmed this cannot affect Restore fidelity, since Restore
only ever reads the JSON backup format.

**Fixed, significant:** `AuditLogService` and `SystemLogService` both
inherit `BaseRepository`'s public `update()`/`remove()` with no
restriction, meaning anything holding a reference to either service
could silently tamper with or delete audit/log history. Fixed by
overriding both methods in each of those two subclasses only (throwing
a new immutability error) — `BaseRepository.ts` itself was not touched,
and `create()`/`record()` are unaffected. Confirmed no existing code
anywhere called the now-blocked methods, so nothing broke.

Confirmed zero uses of `dangerouslySetInnerHTML` anywhere in the
codebase.

### Module 10 — Import/Export/Backup Validation

**Fixed, significant:** cross-referenced every one of the 34 Dexie
tables against `BackupService`'s module list programmatically. Found
that `systemLogs`, `exportHistory`, `importLogs`, `diagnosticsSnapshots`
and `performanceMetrics` were never assigned to any backup module —
even a "Full Backup" silently never captured them. `docs/
PHASE5_PRODUCTION.md` had stated this was deliberate, reasoning that
restoring installation-specific log data onto another installation
would misrepresent its history; on independent re-verification (as this
phase's brief specifically requires) that reasoning did not hold up —
it was applied inconsistently (`auditLogs` is exactly the same kind of
data and was never excluded), and the realistic use of Restore is
disaster recovery onto the *same* installation, where an administrator
wants their real history back. Added a new `systemData` backup module
covering all five tables; `backupHistory` alone remains excluded, for
the narrower, still-valid reason that it is the catalogue of backups
*of* this database (a genuinely self-referential case the other five
are not). Both `docs/PHASE5_PRODUCTION.md` and the source comment were
updated to record this reversal and the reasoning behind it.

Confirmed `BackupService.restore()` is properly transactional (clear
then bulk-re-add, one Dexie read-write transaction, atomic rollback on
failure) — no defect.

**Fixed, minor:** `ImportService.validateRows()` checked admission
numbers for duplicates both within the uploaded file and against
existing students, but the equivalent EMIS-number check only looked
against existing students — two rows sharing an EMIS number within the
same file went undetected. Added the matching within-file check.

### Module 11 — End-to-End Workflow Scenario Testing

See "Testing performed" below — both scenarios required by the brief
(full scored-level lifecycle, KG lifecycle) were implemented as
executable proof scripts and both pass in full.

### Module 12 — Code Quality Review & Cleanup

A final whole-codebase unused-export sweep found 9 candidates, each
individually verified: five are custom error classes correctly exported
for `instanceof` handling (matching the established convention), one
(`getTemplateComponent`) is used internally and just doesn't need
exporting, one (`sanitizeCellValue`) is a unit-testable helper used
internally, one (`ActrsDatabase`) is a reasonable conventional export of
a central class, and one (`INACTIVE_STATUSES`) had a stale doc comment
overclaiming behaviour that doesn't actually exist in the app (the
Students page shows every status via an explicit filter, not a hidden
default) — the comment was corrected rather than the constant removed,
since it remains useful as the single authoritative list for any future
feature that needs it. Zero stray `console.log` debug statements and no
genuine `TODO`/`FIXME` markers were found anywhere. All 14 uses of `any`
in the codebase were reviewed and confirmed confined to Dexie migration
callbacks and harmless DOM event casts — none in calculation, grading or
validation logic.

### Module 13 — Defect Correction

Defects were corrected inline, immediately after each was independently
verified, rather than batched separately — see each module above for the
specific fix. No defect required modifying `BaseRepository.ts`.

### Module 14 — Final Regression Testing

See "Testing performed" below.

## Performance optimization report

Three concrete performance changes were made this phase:

1. **Indexed lookup instead of full-table scan** in
   `ClassService.remove()` — a correctness-neutral, pure performance fix
   on a table (`enrollments`) that only grows over a school's lifetime.
2. **Route-level code splitting** (`React.lazy` across all 26 routes in
   `App.tsx`) — first paint no longer needs to load jsPDF, html2canvas
   and SheetJS/xlsx (all three transitively pulled in by report/export/
   backup pages) until one of those pages is actually opened. This is
   the single highest-leverage change of the phase for a PWA whose
   premise is fast, reliable use on modest school hardware/networks.
3. **Precache size safety margin** (`maximumFileSizeToCacheInBytes: 5MB`)
   — prevents Workbox from silently failing to precache a large chunk,
   which would otherwise surface only as "this page won't open offline"
   with no diagnostic trail.

`ReportDataService`'s batch report/PDF generation path (the one place
per-class iteration over every enrolled student was a real N+1 risk) was
audited and confirmed already efficient — no change needed.

This sandbox has no installed `node_modules` and cannot run a real
`vite build`, so actual bundle-size/chunk-size measurements were not
possible here; the 5MB precache margin was set defensively for exactly
this reason, and real bundle sizes should be checked as the first step
after `npm install` in a real environment (see "Testing performed").

## Testing performed

Four executable proof scripts live in `scripts/`, runnable with `node`/
`python3` and no other dependencies:

| Script | Coverage | Result |
|---|---|---|
| `verify_jhs_bug_fix.mjs` (pre-existing) | JHS Social Studies/Science ranking independence | 5/5 assertions pass |
| `verify_kg_no_calculations.py` (pre-existing) | KG template has zero scored-level concepts | pass |
| `verify_e2e_scored_lifecycle.mjs` (new) | Full scored-level lifecycle: registration → enrollment → score entry → per-subject/overall calculation → archiving → report versioning | 17/17 assertions pass |
| `verify_e2e_kg_lifecycle.mjs` (new) | KG lifecycle: registration → enrollment → skill-rating entry → report snapshot assembly → archiving | 6/6 assertions pass |

Additionally, after every source change this phase: a whole-codebase
import-resolution check (190 files, zero errors), a whole-codebase
unused-import sweep (zero found), a whole-codebase unused-export sweep
(9 candidates, all individually reviewed — see Module 12), and a
brace/paren/bracket balance check across all 19 files touched this
phase (all balanced) were run and re-run.

As with every previous phase, this sandbox has no real browser and no
npm registry access, so live-browser verification (actual PDF rendering,
print dialog output, real IndexedDB quota behaviour, service-worker
update flow under a real network, and real bundle-size measurement)
could not be performed here. This is the same limitation documented in
every prior phase's own testing notes and should be the first manual
step after `npm install` in a real environment, alongside a full
click-through of the new/changed screens (Student Profile's two newly
wired tabs, the Modal accessibility behaviour, the Topbar connectivity
badge, and an offline reload of a never-before-visited route).

## Database schema

No Dexie schema version bump was required. Every fix this phase was a
logic/behaviour correction — service methods, UI wiring, build/PWA
configuration — not a data-model change. The database remains at **v6**
(introduced in Phase 5).

## Production Readiness Assessment

Phase 6's explicit goal was to independently verify Phase 0-5's work
rather than accept it on faith, and to fix whatever that verification
found. It found and fixed two genuinely significant defects that a
routine feature-only review would likely have missed (deleting an
archived term, and a Full Backup silently missing five tables), several
real user-facing gaps (stale placeholder tabs hiding real data, a
connectivity badge that lied, offline navigation failing for unvisited
routes), a real security gap (spreadsheet formula injection) and a real
audit-integrity gap (tamperable logs) — alongside dead-code removal and
a meaningful performance/loading improvement.

Every fix was scoped to the minimum change that resolves the verified
issue, no new business feature was introduced, `BaseRepository.ts` was
left untouched throughout, and all four executable regression proofs
(covering the calculation engine, the KG qualitative-only guarantee, and
both required end-to-end lifecycle scenarios) pass with zero failures
after every change.

**Assessment: ACTRS is ready to proceed to Phase 7 — Production Release
& Deployment**, on the condition that the live-browser verification
steps this sandbox cannot perform (listed under "Testing performed"
above) are carried out once in a real browser/build environment before
the school-facing rollout, exactly as every prior phase's own
documentation has already flagged for its own untestable items.
