import * as XLSX from "xlsx";
import { db } from "@database/db";
import { getFullName } from "@models/Student";
import { ExportService, type ExportScope } from "./ExportService";
import { BackupService } from "./BackupService";
import { ArchiveService } from "./ArchiveService";
import { SystemLogService } from "./SystemLogService";
import { computeSubjectTotal, findGradeBand, resolveGradeBandsForLevel } from "./AssessmentCalculationEngine";
import { downloadBlob } from "@utils/downloadBlob";
import { sanitizeRowsForSpreadsheet } from "@utils/spreadsheetSafety";
import { getSubjectAverages, getClassAverages, getGradeBandDistribution, getPassRate } from "./AnalyticsService";
import type { DataExportType, DataExportHistoryEntry } from "@models/ExportHistory";
import type { ExportFileFormat } from "./ExportService";

/**
 * Module 3 (Phase 5) - the "Export" half of the Import & Export Centre.
 * Student-list export already existed (Phase 2's ExportService, called
 * through unchanged here); Configuration/Archives export reuse Module
 * 2's BackupService (a "configuration export" and a "full backup of
 * just the archives module" are the same operation from the data's
 * point of view - no need for a third way to serialize the same
 * tables). Assessment-sheet and Statistics exports are new, purpose-
 * built spreadsheets.
 */
