# ACTRS Database Reference (IndexedDB via Dexie.js)

**Current schema version: 6** (introduced in Phase 5; unchanged through
Phase 6 and Phase 7 — every fix in both phases was a logic/behaviour
correction, not a data-model change).

## Why IndexedDB / Dexie, not SQL

The project brief explicitly rules out a SQL database and any backend.
Dexie is a thin, well-typed wrapper over the browser's built-in
IndexedDB, giving us a real transactional, indexed, queryable database
with zero installation and zero network dependency — appropriate for an
offline-first tool used on whatever computer a school happens to own.
`src/database/db.ts` is the **only** file that defines the actual Dexie
schema; it imports its row shapes from `src/models/*.ts` (one file per
entity) so the two can never silently drift apart.

## Complete table reference (Version 6)

### Configuration & curriculum

| Table | Purpose | Key indexes |
|---|---|---|
| `schools` | School profile | `name`, `schoolCode`, `circuit`, `district`, `region` |
| `academicYears` | Academic year records | `label`, `isActive`, `isCurrent` |
| `terms` | Term configuration, vacation/reopening dates | `academicYearId`, `termNumber`, `isActive`, `[academicYearId+termNumber]` |
| `levels` | KG1/KG2/Lower/Upper/JHS as data, incl. `assessmentMode` | `code`, `sortOrder`, `isActive` |
| `gradeBands` | Configurable score-to-grade thresholds, global or level-specific | `levelId`, `sortOrder`, `isActive` |
| `classes` | Classes/streams within a level | `levelId`, `code`, `isActive` |
| `subjects` | Subjects for **scored** levels, multi-level via `*levelIds` | `sortOrder`, `isActive`, `*levelIds` |
| `learningAreas` | Learning areas for **skill-checklist** (KG) levels | `sortOrder`, `isActive`, `*levelIds` |
| `skills` | Individual NaCCA checklist skills within a learning area, scoped to one KG level | `learningAreaId`, `levelId`, `serialNumber`, `isActive`, `[learningAreaId+levelId]` |
| `remarksBank` | Editable remark phrase banks by category | `category`, `sortOrder`, `isActive` |
| `settings` | Free-form app settings (system-wide preferences) | `&key` (unique) |
| `reportTemplates` | Registry row per report layout (KG/LOWER_PRIMARY/UPPER_PRIMARY/JHS) | `&code`, `assessmentMode`, `isActive`, `*appliesToLevelIds` |
| `templateSettings` | Single settings row: paper size, margins, fonts, colours, signature titles | (single row) |

### Students & enrollment

| Table | Purpose | Key indexes |
|---|---|---|
| `students` | Permanent learner identity record (never stores current class — see `enrollments`) | `&studentId`, `&admissionNumber`, `emisNumber`, `lastName`, `firstName`, `gender`, `status`, `academicYearOfAdmissionId` |
| `guardians` | One primary guardian per student | `studentId`, `phone` |
| `enrollments` | One row per student per term — the only place "what class is this student in" lives | `studentId`, `academicYearId`, `termId`, `levelId`, `classId`, `isCurrent`, `status`, `[termId+classId]`, `&[studentId+termId]` |
| `promotionHistory` | Append-only promotion record, never updated in place | `studentId`, `academicYearId`, `toLevelId`, `toClassId` |
| `studentPhotos` | Photo version history | `studentId`, `uploadedAt` |
| `importLogs` | One row per bulk student import run | `importedAt` |

### Assessment

| Table | Purpose | Key indexes |
|---|---|---|
| `assessmentSessions` | One row per class per term, tracks Draft→Completed→Verified→Finalized status | `classId`, `termId`, `status`, `&[classId+termId]` |
| `scoreRecords` | SBA + Exam per student/term/subject (scored levels only) | `studentId`, `termId`, `subjectId`, `[studentId+termId+subjectId]` |
| `skillAssessmentRecords` | G/S/B/X/O rating per student/term/skill (KG levels only) | `studentId`, `termId`, `skillId`, `[studentId+termId+skillId]` |
| `auditLogs` | Assessment-session-scoped audit trail (score/rating/remarks changes) — **append-only**, `update`/`remove` are blocked at the service layer | `assessmentSessionId`, `performedAt`, `action` |
| `reportRecords` | Attendance, remarks, progression, sign-off per student/term | `studentId`, `termId`, `[studentId+termId]` |

