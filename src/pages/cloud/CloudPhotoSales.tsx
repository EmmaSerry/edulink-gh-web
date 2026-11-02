import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PhotoSalesService, type PhotoOrderRow } from "@services/cloud/PhotoSalesService";

function money(n: number): string {
  return `GHS ${Number(n).toFixed(2)}`;
}

/**
 * Super Admin: set what the photo editor costs, and see who has paid.
 * The public editor (edulinkgh.com/tools/photo-editor.html) charges per
 * downloaded photo through Paystack, and per AI fix.
 */
export function CloudPhotoSales() {
  const [price, setPrice] = useState("1.00");
  const [aiPrice, setAiPrice] = useState("2.00");
  const [aiBulkPrice, setAiBulkPrice] = useState("1.50");
  const [aiBulkMin, setAiBulkMin] = useState("5");
  const [enabled, setEnabled] = useState(true);
  const [orders, setOrders] = useState<PhotoOrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    setError(null);
    try {
      const [s, o] = await Promise.all([PhotoSalesService.getSettings(), PhotoSalesService.listOrders()]);
      setPrice(Number(s.price).toFixed(2));
      setAiPrice(Number(s.aiPrice).toFixed(2));
      setAiBulkPrice(Number(s.aiBulkPrice).toFixed(2));
      setAiBulkMin(String(s.aiBulkMin));
      setEnabled(s.enabled);
      setOrders(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the photo editor settings.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await PhotoSalesService.setSettings({
        price: Number(price),
        aiPrice: Number(aiPrice),
        aiBulkPrice: Number(aiBulkPrice),
        aiBulkMin: Math.floor(Number(aiBulkMin)),
        enabled,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    const paid = (orders ?? []).filter((o) => o.status === "paid" && !o.is_free);
    return {
      revenue: paid.reduce((a, o) => a + Number(o.amount), 0),
      orders: paid.length,
      photos: paid.reduce((a, o) => a + o.downloads_used, 0),
      ai: paid.reduce((a, o) => a + o.ai_used, 0),
    };
  }, [orders]);

  return (
    <div>
      <h1 className="h4 mb-1">Photo editor</h1>
      <p className="text-muted">
        Anyone can edit photos at edulinkgh.com/tools/photo-editor.html and use the AI Photo Studio at
        edulinkgh.com/tools/ai-photo.html. Downloads and AI edits are paid through Paystack at the prices below. The
        AI price is lower when a customer edits the bulk number of photos or more at once. You (signed in as Super Admin) pass through free.
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={save} className="actrs-card p-3 mb-4" style={{ maxWidth: 560 }}>
        <h2 className="h6 fw-bold mb-3">Prices</h2>
        <div className="row g-3">
          <div className="col-6">
            <label className="form-label small">Price per downloaded photo (GHS)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="col-6">
            <label className="form-label small">AI edit, one photo (GHS each)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={aiPrice}
              onChange={(e) => setAiPrice(e.target.value)}
              required
            />
          </div>
          <div className="col-6">
            <label className="form-label small">AI edit, bulk (GHS each)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={aiBulkPrice}
              onChange={(e) => setAiBulkPrice(e.target.value)}
              required
            />
          </div>
          <div className="col-6">
            <label className="form-label small">Bulk starts at (photos)</label>
            <input
              type="number"
              step="1"
              min="2"
              className="form-control"
              value={aiBulkMin}
              onChange={(e) => setAiBulkMin(e.target.value)}
              required
            />
          </div>
          <div className="col-12">
            <div className="form-check">
              <input
                id="photoEnabled"
                type="checkbox"
                className="form-check-input"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label htmlFor="photoEnabled" className="form-check-label small">
                Editor is open for sale (untick to pause all downloads and AI fixes)
              </label>
            </div>
          </div>
        </div>
        <button className="btn btn-primary mt-3" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save prices"}
        </button>
        {saved && <span className="text-success small ms-3">Saved. New prices apply to the next payment.</span>}
      </form>

      <div className="row g-3 mb-4">
        <Stat label="Money received" value={money(totals.revenue)} />
        <Stat label="Paid orders" value={String(totals.orders)} />
        <Stat label="Photos downloaded" value={String(totals.photos)} />
        <Stat label="AI fixes used" value={String(totals.ai)} />
      </div>

      <div className="actrs-card p-0">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Email</th>
                <th className="text-end">Photos bought</th>
                <th className="text-end">AI fixes bought</th>
                <th className="text-end">Used</th>
                <th className="text-end">Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {orders === null && !error && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    Loading...
                  </td>
                </tr>
              )}
              {orders !== null && orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    No orders yet.
                  </td>
                </tr>
              )}
              {(orders ?? []).map((o) => (
                <tr key={o.id}>
                  <td className="text-nowrap">{new Date(o.created_at).toLocaleString()}</td>
                  <td>{o.email ?? "-"}</td>
                  <td className="text-end">{o.quantity}</td>
                  <td className="text-end">{o.ai_quantity}</td>
                  <td className="text-end">
                    {o.downloads_used} / {o.ai_used}
                  </td>
                  <td className="text-end">{o.is_free ? "Free" : money(o.amount)}</td>
                  <td>
                    <span
                      className={`badge ${o.status === "paid" ? "text-bg-success" : o.status === "failed" ? "text-bg-danger" : "text-bg-secondary"}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="small text-muted">{o.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-6 col-md-3">
      <div className="actrs-card p-3">
        <div className="text-muted small">{label}</div>
        <div className="h5 mb-0">{value}</div>
      </div>
    </div>
  );
}
