import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import { AuditLogService } from "./AuditLogService";
import { ArchiveService } from "./ArchiveService";
import type { ReportRecord } from "@models/Report";

/** Module 10 - Teacher Remarks. Reuses ReportRecord (see the model file's
 *  doc comment for why) rather than a parallel table - one row per
 *  student per term either way. */
class ReportRecordServiceImpl extends BaseRepository<ReportRecord> {
  constructor() {
    super(db.reportRecords);
  }

  async getForStudent(studentId: number, termId: number): Promise<ReportRecord | undefined> {
    return db.reportRecords.where("[studentId+termId]").equals([studentId, termId]).first();
  }

  async getForTerm(termId: number): Promise<ReportRecord[]> {
    return db.reportRecords.where("termId").equals(termId).toArray();
  }

  /** Creates the student's report row on first use, otherwise patches
   *  just the changed field(s) - called on every remarks-field commit
   *  (debounced by the caller), and logs one audit entry per commit. */
  async upsertFields(
    studentId: number,
    termId: number,
    changes: Partial<ReportRecord>,
    sessionId: number,
    performedBy: string,
  ): Promise<void> {
    // Phase 5 (Module 1) - a closed/archived term's remarks/attendance
    // are locked.
    await ArchiveService.assertTermEditable(termId);

    const now = new Date().toISOString();
    const existing = await this.getForStudent(studentId, termId);

    if (existing?.id) {
      await db.reportRecords.update(existing.id, { ...changes, updatedAt: now });
    } else {
      await db.reportRecords.add({
        studentId,
        termId,
        ...changes,
        createdAt: now,
        updatedAt: now,
      } as ReportRecord);
    }

    await AuditLogService.record(
      sessionId,
      "REMARKS_SAVED",
      performedBy,
      `Remarks updated for student #${studentId}: ${Object.keys(changes).join(", ")}`,
    );
  }
}

export const ReportRecordService = new ReportRecordServiceImpl();
