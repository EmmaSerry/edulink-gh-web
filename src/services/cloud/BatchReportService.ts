/**
 * Fast whole-class report generation.
 *
 * The old route (ReportGenerationService.generateForClass) re-ran the full
 * single-student checks and re-fetched the term, school, template and score
 * timestamps for EVERY learner - dozens of requests per learner. This version
 * fetches all of that ONCE for the class, checks every learner in memory, and
 * saves the reports a few at a time. PDF files are no longer rendered during
 * generation at all - they are made only when someone asks for one.
 */
import { rest } from "@/lib/supabaseClient";
import { CloudSchoolService } from "./SchoolService";
import { CloudReportTemplateService } from "./ReportTemplateService";
import { CloudReportRecordService } from "./ReportRecordService";
import { buildClassSnapshots, type ReportValidationIssue } from "./ReportDataService";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { ClassRow, LevelRow, TermRow, GeneratedReportRow, ScoreRecordRow } from "@/types/database";

export interface BatchItem {
  studentId: string;
  name: string;
  report: GeneratedReportRow;
  snapshot: ReportSnapshot;
}

export interface BatchFailure {
  studentId: string;
  name: string;
  error: string;
}

export interface BatchResult {
  items: BatchItem[];
  failed: BatchFailure[];
}

async function runPool<T>(list: T[], size: number, fn: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, list.length) }, async () => {
    while (next < list.length) {
      const i = next;
      next += 1;
      await fn(list[i], i);
    }
  });
  await Promise.all(workers);
}

class BatchReportServiceImpl {
  async generateClass(
    classId: string,
    termId: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<BatchResult> {
    // 1. Everything about the class, built once.
    const snapshots = await buildClassSnapshots(classId, termId);
    const studentIds = Array.from(snapshots.keys());
    const total = studentIds.length;
    if (total === 0) return { items: [], failed: [] };
    onProgress?.(0, total);

    const first = snapshots.get(studentIds[0]) as ReportSnapshot;
    const templateCode = first.templateCode;

    // 2. Shared lookups, fetched once.
    const [[cls], [term], school, records] = await Promise.all([
      rest.select<ClassRow>("classes", { filters: { id: `eq.${classId}` }, limit: 1 }),
      rest.select<TermRow>("terms", { filters: { id: `eq.${termId}` }, limit: 1 }),
      CloudSchoolService.getProfile(),
      CloudReportRecordService.getForStudents(termId, studentIds),
    ]);
    const [level] = cls
      ? await rest.select<LevelRow>("levels", { filters: { id: `eq.${cls.level_id}` }, limit: 1 })
      : [undefined];
    const [session] = await rest.select<{ status: string }>("assessment_sessions", {
      select: "status",
      filters: { class_id: `eq.${classId}`, term_id: `eq.${termId}` },
      limit: 1,
    });
    const template = school ? await CloudReportTemplateService.getByCode(school.id, templateCode) : null;
    const [latest] = await rest.select<Pick<ScoreRecordRow, "updated_at">>("score_records", {
      select: "updated_at",
      filters: { term_id: `eq.${termId}`, student_id: `in.(${studentIds.join(",")})` },
      order: "updated_at.desc",
      limit: 1,
    });
    const sourceUpdatedAt = latest?.updated_at ?? null;
    const recordByStudent = new Map(records.map((r) => [r.student_id, r]));
    const isKg = level?.assessment_mode === "skill-checklist";

    // 3. Class-wide problems (same for everyone in the class).
    const shared: ReportValidationIssue[] = [];
    if (!session || session.status !== "FINALIZED") {
      shared.push({
        code: "ASSESSMENT_NOT_FINALIZED",
        message: "This class's assessment for the selected term has not been finalized yet.",
      });
    }
    if (!templateCode) {
      shared.push({
        code: "NO_TEMPLATE_MAPPED",
        message:
          "No report template is mapped to this student's level yet - configure one under Settings - Report Templates.",
      });
    }
    if (!term?.vacation_date || !term?.reopening_date || !term?.total_school_days) {
      shared.push({
        code: "INCOMPLETE_TERM",
        message: "This term's vacation date, reopening date or total school days are not fully configured.",
      });
    }
    if (!school?.name || !school?.school_code) {
      shared.push({
        code: "INCOMPLETE_SCHOOL_INFO",
        message: "School information is not fully configured yet - see School Setup.",
      });
    }

    // 4. Per-learner checks, in memory.
    const issuesFor = (studentId: string): ReportValidationIssue[] => {
      const issues: ReportValidationIssue[] = [];
      const rec = recordByStudent.get(studentId);
      if (isKg) {
        if (!rec?.general_comment?.trim()) {
          issues.push({ code: "MISSING_REMARKS", message: "The General Progress Comment has not been entered yet." });
        }
      } else if (!rec?.class_teacher_remark?.trim()) {
        issues.push({ code: "MISSING_REMARKS", message: "The Class Teacher's Remark has not been entered yet." });
      }
      if (rec?.days_present === undefined || rec?.days_present === null) {
        issues.push({ code: "MISSING_ATTENDANCE", message: "Attendance (days present) has not been recorded yet." });
      }
      // Promotion/progression is only decided at the end of the year (Term 3).
      if (term?.term_number === 3 && !rec?.progression?.trim()) {
        issues.push({
          code: "MISSING_PROMOTION",
          message: isKg
            ? "The Progression decision has not been entered yet."
            : "The Promotion decision has not been entered yet.",
        });
      }
      return [...issues, ...shared];
    };

    const items: BatchItem[] = [];
    const failed: BatchFailure[] = [];
    const ready: string[] = [];
    for (const id of studentIds) {
      const snap = snapshots.get(id) as ReportSnapshot;
      const issues = issuesFor(id);
      if (issues.length > 0) {
        failed.push({ studentId: id, name: snap.student.fullName, error: issues[0].message });
      } else {
        ready.push(id);
      }
    }
    let done = failed.length;
    onProgress?.(done, total);

    // 5. Save the reports, several at a time.
    await runPool(ready, 5, async (id) => {
      const snap = snapshots.get(id) as ReportSnapshot;
      try {
        const report = await rest.rpc<GeneratedReportRow>("freeze_report", {
          p_student_id: id,
          p_term_id: termId,
          p_class_id: classId,
          p_academic_year_id: term?.academic_year_id ?? null,
          p_template_code: snap.templateCode,
          p_template_version: template?.component_version ?? 1,
          p_source_assessment_updated_at: sourceUpdatedAt,
          p_snapshot_data: snap as unknown as Record<string, unknown>,
        });
        items.push({ studentId: id, name: snap.student.fullName, report, snapshot: snap });
      } catch (err) {
        failed.push({
          studentId: id,
          name: snap.student.fullName,
          error: err instanceof Error ? err.message : "Could not save this report.",
        });
      }
      done += 1;
      onProgress?.(done, total);
    });

    items.sort((a, b) => a.name.localeCompare(b.name));
    failed.sort((a, b) => a.name.localeCompare(b.name));
    return { items, failed };
  }
}

export const BatchReportService = new BatchReportServiceImpl();
