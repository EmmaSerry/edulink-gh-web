import { useEffect, useMemo, useState } from "react";
import { CloudAuditLogService } from "@services/cloud/AuditLogService";
import { downloadCsv } from "@/lib/csvExport";
import type { AuditLogRow } from "@/types/database";

const ACTION_BADGE: Record<AuditLogRow["action"], string> = {
  STATUS_CHANGE: "bg-secondary",
  FINALIZED: "bg-success",
  REOPENED: "bg-warning text-dark",
};

const ACTION_LABEL: Record<AuditLogRow["action"], string> = {
  STATUS_CHANGE: "Status change",
  FINALIZED: "Finalized",
  REOPENED: "Reopened",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Settings-adjacent, admin-only screen (see RequireAdmin in App.tsx) -
 * "who moved this class's assessment through the workflow, and when."
 * Scoped to what audit_logs actually records today: assessment status
 * changes, not every mutation in the system - see
 * edulink_gh_phase0m_audit_log.sql for the reasoning.
 */
export function CloudAuditLog() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    CloudAuditLogService.list()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the audit log."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.class_name, r.term_name, r.performed_by_name, r.detail, ACTION_LABEL[r.action]]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [rows, query]);

  return (
    <div>
      <h1 className="h4 mb-1">Audit log</h1>
      <p className="text-muted mb-4">
        Every time a class's assessment moved through Draft → Completed → Verified → Finalized, or was reopened -
        who did it, and when.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 360 }}
          placeholder="Search by class, term, or staff name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline-secondary text-nowrap"
          disabled={filtered.length === 0}
          onClick={() =>
            downloadCsv(
              "audit-log.csv",
              ["When", "Action", "Class", "Term", "Detail", "By"],
              filtered.map((r) => [
                formatWhen(r.performed_at),
                ACTION_LABEL[r.action],
                r.class_name ?? "",
                r.term_name ?? "",
                r.detail ?? "",
                r.performed_by_name ?? "",
              ])
            )
          }
        >
          <i className="bi bi-download me-1" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted">No matching entries yet.</p>
      ) : (
        <div className="actrs-card p-0">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Class</th>
                <th>Term</th>
                <th>Detail</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="text-nowrap small">{formatWhen(r.performed_at)}</td>
                  <td>
                    <span className={`badge ${ACTION_BADGE[r.action]}`}>{ACTION_LABEL[r.action]}</span>
                  </td>
                  <td>{r.class_name ?? "—"}</td>
                  <td>{r.term_name ?? "—"}</td>
                  <td className="small text-muted">{r.detail ?? "—"}</td>
                  <td className="small">{r.performed_by_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
