import { useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudCredentialService, type CredentialRow } from "@services/cloud/CredentialService";

const ROLE_LABEL: Record<string, string> = {
  district_admin: "District admin",
  school_admin: "School admin",
  teacher: "Teacher",
  bursar: "Bursar",
  platform_admin: "Super admin",
};

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Login credentials: one table of the logins an administrator is
 * responsible for. What each person sees is decided by the database
 * (list_login_credentials), not by this page.
 */
export function CloudCredentials() {
  const { profile } = useCloudAuth();
  const [rows, setRows] = useState<CredentialRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    CloudCredentialService.list()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the login credentials."));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (roleFilter && r.role !== roleFilter) return false;
      if (!q) return true;
      return [r.full_name, r.school_name, r.school_code, r.login_email, r.district_name, ROLE_LABEL[r.role]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const roles = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.role))), [rows]);

  const isPassVisible = (id: string) => showAll || !!shown[id];
  const loginOf = (r: CredentialRow) =>
    r.role === "school_admin" && r.school_code ? `${r.school_code}${r.login_email ? ` / ${r.login_email}` : ""}` : (r.login_email ?? "");

  function tableLines(): string[][] {
    const head = ["School", "Name", "Role", "Login", "Password", "District"];
    const body = filtered.map((r) => [
      r.school_name ?? "",
      r.full_name,
      ROLE_LABEL[r.role] ?? r.role,
      loginOf(r),
      r.password ?? "Not recorded yet",
      r.district_name ?? "",
    ]);
    return [head, ...body];
  }

  async function copyAll() {
    const text = tableLines().map((l) => l.join("\t")).join("\n");
    await navigator.clipboard.writeText(text);
    setNotice("Copied. Paste it into Excel or Word.");
  }

  function downloadCsv() {
    const csv = tableLines()
      .map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "edulink-login-credentials.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printTable() {
    const [head, ...body] = tableLines();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Login credentials</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 8px;font-size:12px;text-align:left}th{background:#eee}</style></head><body><h3>EduLink GH login credentials</h3><table><thead><tr>${head
        .map((h) => `<th>${esc(h)}</th>`)
        .join("")}</tr></thead><tbody>${body
        .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  async function copyRow(r: CredentialRow) {
    await navigator.clipboard.writeText(`${r.full_name}\nLogin: ${loginOf(r)}\nPassword: ${r.password ?? ""}`);
    setNotice(`Copied the login for ${r.full_name}.`);
  }

  async function resetRow(r: CredentialRow) {
    if (!confirm(`Issue a new password for ${r.full_name}? Their old password will stop working.`)) return;
    setBusyId(r.user_id);
    setError(null);
    try {
      const pw = await CloudCredentialService.reset(r.user_id);
      setRows((prev) => (prev ?? []).map((x) => (x.user_id === r.user_id ? { ...x, password: pw } : x)));
      setShown((s) => ({ ...s, [r.user_id]: true }));
      setNotice(`New password for ${r.full_name} is shown in the table.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the password.");
    } finally {
      setBusyId(null);
    }
  }

  const showSchoolCol = profile?.role !== "school_admin";

  return (
    <div>
      <h1 className="h4 mb-1">Login credentials</h1>
      <p className="text-muted">
        Logins for the {profile?.role === "school_admin" ? "teachers and bursars in your school" : "people you look after"}.
        Share each login only with the person it belongs to.
      </p>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {notice && (
        <div className="alert alert-success py-2" role="status">
          {notice}
        </div>
      )}

      <div className="actrs-card p-3">
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <button className="btn btn-sm btn-outline-secondary" onClick={copyAll} disabled={!rows}>
            Copy
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={downloadCsv} disabled={!rows}>
            CSV
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={printTable} disabled={!rows}>
            Print
          </button>
          <div className="form-check form-switch ms-2 mb-0">
            <input
              id="showAllPw"
              className="form-check-input"
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="showAllPw">
              Show passwords
            </label>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 mb-3 align-items-center">
          <label className="small text-muted d-flex align-items-center gap-2 mb-0">
            Show
            <select
              className="form-select form-select-sm"
              style={{ width: 80 }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            entries
          </label>
          <select
            className="form-select form-select-sm"
            style={{ width: 180 }}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r] ?? r}
              </option>
            ))}
          </select>
          <label className="small text-muted d-flex align-items-center gap-2 mb-0 ms-auto">
            Search:
            <input
              className="form-control form-control-sm"
              style={{ width: 220 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-2">
            <thead>
              <tr>
                {showSchoolCol && <th>Name of institution</th>}
                <th>Name</th>
                <th>Role</th>
                <th>Login</th>
                <th>Password</th>
                <th style={{ width: 170 }} />
              </tr>
            </thead>
            <tbody>
              {!rows && !error && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {rows && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted">
                    No logins to show.
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr key={r.user_id} className={r.is_active ? "" : "text-muted"}>
                  {showSchoolCol && (
                    <td>
                      {r.school_name ?? r.district_name ?? "-"}
                      {r.school_code && <div className="small text-muted">{r.school_code}</div>}
                    </td>
                  )}
                  <td>
                    {r.full_name}
                    {!r.is_active && <span className="badge text-bg-secondary ms-2">Archived</span>}
                  </td>
                  <td>{ROLE_LABEL[r.role] ?? r.role}</td>
                  <td>{loginOf(r) || "-"}</td>
                  <td>
                    {r.password ? (
                      <code>{isPassVisible(r.user_id) ? r.password : "••••••••"}</code>
                    ) : (
                      <span className="text-muted small">Not recorded yet</span>
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    {r.password && (
                      <>
                        <button
                          className="btn btn-sm btn-outline-secondary me-1"
                          title="Show or hide"
                          onClick={() => setShown((s) => ({ ...s, [r.user_id]: !s[r.user_id] }))}
                        >
                          <i className={`bi ${isPassVisible(r.user_id) ? "bi-eye-slash" : "bi-eye"}`} />
                        </button>
                        <button className="btn btn-sm btn-outline-secondary me-1" title="Copy login" onClick={() => copyRow(r)}>
                          <i className="bi bi-clipboard" />
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-sm btn-outline-primary"
                      disabled={busyId === r.user_id}
                      onClick={() => resetRow(r)}
                    >
                      {busyId === r.user_id ? "…" : "Reset"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex align-items-center justify-content-between small text-muted">
          <span>
            {filtered.length === 0
              ? "0 entries"
              : `Showing ${safePage * pageSize + 1} to ${Math.min((safePage + 1) * pageSize, filtered.length)} of ${filtered.length} entries`}
          </span>
          <span className="d-flex gap-1">
            <button className="btn btn-sm btn-outline-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
