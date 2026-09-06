/**
 * Read-only access to audit_logs - assessment status-change history
 * (Draft/Completed/Verified/Finalized, and reopens), see
 * edulink_gh_phase0m_audit_log.sql for exactly what is and isn't
 * captured yet. Every row already carries its own class/term/performer
 * name (denormalized at write time), so this needs no client-side
 * joins.
 */
import { rest } from "@/lib/supabaseClient";
import type { AuditLogRow } from "@/types/database";

class CloudAuditLogServiceImpl {
  async list(limit = 300): Promise<AuditLogRow[]> {
    return rest.select<AuditLogRow>("audit_logs", {
      order: "performed_at.desc",
      limit,
    });
  }
}

export const CloudAuditLogService = new CloudAuditLogServiceImpl();
