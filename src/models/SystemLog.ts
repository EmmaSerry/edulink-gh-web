/**
 * Module 6 (Phase 5) - System-wide activity log, complementing (not
 * replacing) the Phase 3 `AuditLogEntry` table. AuditLogEntry is scoped
 * tightly to one assessment session (SCORE_SAVED/FINALIZED/etc. against
 * an `assessmentSessionId`) which is exactly right for the Assessment
 * workspace's own history view, but it has no sensible way to represent
 * a backup, a restore, a bulk import, or a settings change - none of
 * those belong to a session. Rather than force unrelated actions into
 * that shape, `SystemLogEntry` is a second, general-purpose append-only
 * log for everything else. The Module 6 "System Logs & Audit" viewer
 * page reads BOTH tables and merges them into one chronological,
 * filterable feed (see SystemLogService.getUnifiedFeed).
 */
export type SystemLogModule =
  | "STUDENT"
  | "ASSESSMENT"
  | "REPORT"
  | "ARCHIVE"
  | "BACKUP"
  | "RESTORE"
  | "IMPORT"
  | "EXPORT"
  | "CONFIGURATION"
  | "SYSTEM";

export interface SystemLogEntry {
  id?: number;
  module: SystemLogModule;
  /** Short verb/phrase, e.g. "Full backup created", "Subjects imported",
   *  "Grade band updated". Free text - there is deliberately no closed
   *  enum here since the range of configuration changes is open-ended. */
  action: string;
  entityType?: string;
  entityId?: number;
  performedBy: string;
  performedAt: string;
  details?: string;
}
