import { useEffect, useState } from "react";
import {
  METHOD_LABEL,
  ReportBillingService,
  type AdminPaymentRow,
  type PaymentSettings,
  type SchoolBillingRow,
} from "@services/cloud/ReportBillingService";

function money(n: number): string {
  return `GHS ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Super Admin: set the report price, the onboarding-fee switch, per-school
 *  prices, and approve / reject report payment claims. */
export function CloudReportPaymentsAdmin() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [price, setPrice] = useState("");
  const [onbRequired, setOnbRequired] = useState(false);
  const [onbPublic, setOnbPublic] = useState("");
  const [onbPrivate, setOnbPrivate] = useState("");
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [schools, setSchools] = useState<SchoolBillingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  async function load() {
    const [s, p, sc] = await Promise.all([
      ReportBillingService.getSettings(),
      ReportBillingService.listPayments(),
      ReportBillingService.listSchools(),
    ]);
    setSettings(s);
    setPrice(String(s.report_price_per_learner));
    setOnbRequired(s.onboarding_fee_required);
    setOnbPublic(String(s.onboarding_fee_public));
    setOnbPrivate(String(s.onboarding_fee_private));
    setPayments(p);
    setSchools(sc);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  async function run(fn: () => Promise<void>, msg: string) {
    setError(null);
    setOk(null);
    try {
      await fn();
      setOk(msg);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function decide(p: AdminPaymentRow, approve: boolean) {
    let notes: string | undefined;
    if (!approve) {
      const reason = window.prompt("Reason for rejecting (the school will see this):", "");
      if (reason === null) return;
      notes = reason;
    } else if (!window.confirm(`Approve ${money(p.amount)} from ${p.school_name}? This unlocks ${p.learner_count} report(s).`)) {
      return;
    }
    setBusyId(p.id);
    await run(() => ReportBillingService.decide(p.id, approve, notes), approve ? "Payment approved - reports unlocked." : "Payment rejected.");
    setBusyId(null);
  }

  const pending = payments.filter((p) => p.status === "pending");
  const past = payments.filter((p) => p.status !== "pending");
  const q = search.trim().toLowerCase();
  const shownSchools = schools.filter((s) => !q || s.school_name.toLowerCase().includes(q) || (s.district_name ?? "").toLowerCase().includes(q));

  return (
    <div>
      <h1 className="h4 mb-1">Report payments</h1>
      <p className="text-muted">Set what schools pay, and approve their payments.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}

      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="actrs-card p-3 h-100">
            <h2 className="h6 fw-bold">Price per learner report</h2>
            <p className="text-muted small">
              Charged per learner report released (print, PDF/zip, SMS). <strong>0 means reports are free</strong> and
              nothing is locked. One free full report per class each term. You can set a different price for one school
              in the table below.
            </p>
            <div className="input-group" style={{ maxWidth: 280 }}>
              <span className="input-group-text">GHS</span>
              <input className="form-control" type="number" min="0" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
              <button
                className="btn btn-primary"
                onClick={() => run(() => ReportBillingService.setReportPrice(Number(price || 0)), "Report price saved.")}
              >
                Save
              </button>
            </div>
            {settings && Number(settings.report_price_per_learner) === 0 && (
              <div className="small text-warning mt-2">Currently free for every school.</div>
            )}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="actrs-card p-3 h-100">
            <h2 className="h6 fw-bold">School onboarding fee</h2>
            <div className="form-check form-switch mb-2">
              <input className="form-check-input" type="checkbox" id="onb" checked={onbRequired} onChange={(e) => setOnbRequired(e.target.checked)} />
              <label className="form-check-label" htmlFor="onb">
                {onbRequired ? "Required before a school can be approved" : "Free (no payment needed to onboard)"}
              </label>
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small mb-1">Public school (GHS)</label>
                <input className="form-control" type="number" min="0" value={onbPublic} onChange={(e) => setOnbPublic(e.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label small mb-1">Private school (GHS)</label>
                <input className="form-control" type="number" min="0" value={onbPrivate} onChange={(e) => setOnbPrivate(e.target.value)} />
              </div>
            </div>
            <button
              className="btn btn-primary mt-2"
              onClick={() => run(() => ReportBillingService.setOnboarding(onbRequired, Number(onbPublic || 0), Number(onbPrivate || 0)), "Onboarding settings saved.")}
            >
              Save
            </button>
            <p className="text-muted small mt-2 mb-0">
              When switched on, a school needs an approved payment (recorded under Super Admin) before it is approved.
            </p>
          </div>
        </div>
      </div>

      <div className="actrs-card p-3 mb-4">
        <h2 className="h6 fw-bold">Payments waiting for approval ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-muted small mb-0">Nothing waiting.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>School</th>
                  <th className="text-end">Reports</th>
                  <th className="text-end">Amount</th>
                  <th>Method / reference</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="fw-semibold">{p.school_name}</div>
                      <div className="small text-muted">
                        {p.district_name ?? "-"} · {p.term_name ?? ""} · {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="text-end">
                      {p.learner_count} x {money(p.unit_price)}
                    </td>
                    <td className="text-end fw-bold">{money(p.amount)}</td>
                    <td className="small">
                      {METHOD_LABEL[p.method] ?? p.method}
                      <div>{p.reference ?? "-"}</div>
                      {p.notes && <div className="text-muted">{p.notes}</div>}
                    </td>
                    <td className="text-end text-nowrap">
                      <button className="btn btn-success btn-sm me-1" disabled={busyId === p.id} onClick={() => decide(p, true)}>
                        Approve
                      </button>
                      <button className="btn btn-outline-danger btn-sm" disabled={busyId === p.id} onClick={() => decide(p, false)}>
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="actrs-card p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h2 className="h6 fw-bold mb-0">Schools - reports and prices</h2>
          <input className="form-control" style={{ maxWidth: 260 }} placeholder="Search school or district" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>School</th>
                <th className="text-end">Generated</th>
                <th className="text-end">Unlocked</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Pending</th>
                <th>Price (GHS)</th>
              </tr>
            </thead>
            <tbody>
              {shownSchools.map((s) => (
                <tr key={s.school_id}>
                  <td>
                    {s.school_name}
                    <div className="small text-muted">{s.district_name ?? "-"}</div>
                  </td>
                  <td className="text-end">{s.generated_count}</td>
                  <td className="text-end">{s.unlocked_count}</td>
                  <td className="text-end">{money(s.approved_amount)}</td>
                  <td className="text-end">{money(s.pending_amount)}</td>
                  <td style={{ minWidth: 190 }}>
                    <div className="input-group input-group-sm">
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        placeholder={`${s.effective_price} (standard)`}
                        value={overrideDraft[s.school_id] ?? (s.price_override ?? "")}
                        onChange={(e) => setOverrideDraft((d) => ({ ...d, [s.school_id]: e.target.value }))}
                      />
                      <button
                        className="btn btn-outline-primary"
                        onClick={() => {
                          const v = overrideDraft[s.school_id];
                          const n = v === undefined ? s.price_override : v === "" ? null : Number(v);
                          void run(() => ReportBillingService.setSchoolPrice(s.school_id, n), `Price saved for ${s.school_name}.`);
                        }}
                      >
                        Set
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted small mt-2 mb-0">Leave a school's price blank to use the standard price above.</p>
      </div>

      {past.length > 0 && (
        <div className="actrs-card p-3">
          <h2 className="h6 fw-bold">Past payments</h2>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <tbody>
                {past.map((p) => (
                  <tr key={p.id}>
                    <td>{p.school_name}</td>
                    <td className="text-end">{p.learner_count}</td>
                    <td className="text-end">{money(p.amount)}</td>
                    <td className="small">{p.reference ?? "-"}</td>
                    <td>
                      <span className={`badge ${p.status === "approved" ? "text-bg-success" : "text-bg-danger"}`}>{p.status}</span>
                    </td>
                    <td className="small text-muted">{p.reviewed_at ? new Date(p.reviewed_at).toLocaleDateString() : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
