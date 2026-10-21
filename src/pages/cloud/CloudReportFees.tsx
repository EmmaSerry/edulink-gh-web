import { useEffect, useMemo, useState } from "react";
import { PlatformPaymentsService } from "@services/cloud/PlatformPaymentsService";
import { CloudTermService } from "@services/cloud/TermService";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import {
  METHOD_LABEL,
  ReportBillingService,
  type BillingRow,
  type ReportPaymentRow,
} from "@services/cloud/ReportBillingService";
import type { TermRow } from "@/types/database";

function money(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_BADGE: Record<string, string> = {
  paid: "text-bg-success",
  free: "text-bg-info",
  pending: "text-bg-warning",
  locked: "text-bg-secondary",
};

/**
 * School admin / bursar: pay for report cards. Reports are generated and
 * counted first; here the school picks which generated reports to release,
 * sees the amount (count x the price the Super Admin set), and submits a
 * payment claim. Once the Super Admin approves it, those learners' reports
 * unlock for printing, PDF/zip download and SMS.
 */
export function CloudReportFees() {
  const { profile } = useCloudAuth();
  const [term, setTerm] = useState<TermRow | null>(null);
  const [rows, setRows] = useState<BillingRow[] | null>(null);
  const [price, setPrice] = useState(0);
  const [history, setHistory] = useState<ReportPaymentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState("mobile_money");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load(t: TermRow) {
    const [r, pricing, h] = await Promise.all([
      ReportBillingService.listRows(t.id),
      ReportBillingService.getLockState(t.id),
      ReportBillingService.myPayments().catch(() => [] as ReportPaymentRow[]),
    ]);
    setRows(r);
    setPrice(pricing.price);
    setHistory(h);
  }

  useEffect(() => {
    let cancelled = false;
    CloudTermService.getActive(profile?.school_id)
      .then(async (t) => {
        if (cancelled) return;
        setTerm(t);
        if (t) await load(t);
        else setRows([]);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load report fees."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  const generated = (rows ?? []).filter((r) => r.generated);
  const payable = generated.filter((r) => r.status === "locked");
  const counts = {
    students: rows?.length ?? 0,
    generated: generated.length,
    unlocked: generated.filter((r) => r.status === "paid" || r.status === "free").length,
    pending: generated.filter((r) => r.status === "pending").length,
    locked: payable.length,
  };

  const byClass = useMemo(() => {
    const m = new Map<string, { name: string; items: BillingRow[] }>();
    for (const r of rows ?? []) {
      const g = m.get(r.class_id) ?? { name: r.class_name, items: [] };
      g.items.push(r);
      m.set(r.class_id, g);
    }
    return [...m.entries()];
  }, [rows]);

  const total = selected.size * price;

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleClass(items: BillingRow[]) {
    const ids = items.filter((r) => r.generated && r.status === "locked").map((r) => r.student_id);
    setSelected((p) => {
      const n = new Set(p);
      const all = ids.every((i) => n.has(i));
      ids.forEach((i) => (all ? n.delete(i) : n.add(i)));
      return n;
    });
  }

  async function submit() {
    if (!term || selected.size === 0) return;
    if (!window.confirm(`Submit a payment claim for ${selected.size} report(s) - ${money(total)}?`)) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const p = await ReportBillingService.submit(term.id, [...selected], method, reference.trim(), notes.trim());
      setSuccess(`Claim submitted for ${p.learner_count} report(s) - ${money(p.amount)}. These unlock once the Super Admin approves the payment.`);
      setSelected(new Set());
      setReference("");
      setNotes("");
      await load(term);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit the payment.");
    } finally {
      setBusy(false);
    }
  }

  async function payOnline() {
    if (!term || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await PlatformPaymentsService.checkout({ kind: "report_fees", termId: term.id, studentIds: [...selected] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.");
      setBusy(false);
    }
  }

  if (rows === null && !error) return <p className="text-muted">Loading...</p>;
  if (!term) return <div className="alert alert-warning">Your school has no active term set up yet.</div>;
  if (!profile?.school_id) return <div className="alert alert-info">Report fees are paid from a school account.</div>;

  return (
    <div>
      <h1 className="h4 mb-1">Report fees</h1>
      <p className="text-muted">
        {term.term_name}. Reports can be generated for every learner. To print, download or text a report to parents, it
        must be paid for. Each class gets <strong>one free full report</strong> per term.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {price <= 0 ? (
        <div className="alert alert-success">Reports are free for your school right now - nothing to pay.</div>
      ) : (
        <>
          <div className="row g-3 mb-3">
            {[
              ["Price per report", money(price)],
              ["Reports generated", String(counts.generated)],
              ["Unlocked", String(counts.unlocked)],
              ["Awaiting approval", String(counts.pending)],
              ["Locked (to pay)", String(counts.locked)],
              ["Amount if all paid", money(counts.locked * price)],
            ].map(([k, v]) => (
              <div className="col-6 col-md-4 col-lg-2" key={k}>
                <div className="actrs-card p-3 h-100">
                  <div className="text-muted small">{k}</div>
                  <div className="fw-bold fs-5">{v}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="actrs-card p-3 mb-3">
            <h2 className="h6 fw-bold">Choose reports to release</h2>
            {counts.generated === 0 && (
              <p className="text-muted small mb-0">
                No reports generated yet this term. Generate them from Reports, then come back to pay.
              </p>
            )}
            {byClass.map(([classId, g]) => {
              const payableHere = g.items.filter((r) => r.generated && r.status === "locked");
              return (
                <div key={classId} className="mb-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <strong>{g.name}</strong>
                    {payableHere.length > 0 && (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => toggleClass(g.items)}>
                        Select / clear all ({payableHere.length})
                      </button>
                    )}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <tbody>
                        {g.items.map((r) => {
                          const canPay = r.generated && r.status === "locked";
                          return (
                            <tr key={r.student_id}>
                              <td style={{ width: 36 }}>
                                <input
                                  type="checkbox"
                                  disabled={!canPay}
                                  checked={selected.has(r.student_id)}
                                  onChange={() => toggle(r.student_id)}
                                />
                              </td>
                              <td>
                                {r.student_name} <span className="text-muted small">{r.student_code}</span>
                              </td>
                              <td className="text-end">
                                {!r.generated ? (
                                  <span className="text-muted small">Not generated yet</span>
                                ) : (
                                  <span className={`badge ${STATUS_BADGE[r.status] ?? "text-bg-secondary"}`}>
                                    {r.status === "free" ? "Free report" : r.status === "paid" ? "Paid" : r.status === "pending" ? "Awaiting approval" : "Locked"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {selected.size > 0 && (
            <div className="actrs-card p-3 mb-3">
              <h2 className="h6 fw-bold">Pay for {selected.size} report(s)</h2>
              <p className="mb-2">
                {selected.size} x {money(price)} = <strong>{money(total)}</strong>
              </p>
              <button className="btn btn-success mb-3" disabled={busy} onClick={payOnline}>
                Pay {money(total)} online (Paystack) - unlocks instantly
              </button>
              <div className="small text-muted mb-2">Already paid another way (MoMo, bank, cash)? Submit a claim instead:</div>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label small mb-1">How did you pay?</label>
                  <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {["mobile_money", "bank_transfer", "cash", "other"].map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small mb-1">Transaction reference</label>
                  <input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MoMo transaction ID" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small mb-1">Note (optional)</label>
                  <input className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary mt-3" disabled={busy} onClick={submit}>
                {busy ? "Submitting..." : `Submit payment of ${money(total)}`}
              </button>
              <p className="text-muted small mt-2 mb-0">
                The amount is worked out by the system. Your reports unlock once the Super Admin confirms the payment.
              </p>
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="actrs-card p-3">
          <h2 className="h6 fw-bold">Payment history</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-end">Reports</th>
                  <th className="text-end">Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.created_at).toLocaleDateString()}</td>
                    <td className="text-end">{h.learner_count}</td>
                    <td className="text-end">{money(h.amount)}</td>
                    <td>{METHOD_LABEL[h.method] ?? h.method}</td>
                    <td className="small">{h.reference ?? "-"}</td>
                    <td>
                      <span className={`badge ${h.status === "approved" ? "text-bg-success" : h.status === "rejected" ? "text-bg-danger" : "text-bg-warning"}`}>
                        {h.status}
                      </span>
                      {h.review_notes && <div className="small text-muted">{h.review_notes}</div>}
                    </td>
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
