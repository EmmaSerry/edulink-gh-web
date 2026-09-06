import { useEffect, useMemo, useState } from "react";
import { CloudUserDirectoryService } from "@services/cloud/UserDirectoryService";
import type { UserDirectoryRow } from "@/types/database";

const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  bursar: "Bursar",
  school_admin: "School admin",
  district_admin: "District admin",
  platform_admin: "Platform admin",
};

/**
 * District/platform-admin-only account directory - see
 * edulink_gh_phase0v_user_directory.sql. Read-only except for one
 * action: issuing a brand-new temporary password for an account that's
 * lost access to its own, via the admin-reset-password Edge Function.
 */
export function CloudUserDirectory() {
  const [rows, setRows] = useState<UserDirectoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; fullName: string; tempPassword: string } | null>(
    null
  );

  function load() {
    CloudUserDirectoryService.list()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the account directory."));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.school_name ?? "").toLowerCase().includes(q) ||
        ROLE_LABEL[r.role].toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function handleReset(row: UserDirectoryRow) {
    if (!confirm(`Issue a brand-new temporary password for ${row.full_name}? Their current password will stop working.`)) {
      return;
    }
    setResettingId(row.id);
    setResetError(null);
    try {
      const tempPassword = await CloudUserDirectoryService.resetPassword(row.id);
      setResetResult({ userId: row.id, fullName: row.full_name, tempPassword });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not reset this password.");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <h1 className="h4 mb-1">Accounts</h1>
      <p className="text-muted mb-4">Every staff and admin account visible to you, across every school.</p>

      {error && <div className="alert alert-danger">{error}</div>}
      {resetError && <div className="alert alert-danger py-2">{resetError}</div>}
      {resetResult && (
        <div className="alert alert-success py-2">
          New temporary password for <strong>{resetResult.fullName}</strong>:{" "}
          <code>{resetResult.tempPassword}</code>
          <div className="small mt-1">
            Share this with them directly - it won't be shown again. They should sign in with it and can change it
            from there.
          </div>
          <button type="button" className="btn-close float-end" onClick={() => setResetResult(null)} aria-label="Dismiss" />
        </div>
      )}

      {rows === null && !error ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="mb-3" style={{ maxWidth: 320 }}>
            <input
              className="form-control"
              placeholder="Search by name, email, school, or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="actrs-card p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>School</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        {rows && rows.length === 0 ? "No accounts found." : "No accounts match your search."}
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="fw-semibold">{r.full_name}</td>
                      <td className="text-muted small">{r.email ?? "—"}</td>
                      <td>{ROLE_LABEL[r.role] ?? r.role}</td>
                      <td>{r.school_name ?? "—"}</td>
                      <td>
                        <span className={`badge ${r.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={resettingId === r.id}
                          onClick={() => handleReset(r)}
                        >
                          {resettingId === r.id ? "Resetting…" : "Reset password"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
