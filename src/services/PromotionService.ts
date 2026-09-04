import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { PromotionHistoryEntry } from "@models/PromotionHistory";
import { EnrollmentService } from "./EnrollmentService";
import type { PromotionFormValues } from "@validation/promotionSchema";

class PromotionServiceImpl extends BaseRepository<PromotionHistoryEntry> {
  constructor() {
    super(db.promotionHistory);
  }

  async getHistoryForStudent(studentId: number): Promise<PromotionHistoryEntry[]> {
    const all = await db.promotionHistory.where("studentId").equals(studentId).toArray();
    return all.sort((a, b) => b.promotionDate.localeCompare(a.promotionDate));
  }

  /**
   * Moves a student to a new level/class for a new term (Module 4).
   * Unlike EnrollmentService.assignClass (which corrects the CURRENT
   * term's placement), this always appends a new Enrollment row *and* a
   * permanent, never-edited PromotionHistoryEntry row - the historical
   * trail Module 4 requires.
   */
  async promote(studentId: number, values: PromotionFormValues): Promise<void> {
    const now = new Date().toISOString();
    const previous = await EnrollmentService.getCurrentEnrollment(studentId);

    // Same requirement as StudentService.register(): this transaction
    // must also cover every table EnrollmentService.assignClass() touches
    // internally (db.terms for the active-term/academic-year lookups,
    // db.archives for the closed-term check) - not just the tables this
    // function writes to directly. Missing either one throws the moment
    // assignClass actually reaches that code, which only a real
    // IndexedDB database enforces.
    // Array form (rather than one table per argument) - Dexie's
    // per-argument transaction() overload only accepts up to 5 tables;
    // this is at that limit already, and the array form has no cap, so
    // it won't silently break again if a 6th table is ever needed here.
    await db.transaction(
      "rw",
      [db.enrollments, db.promotionHistory, db.students, db.terms, db.archives],
      async () => {
      await EnrollmentService.assignClass(studentId, {
        termId: values.termId,
        levelId: values.toLevelId,
        classId: values.toClassId,
        enrollmentDate: values.promotionDate,
        remarks: values.remarks,
      });

      await db.promotionHistory.add({
        studentId,
        academicYearId: values.academicYearId,
        fromLevelId: previous?.levelId,
        toLevelId: values.toLevelId,
        fromClassId: previous?.classId,
        toClassId: values.toClassId,
        status: values.status,
        promotionDate: values.promotionDate,
        remarks: values.remarks,
        createdAt: now,
      });

      if (values.status === "GRADUATED") {
        await db.students.update(studentId, {
          status: "GRADUATED",
          statusReason: values.remarks || "Graduated",
          statusChangedAt: now,
          updatedAt: now,
        });
      }
    });
  }
}

export const PromotionService = new PromotionServiceImpl();
