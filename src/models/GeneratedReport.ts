import type { ReportTemplateCode } from "./ReportTemplate";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";

/**
 * The CURRENT generated report for one student+term - one row per
 * `[studentId+termId]` (unique). Regenerating overwrites this row's
 * snapshot/version fields but the previous snapshot is preserved
 * separately in `ReportVersionEntry` (append-only), per Module 13.
 *
 * `sourceAssessmentUpdatedAt` is the AssessmentSession's `updatedAt` at
 * the moment this snapshot was built - the Report Dashboard compares it
 * against the session's CURRENT `updatedAt` to detect "the assessment
 * was reopened/edited since this report was generated" and prompt
 * regeneration, without needing to diff the actual score data.
 */
export interface GeneratedReport {
  id?: number;
  studentId: number;
  termId: number;
  academicYearId: number;
  classId: number;
  templateCode: ReportTemplateCode;
  templateVersion: number;
  versionNumber: number;
  snapshotData: ReportSnapshot;
  sourceAssessmentUpdatedAt: string;
  generatedAt: string;
  generatedBy: string;
  printCount: number;
  pdfExportCount: number;
  lastPrintedAt?: string;
  lastExportedAt?: string;
  createdAt: string;
  updatedAt: string;
}