### Reports

| Table | Purpose | Key indexes |
|---|---|---|
| `generatedReports` | One CURRENT row per `[studentId+termId]`, holding the frozen `ReportSnapshot` | `studentId`, `termId`, `classId`, `&[studentId+termId]` |
| `reportVersions` | Append-only history of every snapshot ever generated, never updated in place | `studentId`, `termId`, `[studentId+termId]`, `versionNumber` |
| `printLogs` | Append-only log of every print action | `studentId`, `termId`, `performedAt` |
| `exportLogs` | Append-only log of every per-report PDF export | `studentId`, `termId`, `performedAt`, `scope` |

### Records management & operations (Phase 5)

| Table | Purpose | Key indexes |
|---|---|---|
| `archives` | One row per permanently-archived (closed) term — does **not** duplicate any student/assessment/report data, it only locks it | `&termId`, `academicYearId`, `archivedAt` |
| `systemLogs` | General-purpose activity log (backup/restore/import/export/archive actions) — **append-only**, `update`/`remove` are blocked at the service layer | `module`, `action`, `performedBy`, `performedAt` |
| `exportHistory` | Bulk export runs from the Import & Export Centre | `exportType`, `performedAt` |
| `diagnosticsSnapshots` | History of manually-triggered "Run Diagnostics" checks | `performedAt` |
| `performanceMetrics` | Best-effort local timing samples (search, batch generation, PDF export) | `metricType`, `capturedAt` |
| `backupHistory` | Log of every backup/restore operation, incl. scope (full/partial), format, outcome | `type`, `performedAt`, `scope` |

## Entity relationships (the ones that matter for integrity)

```
AcademicYear ─┬─< Term ─┬─< Enrollment >─┬─ Student ─┬─< Guardian
              │         │                │           ├─< PromotionHistory
              │         ├─< ScoreRecord >┤           ├─< StudentPhoto
              │         ├─< SkillAssessmentRecord >┤ └─< GeneratedReport >─< ReportVersion
              │         ├─< ReportRecord >┘
              │         ├─< AssessmentSession
              │         └─< Archive (locks the term)
              └─< PromotionHistory

Level ─┬─< Class >─< Enrollment
       ├─< Subject (scored levels)
       ├─< LearningArea >─< Skill (KG levels)
       └─< GradeBand (level-specific, optional — falls back to global)
```

Every arrow above is enforced at the **service layer** (not by an
IndexedDB foreign-key constraint, since IndexedDB has none) — each
entity's `remove()` method checks every table that references it and
refuses the deletion with a clear message if any real data still depends
on it. `docs/PHASE6_QA_REVIEW.md` Module 2 documents the one place this
was found to be incomplete (`TermService.remove()`, since fixed) and the
systematic re-verification of every other entity's guard.

## Version history & migration strategy

| Version | Phase | What changed |
|---|---|---|
| 1 | Phase 0 | Initial schema: school/curriculum configuration, a minimal `students` table, score/skill records, settings, backup history. |
| 2 | Phase 1 | Widened configuration tables (`isActive`/`isCurrent` flags, multi-level `*levelIds` on subjects/learning areas), extracted `gradeBands` into its own table (previously nested inside `levels`). |
| 3 | Phase 2 | Re-keyed `students` around a permanent, unique `studentId`/`admissionNumber`; removed `currentClassId`/`fullName` in favour of `enrollments` (current placement) and split name fields; added `guardians`, `enrollments`, `promotionHistory`, `studentPhotos`, `importLogs`. |
| 4 | Phase 3 | Added `assessmentSessions` (Draft→Finalized workflow) and `auditLogs`. |
| 5 | Phase 4 | Added `reportTemplates`, `templateSettings`, `generatedReports`, `reportVersions`, `printLogs`, `exportLogs` — the entire report-generation/versioning data model. |
| 6 | Phase 5 | Added `archives`, `systemLogs`, `exportHistory`, `diagnosticsSnapshots`, `performanceMetrics`; widened `backupHistory` with a `scope` field. |

