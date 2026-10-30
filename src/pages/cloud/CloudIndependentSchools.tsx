import { useEffect, useMemo, useState } from "react";
import { CloudSchoolSignupService } from "@services/cloud/SchoolSignupService";
import { IndependentSchoolService, type IndependentSchoolRow } from "@services/cloud/IndependentSchoolService";
import type { DistrictOption } from "@/types/database";

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Best guess at which registered district a typed district name means. */
function suggestDistrict(typed: string | null, districts: DistrictOption[]): string {
  if (!typed) return "";
  const t = normalise(typed);
  if (!t) return "";
  const exact = districts.find((d) => normalise(d.name) === t);
  if (exact) return exact.id;
  const loose = districts.find((d) => {
    const n = normalise(d.name);
    return n.length >= 4 && (n.includes(t) || t.includes(n));
  });
  return loose ? loose.id : "";
}

/**
 * Super Admin: schools whose district is not on EduLink GH (yet). They
 * use the system fully on their own. When their district joins, connect
 * each school here; from then on it appears on that district's
 * dashboard like any other school in it.
 */
export function CloudIndependentSchools() {
  const [rows, setRows] = useState<IndependentSchoolRow[] | null>(null);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setError(null);
    try {
      const [list, ds] = await Promise.all([IndependentSchoolService.list(), CloudSchoolSignupService.listDistricts()]);
      setRows(list);
      setDistricts(ds);
      setPicked((p) => {
        const next = { ...p };
        for (const r of list) {
          if (!next[r.school_id]) next[r.school_id] = suggestDistrict(r.district_name_manual, ds);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load independent schools.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function link(row: IndependentSchoolRow) {
    const districtId = picked[row.school_id];
    if (!districtId) return;
    const district = districts.find((d) => d.id === districtId);
    if (!window.confirm(`Connect "${row.school_name}" to ${district?.name ?? "this district"}?`)) return;
    setBusyId(row.school_id);
    setMessage(null);
    try {
      const res = await IndependentSchoolService.linkToDistrict(row.school_id, districtId);
      setMessage({ ok: true, text: `${res.schoolName} is now connected to ${res.districtName}.` });
      await load();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not connect the school." });
    } finally {
      setBusyId(null);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        !q ||
        r.school_name.toLowerCase().includes(q) ||
        (r.district_name_manual ?? "").toLowerCase().includes(q) ||
        (r.school_code ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-0">Independent schools</h1>
          <div className="text-muted small">
            Schools whose district is not on EduLink GH yet. They work fully on their own. Connect a school here once
            its district has joined.
          </div>
        </div>
        <input
          type="search"
          className="form-control"
          style={{ maxWidth: 280 }}
          placeholder="Search school, code or district…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className={`alert ${message.ok ? "alert-success" : "alert-danger"} py-2`}>{message.text}</div>}

      <div className="actrs-card p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>School</th>
                <th>District typed by the school</th>
                <th>Contact</th>
                <th className="text-end">Learners</th>
                <th style={{ minWidth: 260 }}>Connect to district</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && !error && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Loading…
                  </td>
                </tr>
              )}
              {rows !== null && shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    {rows.length === 0 ? "No independent schools. Every school is connected to a district." : "No match."}
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.school_id}>
                  <td>
                    <div className="fw-medium">{r.school_name}</div>
                    <div className="small text-muted">
                      {r.school_code ?? "-"} &middot; {r.is_private ? "Private" : "Public"} &middot;{" "}
                      <span className={r.approval_status === "approved" ? "text-success" : "text-warning"}>
                        {r.approval_status === "approved" ? "Approved" : "Waiting for approval"}
                      </span>
                    </div>
                  </td>
                  <td>
                    {r.district_name_manual ? (
                      <>
                        <div>{r.district_name_manual}</div>
                        <div className="small text-muted">{[r.circuit, r.region].filter(Boolean).join(", ")}</div>
                      </>
                    ) : (
                      <span className="text-muted small">Not typed yet {r.region ? `(${r.region})` : ""}</span>
                    )}
                  </td>
                  <td>
                    <div>{r.admin_name ?? "-"}</div>
                    <div className="small text-muted">{r.admin_phone ?? ""}</div>
                  </td>
                  <td className="text-end">{r.learner_count}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <select
                        className="form-select form-select-sm"
                        value={picked[r.school_id] ?? ""}
                        onChange={(e) => setPicked((p) => ({ ...p, [r.school_id]: e.target.value }))}
                      >
                        <option value="">Choose a district…</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary text-nowrap"
                        disabled={!picked[r.school_id] || busyId === r.school_id}
                        onClick={() => link(r)}
                      >
                        {busyId === r.school_id ? "Connecting…" : "Connect"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
