import { db } from "@database/db";
import { AuditLogService } from "./AuditLogService";
import { ArchiveService } from "./ArchiveService";
import type { ProficiencyRating, SkillAssessmentRecord } from "@models/AssessmentRecord";

/** Persistence for KG skill ratings (Module 8). Mirrors ScoreRecordService
 *  but for the skill-checklist mode - Gold/Silver/Bronze/X/O plus an
 *  optional per-skill comment, never a score or calculation. */
class SkillRecordServiceImpl {
  async getForTerm(termId: number): Promise<SkillAssessmentRecord[]> {
    return db.skillAssessmentRecords.where("termId").equals(termId).toArray();
  }

  async upsertRating(
    studentId: number,
    termId: number,
    skillId: number,
    rating: ProficiencyRating | null,
    comment: string | undefined,
    sessionId: number,
    performedBy: string,
  ): Promise<void> {
    // Phase 5 (Module 1) - a closed/archived term's ratings are locked.
    await ArchiveService.assertTermEditable(termId);

    const now = new Date().toISOString();
    const existing = await db.skillAssessmentRecords
      .where("[studentId+termId+skillId]")
      .equals([studentId, termId, skillId])
      .first();

    if (existing?.id) {
      await db.skillAssessmentRecords.update(existing.id, { rating, comment, updatedAt: now });
    } else {
      await db.skillAssessmentRecords.add({
        studentId,
        termId,
        skillId,
        rating,
        comment,
        createdAt: now,
        updatedAt: now,
      });
    }

    await AuditLogService.record(
      sessionId,
      "SKILL_RATING_SAVED",
      performedBy,
      `Rating for skill #${skillId}, student #${studentId} set to ${rating ?? "(cleared)"}`,
    );
  }
}

export const SkillRecordService = new SkillRecordServiceImpl();
