/**
 * Cloud (Supabase-backed) replacement for src/services/ScoreRecordService.ts.
 *
 * upsertField() is now one call to the upsert_score() Postgres function
 * (edulink_gh_phase0e_scores.sql), which saves the score AND writes its
 * audit-log entry in the same atomic operation - previously two
 * separate Dexie writes that could, in principle, succeed/fail
 * independently.
 */

import { rest } from "@/lib/supabaseClient";
import type { ScoreRecordRow } from "@/types/database";

export type ScoreField = "sbaScore" | "examScore";

const FIELD_TO_COLUMN: Record<ScoreField, "sba_score" | "exam_score"> = {
  sbaScore: "sba_score",
  examScore: "exam_score",
};

class CloudScoreRecordServiceImpl {
  async getForTerm(termId: string): Promise<ScoreRecordRow[]> {
    return rest.select<ScoreRecordRow>("score_records", {
      filters: { term_id: `eq.${termId}` },
    });
  }

  async upsertField(
    studentId: string,
    termId: string,
    subjectId: string,
    field: ScoreField,
    value: number | null,
    sessionId: string
  ): Promise<ScoreRecordRow> {
    return rest.rpc<ScoreRecordRow>("upsert_score", {
      p_student_id: studentId,
      p_term_id: termId,
      p_subject_id: subjectId,
      p_field: FIELD_TO_COLUMN[field],
      p_value: value,
      p_session_id: sessionId,
    });
  }
}

export const CloudScoreRecordService = new CloudScoreRecordServiceImpl();
