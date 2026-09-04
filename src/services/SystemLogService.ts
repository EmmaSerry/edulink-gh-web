import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { SystemLogEntry, SystemLogModule } from "@models/SystemLog";

export interface UnifiedLogRow {
  id: string;
  module: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: string;
}

export interface UnifiedLogFilter {
  module?: string;
  action?: string;
  performedBy?: string;
  fromDate?: string;
  toDate?: string;
}

/** Thrown by the write-blocking overrides below - see AuditLogService's
 *  matching `AuditLogImmutableError` for the same rationale: a system
 *  log that can be edited or deleted after the fact isn't a log. */
export class SystemLogImmutableError extends Error {}

class SystemLogServiceImpl extends BaseRepository<SystemLogEntry> {
  constructor() {
    super(db.systemLogs);
  }

  // Phase 6 (Module 9 - security & data integrity review): same gap as
  // AuditLogService - BaseRepository publicly exposes update/remove on
  // every subclass, which would let anything holding a reference to this
  // service silently tamper with or erase the system log. Overridden only
  // here (BaseRepository itself is untouched), `create()`/`record()` are
  // unaffected.
  async update(): Promise<never> {
    throw new SystemLogImmutableError("System log entries cannot be edited - the log is permanent by design.");
  }

  async remove(): Promise<never> {
    throw new SystemLogImmutableError("System log entries cannot be deleted - the log is permanent by design.");
  }

  async record(entry: Omit<SystemLogEntry, "id" | "performedAt">): Promise<void> {
    await this.create({ ...entry, performedAt: new Date().toISOString() });
  }

  /**
   * Module 6 - System Logs & Audit. Merges every append-only log table
   * ACTRS keeps (the general `systemLogs` table plus the more specific
   * `auditLogs`, `printLogs` and `exportLogs` from Phases 3-4) into one
   * chronological, filterable feed, rather than duplicating those
   * actions into `systemLogs` too (which would risk the two logs
   * disagreeing about what happened and when).
   */
  async getUnifiedFeed(filter: UnifiedLogFilter = {}): Promise<UnifiedLogRow[]> {
    const [systemRows, auditRows, printRows, exportRows, students, sessions] = await Promise.all([
      db.systemLogs.toArray(),
      db.auditLogs.toArray(),
      db.printLogs.toArray(),
      db.exportLogs.toArray(),
      db.students.toArray(),
      db.assessmentSessions.toArray(),
    ]);

    const studentName = (studentId: number) => {
      const s = students.find((x) => x.id === studentId);
      return s ? `${s.firstName} ${s.lastName}` : `Student #${studentId}`;
    };
    const sessionLabel = (sessionId: number) => {
      const s = sessions.find((x) => x.id === sessionId);
      return s ? `class #${s.classId}, term #${s.termId}` : `session #${sessionId}`;
    };

    const rows: UnifiedLogRow[] = [
      ...systemRows.map((r) => ({
        id: `sys-${r.id}`,
        module: r.module,
        action: r.action,
        performedBy: r.performedBy,
        performedAt: r.performedAt,
        details: r.details ?? "",
      })),
      ...auditRows.map((r) => ({
        id: `audit-${r.id}`,
        module: "ASSESSMENT",
        action: r.action,
        performedBy: r.performedBy,
        performedAt: r.performedAt,
        details: `${r.details} (${sessionLabel(r.assessmentSessionId)})`,
      })),
      ...printRows.map((r) => ({
        id: `print-${r.id}`,
        module: "REPORT",
        action: "Report printed",
        performedBy: r.performedBy,
        performedAt: r.performedAt,
        details: `Printed report for ${studentName(r.studentId)}`,
      })),
      ...exportRows.map((r) => ({
        id: `export-${r.id}`,
        module: "REPORT",
        action: "Report exported to PDF",
        performedBy: r.performedBy,
        performedAt: r.performedAt,
        details: `${r.scope === "batch" ? "Batch" : "Single"} PDF export for ${studentName(r.studentId)} (${r.fileName})`,
      })),
    ];

    return rows
      .filter((r) => !filter.module || r.module === filter.module)
      .filter((r) => !filter.action || r.action.toLowerCase().includes(filter.action!.toLowerCase()))
      .filter((r) => !filter.performedBy || r.performedBy.toLowerCase().includes(filter.performedBy!.toLowerCase()))
      .filter((r) => !filter.fromDate || r.performedAt >= filter.fromDate!)
      .filter((r) => !filter.toDate || r.performedAt <= filter.toDate!)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  }

  static readonly MODULES: SystemLogModule[] = [
    "STUDENT",
    "ASSESSMENT",
    "REPORT",
    "ARCHIVE",
    "BACKUP",
    "RESTORE",
    "IMPORT",
    "EXPORT",
    "CONFIGURATION",
    "SYSTEM",
  ];
}

export const SystemLogService = new SystemLogServiceImpl();
