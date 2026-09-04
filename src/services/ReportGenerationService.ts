import { db } from "@database/db";
import { validateReportPrerequisites, buildClassSnapshots, type ReportValidationResult } from "./ReportDataService";
import { ArchiveService } from "./ArchiveService";
import { recordPerformanceMetric } from "./PerformanceMetricService";
import { ReportTemplateService } from "./ReportTemplateService";
import type { GeneratedReport } from "@models/GeneratedReport";

export interface GenerateResult {
  studentId: number;
  success: boolean;
  report?: GeneratedReport;
  validation?: ReportValidationResult;
}

/**
 * Orchestrates Modules 9 & 13: turning a validated snapshot into a
 * persisted `GeneratedReport` (the CURRENT row for that student+term)
 * plus an append-only `ReportVersionEntry`, and recording print/export
 * actions. This is the only place that writes to `generatedReports` /
 * `reportVersions` / `printLogs` / `exportLogs` - the Preview, Dashboard
 * and batch-generation UI all call through here rather than touching
 * those tables directly.
 */
class ReportGenerationServiceImpl {
  async getCurrent(studentId: number, termId: number): Promise<GeneratedReport | undefined> {
    return db.generatedReports.where("[studentId+termId]").equals([studentId, termId]).first();
  }

  /** True when the assessment for this student's class+term has changed
   *  (reopened/re-edited) since the CURRENT report was generated -
   *  Module 13's "unless the assessment has been officially reopened"
   *  regeneration trigger. */
  async isStale(report: GeneratedReport): Promise<boolean> {
    const enrollment = await db.enrollments.where("[studentId+termId]").equals([report.studentId, report.termId]).first();
    if (!enrollment) return true;
    const session = await db.assessmentSessions.where("[classId+termId]").equals([enrollment.classId, report.termId]).first();
    if (!session) return true;
    return session.updatedAt !== report.sourceAssessmentUpdatedAt;
  }

  /** Generates (or regenerates) one student's report, validating first.
   *  On success this OVERWRITES the current `GeneratedReport` row for
   *  this student+term and appends a new `ReportVersionEntry` - the
   *  previous snapshot is never lost, only superseded. */
  async generateForStudent(studentId: number, termId: number, performedBy: string): Promise<GenerateResult> {
    // Phase 5 (Module 1) - a closed/archived term's report cards are
    // frozen; re-generating (as opposed to reprinting the existing
    // frozen version, which does not go through this method) is blocked.
    if (await ArchiveService.isTermArchived(termId)) {
      return {
        studentId,
        success: false,
        validation: {
          valid: false,
          issues: [{
            code: "TERM_ARCHIVED",
            message: "This term has been archived - reports are frozen. Reopen the term first if regeneration is really necessary.",
          }],
        },
      };
    }

    const validation = await validateReportPrerequisites(studentId, termId);
    if (!validation.valid || !validation.context) {
      return { studentId, success: false, validation };
    }

    const snapshots = await buildClassSnapshots(validation.context.classId, termId);
    const snapshot = snapshots.get(studentId);
    if (!snapshot) {
      return {
        studentId,
        success: false,
        validation: { valid: false, issues: [{ code: "SNAPSHOT_FAILED", message: "Could not build report data." }] },
      };
    }

    const template = await ReportTemplateService.getByCode(validation.context.templateCode);
    const session = await db.assessmentSessions
      .where("[classId+termId]")
      .equals([validation.context.classId, termId])
      .first();
    const enrollment = await db.enrollments.where("[studentId+termId]").equals([studentId, termId]).first();

    const now = new Date().toISOString();
    const existing = await this.getCurrent(studentId, termId);
    const versionNumber = (existing?.versionNumber ?? 0) + 1;

    const reportPayload: Omit<GeneratedReport, "id"> = {
      studentId,
      termId,
      academicYearId: enrollment?.academicYearId ?? 0,
      classId: validation.context.classId,
      templateCode: validation.context.templateCode,
      templateVersion: template?.componentVersion ?? 1,
      versionNumber,
      snapshotData: snapshot,
      sourceAssessmentUpdatedAt: session?.updatedAt ?? now,
      generatedAt: now,
      generatedBy: performedBy,
      printCount: existing?.printCount ?? 0,
      pdfExportCount: existing?.pdfExportCount ?? 0,
      lastPrintedAt: existing?.lastPrintedAt,
      lastExportedAt: existing?.lastExportedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db.transaction("rw", db.generatedReports, db.reportVersions, async () => {
      if (existing?.id) {
        await db.generatedReports.update(existing.id, reportPayload);
      } else {
        await db.generatedReports.add(reportPayload);
      }
      await db.reportVersions.add({
        studentId,
        termId,
        versionNumber,
        templateCode: validation.context!.templateCode,
        templateVersion: reportPayload.templateVersion,
        snapshotData: snapshot,
        generatedAt: now,
        generatedBy: performedBy,
      });
    });

    const saved = await this.getCurrent(studentId, termId);
    return { studentId, success: true, report: saved };
  }

  /** Module 9 - batch generation for every currently-enrolled student in
   *  a class, or a specific subset (`onlyStudentIds`). Validation
   *  failures are collected per-student rather than aborting the whole
   *  batch, so one incomplete student never blocks the rest of the
   *  class. */
  async generateForClass(
    classId: number,
    termId: number,
    performedBy: string,
    onlyStudentIds?: number[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<GenerateResult[]> {
    const startedAt = performance.now();
    const roster = (await db.enrollments.where("[termId+classId]").equals([termId, classId]).toArray()).map((e) => e.studentId);
    const targetIds = onlyStudentIds ? roster.filter((id) => onlyStudentIds.includes(id)) : roster;

    const results: GenerateResult[] = [];
    for (let i = 0; i < targetIds.length; i++) {
      results.push(await this.generateForStudent(targetIds[i], termId, performedBy));
      onProgress?.(i + 1, targetIds.length);
    }
    void recordPerformanceMetric("BATCH_REPORT_GENERATION_MS", performance.now() - startedAt, `${targetIds.length} students`);
    return results;
  }

  async recordPrint(studentId: number, termId: number, performedBy: string): Promise<void> {
    const now = new Date().toISOString();
    const current = await this.getCurrent(studentId, termId);
    if (current?.id) {
      await db.generatedReports.update(current.id, {
        printCount: current.printCount + 1,
        lastPrintedAt: now,
        updatedAt: now,
      });
    }
    await db.printLogs.add({ studentId, termId, generatedReportId: current?.id, performedAt: now, performedBy });
  }

  async recordExport(
    studentId: number,
    termId: number,
    performedBy: string,
    scope: "single" | "batch",
    fileName: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const current = await this.getCurrent(studentId, termId);
    if (current?.id) {
      await db.generatedReports.update(current.id, {
        pdfExportCount: current.pdfExportCount + 1,
        lastExportedAt: now,
        updatedAt: now,
      });
    }
    await db.exportLogs.add({ studentId, termId, generatedReportId: current?.id, scope, fileName, performedAt: now, performedBy });
  }
}

export const ReportGenerationService = new ReportGenerationServiceImpl();
