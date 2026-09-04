import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { AuditAction, AuditLogEntry } from "@models/AuditLog";

/** Thrown by the write-blocking overrides below - an audit trail that can
 *  be edited or deleted after the fact isn't an audit trail. */
export class AuditLogImmutableError extends Error {}

class AuditLogServiceImpl extends BaseRepository<AuditLogEntry> {
  constructor() {
    super(db.auditLogs);
  }

  // Phase 6 (Module 9 - security & data integrity review): `BaseRepository`
  // publicly exposes `update`/`remove` on every subclass, which for a log
  // table defeats the entire point of keeping an audit trail - anything
  // with a reference to this service could otherwise tamper with or erase
  // history. Overridden here (only in this narrow subclass, not in the
  // shared `BaseRepository`) so every entry, once written by `record()`,
  // is permanent. `create()` deliberately still works - it's how
  // `record()` itself writes.
  async update(): Promise<never> {
    throw new AuditLogImmutableError("Audit log entries cannot be edited - the audit trail is permanent by design.");
  }

  async remove(): Promise<never> {
    throw new AuditLogImmutableError("Audit log entries cannot be deleted - the audit trail is permanent by design.");
  }

  async record(assessmentSessionId: number, action: AuditAction, performedBy: string, details: string): Promise<void> {
    await this.create({
      assessmentSessionId,
      action,
      performedBy,
      performedAt: new Date().toISOString(),
      details,
    });
  }

  async getForSession(assessmentSessionId: number): Promise<AuditLogEntry[]> {
    const all = await db.auditLogs.where("assessmentSessionId").equals(assessmentSessionId).toArray();
    return all.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  }
}

export const AuditLogService = new AuditLogServiceImpl();
