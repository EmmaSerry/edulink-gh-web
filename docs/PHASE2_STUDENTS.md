# Phase 2 — Student Management Module

## The core design decision: Student vs. Enrollment

The brief's own recommended enhancement is the spine of this phase: a
`Student` row is a **permanent identity record** (name, DOB, guardian,
permanent Student ID) and never stores current class/level/term.
`Enrollment` rows track where the student belongs in a specific academic
year + term. A promotion, repeat, or transfer always **adds a new
Enrollment row** - it never edits the Student record or overwrites a
previous Enrollment.

```
Student: Emmanuel Mensah (one permanent row)
 ├─ Enrollment 2026/2027 Term 1 → Basic 5A   (isCurrent: false, once superseded)
 ├─ Enrollment 2026/2027 Term 2 → Basic 5A   (isCurrent: false, once superseded)
 └─ Enrollment 2027/2028 Term 1 → Basic 6A   (isCurrent: true)

PromotionHistory (append-only, permanent):
 └─ 2027/2028: Basic 5A → Basic 6A, status PROMOTED, 2027-09-04
```

This is why `Student` (`src/models/Student.ts`) has no `classId`/`levelId`
field at all, and every screen that needs "what class is this student in"
(Students list, Class Register, Dashboard) reads it from Enrollment via
`EnrollmentService.getCurrentEnrollment()` or the `useStudentDirectory()`
hook (`src/hooks/useStudentDirectory.ts`), which joins Student + current
Enrollment + Guardian once and is reused everywhere instead of every page
re-implementing the join.

## Data model (new in v3)

| Table | Purpose | Key indexes |
|---|---|---|
| `students` | Permanent identity: name, DOB, nationality, admission event, **status** (the soft-delete mechanism) | unique `studentId`, unique `admissionNumber`, `emisNumber`, `lastName`/`firstName`, `status` |
| `guardians` | One primary parent/guardian per student (Database Requirements: "Parent/Guardian" as its own table) | `studentId` |
| `enrollments` | One row per student per term - current class/level/term/year placement | unique `[studentId+termId]` (enforces "one active class per term"), `isCurrent`, `[termId+classId]` (fast class-roster lookups) |
| `promotionHistory` | Append-only promotion/transfer/repeat/graduation record | `studentId`, `toLevelId`, `toClassId` |
| `studentPhotos` | Version history of uploaded/resized photos | `studentId`, `uploadedAt` |
| `importLogs` | One row per bulk-import run, with per-row error detail | `importedAt` |

`Student.status` (`ACTIVE | TRANSFERRED_OUT | GRADUATED | WITHDRAWN |
DECEASED`) **is** the module's soft-delete mechanism - there is no
separate `isDeleted` flag and no hard-delete action anywhere in the
Students UI (`StudentService.remove()` is inherited from
`BaseRepository` but intentionally never called or exposed). Any status
other than `ACTIVE` removes the student from default active views while
the full record - and all of their Enrollment/Promotion/Guardian history
- remains queryable forever.

## Student ID generation (Module 10)

`StudentIdService.generateNext()` (`src/services/StudentIdService.ts`)
produces IDs like `ACTRS-2026-000001` from a single **global monotonic
counter** stored in `SystemSettings.studentId.nextSequence` (Settings →
System tab). The counter only ever increases and is never tied to a
specific academic year, which is what guarantees "unique across all
academic years" and "never reused" without any special-casing at year
rollover. The prefix and zero-padding width are configurable; the
increment-and-persist happens inside a Dexie transaction so two
back-to-back registrations can never collide.

## Registration & enrollment workflow (Modules 1 & 3)

`StudentService.register()` runs in one transaction: generate the
permanent ID → insert the `Student` row → insert the `Guardian` row →
call `EnrollmentService.assignClass()` for the initial placement. A
failure partway rolls back the whole registration rather than leaving an
orphaned student with no guardian or class.

`EnrollmentService.assignClass()` is deliberately an **upsert** keyed on
`[studentId, termId]`: calling it again for a student who already has a
row for that term corrects/reassigns the class in place (Module 3 "Class
reassignment"). Moving a student to a **different term/year** should go
through `PromotionService.promote()` instead, which always inserts a new
Enrollment row and a matching, permanent `PromotionHistoryEntry` — it
never updates an existing row (Module 4 "Never overwrite historical
records").

## Search & filtering (Modules 5 & 6)

The Students page (`src/pages/Students.tsx`) filters the joined
`useStudentDirectory()` rows in memory against: Student ID, Admission
Number, EMIS Number, name, parent name/phone, class, level, gender, and
status (Module 5), combined with independent, combinable filters for
Academic Year, Term, Level, Class, Gender, Status, Admission Year and Age
Group (Module 6). This is fast enough client-side for the thousands-of-
students scale target because IndexedDB access happens once (via
`useLiveQuery`) and re-filtering an in-memory array on every keystroke is
sub-millisecond even at that scale.

## Bulk import/export (Modules 7 & 8)

Both use **SheetJS (`xlsx`)**, which reads and writes `.xlsx` and `.csv`
through one unified API - no separate CSV library needed.

- **Import** (`src/services/ImportService.ts` + `src/pages/students/
  ImportWizard.tsx`): parse → auto-map columns by header-name matching
  (`FIELD_ALIASES`) with manual override in the UI → validate every row
  (required fields, gender/date formats, duplicate admission/EMIS numbers
  both within the file and against the database) → commit only rows with
  zero errors, resolving each row's Academic Year/Level/Class by
  case-insensitive label/code match. Every run is logged to
  `importLogs` with per-row error detail.
- **Export** (`src/services/ExportService.ts`): scoped to all students, a
  level, a class, or an explicit selection; formats xlsx/csv/JSON. Rows
  are built the same way as the directory hook - Student + current
  Enrollment + Guardian joined - so exports always reflect current
  placement even though Student itself doesn't store it.

## Student photo management (Module 9)

`PhotoService.upload()` draws the uploaded image onto an off-screen
`<canvas>`, downscales it to a maximum of 480px on the long edge, and
re-encodes as JPEG at 82% quality before it ever touches IndexedDB - a
typical multi-megabyte phone photo becomes tens of kilobytes. Every
upload is also kept in `studentPhotos` (history), while `Student.
photoDataUrl` caches just the latest one for fast list/profile rendering
without an extra query.

## Testing performed

Same sandbox constraint as Phases 0-1 (no live npm registry - see
`README.md`): verified via full import-resolution + stub TypeScript
checks across all new files, plus manual review of every new Dexie query
(compound/unique index usage, multiEntry-style lookups) against Dexie's
documented behaviour. Run the brief's full acceptance checklist
(registration, editing, soft deletion, duplicate prevention, ID
generation, enrollment, promotion history, import, export, offline
persistence, search performance, responsive layouts) in a real browser
after `npm install`.

## Readiness for Phase 3 — Assessment Management

Every entity Phase 3 will need already exists: Students (identity),
Enrollments (which subjects/learning areas apply, via their Level), and
Subjects/LearningAreas/Skills/GradeBands (Phase 1). The `scoreRecords` and
`skillAssessmentRecords` tables already exist in the schema (Phase 0) and
are untouched this phase, ready for Phase 3 to populate them against real
students and real enrollments instead of placeholder data.
