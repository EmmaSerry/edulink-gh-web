# ACTRS Master Project Brief

**Amenfi Central Terminal Report System (ACTRS)** — Version 1.0
**Developed by:** Emmanuel Serry, ICT Coordinator, Wassa Amenfi Central
Education Directorate

> **How to use this document:** provide this brief, the current project
> ZIP, and the specific phase/task prompt at the start of every future
> working session (with Claude or any other assistant). It gives full
> project context in one place, so a new session doesn't need to
> rediscover the architecture or re-litigate settled decisions.

## 1. Project vision

ACTRS replaces the Excel workbook + Word Mail Merge process previously
used to produce terminal report cards for **KG1, KG2, Lower Primary,
Upper Primary and JHS** at schools under the Wassa Amenfi Central
Education Directorate. It is a single, cohesive, **offline-first**
education management application — not a collection of disconnected
tools — covering the entire workflow from school configuration through
student registration, assessment entry, report generation/printing, to
long-term records management, backup and analytics.

## 2. Core functional requirements

- School/curriculum configuration (academic years, terms, levels,
  classes, subjects, KG learning areas/skills, grade bands, remarks
  bank) — all editable data, never hard-coded.
- Student management: registration, permanent student IDs, guardians,
  class enrollment, promotion history, photos, bulk import.
- Assessment management: SBA + Exam scoring (scored levels) and
  Gold/Silver/Bronze/Not-Assessed/Absent skill-checklist rating (KG,
  matching the official NaCCA KG Assessment Tool exactly) — never both
  for the same level.
- Report card generation, versioning, printing and PDF export, per
  template family (Lower Primary, Upper Primary, JHS, KG).
- Records management: permanent term archiving (locks, never
  duplicates), backup/restore, import/export, dashboard analytics,
  system-wide search, unified audit/system logs, diagnostics.

## 3. Technology stack

React 18 + TypeScript + Vite, Bootstrap 5, Dexie.js over IndexedDB (no
SQL, no backend, no server of any kind), jsPDF + html2canvas for PDF
generation, SheetJS (`xlsx`) for spreadsheet import/export, Zod for
validation, `vite-plugin-pwa` for the Progressive Web App/service
worker layer. Full rationale: `docs/ARCHITECTURE.md` Section 3.

## 4. Development principles

- **Configuration over code**: curriculum, grading, and report content
  are database records, not source code — a curriculum change is a
  Settings edit, not a redeploy (`docs/ARCHITECTURE.md` Section 1).
- **Components render, services decide, the database stores** — a
  strict layering rule, checked at every phase's own review.
- **Calculations are always derived, never stored** — totals, grades and
  rankings are computed fresh every time from raw data, so they can
  never silently drift out of sync.
- **Archiving locks, it never duplicates** — a closed term's data stays
  in the same live tables, just write-protected, rather than being
  copied into a second, potentially-diverging table.
- **`BaseRepository` stays minimal** — a standing decision against
  adding cross-cutting side effects (e.g. blanket audit-logging) to the
  shared repository base; each entity's own service adds exactly the
  guards it needs.
- **Independent re-verification, every phase** — never assume an
  earlier phase's work is correct just because it shipped; Phase 6/7
  both found and fixed genuine defects this way.

## 5. Non-functional requirements

Fully offline-capable after first install; installable as a PWA;
fast/lightweight on typical school hardware; historically-accurate and
tamper-resistant records; no user data ever leaves the device except via
an explicit backup export; long-term maintainability by a single ICT
coordinator without a development team.

## 6. Coding rules (full detail: `docs/CODING_STANDARDS.md`)

TypeScript strict mode; one entity per model file; services extend
`BaseRepository` and add their own integrity guards; no business logic
in components; Dexie schema versions are additive-only (never edit a
shipped `.version(n)` block); every new table/index must have an actual
query that needs it; custom error classes (not generic `Error`) for
user-facing validation failures, following the `err instanceof Error ?
err.message : "..."` toast convention used everywhere.

## 7. UI/UX standards (full detail: `docs/UI_DESIGN_SYSTEM.md`)

Professional Blue/White/Navy/Light Grey theme via CSS custom properties
over Bootstrap 5; shared components (`Card`, `Modal`, `PageHeader`,
`EmptyState`, `LoadingSpinner`, `DataTable`, `FormField`, `Breadcrumb`,
`StatusBadge`) used consistently everywhere rather than one-off styling;
loading → empty → data pattern on every list/detail screen; toast
notifications for every create/update/delete/validation outcome; dark
mode supported via token overrides only.

## 8. Integration rules

No module integrates with any external service by default — ACTRS has
no network dependency for any core workflow. Any future integration
(EMIS, SMS/email, cloud sync — see `docs/FUTURE_ROADMAP.md`) is
explicitly opt-in, its own dedicated phase, and must not compromise the
"works with zero network connection" guarantee for schools that don't
use it.

## 9. The complete phase roadmap

| Phase | Focus |
|---|---|
| 0 | Project foundation & software architecture |
| 1 | System configuration & administration |
| 2 | Student management |
| 3 | Assessment management |
| 4 | Report card generation & printing |
| 5 | Records management, archives, backup, analytics & production readiness |
| 6 | Production quality assurance, system integration & optimization (no new features — independent re-verification and defect correction) |
| 7 | Final production release, documentation & deployment — Version 1.0 |

Full detail and acceptance criteria per phase: `docs/ROADMAP.md`.

## 10. Business rules summary (from the original Excel/Word analysis)

- SBA + Exam = Subject Total, each component 0-50, total capped at 100.
- Grade is always looked up against the school's own configured grade
  bands — never a hard-coded threshold.
- Class position uses **competition ranking** (ties share a rank, e.g.
  1-2-2-4), computed **independently per subject** — a student's
  position in one subject must never leak into another's (the specific,
  historically-real "JHS Social Studies reads Science's position" bug
  this rule exists to prevent).
- A student's overall average is computed only over subjects they
  actually have scores in — an unscored subject is excluded, never
  treated as a zero.
- KG uses the official NaCCA qualitative model exclusively: Gold/Silver/
  Bronze/Not-Assessed/Absent skill ratings, **no** totals, averages,
  grades, percentages, or rankings anywhere in a KG report — attendance
  percentage is the one explicit, deliberate exception, since attendance
  is not an assessment concept.
- A student's permanent identity (name, DOB, admission info) is
  separate from their per-term placement (class/level/term), which lives
  in `Enrollment` — a student's history across years/terms is always
  traceable.
- Once a term is archived, its data is permanently locked — reports can
  still be viewed/reprinted, but never edited.
