import { db } from "@database/db";
import type { TermArchiveEntry } from "@models/Archive";
import { SystemLogService } from "./SystemLogService";

export class TermArchivedError extends Error {
  constructor(termId: number) {
    super(`This term (#${termId}) has been archived and its records are permanently locked. Unarchive it first if this change is really necessary.`);
    this.name = "TermArchivedError";
  }
}

/**
 * Module 1 (Phase 5) - Academic Records & Archives. See Archive.ts for
 * the full rationale: archiving does not copy data into a parallel
 * table, it (a) records a summary + timestamp, and (b) is checked by
 * `assertTermEditable` from every service method that mutates per-term
 * data, so a closed term's history genuinely cannot be overwritten.
 *
 * Guarded call sites (Phase 5 additions, one line each):
 *   - ScoreRecordService.upsertField
 *   - SkillRecordService.upsertRating
 *   - ReportRecordService.upsertFields
 *   - EnrollmentService.assignClass / bulkAssignClass
 *   - AssessmentSessionService.changeStatus (reopening only)
 */
class ArchiveServiceImpl {
  async isTermArchived(termId: number): Promise<boolean> {
    const row = await db.archives.where("termId").equals(termId).first();
    return !!row && !row.unarchivedAt;
  }

  /** Throws TermArchivedError if the term is currently archived. Call
   *  this at the top of any write path that touches per-term data. */
  async assertTermEditable(termId: number): Promise<void> {
    if (await this.isTermArchived(termId)) {
      throw new TermArchivedError(termId);
    }
  }

  async getArchivedTerms(): Promise<TermArchiveEntry[]> {
    return db.archives.orderBy("archivedAt").reverse().toArray();
  }

  async getArchiveForTerm(termId: number): Promise<TermArchiveEntry | undefined> {
    return db.archives.where("termId").equals(termId).first();
  }

  /** Computes the point-in-time summary counts shown in the Archives
   *  browser and stored on the archive row - purely informational. */
  private async computeCounts(termId: number) {
    const [enrollments, generatedReports, scoreRecords, skillRecords] = await Promise.all([
      db.enrollments.where("termId").equals(termId).toArray(),
      db.generatedReports.where("termId").equals(termId).count(),
      db.scoreRecords.where("termId").equals(termId).count(),
      db.skillAssessmentRecords.where("termId").equals(termId).count(),
    ]);
    const classIds = new Set(enrollments.map((e) => e.classId));
    return {
      studentCount: enrollments.length,
      classCount: classIds.size,
      generatedReportCount: generatedReports,
      scoreRecordCount: scoreRecords,
      skillRecordCount: skillRecords,
    };
  }

  /** Permanently closes a term. Intended to be run once a term's report
   *  cards have all been generated/printed - ACTRS does not force this
   *  (a school may need to correct something at the last minute), it
   *  only warns if the term still has pending/unfinalized assessments. */
  async archiveTerm(termId: number, performedBy: string, note?: string): Promise<TermArchiveEntry> {
    const term = await db.terms.get(termId);
    if (!term) throw new Error("Term not found.");
    if (await this.isTermArchived(termId)) throw new Error("This term is already archived.");

    const counts = await this.computeCounts(termId);
    const now = new Date().toISOString();
    const existing = await db.archives.where("termId").equals(termId).first();

    const entry: Omit<TermArchiveEntry, "id"> = {
      termId,
      academicYearId: term.academicYearId,
      archivedAt: now,
      archivedBy: performedBy,
      ...counts,
      note,
    };

    if (existing?.id) {
      await db.archives.update(existing.id, { ...entry, unarchivedAt: undefined, unarchivedBy: undefined });
    } else {
      await db.archives.add(entry as TermArchiveEntry);
    }

    await SystemLogService.record({
      module: "ARCHIVE",
      action: "Term archived",
      entityType: "term",
      entityId: termId,
      performedBy,
      details: `${term.termName} closed and locked (${counts.studentCount} students, ${counts.generatedReportCount} report cards).`,
    });

    return (await db.archives.where("termId").equals(termId).first())!;
  }

  /** Explicit, logged safety valve for an accidental archive - clears
   *  the lock without deleting the archive row's history. */
  async unarchiveTerm(termId: number, performedBy: string, reason: string): Promise<void> {
    const row = await db.archives.where("termId").equals(termId).first();
    if (!row?.id) throw new Error("This term is not archived.");
    await db.archives.update(row.id, { unarchivedAt: new Date().toISOString(), unarchivedBy: performedBy });
    await SystemLogService.record({
      module: "ARCHIVE",
      action: "Term unarchived",
      entityType: "term",
      entityId: termId,
      performedBy,
      details: reason,
    });
  }
}

export const ArchiveService = new ArchiveServiceImpl();
