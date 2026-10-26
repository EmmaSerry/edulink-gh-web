import { useEffect, useMemo, useState } from "react";
import { rest } from "@/lib/supabaseClient";
import { ReportBillingService, type BillingRow } from "@services/cloud/ReportBillingService";

interface SchoolOpt {
  id: string;
  name: string;
}
interface ClassOpt {
  id: string;
  name: string;
}
interface TermOpt {
  id: string;
  term_name: string;
}

type Reason = "privilege" | "manual_payment";

const STATUS_BADGE: Record<string, string> = {
  paid: "text-bg-success",
  free: "text-bg-info",
  pending: "text-bg-warning",
  locked: "text-bg-secondary",
};

/**
 * Super Admin: manually unlock report cards for a whole class or for chosen
 * learners of any school, with or without a payment. The reason is recorded:
 * "Privilege" (granted free) or "Manual payment" (paid outside the system).
 */
export function ReportUnlockPanel() {
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [term, setTerm] = useState<TermOpt | null>(null);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<Reason>("privilege");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    rest
      .select<SchoolOpt>("schools", { select: "id,name", order: "name.asc" })
      .then(setSchools)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load schools."));
  }, []);

  useEffect(() => {
    setTerm(null);
    setClasses([]);
    setClassId("");
    setRows([]);
    setPicked(new Set());
    if (!schoolId) return;
    Promise.all([
      rest.select<TermOpt>("terms", {
        select: "id,term_name",
        filters: { school_id: `eq.${schoolId}`, is_active: "eq.true" },
        limit: 1,
      }),
      rest.select<ClassOpt>("classes", {
        select: "id,name",
        filters: { school_id: `eq.${schoolId}` },
        order: "name.asc",
      }),
    ])
      .then(([t, c]) => {
        setTerm(t[0] ?? null);
        setClasses(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this school."));
  }, [schoolId]);

  async function loadRows() {
    if (!schoolId || !term || !classId) {
      setRows([]);
      return;
    }
    const all = await ReportBillingService.listRows(term.id, schoolId);
    setRows(all.filter((r) => r.class_id === classId));
    setPicked(new Set());
  }

  useEffect(() => {
    loadRows().catch((e) => setError(e instanceof Error ? e.message : "Could not load learners."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, term]);

  const shownSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase();
    return schools.filter((s) => !q || s.name.toLowerCase().includes(q)).slice(0, 200);
  }, [schools, schoolSearch]);

  const lockedRows = rows.filter((r) => r.status === "locked" || r.status === "pending");

  async function unlock(scope: "class" | "selected") {
    if (!term || !schoolId || !classId) return;
    const ids = scope === "selected" ? Array.from(picked) : [];
    if (scope === "selected" && ids.length === 0) {
      setError("Tick at least one learner first.");
      return;
    }
    const what = scope === "class" ? `the WHOLE class (${rows.length} learners)` : `${ids.length} selected learner(s)`;
    const why = reason === "privilege" ? "Privilege" : "Manual payment";
    if (!window.confirm(`Unlock reports for ${what}?\nReason: ${why}`)) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const count = await rest.rpc<number>("admin_unlock_reports", {
        p_school_id: schoolId,
        p_term_id: term.id,
        p_class_id: classId,
        p_student_ids: ids,
        p_reason: reason,
        p_notes: notes.trim() || null,
      });
      setOk(`${count} report(s) unlocked (${why}).`);
      await loadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 fw-bold">Unlock reports manually</h2>
      <p className="text-muted small">
        Unlock a whole class, or chosen learners, for any school - with or without a payment. Choose the reason so
        it is on record.
      </p>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {ok && <div className="alert alert-success py-2">{ok}</div>}

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label small mb-1">School</label>
          <input
            className="form-control form-control-sm mb-1"
            placeholder="Type to search schools"
            value={schoolSearch}
            onChange={(e) => setSchoolSearch(e.target.value)}
          />
          <select className="form-select" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">Select a school…</option>
            {shownSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label small mb-1">Class {term ? `(${term.term_name})` : ""}</label>
          <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!schoolId}>
            <option value="">{!schoolId ? "Choose a school first" : "Select a class…"}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {schoolId && !term && <div className="small text-warning mt-1">This school has no active term.</div>}
        </div>
        <div className="col-md-4">
          <label className="form-label small mb-1">Reason</label>
          <div className="d-flex gap-3">
            <label className="form-check-label">
              <input type="radio" className="form-check-input me-1" checked={reason === "privilege"} onChange={() => setReason("privilege")} />
              Privilege
            </label>
            <label className="form-check-label">
              <input type="radio" className="form-check-input me-1" checked={reason === "manual_payment"} onChange={() => setReason("manual_payment")} />
              Manual payment
            </label>
          </div>
          <input className="form-control form-control-sm mt-2" placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {classId && rows.length > 0 && (
        <>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <button className="btn btn-primary btn-sm" disabled={busy || lockedRows.length === 0} onClick={() => unlock("class")}>
              Unlock whole class
            </button>
            <button className="btn btn-outline-primary btn-sm" disabled={busy || picked.size === 0} onClick={() => unlock("selected")}>
              Unlock {picked.size} selected
            </button>
            <button className="btn btn-link btn-sm" onClick={() => setPicked(new Set(lockedRows.map((r) => r.student_id)))}>
              Tick all locked
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Learner</th>
                  <th>Generated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const canPick = r.status === "locked" || r.status === "pending";
                  return (
                    <tr key={r.student_id}>
                      <td>
                        <input type="checkbox" className="form-check-input" disabled={!canPick} checked={picked.has(r.student_id)} onChange={() => toggle(r.student_id)} />
                      </td>
                      <td>
                        {r.student_name} <span className="text-muted small">{r.student_code}</span>
                      </td>
                      <td>{r.generated ? "Yes" : "Not yet"}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[r.status] ?? "text-bg-secondary"}`}>{r.status === "paid" ? "unlocked" : r.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {classId && rows.length === 0 && <p className="text-muted small mb-0">No learners found in this class for the active term.</p>}
    </div>
  );
}
