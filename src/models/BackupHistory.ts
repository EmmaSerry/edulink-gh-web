/**
 * Module 2 (Phase 5) - Backup & Restore metadata. This table existed
 * from the Phase 0 foundation schema as a simple export/import log; it
 * is widened here (additive, optional fields only - nothing removed or
 * retyped) to also cover full/partial scope, format, and restore
 * outcome, rather than introducing a second parallel table for what is
 * still fundamentally "one row per backup-related action".
 */
export type BackupHistoryType = "export" | "import" | "restore";
export type BackupScope = "full" | "partial";
export type BackupFormat = "json" | "xlsx" | "csv";
export type BackupOutcome = "success" | "failed" | "rolled_back";

export interface BackupHistoryEntry {
  id?: number;
  type: BackupHistoryType;
  fileName: string;
  recordCounts: Record<string, number>;
  performedAt: string;
  notes?: string;

  // --- Phase 5 additions (all optional so pre-Phase-5 rows still satisfy
  // this interface without a data migration) ---
  /** Whether this was a full-system backup or a selected-modules one. */
  scope?: BackupScope;
  /** Which modules/tables were included, e.g. ["students","assessments"]. */
  modules?: string[];
  format?: BackupFormat;
  /** Only meaningful for type "restore". */
  outcome?: BackupOutcome;
  /** Validation/conflict messages surfaced before or during a restore. */
  issues?: string[];
  performedBy?: string;
}
