import { useEffect, useRef, useState, type FormEvent } from "react";
import { DistrictProfileService, type DistrictProfile } from "@services/cloud/DistrictProfileService";
import { CloudDistrictService } from "@services/cloud/DistrictService";
import { resizeImageToDataUrl } from "@/lib/imageResize";

/** Settings -> District profile (first tab for a district administrator). */
export function SettingsDistrict() {
  const [profile, setProfile] = useState<DistrictProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [director, setDirector] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    DistrictProfileService.get()
      .then((p) => {
        if (cancelled || !p) return;
        setProfile(p);
        setName(p.name ?? "");
        setRegion(p.region ?? "");
        setPhone(p.contact_phone ?? "");
        setEmail(p.contact_email ?? "");
        setAddress(p.address ?? "");
        setDirector(p.director_name ?? "");
        setLogo(p.logo_data_url ?? null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the district profile."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await DistrictProfileService.save(profile.id, { name, region, phone, email, address, director });
      setSuccess("District profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the district profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setError(null);
    setSuccess(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      await CloudDistrictService.setDistrictLogo(profile.id, dataUrl);
      setLogo(dataUrl);
      setSuccess("District logo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that logo.");
    }
  }

  async function removeLogo() {
    if (!profile) return;
    try {
      await CloudDistrictService.setDistrictLogo(profile.id, null);
      setLogo(null);
      setSuccess("District logo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the logo.");
    }
  }

  if (loading) return <p className="text-muted">Loading district profile…</p>;
  if (!profile) {
    return (
      <div className="alert alert-warning">
        {error ?? "Your account is not tied to one specific district, so there is no district profile to edit here."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave}>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">District logo</h2>
        <p className="text-muted small">Shown on report cards for every school in your district.</p>
        <div className="d-flex align-items-center gap-3">
          <div
            className="border d-flex align-items-center justify-content-center"
            style={{ width: 88, height: 88, borderRadius: 10, background: "#e9ecef", overflow: "hidden" }}
          >
            {logo ? (
              <img src={logo} alt="District logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span className="text-muted small">No logo</span>
            )}
          </div>
          <div className="d-flex flex-column gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={handleLogo} />
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => fileRef.current?.click()}>
              {logo ? "Replace logo" : "Upload logo"}
            </button>
            {logo && (
              <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={removeLogo}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="actrs-card p-4 mb-4">
        <h2 className="h6 fw-bold mb-3">District details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small">District name</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Region</label>
            <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">District Director of Education</label>
            <input className="form-control" value={director} onChange={(e) => setDirector(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Office address</label>
            <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Office phone</label>
            <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="col-md-6">
            <label className="form-label small">Office email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save district profile"}
      </button>
    </form>
  );
}
