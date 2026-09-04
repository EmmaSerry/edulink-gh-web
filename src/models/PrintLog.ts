/** One row per print action (Module 13 "Print Count" / Module 14 "Print
 *  Statistics"). `generatedReportId` links back to the report version
 *  that was current at print time. */
export interface PrintLogEntry {
  id?: number;
  studentId: number;
  termId: number;
  generatedReportId?: number;
  performedAt: string;
  performedBy: string;
}
