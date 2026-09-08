import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { CloudSubscriptionService } from "@services/cloud/SubscriptionService";
import { CloudTermService } from "@services/cloud/TermService";
import type { SchoolRow, SubscriptionPaymentRow, SubscriptionPaymentMethod, TermRow } from "@/types/database";

const METHOD_LABEL: Record<SubscriptionPaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  online: "Online",
  other: "Other",
};

const PAYMENT_METHODS: SubscriptionPaymentMethod[] = ["cash", "mobile_money", "bank_transfer", "online", "other"];

const STATUS_BADGE: Record<SubscriptionPaymentRow["status"], string> = {
  pending: "text-bg-warning",
  approved: "text-bg-success",
  rejected: "text-bg-danger",
};

function money(n: number): string {
  return `GHS ${n.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No expiry set yet";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * School-side counterpart of CloudSubscriptionApproval - a school_admin
 * or bursar's own subscription status, and a form to report a payment
 * they've made (cash to the district office, mobile money, bank
 * transfer, or online outside this app). The claim sits 'pending' until
 * Emmanuel approves it on the Super Admin Dashboard - see
 * edulink_gh_phase1d_subscriptions.sql. Gated with RequireAdmin
 * roles="subscription" (school_admin/bursar only - district_admin/
 * platform_admin have no single school to report a payment for).
 */
export function CloudSubscriptionStatus() {
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [payments, setPayments] = useState<SubscriptionPaymentRow[] | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SubscriptionPaymentMethod>("cash");
  const [termId, setTermId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  function load() {
    CloudSchoolService.getProfile()
      .then((s) => {
        setSchool(s);
        if (!s) return Promise.resolve<[SubscriptionPaymentRow[], TermRow[]]>([[], []]);
        return Promise.all([CloudSubscriptionService.listForSchool(s.id), CloudTermService.list(undefined, s.id)]);
      })
      .then(([paymentRows, termRows]) => {
        setPayments(paymentRows);
        setTerms(termRows);
        setTermId((current) =>
          current && termRows.some((t) => t.id === current) ? current : (termRows.find((t) => t.is_active)?.id ?? "")
        );
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load subscription status."));
  }

  useEffect(load, []);

  const selectedTerm = useMemo(() => terms.find((t) => t.id === termId) ?? null, [terms, termId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      setSubmitError("Enter an amount greater than zero.");
      return;
    }
    if (!termId) {
      setSubmitError("Select which term this payment covers.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await CloudSubscriptionService.submit({
        amount: value,
        method,
        termId,
        reference: reference.trim() || null,
        periodLabel: selectedTerm ? `${selectedTerm.term_name}` : null,
        notes: notes.trim() || null,
      });
      setAmount("");
      setReference("");
      setNotes("");
      setSubmitSuccess("Payment reported - it'll show as active once approved.");
      load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit this payment.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSubmitSuccess(null), 6000);
    }
  }

  if (loadError) return <div className="alert alert-danger">{loadError}</div>;
  if (school === null || payments === null) return <p className="text-muted">Loading…</p>;

  const isLapsed = school.subscription_expires_at != null && new Date(school.subscription_expires_at) < new Date();

  return (
    <div>
      <h1 className="h4 mb-1">Subscription</h1>
      <p className="text-muted mb-4">Your school's subscription status, and reporting a payment you've made.</p>

      <div className="actrs-card p-3 mb-4">
        <div className="row g-3">
          <div className="col-sm-4">
            <div className="text-muted small mb-1">Status</div>
            <div className="fw-semibold">
              {isLapsed ? (
                <span className="badge text-bg-danger">Lapsed</span>
              ) : school.subscription_status === "trial" ? (
                <span className="badge text-bg-info">Trial</span>
              ) : school.subscription_status === "suspended" ? (
                <span className="badge text-bg-dark">Suspended</span>
              ) : (
                <span className="badge text-bg-success">Active</span>
              )}
            </div>
          </div>
          <div className="col-sm-4">
            <div className="text-muted small mb-1">Rate per term</div>
            <div className="fw-semibold">
              {school.subscription_price_per_term != null ? money(school.subscription_price_per_term) : "Not set yet"}
            </div>
          </div>
          <div className="col-sm-4">
            <div className="text-muted small mb-1">Renews / expires</div>
            <div className="fw-semibold">{formatDate(school.subscription_expires_at)}</div>
          </div>
        </div>
      </div>

      <div className="actrs-card p-3 mb-4">
        <h2 className="h6 fw-bold mb-3">Report a payment</h2>
        <p className="text-muted small mb-3">
          Paid by cash, mobile money, bank transfer, or online outside the app? Report it here - it'll be reviewed
          and your subscription updated once approved.
        </p>
        {submitSuccess && <div className="alert alert-success py-2 small">{submitSuccess}</div>}
        {submitError && <div className="alert alert-danger py-2 small">{submitError}</div>}
        <form onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-sm-3">
              <label className="form-label small">Amount (GHS)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-control form-control-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="col-sm-3">
              <label className="form-label small">Method</label>
              <select
                className="form-select form-select-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as SubscriptionPaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-3">
              <label className="form-label small">Term covered</label>
              <select className="form-select form-select-sm" value={termId} onChange={(e) => setTermId(e.target.value)} required>
                <option value="">Select a term…</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.term_name}
                    {t.is_active ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-sm-3">
              <label className="form-label small">Reference (optional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Transaction ID, receipt no."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="col-12">
              <label className="form-label small">Notes (optional)</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Submitting…" : "Submit for approval"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="actrs-card p-0">
        <div className="p-3 border-bottom">
          <h2 className="h6 fw-bold mb-0">Payment history</h2>
        </div>
        {payments.length === 0 && <p className="text-muted p-3 mb-0">No payments reported yet.</p>}
        {payments.length > 0 && (
          <table className="table mb-0 align-middle">
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="fw-semibold">{money(p.amount)}</div>
                    <div className="text-muted small">
                      {METHOD_LABEL[p.method]}
                      {p.period_label ? ` · ${p.period_label}` : ""} · {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="text-muted small">
                    {p.reference && <div>Ref: {p.reference}</div>}
                    {p.review_notes && <div>{p.review_notes}</div>}
                  </td>
                  <td className="text-end">
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
