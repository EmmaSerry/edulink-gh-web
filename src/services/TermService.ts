import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Term } from "@models/Term";
import { DeletionBlockedError } from "./AcademicYearService";

class TermServiceImpl extends BaseRepository<Term> {
  constructor() {
    super(db.terms);
  }

  /** Only one term may be active system-wide at a time. */
  async setActive(id: number): Promise<void> {
    await db.transaction("rw", db.terms, async () => {
      const all = await db.terms.toArray();
      await Promise.all(all.map((t) => db.terms.update(t.id!, { isActive: t.id === id })));
    });
  }

  /**
   * Phase 6 database-integrity review (Module 2): the original check
   * here only looked at scores/skill-ratings/remarks, which left
   * enrollments, assessment sessions, generated report cards and -
   * critically - archived terms completely unchecked. A term with
   * enrolled students, or one that has already been archived, could
   * previously be deleted outright, orphaning that data or (for an
   * archived term) directly violating the "historical records can never
   * be corrupted" guarantee Phase 5's Archives module exists to provide.
   * Every table that references a term by `termId` is now checked.
   */
  async remove(id: number): Promise<void> {
    const [scores, skills, reports, enrollments, assessmentSessions, generatedReports, archived] = await Promise.all([
      db.scoreRecords.where("termId").equals(id).count(),
      db.skillAssessmentRecords.where("termId").equals(id).count(),
      db.reportRecords.where("termId").equals(id).count(),
      db.enrollments.where("termId").equals(id).count(),
      db.assessmentSessions.where("termId").equals(id).count(),
      db.generatedReports.where("termId").equals(id).count(),
      db.archives.where("termId").equals(id).count(),
    ]);
    if (archived > 0) {
      throw new DeletionBlockedError(
        "This term has been archived and its records are permanently preserved - it cannot be deleted. Unarchive it first if this is truly necessary, though this is not recommended.",
      );
    }
    if (scores + skills + reports + enrollments + assessmentSessions + generatedReports > 0) {
      throw new DeletionBlockedError(
        "This term already has enrollments, assessment records, assessment sessions or generated report cards linked to it and cannot be deleted.",
      );
    }
    await super.remove(id);
  }
}

export const TermService = new TermServiceImpl();
