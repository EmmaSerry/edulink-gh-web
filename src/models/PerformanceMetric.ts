/**
 * Module 8 (Phase 5) - Performance Optimization. Lightweight,
 * best-effort local instrumentation (never sent anywhere) so an
 * administrator/developer can see real timings on real school hardware
 * rather than guessing. Kept intentionally simple - a handful of
 * recorded durations, not a full telemetry pipeline.
 */
export type PerformanceMetricName =
  | "APP_STARTUP_MS"
  | "GLOBAL_SEARCH_MS"
  | "REPORT_GENERATION_MS"
  | "PDF_GENERATION_MS"
  | "BATCH_REPORT_GENERATION_MS";

export interface PerformanceMetricEntry {
  id?: number;
  metric: PerformanceMetricName;
  durationMs: number;
  /** Optional context, e.g. "35 students" for a batch run. */
  context?: string;
  recordedAt: string;
}
