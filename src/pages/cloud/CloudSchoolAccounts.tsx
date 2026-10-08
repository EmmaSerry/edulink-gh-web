import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ImpersonationService,
  type ImpersonationLogRow,
  type SchoolAccountRow,
} from "@services/cloud/ImpersonationService";

const ROLE_LABEL: Record<string, string> = {
  school_admin: "School admin",
  bursar: "Bursar",
  teacher: "Teacher",
  district_admin: "District admin",
};

/** Super Admin: every account of one school, each with "Sign in as". */
export function CloudSchoolAccounts() {
  const { schoolId } = useParams();
  const [accounts, setAccounts] = useState<SchoolAccountRow[] | null>(null);
  const [log, setLog] = useState<ImpersonationLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const schoolName = new URLSearchParams(window.location.search).get("name") ?? "School";

  useEffect(() => {
    if (!schoolId) return;
    ImpersonationService.listSchoolAccounts(schoolId)
      .then(setAccounts)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the accounts."));
    ImpersonationService.log().then((l) => setLog(l.filter((x) => x.school_name === schoolName))).catch(() => undefined);
  }, [schoolId, schoolName]);

  async function open(a: SchoolAccountRow) {
    if (!window.confirm(`Open the app as ${a.full_name} (${ROLE_LABEL[a.role] ?? a.role})?\n\nThis is recorded in the access log.`)) return;
    setBusyId(a.user_id);
    setError(null);
    try {
      await ImpersonationService.start(a.user_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this account.");
      setBusyId(null);
    }
  }

  return (
    <div>
      <Link to="/billing" className="small text-decoration-none">
        <i className="bi bi-arrow-left" /> Back to Super Admin
      </Link>
      <h1 className="h3 mt-2 mb-1">{schoolName}</h1>
      <p className="text-muted">
        All accounts in this school. "Sign in as" opens the app exactly as that person sees it - their password is
        not changed or shown. Use "Return to Super Admin" at the top to come back.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}
      {accounts === null && !error && <p className="text-muted">Loading...</p>}

      {accounts !== null && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.user_id}>
                  <td className="fw-semibold">{a.full_name}</td>
                  <td>{ROLE_LABEL[a.role] ?? a.role}</td>
                  <td>{a.phone ?? "-"}</td>
                  <td className="small">{a.email ?? "-"}</td>
                  <td>
                    {a.is_active ? (
                      <span className="badge text-bg-success">Active</span>
                    ) : (
                      <span className="badge text-bg-secondary">Deactivated</span>
                    )}
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!a.is_active || busyId !== null}
                      onClick={() => open(a)}
                    >
                      {busyId === a.user_id ? "Opening..." : "Sign in as"}
                    </button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted text-center py-4">No accounts in this school yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-4">
          <h2 className="h6 fw-bold">Recent access to this school's accounts</h2>
          <ul className="small text-muted mb-0">
            {log.slice(0, 10).map((l) => (
              <li key={l.id}>
                {new Date(l.started_at).toLocaleString()} - {l.admin_name ?? "Super Admin"} opened {l.target_name} (
                {ROLE_LABEL[l.target_role ?? ""] ?? l.target_role})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
