# ACTRS Roadmap

## Phase 0 — Project Foundation & Software Architecture (this delivery)

**Delivered:**
- Project initialization (Vite + React + TypeScript, hand-authored — see
  the note in `README.md` about the sandbox's lack of npm registry access).
- Full folder structure with clearly separated concerns (components, pages,
  layouts, services, database, models, utils, validation, reporting,
  backups, styles, config, hooks, contexts, assets).
- Software architecture documented (`docs/ARCHITECTURE.md`), centred on the
  configuration-over-code principle requested for long-term maintainability.
- UI design system (`docs/UI_DESIGN_SYSTEM.md`): Professional Blue/White/
  Navy/Light Grey theme, reusable `Card`/`PageHeader`/`EmptyState`/`Brand`/
  `DeveloperCredit` components.
- Navigation framework (`docs/NAVIGATION.md`): permanent sidebar/topbar
  shell, all 13 planned menu items wired up (functional ones show a
  consistent placeholder until their phase).
- Database design finalised (`docs/DATABASE.md`): versioned Dexie/IndexedDB
  schema covering School, Academic Year, Term, Level, Class, Student,
  Subject, Learning Area, Skill, Assessment Records (both scored and
  skill-checklist), Remarks Bank, Reports, Settings, Backup History — plus
  a default configuration seed built directly from the three existing
  Amenfi Central workbooks and the official NaCCA KG2 report form.
- PWA foundation (`docs/PWA.md`): manifest, icons, offline service worker
  configuration.
- Development standards (`docs/CODING_STANDARDS.md`).
- Developer credit (Emmanuel Serry, ICT Coordinator, Wassa Amenfi Central
  Education Directorate) wired into Login, Dashboard, About and Help via a
  single `DeveloperCredit` component.

**Explicitly not delivered (by design):** student registration, assessment
entry, report generation, backup/restore logic, or any other functional
module — Phase 0's acceptance criteria require the foundation only.

## Phase 1 — System Configuration & Administration ✅ DELIVERED

All 11 configuration modules from the Phase 1 brief are implemented:
School Configuration, Academic Year Management, Term Management, Level
Management, Class Management, Subject Management, KG Learning Area
Management, KG Skill Management, Grade Band Configuration, Remarks Bank,
and System Settings - plus an updated Dashboard with live summary cards.
See `docs/PHASE1_CONFIGURATION.md` for the full write-up, routing
decisions, database migration (v1 → v2) and business rules enforced.

Student registration remains out of scope, as specified — the `Student`
model/table exist (from Phase 0) but no Students UI was built this phase.

## Phase 2 — Student Management ✅ DELIVERED

Complete Student Information System: registration, profile, class
enrollment, promotion history, search, advanced filtering, bulk
import/export, photo management and permanent Student ID generation. See
`docs/PHASE2_STUDENTS.md` for the full write-up, including the
owner-recommended Student/Enrollment split that keeps identity and
per-term placement as separate, historically-accurate entities.

## Phase 3 — Assessment Management ✅ DELIVERED

Assessment mode (scored vs. skill-checklist) is fully auto-detected from
each class's Level - teachers never choose it manually. Delivered: the
pure calculation/ranking engine (Total, competition ranking, grade-band
lookup - verified against the brief's own `[95,95,91,90] → [1,1,3,4]`
example); an Excel-like score-entry grid for Primary/JHS (keyboard nav,
paste, undo/redo, auto-save, live validation); a Gold/Silver/Bronze/X/O
skill-rating grid for KG1/KG2 with strictly no scores/totals/rankings;
Remarks-Bank-driven Teacher Remarks for scored levels and free-text
remarks for KG; a Draft → Completed → Verified → Finalized lifecycle with
a completion-based finalization gate and reopen-with-reason; a full audit
trail for every score/rating/remarks/status change; and assessment
progress analytics on both the Assessment Dashboard and the main
Dashboard. See `docs/PHASE3_ASSESSMENTS.md` for the full write-up,
including two latent Phase 2 defects found and fixed while integrating.

## Phase 4 — Report Card Generation & Printing ✅ DELIVERED

The correct report layout is auto-selected per Level (KG, Lower Primary,
Upper Primary or JHS - never a manual choice), rendered from a single
frozen `ReportSnapshot` shared identically by the on-screen Preview, PDF
export and native print. Delivered: a template-engine registry so a
future layout is one new component + one registry line + one data row;
Lower/Upper Primary and JHS report cards matching the existing GES
format (subject table, attendance, remarks, promotion, signatures); the
official NaCCA KG Learner Report (legend, five learning areas, skill
ratings, comments - strictly no scores/totals/rankings); an interactive
Preview (zoom, next/previous, download, print); single and batch PDF
generation (jsPDF + html2canvas, combined or per-student per a Module 12
setting) and native printing that visually matches Preview exactly;
Report Validation blocking generation until every prerequisite is met;
a versioned Report History with print/export counts; and report
generation/print/export analytics on both the Report Dashboard and the
main Dashboard. The known JHS defect (the Social Studies row reading the
Science position field) is fixed and verified with an executable proof
(`scripts/verify_jhs_bug_fix.mjs`). See `docs/PHASE4_REPORTS.md` for the
full write-up.

## Phase 5 — Records Management, Archives, Backup, Analytics & Production Readiness ✅ DELIVERED

The final functional development phase - ACTRS's remaining enterprise
modules, making it production-ready for real deployment. Delivered:
Academic Records & Archives (permanently closing a term locks its scores/
remarks/class-assignments at the service layer, with no data duplicated
into a second table - see `docs/PHASE5_PRODUCTION.md` for why); a
Backup & Restore engine (full/partial, JSON/Excel/CSV, all-or-nothing
restore relying on IndexedDB's own transaction atomicity for rollback);
an Import & Export Centre centralizing Students/Subjects/Learning Areas/
Skills/Remarks Bank import and Students/Assessment-Sheet/Reports/
Statistics/Configuration/Archives export; a Dashboard & Analytics module
(subject/class averages, grade-band distribution, pass rate, attendance,
promotion statistics, academic-year comparison, dependency-free SVG
charts); system-wide Global Search grouped by category; a unified
System Logs & Audit viewer merging every append-only log table; an
Application Diagnostics page (storage, service worker, cache, browser
compatibility, troubleshooting guidance, cache-clearing); a performance
pass (parallelized analytics queries, best-effort local timing capture);
PWA completion (update-detection banner, cache management); and a real
Help Centre plus an accurate About page. See `docs/PHASE5_PRODUCTION.md`
for the full write-up, including the Production QA & Release Pass
performed at the end of this phase.

## Phase 6 (optional, later) — Shared / Multi-Device Access

If the circuit wants shared multi-teacher or multi-school access, a small
hosted backend (Postgres + REST API, or a backend-as-a-service) can be added
*without* changing the calculation engine, report templates or UI — only
where data is stored changes, per the "no rebuild" design goal in
`docs/ARCHITECTURE.md`.

## Open questions carried forward

- Only the KG2 skill list/form was supplied; KG1 is seeded as a structural
  copy pending the official KG1 form.
- Should "Promoted To" / "Progression" ever be auto-suggested, or remain a
  fully manual teacher decision (current default)?
- Are the Primary/JHS grade-band thresholds (80/68/54/40) fixed GES policy,
  or editable per school (currently modelled as editable, per Level)?
- Local sign-in (Phase 1+) is assumed to be a lightweight staff-name + PIN
  device gate, not backend authentication — confirm this matches
  expectations before Phase 1 implements it.

## Acceptance criteria checklist (Phase 0)

- [x] Project structure is production-ready
- [x] Architecture is fully documented
- [x] UI design system is established
- [x] Database design is finalised
- [x] Navigation framework is in place
- [x] PWA foundation is configured
- [x] Codebase is ready for Phase 1 without requiring structural changes

## Acceptance criteria checklist (Phase 1)

- [x] All 11 configuration modules are fully functional (CRUD, search,
      sort, pagination, validation, duplicate prevention, confirm-before-
      delete, toasts)
- [x] Data model updated to persist correctly in IndexedDB (Dexie v2)
- [x] Relationships and validations enforced (single active year/term,
      referential-integrity guards on delete)
- [x] Default educational structures available without manual coding
      (seed.ts: 11 levels, 14 subjects, 5 KG learning areas with skills,
      5 grade bands, starter remarks bank, default system settings)
- [x] Administration module ready to support Phase 2 (Student Management)
- [ ] Live-browser verification (CRUD/persistence/offline) — could not be
      run in this sandbox (no npm registry access); documented as the
      first step to run after `npm install` on a real machine, see
      `docs/PHASE1_CONFIGURATION.md` "Testing performed"

## Acceptance criteria checklist (Phase 2)

- [x] Student registration fully operational (identity + guardian +
      initial enrollment created together, in one transaction)
- [x] Permanent Student IDs generated and preserved (global monotonic
      counter, configurable prefix, never reused)
- [x] Enrollment and promotion history accurately maintained (append-only
      PromotionHistory; Enrollment upsert only within the same term)
- [x] Search, filtering, import and export implemented and combinable
- [x] Data model persists correctly in IndexedDB (Dexie v3 + migration)
- [x] Responsive, offline-capable, integrates with Phases 0-1 unchanged
- [x] Ready for Phase 3 assessment entry (Students/Enrollments/Subjects/
      LearningAreas/Skills/GradeBands all in place)
- [ ] Live-browser verification (registration/import/export/offline) —
      could not be run in this sandbox (no npm registry access);
      documented as the first step after `npm install`, see
      `docs/PHASE2_STUDENTS.md` "Testing performed"

## Acceptance criteria checklist (Phase 3)

- [x] Assessment mode fully auto-detected from Level config, no manual
      selector anywhere
- [x] Scored-level Total/Grade-Band/Position/Overall calculations match
      the brief's documented Excel workflow (manually verified)
- [x] KG assessment strictly Gold/Silver/Bronze/X/O + comments, no
      totals/averages/grades/rankings
- [x] Excel-like score entry (keyboard nav, paste, undo/redo, auto-save,
      live validation)
- [x] Draft → Completed → Verified → Finalized lifecycle, gated on
      completion, reopenable with a logged reason
- [x] Full audit trail for every score/rating/remarks/status change
- [x] Teacher Remarks: Remarks-Bank-driven (scored) / free-text (KG)
- [x] Dashboard reflects live assessment progress, including KG
      completion
- [x] Two latent Phase 2 defects found and fixed while integrating
      (stale `Student.currentClassId` references in `LevelService` and
      `ClassService`)
- [ ] Live-browser verification (grid interaction, IndexedDB persistence,
      offline reload) — could not be run in this sandbox (no npm registry
      access); documented as the first step after `npm install`, see
      `docs/PHASE3_ASSESSMENTS.md` "Testing performed"

## Acceptance criteria checklist (Phase 4)

- [x] Correct report template auto-selected per Level, never a manual
      choice
- [x] Lower Primary/Upper Primary/JHS layouts match the existing GES
      format
- [x] KG layout follows the official NaCCA Learner Report Form with no
      scores/totals/rankings anywhere
- [x] JHS Social Studies/Science bug fixed and verified executably
- [x] Individual and batch PDF generation, native printing matching
      Preview exactly
- [x] Report Validation blocks incomplete/inaccurate report generation
- [x] Report History retains every version, reprintable without
      recalculating unless the assessment is reopened
- [x] Dashboards reflect live report generation/print/export activity
- [ ] Live-browser verification (PDF rendering fidelity, print dialog
      output, IndexedDB persistence) — could not be run in this sandbox
      (no npm registry access); documented as the first step after
      `npm install`, see `docs/PHASE4_REPORTS.md` "Testing performed"

## Acceptance criteria checklist (Phase 5)

- [x] Historical academic records permanently preserved (archived terms
      locked at the service layer; no data duplicated into a second table)
- [x] Backup & Restore work reliably with preview, conflict detection and
      all-or-nothing restore (native IndexedDB transaction rollback)
- [x] Import and Export functions are robust and user-friendly (per-row
      validation, downloadable templates, detailed error reporting)
- [x] Dashboard analytics accurately reflect school data (subject/class
      averages, grade-band distribution, pass rate, attendance, using the
      school's own configured grade bands - never a hard-coded cutoff)
- [x] System-wide search is fast and comprehensive, grouped by category
- [x] Audit logs capture backup/restore/import/export/archive actions,
      unified with the existing assessment audit trail and report print/
      export logs into one filterable feed
- [x] Diagnostics provide meaningful health information and
      troubleshooting guidance
- [x] Performance pass: parallelized previously-sequential analytics
      queries; best-effort local timing capture for search/batch
      generation/PDF export
- [x] PWA fully functional offline, with update detection and cache
      management added
- [x] Production QA & Release Pass performed - see
      `docs/PHASE5_PRODUCTION.md` "Production QA & Release Pass"
- [ ] Live-browser verification (restore under real IndexedDB quota
      behaviour, service worker update flow, 5,000+ student dataset
      timing) — could not be run in this sandbox (no npm registry
      access); documented as the first step after `npm install`, see
      `docs/PHASE5_PRODUCTION.md` "Testing performed"

## Phase 6 — Production Quality Assurance, System Integration & Optimization ✅ DELIVERED

Introduced no new business features by design. A line-by-line
independent re-verification of every workflow, calculation, report,
database operation, UI screen and generated output built in Phases 0-5,
against the original project requirements rather than assuming any of
it correct because an earlier phase built it — see
`docs/PHASE6_QA_REVIEW.md` for the full module-by-module findings,
performance report, testing report and production readiness assessment.

- [x] Architecture review — 10 dead-code removals, including one
      constant that silently contradicted the real calculation engine
- [x] Database integrity review — fixed a defect allowing an archived
      term to be deleted outright
- [x] Business logic validation — fixed an unfiltered term dropdown that
      could desynchronize a promotion's academic year
- [x] GES & NaCCA compliance re-verification — JHS ranking independence
      and KG qualitative-only rule both re-confirmed structurally correct
- [x] Report template review — full checklist re-verified, one dead CSS
      class removed
- [x] UI consistency review — wired two permanently-stale placeholder
      tabs on the Student Profile page to real data; fixed accessibility
      gaps (Escape-to-close, ARIA semantics) in the shared Modal used by
      ~16 dialogs app-wide
- [x] Performance optimization — indexed a full-table-scan lookup;
      code-split all 26 routes via `React.lazy`; added a PWA precache
      safety margin
- [x] Offline & PWA re-validation — fixed offline navigation to
      never-before-visited routes; fixed a connectivity badge that always
      said "Offline" regardless of actual connection
- [x] Security & data integrity review — added photo-upload validation;
      fixed a spreadsheet formula-injection gap across every xlsx/csv
      export; locked audit/system logs against tampering
- [x] Import/Export/Backup validation — found and fixed a Full Backup
      completeness gap (5 tables were never included); added a missing
      within-file EMIS duplicate check
- [x] End-to-end workflow scenario testing — both required scenarios
      (full scored-level lifecycle, KG lifecycle) implemented as
      executable proof scripts, all assertions pass
- [x] Code quality review & cleanup — corrected a second misleading doc
      comment; confirmed no stray debug statements or dead exports remain
- [x] Defect correction — every finding above fixed inline, without
      modifying `BaseRepository.ts`
- [x] Final regression testing — all 4 executable proof scripts pass;
      whole-codebase import/unused-import/unused-export sweeps clean

## Acceptance criteria checklist (Phase 6)

- [x] No new business modules or features introduced
- [x] Every module independently re-verified against source, not assumed
      correct from an earlier phase
- [x] All critical/high-severity findings resolved (archived-term
      deletion, Full Backup completeness gap, offline navigation failure,
      audit-log tamperability)
- [x] Executable regression proofs cover the calculation engine, the KG
      qualitative-only guarantee, and both required end-to-end lifecycle
      scenarios — all pass
- [x] `BaseRepository.ts` left unmodified throughout, per the project's
      standing constraint
- [ ] Live-browser verification (real PDF rendering, print dialog output,
      IndexedDB quota behaviour, service-worker update flow, real
      bundle-size measurement) — could not be run in this sandbox (no
      npm registry access); documented as the first step after
      `npm install`, see `docs/PHASE6_QA_REVIEW.md` "Testing performed"
