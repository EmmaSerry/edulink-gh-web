import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { CloudCircuitService } from "@services/cloud/CircuitService";
import { resizeImageToDataUrl } from "@/lib/imageResize";
import type { SchoolRow, CircuitRow } from "@/types/database";

type FormState = {
  name: string;
  school_code: string;
  circuit: string;
  region: string;
  postal_address: string;
  digital_address: string;
  physical_address: string;
  telephone: string;
  email: string;
  website: string;
  head_teacher_name: string;
  head_teacher_phone: string;
  motto: string;
  report_header: string;
  report_footer: string;
};

const BLANK: FormState = {
  name: "",
  school_code: "",
  circuit: "",
  region: "",
  postal_address: "",
  digital_address: "",
  physical_address: "",
  telephone: "",
  email: "",
  website: "",
  head_teacher_name: "",
  head_teacher_phone: "",
  motto: "",
  report_header: "",
  report_footer: "",
};

function rowToForm(row: SchoolRow): FormState {
  return {
    name: row.name ?? "",
    school_code: row.school_code ?? "",
    circuit: row.circuit ?? "",
    region: row.region ?? "",
    postal_address: row.postal_address ?? "",
    digital_address: row.digital_address ?? "",
    physical_address: row.physical_address ?? "",
    telephone: row.telephone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    head_teacher_name: row.head_teacher_name ?? "",
    head_teacher_phone: row.head_teacher_phone ?? "",
    motto: row.motto ?? "",
    report_header: row.report_header ?? "",
    report_footer: row.report_footer ?? "",
  };
}

/**
 * Settings -> School profile. Every field here is what
 * edulink_gh_term_school_setup_fix.sql used to have to fill in by hand
 * for each new school (school_code especially) - this is the
 * self-service replacement for that one-off SQL.
 */
export function SettingsSchool() {
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [circuits, setCircuits] = useState<CircuitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    CloudSchoolService.getProfile()
      .then(async (row) => {
        if (cancelled || !row) return;
        setSchool(row);
        setForm(rowToForm(row));
        setLogoDataUrl(row.logo_data_url);
        if (row.district_id) {
          const circuitRows = await CloudCircuitService.list(row.district_id);
          if (!cancelled) setCircuits(circuitRows);
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Could not load school profile."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function field<K extends keyof FormState>(key: K) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setLogoDataUrl(await resizeImageToDataUrl(file));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not process that image.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!school) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await CloudSchoolService.saveProfile(school.id, {
        ...form,
        logo_data_url: logoDataUrl,
      });
      setSchool(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Loading school profile…</p>;
  if (loadError) return <div className="alert alert-danger">{loadError}</div>;
  if (!school) return <div className="alert alert-warning">No school record found for your account.</div>;

  return (
    <form onSubmit={handleSubmit}>
      {saveError && <div className="alert alert-danger py-2">{saveError}</div>}
      {saved && (
        <div className="alert alert-success py-2" role="status">
          School profile saved.
        </div>
      )}

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">Logo</h2>
        <div className="d-flex align-items-center gap-3">
          <div
            className="border d-flex align-items-center justify-content-center"
            style={{ width: 88, height: 88, borderRadius: 10, background: "#e9ecef", overflow: "hidden", flexShrink: 0 }}
          >
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="School logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span className="text-muted small">No logo</span>
            )}
          </div>
          <div className="d-flex flex-column gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={handleLogoFile} />
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
              {logoDataUrl ? "Replace logo" : "Upload logo"}
            </button>
            {logoDataUrl && (
              <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => setLogoDataUrl(null)}>
                Remove
              </button>
            )}
          </div>
        </div>
        <p className="text-muted small mb-0 mt-2">Used on report cards and the print header.</p>
      </div>

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">School details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small">School name</label>
            <input className="form-control" required {...field("name")} />
          </div>
          <div className="col-md-3">
            <label className="form-label small">School code</label>
            <input className="form-control" {...field("school_code")} />
          </div>
          <div className="col-md-3">
            <label className="form-label small">Circuit</label>
            {circuits.length > 0 ? (
              <select
                className="form-select"
                value={form.circuit}
                onChange={(e) => setForm((f) => ({ ...f, circuit: e.target.value }))}
              >
                <option value="">Select…</option>
                {form.circuit && !circuits.some((c) => c.name === form.circuit) && (
                  <option value={form.circuit}>{form.circuit} (not in the managed list)</option>
                )}
                {circuits.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input className="form-control" {...field("circuit")} />
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label small">Region</label>
            <input className="form-control" {...field("region")} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Motto</label>
            <input className="form-control" {...field("motto")} />
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">Contact</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small">Telephone</label>
            <input className="form-control" {...field("telephone")} />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Email</label>
            <input type="email" className="form-control" {...field("email")} />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Website</label>
            <input className="form-control" {...field("website")} />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Digital address</label>
            <input className="form-control" {...field("digital_address")} />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Postal address</label>
            <input className="form-control" {...field("postal_address")} />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Physical address</label>
            <input className="form-control" {...field("physical_address")} />
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">Head teacher</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small">Name</label>
            <input className="form-control" {...field("head_teacher_name")} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Phone</label>
            <input className="form-control" {...field("head_teacher_phone")} />
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-4">
        <h2 className="h6 fw-bold mb-3">Report header / footer</h2>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small">Header text (shown above the report title)</label>
            <textarea className="form-control" rows={2} {...field("report_header")} />
          </div>
          <div className="col-12">
            <label className="form-label small">Footer text</label>
            <textarea className="form-control" rows={2} {...field("report_footer")} />
          </div>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save school profile"}
      </button>
    </form>
  );
}
