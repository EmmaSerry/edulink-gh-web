import { Fragment, useEffect, useMemo, useState } from "react";
import { CloudSubscriptionService } from "@services/cloud/SubscriptionService";
import type { SchoolSubscriptionOverviewRow, SubscriptionPaymentRow, SubscriptionPaymentMethod } from "@/types/database";

const METHOD_LABEL: Record<SubscriptionPaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  online: "Online",
  other: "Other",
};

const PAYMENT_METHODS: SubscriptionPaymentMethod[] = ["cash", "mobile_money", "bank_transfer", "online", "other"];

function money(n: number): string {
  return `GHS ${n.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No expiry set";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ row }: { row: SchoolSubscriptionOverviewRow }) {
  if (row.is_lapsed) return <span className="badge text-bg-danger">Lapsed</span>;
  if (row.subscription_status === "suspended") return <span className="badge text-bg-dark">Suspended</span>;
  if (row.subscription_status === "trial") return <span className="badge text-bg-info">Trial</span>;
  return <span className="badge text-bg-success">Active</span>;
}

function RecordPaymentForm({ school, onDone }: { school: SchoolSubscriptionOverviewRow; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SubscriptionPaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await CloudSubscriptionService.recordAndApprove({
        schoolId: school.school_id,
        amount: value,
        method,
        reference: reference.trim() || null,
        periodLabel: periodLabel.trim() || null,
        notes: notes.trim() || null,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 border-top">
      {error && <div className="alert alert-danger py-2 small mb-2">{error}</div>}
      <div className="row g-2">
        <div className="col-sm-3">
          <input
            type="number"
            min={0}
            step="0.01"
            className="form-control form-control-sm"
            placeholder="Amount (GHS)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <select className="form-select form-select-sm" value={method} onChange={(e) => setMethod(e.target.value as SubscriptionPaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-sm-3">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Period (e.g. 2026 Term 2)"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Reference (optional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <div className="col-12">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="col-12">
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSubmit}>
            {saving ? "Saving…" : "Record as approved"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Super Admin Dashboard - item 10 of Emmanuel's fixes batch, verbatim:
 * "all payment approval should be done by me on a Super Admin
 * Dashboard." Two halves: a pending-claims queue (schools reporting
 * what they paid, waiting on a yes/no) and a full schools overview
 * where Emmanuel can also log a payment himself with no prior claim -
 * the realistic path for cash he collected in person. Gated to
 * platform_admin only (see RequireAdmin roles="platform") - narrower
 * than every other "admin" screen in this app, since this is
 * specifically Emmanuel's own call per his own request, not a
 * district_admin's.
 */
export function CloudSubscriptionApproval() {
  const [overview, setOverview] = useState<SchoolSubscriptionOverviewRow[] | null>(null);
  const [pending, setPending] = useState<SubscriptionPaymentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  function load() {
    Promise.all([CloudSubscriptionService.listSchoolsOverview(), CloudSubscriptionService.listAll("pending")])
      .then(([overviewRows, pendingRows]) => {
        setOverview(overviewRows);
        setPending(pendingRows);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load subscription data."));
  }

  useEffect(load, []);

  const schoolById = useMemo(() => new Map((overview ?? []).map((r) => [r.school_id, r])), [overview]);

  async function handleApprove(payment: SubscriptionPaymentRow) {
    const school = schoolById.get(payment.school_id);
    if (!confirm(`Approve ${money(payment.amount)} from ${school?.school_name ?? "this school"}?`)) return;
    setDecidingId(payment.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await CloudSubscriptionService.approve(payment.id);
      setActionSuccess(`Payment approved. ${school?.school_name ?? "The school"}'s subscription has been extended.`);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not approve this payment.");
    } finally {
      setDecidingId(null);
      window.setTimeout(() => setActionSuccess(null), 6000);
    }
  }

  async function handleReject(payment: SubscriptionPaymentRow) {
    const reason = prompt("Why is this payment being rejected? (shown to nobody automatically, kept for your own records)");
    if (reason === null) return;
    setDecidingId(payment.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await CloudSubscriptionService.reject(payment.id, reason.trim() || null);
      setActionSuccess("Payment rejected.");
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reject this payment.");
    } finally {
      setDecidingId(null);
      window.setTimeout(() => setActionSuccess(null), 6000);
    }
  }

  const filteredOverview = useMemo(() => {
    if (!overview) return [];
    const q = query.trim().toLowerCase();
    if (!q) return overview;
    return overview.filter(
      (r) => r.school_name.toLowerCase().includes(q) || (r.district_name ?? "").toLowerCase().includes(q)
    );
  }, [overview, query]);

  if (loadError) return <div className="alert alert-danger">{loadError}</div>;
  if (overview === null || pending === null) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="h4 mb-1">Super Admin - Subscriptions</h1>
      <p className="text-muted mb-4">Every school's subscription status, and payment claims waiting on your decision.</p>

      {actionSuccess && <div className="alert alert-success py-2">{actionSuccess}</div>}
      {actionError && <div className="alert alert-danger py-2">{actionError}</div>}

      <div className="actrs-card p-0 mb-4">
        <div className="p-3 border-bottom">
          <h2 className="h6 fw-bold mb-0">Pending payment claims ({pending.length})</h2>
        </div>
        {pending.length === 0 && <p className="text-muted p-3 mb-0">Nothing waiting on you right now.</p>}
        {pending.length > 0 && (
          <table className="table mb-0 align-middle">
            <tbody>
              {pending.map((p) => {
                const school = schoolById.get(p.school_id);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="fw-semibold">{school?.school_name ?? "Unknown school"}</div>
                      <div className="text-muted small">
                        {school?.district_name ?? "No district"} · {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div className="fw-semibold">{money(p.amount)}</div>
                      <div className="text-muted small">
                        {METHOD_LABEL[p.method]}
                        {p.period_label ? ` · ${p.period_label}` : ""}
                      </div>
                    </td>
                    <td className="text-muted small">
                      {p.reference && <div>Ref: {p.reference}</div>}
                      {p.notes && <div>{p.notes}</div>}
                    </td>
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm me-2"
                        disabled={decidingId === p.id}
                        onClick={() => handleApprove(p)}
                      >
                        {decidingId === p.id ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        disabled={decidingId === p.id}
                        onClick={() => handleReject(p)}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="actrs-card p-0">
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between gap-3 flex-wrap">
          <h2 className="h6 fw-bold mb-0">All schools ({filteredOverview.length})</h2>
          <input
            type="search"
            className="form-control form-control-sm"
            style={{ maxWidth: 260 }}
            placeholder="Search school or district…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <table className="table mb-0 align-middle">
          <thead>
            <tr>
              <th>School</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Expires</th>
              <th className="text-end" />
            </tr>
          </thead>
          <tbody>
            {filteredOverview.map((row) => (
              <Fragment key={row.school_id}>
                <tr>
                  <td>
                    <div className="fw-semibold">{row.school_name}</div>
                    <div className="text-muted small">
                      {row.district_name ?? "No district"} · {row.is_private ? "Private" : "Public"}
                      {row.pending_payment_count > 0 && (
                        <span className="badge text-bg-warning ms-2">{row.pending_payment_count} pending</span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted small">{row.subscription_tier}</td>
                  <td>
                    <StatusBadge row={row} />
                  </td>
                  <td className="text-muted small">{formatDate(row.subscription_expires_at)}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setRecordingFor(recordingFor === row.school_id ? null : row.school_id)}
                    >
                      {recordingFor === row.school_id ? "Cancel" : "Record payment"}
                    </button>
                  </td>
                </tr>
                {recordingFor === row.school_id && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <RecordPaymentForm
                        school={row}
                        onDone={() => {
                          setRecordingFor(null);
                          setActionSuccess(`Payment recorded for ${row.school_name}.`);
                          load();
                          window.setTimeout(() => setActionSuccess(null), 6000);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
