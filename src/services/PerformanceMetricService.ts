import { db } from "@database/db";
import type { PerformanceMetricEntry, PerformanceMetricName } from "@models/PerformanceMetric";

/**
 * Module 8 (Phase 5) - Performance Optimization. Best-effort, fire-and-
 * forget local timing capture (see PerformanceMetric.ts's doc comment -
 * this is intentionally lightweight, never blocking the operation being
 * measured, and never thrown from). Read back via
 * DiagnosticsService/the Diagnostics page's history, or directly from
 * the `performanceMetrics` table.
 */
export async function recordPerformanceMetric(metric: PerformanceMetricName, durationMs: number, context?: string): Promise<void> {
  try {
    const entry: Omit<PerformanceMetricEntry, "id"> = {
      metric,
      durationMs: Math.round(durationMs),
      context,
      recordedAt: new Date().toISOString(),
    };
    await db.performanceMetrics.add(entry as PerformanceMetricEntry);
  } catch {
    // Never let instrumentation failure affect the actual operation.
  }
}

export async function getRecentPerformanceMetrics(metric?: PerformanceMetricName, limit = 20): Promise<PerformanceMetricEntry[]> {
  const rows = metric ? await db.performanceMetrics.where("metric").equals(metric).toArray() : await db.performanceMetrics.toArray();
  return rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, limit);
}
