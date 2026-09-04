# Phase 1 — System Configuration & Administration

## What was built

All 11 configuration modules requested, implemented as 5 routed pages
(matching Phase 0's existing navigation instead of adding new nav items -
see "Routing decisions" below):

| Module | Page | Route |
|---|---|---|
| 1. School Configuration | `SchoolSetup.tsx` | `/school-setup` |
| 2. Academic Year Management | `AcademicYears.tsx` | `/academic-years` |
| 3. Term Management | `Terms.tsx` | `/terms` |
| 4. Level Management | `LevelsClasses.tsx` (Levels tab) | `/levels-classes` |
| 5. Class Management | `LevelsClasses.tsx` (Classes tab) | `/levels-classes` |
| 6. Subject Management | `settings/SubjectsTab.tsx` | `/settings` |
| 7. KG Learning Area Management | `settings/LearningAreasTab.tsx` | `/settings` |
| 8. KG Skill Management | `settings/SkillsTab.tsx` | `/settings` |
| 9. Grade Band Configuration | `settings/GradeBandsTab.tsx` | `/settings` |
| 10. Remarks Bank | `settings/RemarksBankTab.tsx` | `/settings` |
| 11. System Settings | `settings/SystemTab.tsx` | `/settings` |

Plus: the Dashboard now shows live summary cards for all nine counts listed
in the brief (Schools Configured, Academic Years, Active Term, Levels,
Classes, Subjects, KG Skills, Grade Bands, Remarks).

## Routing decisions (why 5 pages, not 11)

Phase 0 already fixed the navigation structure (`docs/NAVIGATION.md`) with
one nav item each for "Levels & Classes" and "Settings" — both explicitly
described there as covering multiple of these modules ("KG1, KG2, Basic
1-6, JHS1-3 and their classes" and "grade bands, subjects, learning areas,
remarks banks"). Rather than redesign Phase 0's navigation (against the
brief's "do not redesign" instruction), Level/Class management became two
tabs on one page, and Subjects/Learning Areas/Skills/Grade Bands/Remarks/
System became six tabs on the Settings page. Every module is fully present
and independently reachable; only the URL grouping changed from the
brief's module numbering.

## Shared infrastructure (new in Phase 1)

To satisfy "every configuration page must support CRUD, search, filtering,
sorting, validation, duplicate prevention, confirmation dialogs, and
toasts" without 11x duplicated code, five reusable pieces were added and
are used by every module page:

- **`DataTable<T>`** (`src/components/DataTable.tsx`) — generic search +
  column sorting + pagination + loading/empty states.
- **`Modal`** (`src/components/Modal.tsx`) — the Add/Edit form container.
- **`ToastProvider` / `useToast`** (`src/contexts/ToastContext.tsx`) —
  success/error notifications, mounted once in `main.tsx`.
- **`ConfirmProvider` / `useConfirm`** (`src/contexts/ConfirmContext.tsx`)
  — `await confirm({ message })` before every delete.
- **`FormField`** (`src/components/FormField.tsx`) — consistent label +
  control + validation-message layout.

Every module's validation lives in `src/validation/*Schema.ts` as a Zod
schema (several are schema *factories* — e.g. `createLevelSchema(existing,
excludeId)` — so duplicate-prevention rules can check the already-loaded
table via `useLiveQuery` with no extra database round-trip). Every
module's data access + integrity rules live in `src/services/*.ts`,
extending the Phase 0 `BaseRepository` and throwing a typed
`DeletionBlockedError` when a delete would break a foreign-key
relationship (e.g. deleting a Level with Classes still linked to it).

## Database changes (v1 → v2)

See `src/database/db.ts` version 2 and `docs/DATABASE.md`. Summary:

- `schools`, `academicYears`, `terms`, `levels`, `classes` gained the new
  Phase 1 fields (branding/report fields, `isCurrent`, `termName`+dates,
  `isActive`, `capacity` etc.) — additive, no breaking change.
- `subjects` and `learningAreas` moved from a single `levelId` to a
  multi-valued `levelIds` array (Dexie `*levelIds` multiEntry index), so
  one subject or learning area can legitimately apply to several levels
  ("different subject combinations for Lower Primary, Upper Primary and
  JHS" without duplicating "Science" three times).
- `skills` gained `levelId` directly (a skill is scoped to one specific KG
  level within its learning area, since KG1 and KG2 skill wording can
  diverge even under an identical learning area name).
- `gradeBands` is a new standalone table (Module 9), replacing the
  Phase 0 embedded `Level.gradeBands` array.
- The `.upgrade()` migration backfills sensible defaults (`isActive:
  true`, etc.) onto any Phase 0 data and promotes each level's embedded
  grade bands into the new table automatically.

## Business rules enforced

- **Single active Academic Year / Term:** `AcademicYearService.setCurrent`
  and `TermService.setActive` run inside a Dexie transaction that clears
  the flag on every other row before setting it on the chosen one - it is
  not possible to end up with two "current" years or two "active" terms.
- **Duplicate prevention:** academic year labels, term numbers-per-year,
  level codes, class codes, subject codes, learning area names, skill
  numbers-per-area-per-level, and remark text-per-category are all
  checked before save (see the `.refine()` calls in each
  `src/validation/*Schema.ts`).
- **Referential integrity on delete:** an Academic Year cannot be deleted
  while Terms reference it; a Term cannot be deleted once assessment/
  report records reference it; a Level cannot be deleted while Classes,
  Subjects, Learning Areas or Skills reference it; a Class cannot be
  deleted while Students are enrolled in it; a Subject/Skill cannot be
  deleted once score/skill-assessment records reference it. Each of
  these throws `DeletionBlockedError` with a message the UI shows via a
  toast rather than a raw exception.

## Testing performed

Because this sandbox has no live npm registry access (documented in
`README.md`/`docs/ROADMAP.md` since Phase 0), CRUD/persistence/offline
behaviour could not be exercised in a real browser here. What was
verified instead:

- Every new file's imports resolve to a real file or a real external
  package (no typos in the 100+ new `@alias` imports).
- A full static syntax/type pass with the TypeScript compiler (stubbed
  ambient declarations standing in for the packages that can't be
  installed in this sandbox) - zero real errors.
- Manual review of every Dexie query used in the new services
  (`.where(...).equals(...)`, multiEntry index usage) against Dexie's
  documented API to catch shape mistakes before they'd surface at
  runtime.

**On your machine**, after `npm install`, the concrete acceptance-test
checklist from the brief (CRUD, validation, duplicate prevention,
referential integrity, persistence after refresh, responsive behaviour,
offline functionality) should be run against `npm run dev` before
considering Phase 1 sign-off final — this documentation makes the
intended behaviour explicit enough to verify quickly against each module.

## Readiness for Phase 2 — Student Management

Every entity Phase 2 will need already exists and is populated by this
phase's screens: Levels, Classes, Academic Years, Terms, Subjects (for
scored levels) and Learning Areas/Skills (for KG levels). The `Student`
model and `students` Dexie table already exist from Phase 0
(`src/models/Student.ts`), untouched in Phase 1 as instructed. Phase 2 can
build the Students module directly on top of this configuration data with
no further schema changes anticipated beyond the `students` table itself.
