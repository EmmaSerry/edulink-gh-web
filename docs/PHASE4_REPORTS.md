# Phase 4 — Report Card Generation & Printing Module

## The core design decision: a frozen snapshot, not a live re-query

Every report - previewed, exported to PDF, or printed - is built from a
single `ReportSnapshot` object (`src/reporting/ReportSnapshot.types.ts`):
school info, student info, term info, attendance, and either the scored
subject table + overall result, or the KG learning-area/skill ratings.
`ReportDataService.buildClassSnapshots()` (Module 11) is the ONLY place
that reads Student/Enrollment/ScoreRecord/SkillAssessmentRecord/
ReportRecord/School/GradeBand/Subject/LearningArea/Skill records and runs
the Phase 3 calculation engine over them - once built, a snapshot is
frozen into `GeneratedReport.snapshotData` (the current version) and
`ReportVersionEntry.snapshotData` (permanent history), and every
rendering surface - the on-screen Preview, the PDF export, and the
native print view - renders that same frozen object through the exact
same React component tree. This is what makes Module 13's "reopen and
reprint without recalculating unless the assessment has been officially
reopened" trivially correct: reprinting an old version is just
re-rendering the same object, and `ReportGenerationService.isStale()`
compares the assessment session's `updatedAt` against the snapshot's
`sourceAssessmentUpdatedAt` to know when a fresh regeneration is needed.

## Template engine architecture (Module 2)

```
ReportTemplateService.resolveTemplateCodeForLevel(levelId)
        -> ReportTemplateCode ("KG" | "LOWER_PRIMARY" | "UPPER_PRIMARY" | "JHS")
                -> templateRegistry.ts: TEMPLATE_COMPONENTS[code]
                        -> the React component that renders that layout
```

`reportTemplates.appliesToLevelIds` (Dexie v5) is the single source of
truth for "which template does this Level use" - never a hard-coded
level-code/name switch anywhere in the rendering, PDF, print, or batch
code. The Dexie v5 migration seeds a best-effort mapping matching
ACTRS's own default level codes (KG1/KG2 -> KG, BASIC1-3 -> Lower
Primary, BASIC4-6 -> Upper Primary, JHS1-3 -> JHS); Settings -> Report
Templates (Module 12) lets an administrator reassign a renamed or
newly-added Level to any template of the matching assessment mode with
no code change, which is what "future templates should be easily added
without changing application logic" means in practice here. Adding a
genuinely new layout in the future is: one new component file, one new
registry entry, one new `reportTemplates` row - nothing else changes.

Every template renders through the shared `ReportPage` wrapper
(`src/reporting/ReportPage.tsx`), which applies `TemplateSettings`
(Module 12: paper size, orientation, margins, font, colours, watermark)
as CSS variables - an administrator's appearance change applies to every
future report automatically, without touching any template's code.
`ReportHeader`/`SignatureBlock`/`KgLegend` are shared sub-components so
every report shows the same official letterhead and sign-off block.

