import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CloudSubscriptionService } from "@services/cloud/SubscriptionService";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudDistrictService } from "@services/cloud/DistrictService";
import { CloudBrandingService } from "@services/cloud/BrandingService";
import { resizeImageToDataUrl } from "@/lib/imageResize";
import type { PendingDistrictRow } from "@services/cloud/DistrictService";
import type {
  SchoolSubscriptionOverviewRow,
  SubscriptionPaymentRow,
  SubscriptionPaymentMethod,
  TermRow,
  IdleTimeoutSettings,
  PilotProgramSettings,
  DistrictPilotUsageRow,
  PublicBranding,
} from "@/types/database";

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

function RateCell({ row, onSaved }: { row: SchoolSubscriptionOverviewRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.subscription_price_per_term != null ? String(row.subscription_price_per_term) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsed = Number(value);
    if (value === "" || Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a rate of zero or more.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await CloudSubscriptionService.setSchoolRate(row.school_id, parsed);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this rate.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setEditing(true)}>
        {row.subscription_price_per_term != null ? money(row.subscription_price_per_term) : "Set rate"}
        {row.subscription_rate_is_custom && <span className="badge text-bg-secondary ms-1">custom</span>}
      </button>
    );
  }

  return (
    <div className="d-flex align-items-center gap-1" style={{ minWidth: 140 }}>
      <input
        type="number"
        min={0}
        step="0.01"
        className="form-control form-control-sm"
        style={{ width: 90 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
        ✓
      </button>
      <button type="button" className="btn btn-link btn-sm text-muted" onClick={() => setEditing(false)}>
        ✕
      </button>
      {error && <div className="text-danger small ms-1">{error}</div>}
    </div>
  );
}

function DefaultRatesForm({ onSaved }: { onSaved: (updated: number) => void }) {
  const [publicRate, setPublicRate] = useState("");
  const [privateRate, setPrivateRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    const pub = Number(publicRate);
    const priv = Number(privateRate);
    if (publicRate === "" || Number.isNaN(pub) || pub < 0 || privateRate === "" || Number.isNaN(priv) || priv < 0) {
      setError("Enter a rate of zero or more for both.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await CloudSubscriptionService.setDefaultRates(pub, priv);
      onSaved(result.updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply these rates.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 fw-bold mb-1">Default termly rates</h2>
      <p className="text-muted small mb-2">
        Applies to every school that hasn't had its own rate set individually - a school-specific rate (below) is
        never overwritten by this.
      </p>
      {error && <div className="alert alert-danger py-2 small mb-2">{error}</div>}
      <div className="row g-2 align-items-end">
        <div className="col-sm-3">
          <label className="form-label small">Public schools (GHS/term)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="form-control form-control-sm"
            value={publicRate}
            onChange={(e) => setPublicRate(e.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <label className="form-label small">Private schools (GHS/term)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="form-control form-control-sm"
            value={privateRate}
            onChange={(e) => setPrivateRate(e.target.value)}
          />
        </div>
        <div className="col-sm-3">
          <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleApply}>
            {saving ? "Applying…" : "Apply to non-custom schools"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Platform-wide branding - the one logo that replaces the "EG" badge
 * everywhere it appears (public homepage, login/signup, every role's
 * in-app sidebar - see BrandMark.tsx), plus a personal photo + caption
 * shown only on the login/signup screens (CloudAuthLayout). Both are
 * platform_admin-exclusive by design - see
 * edulink_gh_phase1h_platform_branding.sql. District logos
 * (district_admin, DistrictLogoPanel) and school logos (school_admin,
 * SettingsSchool) are a level below this and untouched.
 */
function PlatformBrandingPanel() {
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function load() {
    CloudBrandingService.getPublicBranding()
      .then((b) => {
        setBranding(b);
        setLogoDataUrl(b.platformLogoDataUrl);
        setPhotoDataUrl(b.superAdminPhotoDataUrl);
        setCaption(b.superAdminCaption ?? "");
      })
      .catch(() => setBranding(null));
  }

  useEffect(load, []);

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    setLogoSuccess(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setSavingLogo(true);
      await CloudBrandingService.setPlatformLogo(dataUrl);
      setLogoDataUrl(dataUrl);
      setLogoSuccess("Platform logo updated everywhere it appears.");
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Could not save that logo.");
    } finally {
      setSavingLogo(false);
      window.setTimeout(() => setLogoSuccess(null), 6000);
    }
  }

  async function handleRemoveLogo() {
    setSavingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      await CloudBrandingService.setPlatformLogo(null);
      setLogoDataUrl(null);
      setLogoSuccess("Platform logo removed - back to the default badge.");
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Could not remove that logo.");
    } finally {
      setSavingLogo(false);
      window.setTimeout(() => setLogoSuccess(null), 6000);
    }
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoSuccess(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setSavingPhoto(true);
      await CloudBrandingService.setSuperAdminPhoto(dataUrl, caption);
      setPhotoDataUrl(dataUrl);
      setPhotoSuccess("Photo updated on the login screen.");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not save that photo.");
    } finally {
      setSavingPhoto(false);
      window.setTimeout(() => setPhotoSuccess(null), 6000);
    }
  }

  async function handleRemovePhoto() {
    setSavingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);
    try {
      await CloudBrandingService.setSuperAdminPhoto(null, caption);
      setPhotoDataUrl(null);
      setPhotoSuccess("Photo removed from the login screen.");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not remove that photo.");
    } finally {
      setSavingPhoto(false);
      window.setTimeout(() => setPhotoSuccess(null), 6000);
    }
  }

  async function handleSaveCaption(e: FormEvent) {
    e.preventDefault();
    setSavingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);
    try {
      await CloudBrandingService.setSuperAdminPhoto(photoDataUrl, caption);
      setPhotoSuccess("Caption saved.");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not save that caption.");
    } finally {
      setSavingPhoto(false);
      window.setTimeout(() => setPhotoSuccess(null), 6000);
    }
  }

  if (!branding) return null;

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 fw-bold mb-1">Platform branding</h2>
      <p className="text-muted small mb-3">
        Yours to set, exclusively - replaces the "EG" badge on the public homepage, the login/signup screens, and
        every role's sidebar once uploaded. A district admin can still set their own district's logo, and a school
        admin their own school's logo (both already appear on report cards) - this is a level above those, for the
        platform as a whole.
      </p>

      <div className="row g-4">
        <div className="col-md-6">
          <h3 className="h6 mb-2" style={{ fontSize: "0.9rem" }}>
            Platform logo
          </h3>
          {logoSuccess && <div className="alert alert-success py-2 small">{logoSuccess}</div>}
          {logoError && <div className="alert alert-danger py-2 small">{logoError}</div>}
          <div className="d-flex align-items-center gap-3">
            <div
              className="border d-flex align-items-center justify-content-center"
              style={{ width: 72, height: 72, borderRadius: 10, background: "#e9ecef", overflow: "hidden", flexShrink: 0 }}
            >
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="Platform logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <span className="text-muted small">EG badge</span>
              )}
            </div>
            <div className="d-flex flex-column gap-2">
              <input ref={logoInputRef} type="file" accept="image/*" className="d-none" onChange={handleLogoFile} />
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={savingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoDataUrl ? "Replace logo" : "Upload logo"}
              </button>
              {logoDataUrl && (
                <button type="button" className="btn btn-link btn-sm text-danger p-0" disabled={savingLogo} onClick={handleRemoveLogo}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <h3 className="h6 mb-2" style={{ fontSize: "0.9rem" }}>
            Your photo (login screen only)
          </h3>
          {photoSuccess && <div className="alert alert-success py-2 small">{photoSuccess}</div>}
          {photoError && <div className="alert alert-danger py-2 small">{photoError}</div>}
          <div className="d-flex align-items-center gap-3 mb-2">
            <div
              className="border d-flex align-items-center justify-content-center"
              style={{ width: 72, height: 72, borderRadius: "50%", background: "#e9ecef", overflow: "hidden", flexShrink: 0 }}
            >
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="Your photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="text-muted small">No photo</span>
              )}
            </div>
            <div className="d-flex flex-column gap-2">
              <input ref={photoInputRef} type="file" accept="image/*" className="d-none" onChange={handlePhotoFile} />
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                disabled={savingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                {photoDataUrl ? "Replace photo" : "Upload photo"}
              </button>
              {photoDataUrl && (
                <button type="button" className="btn btn-link btn-sm text-danger p-0" disabled={savingPhoto} onClick={handleRemovePhoto}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <form className="d-flex align-items-end gap-2" onSubmit={handleSaveCaption}>
            <div className="flex-grow-1">
              <label className="form-label small mb-1">Caption (e.g. "Emmanuel Serry, Platform Administrator")</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-outline-primary btn-sm" disabled={savingPhoto}>
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * The free-pilot-program control - see
 * edulink_gh_phase1f_free_pilot_program.sql. One setting (how many of
 * a NEW district's first schools get a free term, 0 to turn it off)
 * plus a read-only usage table so Emmanuel can see which recently
 * approved districts are mid-pilot without opening each one's own
 * school list. Districts approved before the program started never
 * appear here - the program is deliberately going-forward only, so
 * there's nothing retroactive to show for them.
 */
function PilotProgramPanel() {
  const [settings, setSettings] = useState<PilotProgramSettings | null>(null);
  const [usage, setUsage] = useState<DistrictPilotUsageRow[] | null>(null);
  const [slots, setSlots] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [optInEmail, setOptInEmail] = useState("");
  const [optInSaving, setOptInSaving] = useState(false);
  const [optInError, setOptInError] = useState<string | null>(null);
  const [optInSuccess, setOptInSuccess] = useState<string | null>(null);

  function load() {
    Promise.all([CloudSubscriptionService.getPilotProgramSettings(), CloudSubscriptionService.listDistrictPilotUsage()])
      .then(([s, u]) => {
        setSettings(s);
        setSlots(String(s.slotsPerDistrict));
        setUsage(u);
      })
      .catch(() => {
        setSettings(null);
        setUsage(null);
      });
  }

  useEffect(load, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const value = Number(slots);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Enter zero (to turn the program off) or a positive number of slots.");
      }
      await CloudSubscriptionService.setPilotSlotsPerDistrict(value);
      setSuccess("Pilot program setting updated.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the pilot program setting.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSuccess(null), 6000);
    }
  }

  async function handleOptIn(e: FormEvent) {
    e.preventDefault();
    setOptInSaving(true);
    setOptInError(null);
    setOptInSuccess(null);
    try {
      const email = optInEmail.trim();
      if (!email) throw new Error("Enter the district admin's sign-in email.");
      const result = await CloudSubscriptionService.setDistrictPilotOptInByAdminEmail(email, true);
      setOptInSuccess(`${result.districtName} opted into the pilot program. New schools registering under it from now will get a free first term.`);
      setOptInEmail("");
      load();
    } catch (err) {
      setOptInError(err instanceof Error ? err.message : "Could not opt this district in.");
    } finally {
      setOptInSaving(false);
      window.setTimeout(() => setOptInSuccess(null), 8000);
    }
  }

  if (!settings) return null;

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 fw-bold mb-1">Free pilot program</h2>
      <p className="text-muted small mb-3">
        The first schools to self-register under any district approved from{" "}
        {new Date(settings.startedAt).toLocaleDateString()} onward get their first term's subscription waived
        automatically - no payment, no extra approval step for you. Existing districts and schools are unaffected.
        Set this to 0 to turn it off for any district approved from now on - schools already granted a free term
        keep it.
      </p>
      {success && <div className="alert alert-success py-2 small">{success}</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <form className="d-flex flex-wrap align-items-end gap-3 mb-3" onSubmit={handleSave}>
        <div>
          <label className="form-label small mb-1">Free slots per new district</label>
          <input
            type="number"
            min={0}
            className="form-control form-control-sm"
            style={{ width: 100 }}
            value={slots}
            onChange={(e) => setSlots(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-outline-primary btn-sm" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="border-top pt-3 mb-3">
        <h3 className="h6 mb-1" style={{ fontSize: "0.9rem" }}>
          Opt an already-existing district in
        </h3>
        <p className="text-muted small mb-2">
          For a district that was approved before the date above - find it by its district admin's own sign-in
          email. Only schools that register AFTER this takes effect get a free term; nothing already registered
          under the district changes.
        </p>
        {optInSuccess && <div className="alert alert-success py-2 small">{optInSuccess}</div>}
        {optInError && <div className="alert alert-danger py-2 small">{optInError}</div>}
        <form className="d-flex flex-wrap align-items-end gap-3" onSubmit={handleOptIn}>
          <div>
            <label className="form-label small mb-1">District admin's email</label>
            <input
              type="email"
              className="form-control form-control-sm"
              style={{ width: 240 }}
              placeholder="admin@example.com"
              value={optInEmail}
              onChange={(e) => setOptInEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-outline-primary btn-sm" disabled={optInSaving}>
            {optInSaving ? "Working…" : "Opt district in"}
          </button>
        </form>
      </div>

      {usage && usage.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm mb-0 align-middle">
            <thead>
              <tr>
                <th>District</th>
                <th className="text-end">Free slots used</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((d) => (
                <tr key={d.district_id}>
                  <td>
                    {d.district_name}
                    {d.opted_in && <span className="badge text-bg-info ms-2">Opted in</span>}
                    <div className="text-muted small">{d.region ?? "No region"}</div>
                  </td>
                  <td className="text-end">
                    {d.used} / {d.slots_per_district}
                    {d.slots_per_district > 0 && d.used >= d.slots_per_district && (
                      <span className="badge text-bg-secondary ms-2">Full</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {usage && usage.length === 0 && (
        <p className="text-muted small mb-0">No districts have been approved under the pilot program yet.</p>
      )}
    </div>
  );
}

function RecordPaymentForm({ school, onDone }: { school: SchoolSubscriptionOverviewRow; onDone: () => void }) {
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [amount, setAmount] = useState(school.subscription_price_per_term != null ? String(school.subscription_price_per_term) : "");
  const [method, setMethod] = useState<SubscriptionPaymentMethod>("cash");
  const [termId, setTermId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    CloudTermService.list(undefined, school.school_id).then((rows) => {
      if (cancelled) return;
      setTerms(rows);
      setTermId(rows.find((t) => t.is_active)?.id ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [school.school_id]);

  async function handleSubmit() {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!termId) {
      setError("Select which term this payment covers.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const term = terms.find((t) => t.id === termId);
      await CloudSubscriptionService.recordAndApprove({
        schoolId: school.school_id,
        amount: value,
        method,
        termId,
        reference: reference.trim() || null,
        periodLabel: term?.term_name ?? null,
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
          <select className="form-select form-select-sm" value={termId} onChange={(e) => setTermId(e.target.value)}>
            <option value="">{terms.length === 0 ? "No terms yet" : "Select a term…"}</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.term_name}
                {t.is_active ? " (current)" : ""}
              </option>
            ))}
          </select>
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
 * Self-registered districts waiting on approval - the district-level
 * counterpart of the school-signup panel below. Districts have no
 * "confirmed payment" concept of their own (only their schools do), so
 * unlike the school panel this is a plain one-click Approve with no
 * payment badge. Also unlike school approval, there's no SMS leg here
 * for now - see CloudDistrictService.approveDistrict, and
 * edulink_gh_district_signup.sql.
 */
function PendingDistrictsPanel() {
  const [pending, setPending] = useState<PendingDistrictRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  function load() {
    CloudDistrictService.getPendingDistricts()
      .then(setPending)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load pending districts."));
  }

  useEffect(load, []);

  async function handleApprove(row: PendingDistrictRow) {
    if (!confirm(`Approve ${row.name} as a new district?`)) return;
    setApprovingId(row.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await CloudDistrictService.approveDistrict(row.id);
      setActionSuccess(`${row.name} approved. Schools can now sign up under it.`);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not approve this district.");
    } finally {
      setApprovingId(null);
      window.setTimeout(() => setActionSuccess(null), 6000);
    }
  }

  async function handleReject(row: PendingDistrictRow) {
    if (
      !confirm(
        `Reject ${row.name}?\n\nThis permanently removes the application and its sign-in account - it cannot be undone. ` +
          `The same email address can register again afterwards.`
      )
    )
      return;
    setRejectingId(row.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await CloudDistrictService.rejectDistrictApplication(row.id);
      setActionSuccess(`${row.name} was rejected and removed.`);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reject this application.");
    } finally {
      setRejectingId(null);
      window.setTimeout(() => setActionSuccess(null), 6000);
    }
  }

  if (loadError) return null;
  if (pending === null) return null;

  return (
    <div className="actrs-card p-0 mb-4">
      <div className="p-3 border-bottom">
        <h2 className="h6 fw-bold mb-0">Pending district signups ({pending.length})</h2>
      </div>
      {actionSuccess && <div className="alert alert-success py-2 mx-3 mt-3 mb-0">{actionSuccess}</div>}
      {actionError && <div className="alert alert-danger py-2 mx-3 mt-3 mb-0">{actionError}</div>}
      {pending.length === 0 && <p className="text-muted p-3 mb-0">Nothing waiting on you right now.</p>}
      {pending.length > 0 && (
        <table className="table mb-0 align-middle">
          <tbody>
            {pending.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="fw-semibold">{d.name}</div>
                  <div className="text-muted small">
                    {d.region || "No region"} · {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="text-muted small">
                  {d.requested_by_name && <div>{d.requested_by_name}</div>}
                  {d.requested_by_phone && <div>{d.requested_by_phone}</div>}
                </td>
                <td className="text-end text-nowrap">
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm me-2"
                    disabled={approvingId === d.id || rejectingId === d.id}
                    onClick={() => handleReject(d)}
                  >
                    {rejectingId === d.id ? "Removing…" : "Reject"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={approvingId === d.id || rejectingId === d.id}
                    onClick={() => handleApprove(d)}
                  >
                    {approvingId === d.id ? "Working…" : "Approve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
/**
 * The platform-wide idle-session timeout default - moved here from the
 * District Dashboard (see CloudDistrictDashboard.tsx's
 * SessionTimeoutPanel) because it isn't about any one district, it's a
 * platform-wide setting, so it belongs on the platform_admin-only Super
 * Admin Dashboard instead. Same get_idle_timeout_settings()/
 * set_platform_idle_timeout() RPCs as before (edulink_gh_phase0z_idle_
 * timeout_and_signup_fix.sql) - only where this control lives changed,
 * not how it works.
 */
function PlatformIdleTimeoutPanel() {
  const [settings, setSettings] = useState<IdleTimeoutSettings | null>(null);
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    CloudDistrictService.getIdleTimeoutSettings()
      .then((s) => {
        setSettings(s);
        setMinutes(String(s.platformDefaultMinutes));
      })
      .catch(() => setSettings(null));
  }

  useEffect(load, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const value = Number(minutes);
      if (!Number.isFinite(value) || value < 1 || value > 480) {
        throw new Error("Choose a timeout between 1 and 480 minutes.");
      }
      await CloudDistrictService.setPlatformIdleTimeout(value);
      setSuccess("Platform-wide session timeout updated.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the session timeout.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSuccess(null), 6000);
    }
  }

  if (!settings?.canSetPlatform) return null;

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 fw-bold mb-1">Platform-wide session timeout</h2>
      <p className="text-muted small mb-3">
        Signs a device out automatically after this many minutes of inactivity - applies to every district that
        hasn't set its own override. Currently <strong>{settings.effectiveMinutes} minutes</strong>.
      </p>
      {success && <div className="alert alert-success py-2 small">{success}</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <form className="d-flex flex-wrap align-items-end gap-3" onSubmit={handleSave}>
        <div>
          <label className="form-label small mb-1">Minutes</label>
          <input
            type="number"
            min={1}
            max={480}
            className="form-control form-control-sm"
            style={{ width: 100 }}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-outline-primary btn-sm" disabled={saving}>
          {saving ? "Saving…" : "Save platform default"}
        </button>
      </form>
    </div>
  );
}

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

      <PlatformBrandingPanel />

      <PendingDistrictsPanel />

      <PilotProgramPanel />

      <PlatformIdleTimeoutPanel />

      <DefaultRatesForm
        onSaved={(updated) => {
          setActionSuccess(`Default rates applied to ${updated} school${updated === 1 ? "" : "s"}.`);
          load();
          window.setTimeout(() => setActionSuccess(null), 6000);
        }}
      />

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
              <th>Rate / term</th>
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
                      {row.is_pilot && <span className="badge text-bg-info ms-2">Pilot</span>}
                      {row.pending_payment_count > 0 && (
                        <span className="badge text-bg-warning ms-2">{row.pending_payment_count} pending</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <RateCell row={row} onSaved={load} />
                  </td>
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