function writeRows(rows: Record<string, unknown>[], sheetName: string, format: ExportFileFormat, fileNamePrefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${fileNamePrefix}-${stamp}.${format}`;
  if (format === "json") {
    downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }), fileName);
    return fileName;
  }
  const safeRows = sanitizeRowsForSpreadsheet(rows);
  const sheet = XLSX.utils.json_to_sheet(safeRows.length > 0 ? safeRows : [{ "(no rows)": "" }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  if (format === "csv") {
    downloadBlob(new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: "text/csv" }), fileName);
  } else {
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([arrayBuffer], { type: "application/octet-stream" }), fileName);
  }
  return fileName;
}

async function logExport(exportType: DataExportType, format: ExportFileFormat, fileName: string, recordCount: number, performedBy: string) {
  const entry: Omit<DataExportHistoryEntry, "id"> = {
    exportType,
    format: format as "xlsx" | "csv" | "json",
    fileName,
    recordCount,
    performedAt: new Date().toISOString(),
    performedBy,
  };
  await db.exportHistory.add(entry as DataExportHistoryEntry);
  await SystemLogService.record({
    module: "EXPORT",
    action: `${exportType} exported`,
    performedBy,
    details: `${fileName} (${recordCount} record${recordCount === 1 ? "" : "s"})`,
  });
}

class CenterExportServiceImpl {
  /** Student list export - thin wrapper around the existing Phase 2
   *  ExportService so this module logs it consistently alongside every
   *  other export type. */
  async exportStudents(scope: ExportScope, format: ExportFileFormat, performedBy: string): Promise<number> {
    const count = await ExportService.export(scope, format, "students");
    await logExport("students", format, `students-${new Date().toISOString().slice(0, 10)}.${format}`, count, performedBy);
    return count;
  }

  /** One row per student per subject: SBA, Exam, Total, Grade - the
   *  same figures the report cards print, for a class+term. */
  async exportAssessmentSheet(classId: number, termId: number, format: ExportFileFormat, performedBy: string): Promise<number> {
    const [roster, students, subjects, scores, gradeBands, cls] = await Promise.all([
      db.enrollments.where("[termId+classId]").equals([termId, classId]).toArray(),
      db.students.toArray(),
      db.subjects.toArray(),
      db.scoreRecords.where("termId").equals(termId).toArray(),
      db.gradeBands.toArray(),
      db.classes.get(classId),
    ]);
    const relevantSubjects = subjects.filter((s) => s.isActive && s.levelIds.includes(cls?.levelId ?? -1));
    const bands = resolveGradeBandsForLevel(gradeBands, cls?.levelId ?? -1);

    const rows: Record<string, unknown>[] = [];
    for (const enrollment of roster) {
      const student = students.find((s) => s.id === enrollment.studentId);
      if (!student) continue;
      const row: Record<string, unknown> = { "Student": getFullName(student), "Student ID": student.studentId };
      for (const subject of relevantSubjects) {
        const rec = scores.find((s) => s.studentId === enrollment.studentId && s.subjectId === subject.id);
        const total = rec ? computeSubjectTotal(rec.sbaScore, rec.examScore) : null;
        const band = total !== null ? findGradeBand(total, bands) : undefined;
        row[`${subject.shortName} SBA`] = rec?.sbaScore ?? "";
        row[`${subject.shortName} Exam`] = rec?.examScore ?? "";
        row[`${subject.shortName} Total`] = total ?? "";
        row[`${subject.shortName} Grade`] = band?.code ?? "";
      }
      rows.push(row);
    }

    const fileName = writeRows(rows, "Assessment Sheet", format, `assessment-sheet-class${classId}`);
    await logExport("assessment-sheet", format, fileName, rows.length, performedBy);
    return rows.length;
  }

  /** Metadata listing of generated report cards (not the PDFs
   *  themselves - see Report Cards / PDF batch export for that). */
  async exportReportsList(termId: number, format: ExportFileFormat, performedBy: string): Promise<number> {
    const [reports, students] = await Promise.all([
      db.generatedReports.where("termId").equals(termId).toArray(),
      db.students.toArray(),
    ]);
    const rows = reports.map((r) => {
      const student = students.find((s) => s.id === r.studentId);
      return {
        "Student": student ? getFullName(student) : `#${r.studentId}`,
        "Template": r.templateCode,
        "Version": r.versionNumber,
        "Generated At": r.generatedAt,
        "Generated By": r.generatedBy,
        "Print Count": r.printCount,
        "PDF Export Count": r.pdfExportCount,
      };
    });
    const fileName = writeRows(rows, "Reports", format, `reports-term${termId}`);
    await logExport("reports", format, fileName, rows.length, performedBy);
    return rows.length;
  }

  /** School-wide performance statistics for one term - subject
   *  averages, class averages, grade-band distribution and pass rate,
   *  each as its own sheet/section. */
  async exportStatistics(termId: number, format: ExportFileFormat, performedBy: string): Promise<number> {
    const [subjectAverages, classAverages, gradeBands, passRate] = await Promise.all([
      getSubjectAverages(termId),
      getClassAverages(termId),
      getGradeBandDistribution(termId),
      getPassRate(termId),
    ]);

    const rows: Record<string, unknown>[] = [
      ...subjectAverages.map((s) => ({ Section: "Subject Average", Name: s.name, Value: s.average, Students: s.studentCount })),
      ...classAverages.map((c) => ({ Section: "Class Average", Name: c.name, Value: c.average, Students: c.studentCount })),
      ...gradeBands.map((g) => ({ Section: "Grade Band Distribution", Name: g.label, Value: g.count, Students: "" })),
      { Section: "Pass Rate", Name: "Overall", Value: `${passRate.pct}%`, Students: passRate.totalCount },
    ];

    const fileName = writeRows(rows, "Statistics", format, `statistics-term${termId}`);
    await logExport("statistics", format, fileName, rows.length, performedBy);
    return rows.length;
  }

  /** Configuration export - delegates to BackupService's module
   *  grouping so this is exactly the same reliable serialization used
   *  for backups, just invoked with a fixed "everything except student/
   *  assessment/report data" module list. */
  async exportConfiguration(format: ExportFileFormat, performedBy: string): Promise<void> {
    const entry = await BackupService.exportBackup(
      ["school", "academicStructure", "subjects", "learningAreasSkills", "remarksBank", "settings"],
      format === "json" ? "json" : format,
      performedBy,
    );
    const total = Object.values(entry.recordCounts).reduce((a, b) => a + b, 0);
    await logExport("configuration", format, entry.fileName, total, performedBy);
  }

  /** Archives export - the archive index itself (which terms are
   *  closed, when, by whom, with what counts) - reuses BackupService
   *  the same way as Configuration. */
  async exportArchives(format: ExportFileFormat, performedBy: string): Promise<void> {
    const archives = await ArchiveService.getArchivedTerms();
    const fileName = writeRows(
      archives.map((a) => ({
        "Term ID": a.termId,
        "Archived At": a.archivedAt,
        "Archived By": a.archivedBy,
        "Students": a.studentCount,
        "Classes": a.classCount,
        "Reports": a.generatedReportCount,
      })),
      "Archives",
      format,
      "archives-index",
    );
    await logExport("archive", format, fileName, archives.length, performedBy);
  }

  async getHistory(): Promise<DataExportHistoryEntry[]> {
    const rows = await db.exportHistory.toArray();
    return rows.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  }
}

export const CenterExportService = new CenterExportServiceImpl();
