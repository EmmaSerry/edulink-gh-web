import { db } from "@database/db";
import { EnrollmentService } from "./EnrollmentService";

export interface ClassReportSummary {
  classId: number;
  termId: number;
  levelId: number;
  totalStudents: number;
  generatedCount: number;
  pendingCount: number;
  assessmentStatus: "NOT_STARTED" | "DRAFT" | "COMPLETED" | "VERIFIED" | "FINALIZED";
}

/** Module 1/14 - report-generation progress, computed the same way for
 *  a single class row (Report Dashboard) and the whole-term aggregate
 *  (main Dashboard's "reports pending", "finalized ready for printing"). */
export async function getClassReportSummary(classId: number, termId: number, levelId: number): Promise<ClassReportSummary> {
  const roster = await EnrollmentService.getRoster(termId, classId);
  const generated = await db.generatedReports.where("[studentId+termId]").anyOf(roster.map((e) => [e.studentId, termId])).count();
  const session = await db.assessmentSessions.where("[classId+termId]").equals([classId, termId]).first();

  return {
    classId,
    termId,
    levelId,
    totalStudents: roster.length,
    generatedCount: generated,
    pendingCount: Math.max(0, roster.length - generated),
    assessmentStatus: session?.status ?? "NOT_STARTED",
  };
}

export async function getAllClassReportSummaries(termId: number): Promise<ClassReportSummary[]> {
  const classes = await db.classes.filter((c) => c.isActive).toArray();
  return Promise.all(classes.map((c) => getClassReportSummary(c.id!, termId, c.levelId)));
}

export interface ReportActivityStats {
  generatedToday: number;
  pendingTotal: number;
  finalizedClassesReadyForPrinting: number;
  lastPdfExportAt?: string;
  printsToday: number;
  exportsToday: number;
}

function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** Module 14 Dashboard enhancements - reports generated today, pending,
 *  finalized-and-ready-for-printing classes, last PDF export, and
 *  today's print/export activity, all for the given term. */
export async function getReportActivityStats(termId: number): Promise<ReportActivityStats> {
  const [summaries, todaysReports, allExports, allPrints] = await Promise.all([
    getAllClassReportSummaries(termId),
    db.generatedReports.where("termId").equals(termId).toArray(),
    db.exportLogs.where("termId").equals(termId).toArray(),
    db.printLogs.where("termId").equals(termId).toArray(),
  ]);

  const generatedToday = todaysReports.filter((r) => isToday(r.generatedAt)).length;
  const pendingTotal = summaries.reduce((sum, s) => sum + s.pendingCount, 0);
  const finalizedClassesReadyForPrinting = summaries.filter((s) => s.assessmentStatus === "FINALIZED" && s.pendingCount === 0).length;
  const lastExport = [...allExports].sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];

  return {
    generatedToday,
    pendingTotal,
    finalizedClassesReadyForPrinting,
    lastPdfExportAt: lastExport?.performedAt,
    printsToday: allPrints.filter((p) => isToday(p.performedAt)).length,
    exportsToday: allExports.filter((e) => isToday(e.performedAt)).length,
  };
}
