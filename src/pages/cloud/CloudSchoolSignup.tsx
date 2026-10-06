import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { auth } from "@/lib/supabaseClient";
import { CloudSchoolSignupService } from "@services/cloud/SchoolSignupService";
import type { DistrictOption, CircuitOption } from "@/types/database";

/**
 * Public "Register your school" page - the self-service replacement
 * for me setting up a new school by hand via SQL. See
 * edulink_gh_phase0w_school_self_signup.sql for what actually happens
 * server-side (school + admin profile + a full starter curriculum, all
 * in one RPC).
 *
 * The person filling this in becomes the school's ADMINISTRATOR
 * account (role school_admin) - not necessarily the head teacher.
 * Their name and phone go on their own user profile only; the school's
 * head teacher name/phone are separate fields, filled in later under
 * Settings -> School profile.
 *
 * Two network steps on submit, in order: sign the person up as a brand
 * new Supabase Auth user AND keep that session (unlike staff creation,
 * there's no existing admin session to protect here - this account IS
 * the one being created); then call register_school_self_service() as
 * that now-signed-in user, since it identifies the account via
 * auth.uid() rather than trusting an id the browser could send.
 */
export function CloudSchoolSignup() {
  const navigate = useNavigate();
  const { signIn } = useCloudAuth();

  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [circuits, setCircuits] = useState<CircuitOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [circuitChoice, setCircuitChoice] = useState("");
  const [customCircuit, setCustomCircuit] = useState("");
  const [region, setRegion] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Name-already-taken check (see edulink_gh_phase1l_school_name_check.sql).
  // null = not checked yet / nothing to check. If the check itself
  // fails (e.g. a dropped connection) it fails OPEN - registration is
  // never blocked just because this helper couldn't be reached.
  const [nameTaken, setNameTaken] = useState<boolean | null>(null);

  useEffect(() => {
    CloudSchoolSignupService.listDistricts()
      .then(setDistricts)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load the list of districts."));
  }, []);

  useEffect(() => {
    if (!districtId) {
      setCircuits([]);
      setCircuitChoice("");
      return;
    }
    CloudSchoolSignupService.listCircuits(districtId).then((rows) => {
      setCircuits(rows);
      setCircuitChoice("");
      const district = districts.find((d) => d.id === districtId);
      if (district?.region) setRegion(district.region);
    });
  }, [districtId]);

  useEffect(() => {
    setNameTaken(null);
    const name = schoolName.trim();
    if (!districtId || name.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      CloudSchoolSignupService.isNameTaken(districtId, name)
        .then((taken) => !cancelled && setNameTaken(taken))
        .catch(() => !cancelled && setNameTaken(null));
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [schoolName, districtId]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const readyToSubmit = useMemo(
    () =>
      schoolName.trim().length > 0 &&
      nameTaken !== true &&
      districtId.length > 0 &&
      fullName.trim().length > 0 &&
      phone.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      passwordsMatch,
    [schoolName, nameTaken, districtId, fullName, phone, email, password, passwordsMatch]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Re-check right before creating anything, in case the on-screen
      // check hadn't finished (or a name was taken in the meantime).
      // Fails open if the check can't be reached.
      const taken = await CloudSchoolSignupService.isNameTaken(districtId, schoolName.trim()).catch(() => false);
      if (taken) {
        setNameTaken(true);
        setSubmitting(false);
        return;
      }

      await auth.signUpAndSignIn(email.trim(), password);

      const circuit = circuitChoice === "__other__" ? customCircuit.trim() : circuitChoice;
      await CloudSchoolSignupService.register({
        schoolName: schoolName.trim(),
        districtId,
        circuit,
        region: region.trim(),
        isPrivate,
        fullName: fullName.trim(),
        phone: phone.trim(),
      });

      // Puts the freshly-created profile into the shared auth context,
      // not just localStorage - every page reads profile from there.
      await signIn(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not complete registration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="h5 text-center mb-1">Register your school</h1>
      <p className="text-muted text-center small mb-4">Set up your school and your own admin account in one step</p>

      {loadError && <div className="alert alert-danger py-2 small">{loadError}</div>}
      {submitError && (
        <div className="alert alert-danger py-2 small" role="alert">
          {submitError}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label small">School name</label>
        <input className="form-control" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
        {nameTaken === true && (
          <div className="alert alert-danger py-2 small mt-2 mb-0" role="alert">
            A school named &ldquo;{schoolName.trim()}&rdquo; is already registered in this district. If this is your
            school, please don't register it again &mdash; contact your district office, or WhatsApp EduLink GH on
            0203555130. If it is a different school, add its town or area to the name (for example &ldquo;St.
            Mary's Basic School, Anakum&rdquo;).
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label small">District</label>
        <select className="form-select" value={districtId} onChange={(e) => setDistrictId(e.target.value)} required>
          <option value="">Select a district…</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="form-text">
          Don't see your district listed? <Link to="/signup/district">Register your district first</Link>.
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small">Circuit (optional)</label>
        <select
          className="form-select"
          value={circuitChoice}
          onChange={(e) => setCircuitChoice(e.target.value)}
          disabled={!districtId}
        >
          <option value="">{districtId ? "None / not sure" : "Choose a district first"}</option>
          {circuits.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value="__other__">My circuit isn't listed…</option>
        </select>
        {circuitChoice === "__other__" && (
          <input
            className="form-control mt-2"
            placeholder="Type your circuit's name"
            value={customCircuit}
            onChange={(e) => setCustomCircuit(e.target.value)}
          />
        )}
      </div>

      <div className="mb-3">
        <label className="form-label small">Region</label>
        <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      <div className="mb-3 form-check">
        <input
          type="checkbox"
          className="form-check-input"
          id="isPrivate"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <label className="form-check-label small" htmlFor="isPrivate">
          This is a private school
        </label>
      </div>

      <hr className="my-4" />

      <div className="mb-3">
        <label className="form-label small">School administrator's full name</label>
        <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <div className="form-text">
          This is the person signing up - you, as the school's administrator. The head teacher's details can be added
          later under Settings &rarr; School profile.
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label small">School administrator's phone number</label>
        <input
          type="tel"
          className="form-control"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 0241234567"
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label small">Email</label>
        <input
          type="email"
          className="form-control"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div className="mb-3">
        <label className="form-label small">Password</label>
        <input
          type="password"
          className="form-control"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <div className="form-text">At least 6 characters.</div>
      </div>
      <div className="mb-3">
        <label className="form-label small">Confirm password</label>
        <input
          type="password"
          className="form-control"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <div className="form-text text-danger">Passwords do not match.</div>
        )}
      </div>

      <button className="btn btn-primary w-100" type="submit" disabled={!readyToSubmit || submitting}>
        {submitting ? "Setting up your school…" : "Register school"}
      </button>

      <p className="text-center small text-muted mt-3 mb-0">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}
