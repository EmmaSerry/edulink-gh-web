import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Enrollment } from "@models/Enrollment";
import { ArchiveService } from "./ArchiveService";

class EnrollmentServiceImpl extends BaseRepository<Enrollment> {
  constructor() {
    super(db.enrollments);
  }

  /** The student's current placement - the enrollment flagged isCurrent,
   *  falling back to the most recent by enrollment date if that flag is
   *  ever out of sync (defensive; should not normally happen). */
  async getCurrentEnrollment(studentId: number): Promise<Enrollment | undefined> {
    const current = await db.enrollments
      .where("studentId")
      .equals(studentId)
      .filter((e) => e.isCurrent)
      .first();
    if (current) return current;
    const all = await db.enrollments.where("studentId").equals(studentId).toArray();
    return all.sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate))[0];
  }

  async getHistoryForStudent(studentId: number): Promise<Enrollment[]> {
    const all = await db.enrollments.where("studentId").equals(studentId).toArray();
    return all.sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate));
  }

  /** Class roster for a specific term (Module 12 Class Lists). */
  async getRoster(termId: number, classId: number): Promise<Enrollment[]> {
    return db.enrollments.where("[termId+classId]").equals([termId, classId]).toArray();
  }

  /**
   * Assigns/reassigns a student's class for a given term (Module 3).
   * "One active class per academic term" is enforced by the unique
   * compound index `&[studentId+termId]` - if a row for this student and
   * term already exists, this UPDATES it in place (a same-term class
   * reassignment/correction); otherwise it creates a new row. Moving a
   * student to a *different term/year* (a promotion) should go through
   * PromotionService instead, which also records permanent history.
   */
  async assignClass(
    studentId: number,
    values: { termId: number; levelId: number; classId: number; enrollmentDate: string; remarks?: string },
  ): Promise<number> {
    // Phase 5 (Module 1) - cannot (re)assign a class within a closed/
    // archived term.
    await ArchiveService.assertTermEditable(values.termId);

    const now = new Date().toISOString();
    const activeTerm = await db.terms.filter((t) => t.isActive).first();
    const isCurrent = activeTerm?.id === values.termId;

    // The transaction's table list must cover every table touched by
    // ANYTHING inside it, not just the enrollments writes below - Dexie
    // throws at runtime if code running inside an active transaction
    // ever touches a table not declared up front, even a plain read.
    // db.terms.get() further down (needed to resolve academicYearId
    // for a brand-new enrollment row) was missing from this scope,
    // which threw - silently, generically, and specifically for the
    // most common case: assigning a class to a student who doesn't
    // already have an enrollment row for that term yet (e.g. every
    // newly bulk-imported or newly registered student). See the same
    // bug class already fixed in StudentService.register().
    return db.transaction("rw", db.enrollments, db.terms, async () => {
      const existing = await db.enrollments
        .where("[studentId+termId]")
        .equals([studentId, values.termId])
        .first();

      if (isCurrent) {
        // Only one enrollment per student may be "current" at a time.
        await db.enrollments
          .where("studentId")
          .equals(studentId)
          .filter((e) => e.isCurrent && e.id !== existing?.id)
          .modify({ isCurrent: false });
      }

      if (existing?.id) {
        await db.enrollments.update(existing.id, {
          levelId: values.levelId,
          classId: values.classId,
          enrollmentDate: values.enrollmentDate,
          remarks: values.remarks,
          isCurrent,
          updatedAt: now,
        });
        return existing.id;
      }

      return db.enrollments.add({
        studentId,
        academicYearId: (await db.terms.get(values.termId))?.academicYearId ?? 0,
        termId: values.termId,
        levelId: values.levelId,
        classId: values.classId,
        enrollmentDate: values.enrollmentDate,
        status: "ACTIVE",
        isCurrent,
        remarks: values.remarks,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  /** Sequential rather than one all-or-nothing transaction, so one
   *  student's failure (e.g. an archived term) doesn't roll back
   *  assignments that already succeeded, and so the caller can report
   *  exactly which students failed and why instead of a single generic
   *  error covering the whole batch. */
  async bulkAssignClass(
    studentIds: number[],
    values: { termId: number; levelId: number; classId: number; enrollmentDate: string; remarks?: string },
  ): Promise<{ succeeded: number[]; failed: Array<{ studentId: number; message: string }> }> {
    const succeeded: number[] = [];
    const failed: Array<{ studentId: number; message: string }> = [];
    for (const studentId of studentIds) {
      try {
        await this.assignClass(studentId, values);
        succeeded.push(studentId);
      } catch (err) {
        failed.push({ studentId, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    return { succeeded, failed };
  }
}

export const EnrollmentService = new EnrollmentServiceImpl();