**Migration rules** (unchanged since Phase 0, re-confirmed still followed
in every phase since):

- Never edit a `.version(n)` block that has already shipped — add a new
  one. Every version block above is exactly as originally written.
- Only add indexes actually queried by (`Table.where(...)`); indexing
  everything slows writes down for no benefit.
- Compound indexes (e.g. `[studentId+termId+subjectId]`) exist
  specifically to make "does this record already exist" and "get this
  student's records for this term" lookups fast instead of full scans —
  see `docs/PHASE6_QA_REVIEW.md` Module 7 for the one place this rule was
  found to have been bypassed (`ClassService.remove()`, since fixed) and
  the review of every other `.filter()` usage in the codebase confirming
  the rest were legitimate (either a non-indexable predicate, or a
  reference-data table too small to matter).
- A `.upgrade()` callback runs once, automatically, the first time an
  existing installation opens a build with a newer schema version — no
  manual migration step is ever required of a school.

## Backup modules (as of Phase 6)

`BackupService.ts` groups all 34 tables into named modules a school can
back up independently:

| Module | Tables |
|---|---|
| School Profile | `schools` |
| Academic Years, Terms, Levels & Classes | `academicYears`, `terms`, `levels`, `gradeBands`, `classes` |
| Subjects | `subjects` |
| Learning Areas & Skills (KG) | `learningAreas`, `skills` |
| Remarks Bank | `remarksBank` |
| Settings & Report Templates | `settings`, `templateSettings`, `reportTemplates` |
| Students | `students`, `guardians`, `enrollments`, `promotionHistory`, `studentPhotos` |
| Assessments | `assessmentSessions`, `scoreRecords`, `skillAssessmentRecords`, `auditLogs` |
| Reports | `reportRecords`, `generatedReports`, `reportVersions`, `printLogs`, `exportLogs` |
| Archives | `archives` |
| System Logs & Diagnostics | `systemLogs`, `exportHistory`, `importLogs`, `diagnosticsSnapshots`, `performanceMetrics` |

**`backupHistory` is the one table deliberately excluded from every
module** — it is the catalogue of backups *of* this database, and
restoring a backup's own backup-history log back into a live database
would create a confusing "history of history" chain. Every other table
is covered by a **Full Backup**; see `docs/PHASE6_QA_REVIEW.md` Module 10
for the completeness gap this corrected (five tables were previously
missing from any module) and the reasoning for why.

## Default configuration seed

`src/database/seed.ts`'s `seedDefaultConfiguration()` runs once,
automatically, on an empty database — it inserts the five levels with
their assessment modes and default grade bands, the Lower/Upper Primary
and JHS subject lists (taken from the existing Amenfi Central workbooks),
the KG1/KG2 learning areas and skills (taken from the official NaCCA
Kindergarten Assessment Tool), and a starter remarks bank. This is
editable reference data, not a fixed template — see
`docs/ADMINISTRATOR_GUIDE.md` for how a school customizes it.

## Data integrity on restore

Before committing a restored backup, `BackupService.restore()`:

1. Shows a preview of exactly what will change (record counts per table,
   and a warning wherever existing data would be replaced) before the
   administrator confirms.
2. Only ever restores from the JSON format (the one lossless, complete
   backup format — xlsx/csv exports are for external viewing only and
   are never accepted back in).
3. Runs the entire restore inside one Dexie read-write transaction per
   selected table (clear, then bulk-re-add) — if any write throws
   partway through, Dexie/IndexedDB discards the whole transaction,
   leaving the existing database exactly as it was before the restore
   was attempted.
