/** One row per PDF export action (Module 13 "PDF Export Count" /
 *  Module 14 "Last PDF Export"). `scope` distinguishes a single-student
 *  export from a batch (class/level/selected) export - see Module 9. */
export interface ExportLogEntry {
  id?: number;
  studentId: number;
  termId: number;
  generatedReportId?: number;
  scope: "single" | "batch";
  fileName: string;
  performedAt: string;
  performedBy: string;
}
