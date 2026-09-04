# Phase 3 — Assessment Management Module

## The core design decision: mode auto-detection, never a manual choice

The brief is explicit that "teachers should never have to manually choose
between Primary/JHS scoring and KG skill assessment." ACTRS reads
`Level.assessmentMode` (`"scored" | "skill-checklist"`, set once per Level
under Settings in Phase 1) and the assessment workspace
(`src/pages/AssessmentWorkspace.tsx`) renders the matching interface
automatically:

```
Open a class + term → AssessmentSessionService.getOrCreate() looks up the
class's Level → level.assessmentMode decides which component mounts:
  "scored"          → ScoreEntryGrid  (SBA + Exam, Total, Grade, Position)
  "skill-checklist" → KGSkillGrid     (Gold/Silver/Bronze/X/O per skill)
```

There is no UI control anywhere that lets a teacher pick a mode - it is
entirely a property of the class's Level, exactly as configured in
Phase 1.

## The calculation engine is pure, and nothing else touches Dexie for calculations

`src/services/AssessmentCalculationEngine.ts` contains every formula the
brief's "Critical Instruction - Calculation Accuracy" section requires,
as plain, framework-free functions over plain data - no Dexie import, no
React import:

| Function | Rule reproduced |
|---|---|
| `computeSubjectTotal(sba, exam)` | Total = SBA + Exam, capped at 100. Returns `null` (not 0) if either input is missing - an unscored subject must never look like a zero score. |
| `isValidComponentScore(value)` | SBA and Exam are each validated on their own 0-50 scale (Module 3), never 0-100. |
| `findGradeBand(score, bands)` / `resolveGradeBandsForLevel(bands, levelId)` | Grade-band thresholds always come from the Phase 1 `GradeBand` table (default 80 Advanced / 68 Proficient / 54 Approaching Proficiency / 40 Developing / 0 Beginning) - never hard-coded here. A level-specific band set wins over the global default if one exists. |
| `computeCompetitionRanking(items, getValue)` | Competition ranking: ties share a rank and the next distinct value skips accordingly. Verified by hand against the brief's own example: scores `[95, 95, 91, 90]` → ranks `[1, 1, 3, 4]`. Items with no value yet are excluded from ranking entirely, rather than being ranked last. |
| `computeOverallForStudent(subjectTotals, bands)` | Overall Total/Average/Grade, averaged only over subjects actually scored so far - a partially-complete draft doesn't understate a student's standing mid-term. |

**Totals, grade bands, and positions are never persisted.** `ScoreRecord`
only ever stores the raw `sbaScore`/`examScore` a teacher typed
(`ScoreRecordService`); everything derived is recomputed live by
`ScoreEntryGrid` on every keystroke via the engine above, in-memory. This
guarantees a stored value can never silently drift out of sync with the
formula that produced it - correcting a `GradeBand` threshold, for
example, instantly and correctly changes every existing report's grade,
because there is no cached grade to go stale.

The same "never persist a derived value" rule applies to KG: skill
ratings are Gold/Silver/Bronze/X/O only (`SkillAssessmentRecord.rating`)
with an optional per-skill comment - the engine has no scoring path for
skill-checklist mode at all, so there is no code path that could
accidentally compute a KG score, total, or rank.

## Data model (new in v4)

| Table | Purpose | Key indexes |
|---|---|---|
| `assessmentSessions` | One row per class+term; drives the Draft → Completed → Verified → Finalized lifecycle and records the auto-detected `assessmentMode`/`levelId` at creation time | unique `[classId+termId]`, `status` |
| `auditLogs` | Append-only action log - every score save, rating save, remarks save, and status change | `assessmentSessionId`, `performedAt`, `action` |

`ScoreRecord`, `SkillAssessmentRecord` (`src/models/AssessmentRecord.ts`)
and `ReportRecord` (`src/models/Report.ts`) already existed as
Phase 0 placeholder tables with the exact shape Phase 3 needed, so no
schema change was required for them - only the two new tables above.
`ReportRecord` is deliberately reused as the Module 10 "Teacher Remarks"
store (`interestRemark`/`conductRemark`/`attitudeRemark`/
`classTeacherRemark`/`headteacherRemark` for scored levels;
`generalComment`/`areasForImprovement`/`teacherRecommendation` for KG)
instead of adding a parallel table, since it already models exactly the
same one-row-per-student-per-term shape a future Report Cards phase will
need anyway.

## Session lifecycle & audit trail (Modules 11-12)

