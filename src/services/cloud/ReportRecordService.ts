/**
 * Cloud (Supabase-backed) replacement for src/services/ReportRecordService.ts.
 *
 * upsertFields() calls the upsert_report_fields() Postgres function
 * (edulink_gh_phase0f_remarks_templates.sql), which saves only the
 * fields actually passed in and writes the audit-log entry atomically -
 * same shape as ScoreRecordService.upsertField.
 */

import { rest } from "@/lib/supabaseClient";
import type { ReportRecordRow } from "@/types/database";

class CloudReportRecordServiceImpl {
  async getForStudent(studentId: string, termId: string): Promise<ReportRecordRow | null> {
    const rows = await rest.select<ReportRecordRow>("report_records", {
      filters: { student_id: `eq.${studentId}`, term_id: `eq.${termId}` },
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async getForTerm(termId: string): Promise<ReportRecordRow[]> {
    return rest.select<ReportRecordRow>("report_records", {
      filters: { term_id: `eq.${termId}` },
    });
  }

  async upsertFields(
    studentId: string,
    termId: string,
    changes: Partial<ReportRecordRow>,
    sessionId: string
  ): Promise<ReportRecordRow> {
    return rest.rpc<ReportRecordRow>("upsert_report_fields", {
      p_student_id: studentId,
      p_term_id: termId,
      p_changes: changes,
      p_session_id: sessionId,
    });
  }
}

export const CloudReportRecordService = new CloudReportRecordServiceImpl();
