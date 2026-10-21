import { useEffect, useState } from "react";
import {
  KIND_LABEL,
  PlatformPaymentsService,
  type LedgerRow,
  type MessagingPricing,
  type PurchaseKind,
  type PurchaseRow,
} from "@services/cloud/PlatformPaymentsService";

function money(n: number): string {
  return `GHS ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** School admin / bursar: buy SMS and WhatsApp tokens with Paystack. Tokens
 *  are credited automatically as soon as Paystack confirms the payment. */
export function CloudCredits() {
  const [pricing, setPricing] = useState<MessagingPricing | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({ sms_tokens: "100", whatsapp_tokens: "100" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([PlatformPaymentsService.pricing(), PlatformPaymentsService.purchases(), PlatformPaymentsService.ledger()])
      .then(([p, h, l]) => {
        setPricing(p);
        setPurchases(h);
        setLedger(l);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load."));
  }, []);

  async function buy(kind: PurchaseKind) {
    setError(null);
    const n = Math.floor(Number(qty[kind]));
    if (!n || n < 1) {
      setError("Enter how many messages you want to buy.");
      return;
    }
    setBusy(kind);
    try {
      await PlatformPaymentsService.checkout({ kind, quantity: n });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.");
      setBusy(null);
    }
  }

  if (!pricing && !error) return <p className="text-muted">Loading...</p>;

  const cards: { kind: PurchaseKind; title: string; price: number; balance: number; blurb: string }[] = pricing
    ? [
        { kind: "sms_tokens", title: "SMS tokens", price: pricing.sms_price, balance: pricing.sms_tokens, blurb: "1 token = 1 SMS message part (160 characters) to a parent." },
        { kind: "whatsapp_tokens", title: "WhatsApp tokens", price: pricing.whatsapp_price, balance: pricing.whatsapp_tokens, blurb: "1 token = 1 WhatsApp message (report card PDF or notice) to a parent." },
      ]
    : [];

  return (
    <div>
      <h1 className="h4 mb-1">SMS &amp; WhatsApp credits</h1>
      <p className="text-muted">Buy message tokens with Paystack (mobile money or card). Tokens are added automatically as soon as the payment goes through.</p>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-4">
        {cards.map((c) => {
          const n = Math.floor(Number(qty[c.kind])) || 0;
          const total = n * c.price;
          const min = pricing?.min_purchase ?? 1;
          return (
            <div className="col-md-6" key={c.kind}>
              <div className="actrs-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-start">
                  <h2 className="h6 fw-bold mb-1">{c.title}</h2>
                  <span className="badge text-bg-primary fs-6">{c.balance.toLocaleString()} left</span>
                </div>
                <p className="text-muted small">{c.blurb}</p>
                {c.price <= 0 ? (
                  <div className="alert alert-success py-2 mb-0">Free right now - no tokens needed.</div>
                ) : (
                  <>
                    <div className="small mb-2">Price: <strong>{money(c.price)}</strong> per message (minimum {min})</div>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {[100, 500, 1000, 5000].map((p) => (
                        <button key={p} className="btn btn-sm btn-outline-secondary" onClick={() => setQty((q) => ({ ...q, [c.kind]: String(p) }))}>
                          {p.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <div className="input-group mb-2">
                      <input
                        className="form-control"
                        type="number"
                        min={min}
                        value={qty[c.kind]}
                        onChange={(e) => setQty((q) => ({ ...q, [c.kind]: e.target.value }))}
                      />
                      <span className="input-group-text">messages</span>
                    </div>
                    <button className="btn btn-primary w-100" disabled={busy !== null || n < min} onClick={() => buy(c.kind)}>
                      {busy === c.kind ? "Opening Paystack..." : `Pay ${money(total)} with Paystack`}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {purchases.length > 0 && (
        <div className="actrs-card p-3 mb-3">
          <h2 className="h6 fw-bold">Online payments</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>{KIND_LABEL[p.kind] ?? p.kind}</td>
                    <td className="text-end">{p.quantity.toLocaleString()}</td>
                    <td className="text-end">{money(p.amount)}</td>
                    <td>
                      <span className={`badge ${p.status === "paid" ? "text-bg-success" : p.status === "failed" ? "text-bg-danger" : "text-bg-warning"}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="actrs-card p-3">
          <h2 className="h6 fw-bold">Token history</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="small">{new Date(l.created_at).toLocaleString()}</td>
                    <td>{l.channel === "sms" ? "SMS" : "WhatsApp"}</td>
                    <td className={`text-end fw-semibold ${l.delta > 0 ? "text-success" : "text-danger"}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                    <td className="small text-muted">{l.reason}</td>
                    <td className="text-end small">{l.balance_after ?? ""}</td>
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