`AssessmentSessionService.changeStatus()` enforces a linear
Draft → Completed → Verified → Finalized progression via an explicit
`ALLOWED_FORWARD` transition table, plus one exception: Completed or
Verified can be reopened back to Draft with a required reason, since
Phase 0-2 never built real authentication/roles for ACTRS - there is no
"administrator" account distinct from "teacher" to gate this to. This is
a deliberate, documented simplification: the reopen action is still
fully audit-logged (who, when, why), just not permission-gated.

Every score save, skill-rating save, remarks save, status change,
finalization and reopen writes one row to `auditLogs` via
`AuditLogService.record()` - satisfying "even in an offline system,
maintain a complete audit log for accountability" without needing a
server. Attribution comes from `useCurrentUser()`
(`src/hooks/useCurrentUser.ts`), a simple locally-remembered display name
the teacher enters once per device - explicitly documented in that file
as audit attribution only, **not** an access-control mechanism, since
Login remains the Phase 0 placeholder.

**Finalization gating (Modules 9 & 11):** moving a session forward from
Draft (to Completed, Verified, or Finalized) is blocked with an inline
error if any enrolled student is not yet fully assessed - every subject
scored for scored levels, every skill rated for KG - reusing the same
completion check the Dashboard displays (`AssessmentProgressService`).
Reopening back to Draft is always allowed, since it only loosens the
gate.

## The score-entry grid (Module 2, 4-7)

`ScoreEntryGrid` (`src/pages/assessments/ScoreEntryGrid.tsx`) is a
hand-built Excel-like grid - no charting/grid npm dependency was added,
consistent with the project's "don't add a dependency the brief didn't
ask for" pattern from earlier phases:

- **Sticky headers, frozen name column** via plain CSS (`.actrs-grid-scroll`
  / `.actrs-grid-frozen-col` in `src/styles/theme.css`) rather than a grid
  library.
- **Keyboard navigation:** Arrow keys move between cells (left/right only
  at the start/end of the current text, so normal in-cell editing still
  works), Enter moves down, Tab follows natural DOM order.
- **Paste from Excel:** pasting a tab/newline-delimited block starting at
  any focused cell fills forward across subjects and down students,
  clamped to the grid's bounds.
- **Undo/redo:** Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) walk a per-cell history
  stack.
