import { db } from "@database/db";
import { AuditLogService } from "./AuditLogService";
import { ArchiveService } from "./ArchiveService";
import type { ScoreRecord } from "@models/AssessmentRecord";

/** Persistence for Primary/JHS score entry (Module 2). Kept separate
 *  from the pure AssessmentCalculationEngine - this file is the only
 *  place that touches Dexie for scores; the engine never does. */
class ScoreRecordServiceImpl {
  async getForTerm(termId: number): Promise<ScoreRecord[]> {
    return db.scoreRecords.where("termId").equals(termId).toArray();
  }

  /** Creates or updates the one SBA/Exam cell just edited, and records an
   *  audit-trail entry against the assessment session it belongs to
   *  (Module 12 - "even in an offline system, maintain a complete audit
   *  log"). */
  async upsertField(
    studentId: number,
    termId: number,
    subjectId: number,
    field: "sbaScore" | "examScore",
    value: number | null,
    sessionId: number,
    performedBy: string,
  ): Promise<void> {
    // Phase 5 (Module 1) - a closed/archived term's scores are locked.
    await ArchiveService.assertTermEditable(termId);

    const now = new Date().toISOString();
    const existing = await db.scoreRecords
      .where("[studentId+termId+subjectId]")
      .equals([studentId, termId, subjectId])
      .first();

    if (existing?.id) {
      await db.scoreRecords.update(existing.id, { [field]: value, updatedAt: now });
    } else {
      await db.scoreRecords.add({
        studentId,
        termId,
        subjectId,
        sbaScore: field === "sbaScore" ? value : null,
        examScore: field === "examScore" ? value : null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await AuditLogService.record(
      sessionId,
      "SCORE_SAVED",
      performedBy,
      `${field === "sbaScore" ? "SBA" : "Exam"} score for subject #${subjectId}, student #${studentId} set to ${value ?? "(blank)"}`,
    );
  }
}

export const ScoreRecordService = new ScoreRecordServiceImpl();
