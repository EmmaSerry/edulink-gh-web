import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { auth } from "@/lib/supabaseClient";
import { CloudDistrictSignupService } from "@services/cloud/DistrictSignupService";

/**
 * Public "Register your district" page - the district-level counterpart
 * of CloudSchoolSignup.tsx. See edulink_gh_district_signup.sql for what
 * actually happens server-side (a district + its own district_admin
 * profile, in one RPC) and for why this sits behind platform_admin
 * approval rather than going live immediately: a district is a bigger,
 * rarer, higher-trust registration than one school, since every school
 * that signs up afterwards will pick it from a dropdown by name - see
 * RequireApprovedSchool for the "Almost there" screen this account
 * lands on until approved.
 *
 * Same two-network-step pattern as school sign-up, in order: sign the
 * person up as a brand new Supabase Auth user AND keep that session (no
 * existing admin session to protect here - this account IS what's being
 * created); then call register_district_self_service() as that
 * now-signed-in user, since it identifies the account via auth.uid()
 * rather than trusting an id the browser could send.
 */
export function CloudDistrictSignup() {
  const navigate = useNavigate();
  const { signIn } = useCloudAuth();

  const [districtName, setDistrictName] = useState("");
  const [region, setRegion] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const readyToSubmit = useMemo(
    () =>
      districtName.trim().length > 0 &&
      fullName.trim().length > 0 &&
      phone.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      passwordsMatch,
    [districtName, fullName, phone, email, password, passwordsMatch]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await auth.signUpAndSignIn(email.trim(), password);

      await CloudDistrictSignupService.register({
        districtName: districtName.trim(),
        region: region.trim(),
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
      <h1 className="h5 text-center mb-1">Register your district</h1>
      <p className="text-muted text-center small mb-4">
        Set up your district and your own district administrator account in one step. Schools in your district can
        register themselves once your district is approved.
      </p>

      {submitError && (
        <div className="alert alert-danger py-2 small" role="alert">
          {submitError}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label small">District name</label>
        <input className="form-control" value={districtName} onChange={(e) => setDistrictName(e.target.value)} required />
      </div>

      <div className="mb-3">
        <label className="form-label small">Region</label>
        <input className="form-control" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      <hr className="my-4" />

      <div className="mb-3">
        <label className="form-label small">Your full name</label>
        <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <div className="form-text">This is the person signing up - you, as the district administrator.</div>
      </div>
      <div className="mb-3">
        <label className="form-label small">Your phone number</label>
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
        {submitting ? "Setting up your district…" : "Register district"}
      </button>

      <p className="text-center small text-muted mt-3 mb-0">
        Registering a single school instead? <Link to="/signup">Register your school</Link>
      </p>
      <p className="text-center small text-muted mt-1 mb-0">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}