- **Auto-save:** each cell writes through to Dexie on a 600ms debounce
  after the last keystroke (flushed immediately on unmount so a quick
  navigation-away doesn't lose the last edit), with a visible
  "Saving…" / "All changes saved" indicator.
- **Live validation:** an SBA/Exam value outside 0-50 is highlighted red
  and is never persisted or included in a calculation until corrected -
  the teacher's last-typed value stays on screen so nothing is silently
  discarded.
- **Design note:** the grid seeds itself once from Dexie and from then on
  treats its own in-memory state as the source of truth, writing through
  on a debounce, rather than staying subscribed to a live query on
  `scoreRecords` - a live subscription would re-fight in-progress typing
  every time the grid's own write lands. Documented in the file's top
  comment as the standard pattern for any spreadsheet-like editor over
  Dexie.

Column layout, left to right: frozen Student name, then for each Subject
(from Phase 1 config, never hard-coded) - SBA, Exam, Total, Grade,
Position - then a final Overall group - Total, Average, Grade, Position.

## The KG skill-assessment interface (Module 8)

`KGSkillGrid` (`src/pages/assessments/KGSkillGrid.tsx`) renders one tab
per active Learning Area (from Phase 1 config) and, within a tab, one
column per Skill in that area and one row per enrolled student. Each cell
is a Gold/Silver/Bronze/Not-assessed/Absent button group (click a
selected rating again to clear it) plus an optional free-text note -
strictly no scores, totals, or rankings anywhere in this component, per
the NaCCA Kindergarten Assessment Tool and the brief's "Critical
Instruction" section.

## Teacher Remarks (Module 10)

`TeacherRemarksPanel` (`src/pages/assessments/TeacherRemarksPanel.tsx`)
edits one student at a time (Previous/Next navigation) rather than a
wide table, since scored levels have five remark fields per student.
Scored levels get a "pick from the Remarks Bank" dropdown per field
(Conduct/Interest/Attitude/Teacher Remarks/Headteacher Remarks,
categories from Phase 1) that fills a free-text box the teacher can still
edit or override; KG gets three free-text fields only (General Progress
Comment, Areas for Improvement, Teacher Recommendation) with no picklist,
per the NaCCA tool having no remarks-bank equivalent.

## Assessment Dashboard & Dashboard enhancements (Modules 1 & 14)

`/assessments` (`AssessmentDashboard.tsx`) is the entry point: pick an
academic year/term/level filter, see every active class's auto-detected
mode, live completion percentage, missing-student list, lifecycle status
and last-saved time, then jump into that class's workspace. Opening a
class is what *creates* its `AssessmentSession` (`getOrCreate`) - the
Dashboard itself only reads, so simply looking at the Dashboard can never
create phantom sessions for classes nobody has started assessing.

The main `/` Dashboard gained an "Assessment progress" card for the
active term: classes not-started/draft/verified/finalized counts,
students still missing a score or rating, and a KG-specific
"X of Y KG classes fully rated" line - all computed by the same
`AssessmentProgressService.getClassAssessmentSummary()` /
`getAllClassSummaries()` the per-class dashboard row and the finalization
gate both use, so the three numbers can never disagree with each other.

## Defects fixed in earlier phases while integrating

Two Phase 1/2 services still referenced `Student.currentClassId`, a field
Phase 2 removed entirely in favour of `Enrollment` (see
`docs/PHASE2_STUDENTS.md`). Left as-is, `LevelService.remove()` and
`ClassService.remove()` would have thrown at runtime the first time
either was called against real data (Dexie has no index for that no
longer-indexed field). Both were corrected to check `Enrollment` records
instead, consistent with "current class" living there everywhere else in
the app; `LevelService.remove()`'s student check was removed outright
since a Level is never linked to a student directly - only via Class, and
`ClassService.remove()` already covers that.

A full sweep of every source file for unused imports/locals (this
project's strict `noUnusedLocals`/`noUnusedParameters` setting would fail
the build on these) also turned up three more pre-existing Phase 1/2
issues, fixed the same way: an unused `isDuplicate` import in
`validation/remarksBankSchema.ts` and `validation/termSchema.ts` (both
files implement their duplicate check inline via `.refine()` instead), and
an unused `useState` import in `pages/students/ClassAssignmentModal.tsx`.

## Testing performed

- Manual trace of `computeCompetitionRanking` against the brief's own
  `[95, 95, 91, 90] → [1, 1, 3, 4]` example.
- Manual trace of `computeSubjectTotal`/`findGradeBand` against each of
  the five default grade-band boundaries (0, 39, 40, 53, 54, 67, 68, 79,
  80, 100).
- A custom Python import-resolution checker confirms every relative and
  `@alias` import across all 136 source files resolves to a real file
  (see the note in `README.md` about the sandbox's lack of npm registry
  access - a full `tsc`/build pass could not be run here and must be the
  first step after `npm install` on a real machine, exactly as documented
  for Phases 1 and 2).
- Manual line-by-line review of every new/changed file for unused
  imports/locals (this project's `tsconfig.app.json` has
  `noUnusedLocals`/`noUnusedParameters` enabled, so these would otherwise
  fail the build) and for consistency with existing Dexie query patterns
  used elsewhere in the codebase.

## Out of scope (per the brief)

Report card printing/PDF generation, report templates, archives,
backup/restore, and analytics beyond assessment progress are explicitly
deferred to Phases 4-5, unchanged from the brief.

## Acceptance criteria checklist

- [x] Assessment mode is fully auto-detected from Level config - no
      manual mode selector exists anywhere in the UI
- [x] Scored-level calculations (Total, Grade Band, Subject Position,
      Overall Total/Average/Position/Grade) exactly match the brief's
      documented Excel workflow, verified by manual trace
- [x] KG assessment is strictly Gold/Silver/Bronze/X/O + comments - no
      totals, averages, grades, or rankings anywhere in that path
- [x] Excel-like score entry: keyboard navigation, paste, undo/redo,
      auto-save, live validation
- [x] Finalization lifecycle (Draft → Completed → Verified → Finalized)
      enforced, blocked while any student is incomplete, reopenable with
      a logged reason
- [x] Full audit trail for every score/rating/remarks/status change
- [x] Teacher Remarks: Remarks Bank-driven for scored levels, free-text
      for KG
- [x] Dashboard reflects live assessment progress, including a
      KG-specific completion figure
- [x] Two latent Phase 2 defects (stale `currentClassId` references)
      found and fixed while integrating
- [ ] Live-browser verification (grid interaction, IndexedDB persistence,
      offline reload) - could not be run in this sandbox (no npm registry
      access); documented as the first step after `npm install` on a real
      machine, as with every prior phase
