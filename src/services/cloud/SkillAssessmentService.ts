/**
 * Cloud (Supabase-backed) replacement for the offline app's KG skill
 * rating entry. upsertRating() calls upsert_skill_rating()
 * (edulink_gh_phase0j_skill_assessment.sql), which saves the rating AND
 * writes its audit-log entry atomically - the KG equivalent of
 * ScoreRecordService.upsertField.
 */
import { rest } from "@/lib/supabaseClient";
import type { SkillAssessmentRecordRow, SkillRating } from "@/types/database";

class CloudSkillAssessmentServiceImpl {
  async getForTerm(termId: string): Promise<SkillAssessmentRecordRow[]> {
    return rest.select<SkillAssessmentRecordRow>("skill_assessment_records", {
      filters: { term_id: `eq.${termId}` },
    });
  }

  async upsertRating(
    studentId: string,
    termId: string,
    skillId: string,
    rating: SkillRating | null,
    comment: string | null,
    sessionId: string
  ): Promise<SkillAssessmentRecordRow> {
    return rest.rpc<SkillAssessmentRecordRow>("upsert_skill_rating", {
      p_student_id: studentId,
      p_term_id: termId,
      p_skill_id: skillId,
      p_rating: rating,
      p_comment: comment,
      p_session_id: sessionId,
    });
  }
}

export const CloudSkillAssessmentService = new CloudSkillAssessmentServiceImpl();
