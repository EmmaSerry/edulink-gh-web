/**
 * Module 12 - Audit Trail. Even though ACTRS has no server and no real
 * multi-user authentication yet, every meaningful assessment action is
 * still logged locally for accountability, keyed by whatever name is
 * currently set via useCurrentUser() (see src/hooks/useCurrentUser.ts).
 */
export type AuditAction =
  | "SCORE_SAVED"
  | "SKILL_RATING_SAVED"
  | "REMARKS_SAVED"
  | "STATUS_CHANGE"
  | "FINALIZED"
  | "REOPENED";

export interface AuditLogEntry {
  id?: number;
  assessmentSessionId: number;
  action: AuditAction;
  performedBy: string;
  performedAt: string;
  /** Free-text detail, e.g. "Status changed from DRAFT to COMPLETED" or
   *  "12 score(s) updated for English Language". */
  details: string;
}
