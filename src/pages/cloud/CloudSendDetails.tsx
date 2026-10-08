import { useEffect, useMemo, useState } from "react";
import {
  AccountMessagingService,
  type MessageableAccount,
  type SendMode,
  type SendResult,
} from "@services/cloud/AccountMessagingService";

const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  bursar: "Bursar",
  school_admin: "School admin",
  district_admin: "District admin",
};

/**
 * Text the web link, the capture-app link and sign-in details to account
 * holders. "Send links" changes nothing; "Send new login details" also
 * issues a NEW password to each person chosen (old one stops working).
 */
export function CloudSendDetails() {
  const [accounts, setAccounts] = useState<MessageableAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    AccountMessagingService.list()
      .then(setAccounts)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the accounts."));
  }, []);

  const schools = useMemo(
    () => Array.from(new Set((accounts ?? []).map((a) => a.school_name).filter(Boolean) as string[])).sort(),
    [accounts],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accounts ?? []).filter((a) => {
      if (roleFilter && a.role !== roleFilter) return false;
      if (schoolFilter && a.school_name !== schoolFilter) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.phone, a.school_name].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [accounts, search, roleFilter, schoolFilter]);

  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.has(a.user_id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((a) => next.delete(a.user_id));
      else visible.forEach((a) => next.add(a.user_id));
      return next;
    });
  }

  async function run(mode: SendMode) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const warn =
      mode === "credentials"
        ? `Send NEW login details to ${ids.length} ${ids.length === 1 ? "person" : "people"}?\n\nEach person gets a brand-new password by text. Their old password will stop working.`
        : `Text the website and capture-app links to ${ids.length} ${ids.length === 1 ? "person" : "people"}?`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await AccountMessagingService.send(mode, ids, (d, t) => setProgress(`Sending ${d} of ${t}...`));
      setResult(r);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const problems = result?.results.filter((r) => r.status !== "sent") ?? [];

  return (
    <div>
      <h1 className="h3 mb-1">Send login details</h1>
      <p className="text-muted">
        Text the website link, the capture-app link and sign-in email to account holders. <strong>Send links</strong>{" "}
        changes nothing. <strong>Send new login details</strong> also gives each person a brand-new password (the old
        one stops working) - use it for people who have lost theirs or never received it.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      {result && (
        <div className={`alert ${result.failed || result.noPhone ? "alert-warning" : "alert-success"}`}>
          <strong>{result.sent}</strong> sent
          {result.noPhone > 0 && <>, <strong>{result.noPhone}</strong> without a phone number</>}
          {result.failed > 0 && <>, <strong>{result.failed}</strong> failed</>}
          {result.skipped > 0 && <>, <strong>{result.skipped}</strong> skipped</>}.
          {problems.length > 0 && (
            <ul className="mb-0 mt-2">
              {problems.map((p) => (
                <li key={p.userId}>
                  {p.name}: {p.reason}
                  {p.tempPassword && (
                    <>
                      {" "}Give them this by hand - email <code>{p.email}</code>, new password <code>{p.tempPassword}</code>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {problems.some((p) => p.tempPassword) && (
            <div className="small mt-2">These passwords are shown only now - note them before leaving this page.</div>
          )}
        </div>
      )}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small mb-1">Search</label>
              <input className="form-control" placeholder="Name, email, phone or school" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">Role</label>
              <select className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {Object.entries(ROLE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label small mb-1">School</label>
              <select className="form-select" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
                <option value="">All schools</option>
                {schools.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <span className="me-2">{selected.size} selected</span>
        <button className="btn btn-outline-primary" disabled={busy || selected.size === 0} onClick={() => run("link")}>
          Send links
        </button>
        <button className="btn btn-primary" disabled={busy || selected.size === 0} onClick={() => run("credentials")}>
          Send new login details
        </button>
        {progress && <span className="text-muted">{progress}</span>}
      </div>

      {accounts === null && !error && <p className="text-muted">Loading...</p>}

      {accounts !== null && (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all shown" />
                </th>
                <th>Name</th>
                <th>Role</th>
                <th>School</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.user_id}>
                  <td>
                    <input type="checkbox" checked={selected.has(a.user_id)} onChange={() => toggle(a.user_id)} />
                  </td>
                  <td>{a.full_name}</td>
                  <td>{ROLE_LABEL[a.role] ?? a.role}</td>
                  <td>{a.school_name ?? a.district_name ?? "-"}</td>
                  <td>{a.phone ?? <span className="text-danger">none</span>}</td>
                  <td className="small">{a.email ?? "-"}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted text-center py-4">No accounts match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
