import type { ReportTemplateCode } from "./ReportTemplate";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";

/** Append-only history of every report ever generated for a student+term
 *  - never updated in place, never deleted (Module 13 "Report History"),
 *  mirroring the same append-only pattern `PromotionHistory` established
 *  in Phase 2. */
export interface ReportVersionEntry {
  id?: number;
  studentId: number;
  termId: number;
  versionNumber: number;
  templateCode: ReportTemplateCode;
  templateVersion: number;
  snapshotData: ReportSnapshot;
  generatedAt: string;
  generatedBy: string;
}
