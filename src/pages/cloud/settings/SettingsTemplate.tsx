import { useEffect, useState, type FormEvent } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from "@models/TemplateSettings";

type FormState = Omit<TemplateSettings, "updatedAt" | "id">;

/**
 * Settings -> Report template. Backed by the CloudTemplateSettingsService
 * that already existed (get/save, one row per school) - this is just its
 * first UI. Every field here is consumed by the report rendering
 * pipeline (ReportPage, ReportHeader, SignatureBlock, PdfService) with
 * no other code changes needed.
 */
export function SettingsTemplate() {
  const { profile } = useCloudAuth();
  const [form, setForm] = useState<FormState>(DEFAULT_TEMPLATE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile?.school_id) return;
    let cancelled = false;
    CloudTemplateSettingsService.get(profile.school_id)
      .then((settings) => {
        if (cancelled) return;
        const { updatedAt: _updatedAt, ...rest } = settings;
        setForm(rest);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Could not load template settings."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profile?.school_id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await CloudTemplateSettingsService.save(profile.school_id, form);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save template settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Loading template settings…</p>;
  if (loadError) return <div className="alert alert-danger">{loadError}</div>;

  return (
    <form onSubmit={handleSubmit}>
      {saveError && <div className="alert alert-danger py-2">{saveError}</div>}
      {saved && (
        <div className="alert alert-success py-2" role="status">
          Report template settings saved.
        </div>
      )}

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">Page setup</h2>
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label small">Paper size</label>
            <select
              className="form-select"
              value={form.paperSize}
              onChange={(e) => set("paperSize", e.target.value as FormState["paperSize"])}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">Orientation</label>
            <select
              className="form-select"
              value={form.orientation}
              onChange={(e) => set("orientation", e.target.value as FormState["orientation"])}
            >
              <option value="Portrait">Portrait</option>
              <option value="Landscape">Landscape</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">Margin (mm)</label>
            <input
              type="number"
              min={0}
              className="form-control"
              value={form.marginMm}
              onChange={(e) => set("marginMm", Number(e.target.value))}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small">Batch PDF mode</label>
            <select
              className="form-select"
              value={form.batchPdfMode}
              onChange={(e) => set("batchPdfMode", e.target.value as FormState["batchPdfMode"])}
            >
              <option value="single">One combined PDF</option>
              <option value="individual">One PDF per student</option>
            </select>
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">Typography &amp; colours</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small">Font family</label>
            <input className="form-control" value={form.fontFamily} onChange={(e) => set("fontFamily", e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label small">Font size (pt)</label>
            <input
              type="number"
              min={6}
              className="form-control"
              value={form.fontSizePt}
              onChange={(e) => set("fontSizePt", Number(e.target.value))}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small d-block">Primary colour</label>
            <div className="d-flex align-items-center gap-2">
              <input
                type="color"
                className="form-control form-control-color"
                value={form.primaryColorHex}
                onChange={(e) => set("primaryColorHex", e.target.value)}
              />
              <input
                className="form-control"
                value={form.primaryColorHex}
                onChange={(e) => set("primaryColorHex", e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small d-block">Secondary colour</label>
            <div className="d-flex align-items-center gap-2">
              <input
                type="color"
                className="form-control form-control-color"
                value={form.secondaryColorHex}
                onChange={(e) => set("secondaryColorHex", e.target.value)}
              />
              <input
                className="form-control"
                value={form.secondaryColorHex}
                onChange={(e) => set("secondaryColorHex", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">Watermark</h2>
        <div className="row g-3 align-items-center">
          <div className="col-md-4">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="showWatermark"
                checked={form.showWatermark}
                onChange={(e) => set("showWatermark", e.target.checked)}
              />
              <label className="form-check-label" htmlFor="showWatermark">
                Show school logo as a watermark
              </label>
            </div>
          </div>
          <div className="col-md-4">
            <label className="form-label small">Opacity ({Math.round(form.watermarkOpacity * 100)}%)</label>
            <input
              type="range"
              className="form-range"
              min={0}
              max={0.3}
              step={0.01}
              value={form.watermarkOpacity}
              onChange={(e) => set("watermarkOpacity", Number(e.target.value))}
              disabled={!form.showWatermark}
            />
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-4">
        <h2 className="h6 fw-bold mb-3">Signature titles</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small">Class teacher signature label</label>
            <input
              className="form-control"
              value={form.signatureTitleClassTeacher}
              onChange={(e) => set("signatureTitleClassTeacher", e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Head teacher signature label</label>
            <input
              className="form-control"
              value={form.signatureTitleHeadTeacher}
              onChange={(e) => set("signatureTitleHeadTeacher", e.target.value)}
            />
          </div>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save template settings"}
      </button>
    </form>
  );
}
