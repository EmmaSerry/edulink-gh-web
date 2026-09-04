/**
 * Module 1 (Phase 5) - Academic Records & Archives.
 *
 * ACTRS already keeps most historical data append-only by construction:
 * Enrollment/PromotionHistory rows are never edited after the fact
 * (Phase 2), and GeneratedReport/ReportVersionEntry are frozen snapshots
 * that are only ever superseded, never overwritten in place (Phase 4).
 * So "permanently archiving a term" does NOT mean copying all of that
 * data into a second, parallel set of tables - that would just create a
 * second source of truth that could drift from the original. Instead,
 * archiving a term:
 *
 *   1. Writes one `TermArchiveEntry` marking that term CLOSED, with a
 *      point-in-time summary (counts) for the Archives browser to show
 *      without re-scanning every table.
 *   2. Causes `ArchiveService.assertTermEditable()` to start rejecting
 *      writes for that term from every place that mutates per-term data
 *      (score/skill entry, remarks/attendance, class assignment,
 *      reopening a finalized assessment) - see ArchiveService.ts for the
 *      full list of guarded call sites. This is what actually delivers
 *      "historical records must never be overwritten".
 *
 * Viewing/reprinting an archived report card, or comparing academic
 * years, both read the EXISTING live tables (generatedReports,
 * reportVersions, enrollments, promotionHistory, reportRecords) filtered
 * by the archived term/year - there is nothing extra to keep in sync.
 */
export interface TermArchiveEntry {
  id?: number;
  termId: number;
  academicYearId: number;
  archivedAt: string;
  archivedBy: string;
  /** Point-in-time counts, purely informational (never used for
   *  validation - the live tables remain the source of truth). */
  studentCount: number;
  classCount: number;
  generatedReportCount: number;
  scoreRecordCount: number;
  skillRecordCount: number;
  note?: string;
  /** Set if an administrator later reverses an accidental archive. This
   *  is a deliberate, logged safety valve - not a routine action. Once
   *  cleared, the term is editable again. */
  unarchivedAt?: string;
  unarchivedBy?: string;
}
