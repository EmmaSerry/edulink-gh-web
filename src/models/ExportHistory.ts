/**
 * Module 3 (Phase 5) - Import & Export Centre. Distinct from Phase 4's
 * `ExportLogEntry` (which logs a single student's report-PDF export).
 * This logs runs of the *centre's* bulk exports - student lists,
 * assessment sheets, statistics, configuration, archives - each of
 * which can cover many records in one file.
 */
export type DataExportType =
  | "students"
  | "assessment-sheet"
  | "reports"
  | "statistics"
  | "configuration"
  | "archive";

export interface DataExportHistoryEntry {
  id?: number;
  exportType: DataExportType;
  format: "xlsx" | "csv" | "json";
  fileName: string;
  recordCount: number;
  performedAt: string;
  performedBy: string;
}
