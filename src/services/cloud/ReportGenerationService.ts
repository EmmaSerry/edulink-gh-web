/**
 * Cloud (Supabase-backed) replacement for src/services/ReportGenerationService.ts.
 *
 * This is the "generate/freeze" step that sits on top of the already-
 * ported ReportDataService.ts. That file only ASSEMBLES a snapshot in
 * memory; nothing is saved until this file's freeze() calls the
 * freeze_report() Postgres function, which atomically (1) overwrites
 * generated_reports - the ONE current row per student+term - and (2)
 * appends an entry to report_versions, so nothing is ever silently
 * lost when a report is regenerated. See
 * edulink_gh_phase0h_report_generation.sql for the database side.
 *
 * Staleness detection is adapted, not copied verbatim: the original
 * Dexie version compared the assessment session's updatedAt timestamp
 * against the value stored on the report. The cloud schema doesn't
 * stamp assessment_sessions on every score edit, but score_records
 * already carries its own updated_at - so staleness here compares the
 * report's saved source_assessment_updated_at against the MOST RECENT
 * score_records.updated_at across the class's current roster for that
 * term. Same question ("did anything change since this was printed?"),
 * a more precise source of truth.
 */

import { rest } from "@/lib/supabaseClient";
import { CloudEnrollmentService } from "./EnrollmentService";
import { CloudReportTemplateService } from "./ReportTemplateService";
import { CloudSchoolService } from "./SchoolService";
import { validateReportPrerequisites, buildClassSnapshots, buildSnapshotForStudent } from "./ReportDataService";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { GeneratedReportRow, TermRow, ScoreRecordRow } from "@/types/database";

export interface GenerateResult {
  studentId: string;
  report?: GeneratedReportRow;
  error?: string;
}

async function latestScoreUpdateForClass(classId: string, termId: string): Promise<string | null> {
  const roster = await CloudEnrollmentService.getRoster(termId, classId);
  const studentIds = roster.map((e) => e.student_id);
  if (studentIds.length === 0) return null;
  const [latest] = await rest.select<Pick<ScoreRecordRow, "updated_at">>("score_records", {
    select: "updated_at",
    filters: { term_id: `eq.${termId}`, student_id: `in.(${studentIds.join(",")})` },
    order: "updated_at.desc",
    limit: 1,
  });
  return latest?.updated_at ?? null;
}

async function freeze(
  studentId: string,
  termId: string,
  classId: string,
  snapshot: ReportSnapshot
): Promise<GeneratedReportRow> {
  const [term] = await rest.select<TermRow>("terms", { filters: { id: `eq.${termId}` }, limit: 1 });
  const school = await CloudSchoolService.getProfile();
  const template = school ? await CloudReportTemplateService.getByCode(school.id, snapshot.templateCode) : null;
  const sourceUpdatedAt = await latestScoreUpdateForClass(classId, termId);

  return rest.rpc<GeneratedReportRow>("freeze_report", {
    p_student_id: studentId,
    p_term_id: termId,
    p_class_id: classId,
    p_academic_year_id: term?.academic_year_id ?? null,
    p_template_code: snapshot.templateCode,
    p_template_version: template?.component_version ?? 1,
    p_source_assessment_updated_at: sourceUpdatedAt,
    p_snapshot_data: snapshot as unknown as Record<string, unknown>,
  });
}

class CloudReportGenerationServiceImpl {
  /** The report currently on file for this student+term, if one has ever been generated. */
  async getCurrent(studentId: string, termId: string): Promise<GeneratedReportRow | null> {
    const rows = await rest.select<GeneratedReportRow>("generated_reports", {
      filters: { student_id: `eq.${studentId}`, term_id: `eq.${termId}` },
      limit: 1,
    });
    return rows[0] ?? null;
  }

  /** True if a score has changed since this exact report was generated. */
  async isStale(report: GeneratedReportRow): Promise<boolean> {
    const latest = await latestScoreUpdateForClass(report.class_id, report.term_id);
    if (!latest) return false;
    if (!report.source_assessment_updated_at) return true;
    return new Date(latest).getTime() > new Date(report.source_assessment_updated_at).getTime();
  }

  /**
   * Validates prerequisites, assembles the snapshot, and freezes it as
   * the current report for one student. Throws with the first
   * validation issue's message if prerequisites aren't met - callers
   * that want the full issue list should call validateReportPrerequisites
   * themselves first (e.g. to show a checklist in the UI).
   */
  async generateForStudent(studentId: string, termId: string): Promise<GeneratedReportRow> {
    const validation = await validateReportPrerequisites(studentId, termId);
    if (!validation.valid || !validation.context) {
      const message = validation.issues[0]?.message ?? "This report cannot be generated yet.";
      throw new Error(message);
    }
    const snapshot = await buildSnapshotForStudent(studentId, termId);
    return freeze(studentId, termId, validation.context.classId, snapshot);
  }

  /**
   * Batch version for a whole class. Sequential and not all-or-nothing,
   * same philosophy as EnrollmentService.bulkAssignClass - one
   * student's failed validation doesn't block the rest, and the caller
   * gets back exactly who succeeded and why anyone failed.
   */
  async generateForClass(
    classId: string,
    termId: string,
    onlyStudentIds?: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<GenerateResult[]> {
    const snapshots = await buildClassSnapshots(classId, termId);
    const studentIds = onlyStudentIds ?? Array.from(snapshots.keys());
    const results: GenerateResult[] = [];

    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      try {
        const validation = await validateReportPrerequisites(studentId, termId);
        if (!validation.valid) {
          results.push({
            studentId,
            error: validation.issues[0]?.message ?? "This report cannot be generated yet.",
          });
        } else {
          const snapshot = snapshots.get(studentId);
          if (!snapshot) throw new Error("Could not build a report snapshot for this student");
          const report = await freeze(studentId, termId, classId, snapshot);
          results.push({ studentId, report });
        }
      } catch (err) {
        results.push({ studentId, error: err instanceof Error ? err.message : "Unknown error" });
      }
      onProgress?.(i + 1, studentIds.length);
    }

    return results;
  }

  async recordPrint(studentId: string, termId: string): Promise<void> {
    await rest.rpc<void>("record_report_print", { p_student_id: studentId, p_term_id: termId });
  }

  async recordExport(studentId: string, termId: string, scope: "single" | "batch", fileName?: string): Promise<void> {
    await rest.rpc<void>("record_report_export", {
      p_student_id: studentId,
      p_term_id: termId,
      p_scope: scope,
      p_file_name: fileName ?? null,
    });
  }
}

export const CloudReportGenerationService = new CloudReportGenerationServiceImpl();
