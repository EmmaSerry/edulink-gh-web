/**
 * Module 7 (Phase 5) - Application Diagnostics. Most diagnostics are
 * computed live (storage estimate, service worker status, etc. - see
 * DiagnosticsService.ts) and never stored. This table only keeps a
 * short history of manually-triggered "Run Diagnostics" checks so an
 * administrator can see whether e.g. storage usage is trending up
 * across visits, without ACTRS silently polling/writing in the
 * background.
 */
export interface DiagnosticsSnapshotEntry {
  id?: number;
  recordedAt: string;
  dbVersion: number;
  storageUsageBytes?: number;
  storageQuotaBytes?: number;
  serviceWorkerStatus: string;
  totalStudents: number;
  totalRecords: number;
  notes?: string;
}
