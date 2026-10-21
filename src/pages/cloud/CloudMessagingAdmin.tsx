import { useEffect, useState } from "react";
import {
  KIND_LABEL,
  PlatformPaymentsService,
  type DigestRow,
  type OnlinePaymentRow,
  type TokenBalanceRow,
} from "@services/cloud/PlatformPaymentsService";

function money(n: number): string {
  return `GHS ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Super Admin: message prices, weekly payment summary, token top-ups and
 *  every online (Paystack) payment. */
export function CloudMessagingAdmin() {
  const [sms, setSms] = useState("");
  const [wa, setWa] = useState("");
  const [min, setMin] = useState("50");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [balances, setBalances] = useState<TokenBalanceRow[]>([]);
  const [online, setOnline] = useState<OnlinePaymentRow[]>([]);
  const [digests, setDigests] = useState<DigestRow[]>([]);
  const [grantSchool, setGrantSchool] = useState("");
  const [grantChannel, setGrantChannel] = useState<"sms" | "whatsapp">("sms");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load(d = days) {
    const [s, b, o, dg] = await Promise.all([
      PlatformPaymentsService.adminSettings(),
      PlatformPaymentsService.balances(),
      PlatformPaymentsService.onlinePayments(d),
      PlatformPaymentsService.digests(),
    ]);
    setSms(String(s.sms_price_per_message));
    setWa(String(s.whatsapp_price_per_message));
    setMin(String(s.min_token_purchase));
    setPhone(s.digest_phone ?? "");
    setEmail(s.digest_email ?? "");
    setBalances(b);
    setOnline(o);
    setDigests(dg);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const paid = online.filter((p) => p.status === "paid");
  const paidTotal = paid.reduce((a, p) => a + Number(p.amount), 0);
  const q = search.trim().toLowerCase();
  const shownBalances = balances.filter((b) => !q || b.school_name.toLowerCase().includes(q));

  return (
    <div>
      <h1 className="h4 mb-1">Messaging &amp; online payments</h1>
      <p className="text-muted">Prices for SMS and WhatsApp messages, your weekly payment summary, and every Paystack payment.</p>
      {error && <div className="alert alert-danger">{error}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}

      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="actrs-card p-3 h-100">
            <h2 className="h6 fw-bold">Price per message</h2>
            <p className="text-muted small">
              Schools buy tokens at these prices (1 token = 1 message). <strong>0 = free</strong>: nothing is deducted.
              WhatsApp is charged to you by Meta per message - set your WhatsApp price above that cost.
            </p>
            <div className="row g-2">
              <div className="col-4">
                <label className="form-label small mb-1">SMS (GHS)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={sms} onChange={(e) => setSms(e.target.value)} />
              </div>
              <div className="col-4">
                <label className="form-label small mb-1">WhatsApp (GHS)</label>
                <input className="form-control" type="number" min="0" step="0.01" value={wa} onChange={(e) => setWa(e.target.value)} />
              </div>
              <div className="col-4">
                <label className="form-label small mb-1">Min. purchase</label>
                <input className="form-control" type="number" min="1" value={min} onChange={(e) => setMin(e.target.value)} />
              </div>
            </div>
            <button
              className="btn btn-primary mt-2"
              onClick={() => run(() => PlatformPaymentsService.setMessagingPrices(Number(sms || 0), Number(wa || 0), Number(min || 50)), "Prices saved.")}
            >
              Save prices
            </button>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="actrs-card p-3 h-100">
            <h2 className="h6 fw-bold">Weekly payment summary</h2>
            <p className="text-muted small">Every Monday morning you get a text (and an email, if set up) with the week's successful payments.</p>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small mb-1">Your phone (SMS)</label>
                <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024XXXXXXX" />
              </div>
              <div className="col-6">
                <label className="form-label small mb-1">Email (optional)</label>
                <input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-primary" onClick={() => run(() => PlatformPaymentsService.setDigestContacts(phone, email), "Saved.")}>
                Save
              </button>
              <button
                className="btn btn-outline-primary"
                onClick={() =>
                  run(async () => {
                    const r = await PlatformPaymentsService.sendDigestNow();
                    if (r.hint) throw new Error(r.hint);
                  }, "Summary sent to your phone.")
                }
              >
                Send a summary now
              </button>
            </div>
          </div>
        </div>
      </div>

      {digests.length > 0 && (
        <div className="actrs-card p-3 mb-4">
          <h2 className="h6 fw-bold">Recent summaries</h2>
          {digests.map((d) => (
            <div key={d.id} className="small border-bottom py-2">
              <span className="text-muted">{new Date(d.created_at).toLocaleString()}</span>{" "}
              {d.sms_sent ? <span className="badge text-bg-success">SMS sent</span> : <span className="badge text-bg-secondary">not texted</span>}
              <div>{d.body}</div>
            </div>
          ))}
        </div>
      )}

      <div className="actrs-card p-3 mb-4">
        <h2 className="h6 fw-bold">Add or remove tokens for a school</h2>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">School</label>
            <select className="form-select" value={grantSchool} onChange={(e) => setGrantSchool(e.target.value)}>
              <option value="">Choose...</option>
              {balances.map((b) => (
                <option key={b.school_id} value={b.school_id}>{b.school_name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Type</label>
            <select className="form-select" value={grantChannel} onChange={(e) => setGrantChannel(e.target.value as "sms" | "whatsapp")}>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Amount (- to remove)</label>
            <input className="form-control" type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Reason</label>
            <input className="form-control" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder="e.g. free welcome bonus" />
          </div>
          <div className="col-md-1">
            <button
              className="btn btn-primary w-100"
              disabled={!grantSchool || !Number(grantAmount)}
              onClick={() =>
                run(async () => {
                  await PlatformPaymentsService.grantTokens(grantSchool, grantChannel, Math.trunc(Number(grantAmount)), grantReason);
                  setGrantAmount("");
                  setGrantReason("");
                }, "Tokens updated.")
              }
            >
              Go
            </button>
          </div>
        </div>
      </div>

      <div className="actrs-card p-3 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 className="h6 fw-bold mb-0">Online payments - last {days} days</h2>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted">{paid.length} paid · {money(paidTotal)}</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 110 }}
              value={days}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDays(d);
                void load(d);
              }}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <tbody>
              {online.length === 0 && (
                <tr>
                  <td className="text-muted">No online payments in this period.</td>
                </tr>
              )}
              {online.map((p) => (
                <tr key={p.id}>
                  <td className="small">{new Date(p.paid_at ?? p.created_at).toLocaleString()}</td>
                  <td>
                    {p.school_name}
                    <div className="small text-muted">{p.district_name ?? "-"}</div>
                  </td>
                  <td>{KIND_LABEL[p.kind] ?? p.kind}</td>
                  <td className="text-end">{p.quantity.toLocaleString()}</td>
                  <td className="text-end fw-semibold">{money(p.amount)}</td>
                  <td>
                    <span className={`badge ${p.status === "paid" ? "text-bg-success" : p.status === "failed" ? "text-bg-danger" : "text-bg-warning"}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="actrs-card p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 className="h6 fw-bold mb-0">School token balances</h2>
          <input className="form-control form-control-sm" style={{ maxWidth: 240 }} placeholder="Search school" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>School</th>
                <th className="text-end">SMS</th>
                <th className="text-end">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {shownBalances.map((b) => (
                <tr key={b.school_id}>
                  <td>
                    {b.school_name}
                    <div className="small text-muted">{b.district_name ?? "-"}</div>
                  </td>
                  <td className="text-end">{b.sms_tokens.toLocaleString()}</td>
                  <td className="text-end">{b.whatsapp_tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