Lower Primary, Upper Primary and JHS (Modules 3-5) are layout-identical
per the brief itself ("Upper Primary... identical in layout and
calculations to the current Upper Primary report card") - only the
subject list differs, and that was already 100% data-driven via Phase 1
`Subject.levelIds`. Rather than triplicating ~200 lines of JSX three
times, `ScoredReportLayout.tsx` holds the shared layout and each level's
template component (`LowerPrimaryReportTemplate.tsx` etc.) is a
one-line wrapper supplying only the title text. KG (Module 6) is
structurally different (learning areas/skills instead of subjects, no
calculations at all) and has its own `KGReportTemplate.tsx`.

## JHS Social Studies/Science bug fix (Module 5)

The known defect in the previous Microsoft Word mail-merge template was
a copy-pasted merge field: the Social Studies row's Position cell
referenced the Science Position merge field instead of its own.
`ReportDataService.buildClassSnapshots()` computes one competition
ranking PER subject independently, keyed by that subject's own
`subjectId` (`rankingBySubject: Map<subjectId, Map<studentId, rank>>`),
and every subject row in `ScoredReportLayout.tsx` reads
`snapshot.subjects[i].positionText` straight from the array element
`ReportDataService` built for that specific subject - there is no shared
variable, hard-coded field name, or column-index coincidence anywhere
in the rendering path that could make one subject display another's
position.

This was verified two ways, not just asserted:

1. `scripts/verify_jhs_bug_fix.mjs` - a standalone, executable
   reproduction of the exact ranking algorithm with a class of 4
   students where Science and Social Studies scores are deliberately
   mirrored (the class's best Science student is its worst Social
   Studies student and vice versa). It asserts each subject shows its
   OWN position, not the other's - all 5 checks pass. Run with
   `node scripts/verify_jhs_bug_fix.mjs`.
2. Manual code review confirms `subjects.map((subject) => {...})` in
   `ReportDataService.ts` looks up both the score cell and the ranking
   entry using that same iteration's `subject.id` - never a fixed
   subject name or a value carried over from a previous loop iteration.

## KG compliance with the NaCCA model (Module 6)

`KGReportTemplate.tsx` never imports or references `subjects`,
`overall`, or any scored-level snapshot field - the KG branch of
`ReportDataService.buildClassSnapshots()` never populates them in the
first place, so there is no total/average/grade/position/percentage
value for the template to accidentally display even if it tried.
`scripts/verify_kg_no_calculations.py` statically greps the template's
executable source (comments stripped) for `total`/`average`/`grade`/
`position`/`rank`/`percentage`/`score`/`sba`/`exam` and confirms zero
matches. Run with `python3 scripts/verify_kg_no_calculations.py`.

## Report Validation (Module 11)

`validateReportPrerequisites(studentId, termId)` checks, all at once
(not stopping at the first failure, so every problem is shown together):
student exists; an Enrollment exists for the term; the class's
assessment session is `FINALIZED`; a template is mapped to the level;
the required remark is present (Class Teacher's Remark for scored
levels, General Progress Comment for KG); attendance (days present) is
recorded; a promotion/progression decision is entered; the term's
vacation/reopening dates and school days are complete; and the School
profile has its mandatory fields configured. A report cannot be
generated - individually or in a batch - until every issue is resolved.

## Data model (new in v5)

| Table | Purpose | Key indexes |
|---|---|---|
| `reportTemplates` | Registry: which template code, which Levels, which assessment mode | unique `code`, multi-entry `appliesToLevelIds` |
| `templateSettings` | Singleton report-appearance settings (Module 12) | - |
| `generatedReports` | CURRENT report per student+term - the frozen snapshot, version number, print/export counts | unique `[studentId+termId]` |
| `reportVersions` | Append-only history of every snapshot ever generated | `[studentId+termId]`, `versionNumber` |
| `printLogs` / `exportLogs` | Append-only action logs backing Module 13/14's counts | `[studentId+termId]`, `performedAt` |

`templateSettings` is seeded from the pre-existing
`SystemSettings.report` values (Phase 1) on first migration so a
school's already-configured paper size/margins/font carries forward
unchanged - it is kept as its own table rather than folded into
`SystemSettings` because it is a distinct concern (report *appearance*,
consumed only by the Phase 4 rendering pipeline) with its own dedicated
admin screen (Settings -> Report Templates), matching the brief's
explicit "Template Settings" database requirement.

## PDF generation & printing (Modules 8 & 10)

`PdfService.generatePdfFromPages()` rasterizes each already-mounted
`.actrs-report-page` DOM node with `html2canvas` (so fonts render
pixel-for-pixel exactly as shown on screen, avoiding font-embedding
mismatches across OSes with no internet access to fetch web fonts) and
assembles them into one jsPDF document at the school's configured paper
size, adding page numbers when there is more than one page.
`PrintService.printReports()` mounts the identical component tree
(`ReportPrintSurface`, reused by Preview, PDF export AND print) into a
temporary detached container and calls `window.print()`; the
`@media print` rules in `src/styles/report-print.css` hide everything
else on the page so only the report prints, preserving letterhead,
tables, margins, page breaks, images and signature lines exactly as
shown in Preview - all three surfaces render from the same markup, so
they can never visually disagree with each other.

## Batch generation (Module 9)

`ReportGenerationService.generateForClass()` validates and generates
every roster student (or a `Set` of selected ones) sequentially,
collecting per-student results rather than aborting the whole batch on
one student's incomplete data, with a progress callback driving the
Dashboard's progress bar. Batch PDF export honours
`TemplateSettings.batchPdfMode`: one combined multi-page PDF, or one
file per student (downloaded sequentially with a short delay between
files - a zip archive would need an additional library outside this
project's approved tech stack, so this is the pragmatic choice for
"individual" mode with today's dependencies).

## Routing

| Route | Page | Notes |
|---|---|---|
| `/report-cards` | `ReportCardsDashboard` (Module 1) | Year/term/level picker + per-class generation progress |
| `/report-cards/:classId?termId=` | `ClassReportManager` (Module 9) | Roster with per-student generate/preview/history, plus class-wide bulk actions |
| `/report-cards/preview?classId=&termId=&studentIds=` | `ReportPreview` (Module 7) | Zoom, next/previous, download, print - `mode=frozen&reportId=` views a past version without recalculating |

Settings -> Report Templates (a new tab alongside Phase 1's Subjects/
Learning Areas/Skills/Grade Bands/Remarks/System tabs, following the
same tabbed-route pattern established in `docs/PHASE1_CONFIGURATION.md`)
hosts Module 12's appearance settings and the Level->Template assignment
control. Report History (Module 13) is a modal reached from each
roster row in `ClassReportManager` rather than a separate route, since
it is always viewed in the context of a specific student.

## Testing performed

- `node scripts/verify_jhs_bug_fix.mjs` - 5/5 checks pass (JHS bug fix,
  see above).
- `python3 scripts/verify_kg_no_calculations.py` - confirms zero
  scored-level tokens in the KG template's executable source.
- A custom Python import-resolution checker confirms every relative and
  `@alias` import across all 167 source files resolves to a real file
  (the sandbox has no npm registry access, so a full `tsc`/build pass
  could not be run here - the first step after `npm install` on a real
  machine, as with every prior phase).
- A full-project sweep for unused imports/locals (this project's
  `tsconfig.app.json` has `noUnusedLocals`/`noUnusedParameters` enabled)
  found zero remaining issues after this phase's changes.
- Manual review of every new Dexie query against the v5 schema's actual
  index definitions (compound `[studentId+termId]` lookups, multi-entry
  `appliesToLevelIds`) for consistency with the query patterns
  established in Phases 1-3.

## Out of scope (per the brief)

Academic archives, backup/restore, school-wide analytics beyond report
generation, cloud synchronisation, and user authentication are
explicitly deferred to later phases, unchanged from the brief.

## Acceptance criteria checklist

- [x] Correct report template auto-selected per educational level (data-
      driven via `ReportTemplate.appliesToLevelIds`, never hard-coded)
- [x] Lower Primary/Upper Primary/JHS layouts match the existing GES
      format (subject table, attendance, remarks, promotion, signatures)
- [x] KG layout follows the official NaCCA Learner Report Form - legend,
      five learning areas, skill ratings, comments, no calculations
- [x] JHS Social Studies/Science field-mapping bug fixed and verified
      executably (`scripts/verify_jhs_bug_fix.mjs`)
- [x] Individual and batch PDF generation implemented (single/selected/
      class/level scope, combined or per-student per Module 12 setting)
- [x] Printing preserves letterhead/tables/margins/page breaks/images/
      signatures via the same rendered markup as Preview
- [x] Report Validation blocks generation until every prerequisite (
      finalized assessment, remarks, attendance, promotion, school info)
      is met
- [x] Report History retains every version with print/export counts,
      reprintable without recalculating unless the assessment reopened
- [x] Dashboard (both Report Cards and main) reflects live generation/
      print/export activity
- [ ] Live-browser verification (PDF rendering fidelity, print dialog
      output, IndexedDB persistence across reloads) - could not be run
      in this sandbox (no npm registry access); documented as the first
      step after `npm install` on a real machine, as with every prior
      phase
