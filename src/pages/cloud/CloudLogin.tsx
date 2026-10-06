import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CodeLoginService } from "@services/cloud/CodeLoginService";

/**
 * Real sign-in against Supabase Auth (see src/lib/supabaseClient.ts).
 * The first box takes EITHER an email address OR a school code (e.g.
 * WAC0001) - anything without an "@" is treated as a school code and
 * signs in that school's administrator (see CodeLoginService). Most
 * accounts are created by a school admin (Settings -> Staff) or a
 * district/platform admin - a brand-new SCHOOL, though, registers
 * itself via /signup (see edulink_gh_phase0w_school_self_signup.sql)
 * rather than needing me to set it up by hand; this screen only signs
 * an already-created user in.
 */
export function CloudLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, error } = useCloudAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setCodeError(null);
    try {
      const value = identifier.trim();
      const redirectFrom = (location.state as { from?: string } | null)?.from;

      if (value.includes("@")) {
        const signedInProfile = await signIn(value, password);
        const fallback = signedInProfile?.role === "district_admin" ? "/district" : "/dashboard";
        navigate(redirectFrom ?? fallback, { replace: true });
      } else {
        await CodeLoginService.signIn(value, password);
        // Full page load so the auth context restores the new session
        // and loads the profile, exactly as it does after a refresh.
        window.location.assign(redirectFrom ?? "/dashboard");
      }
    } catch (err) {
      // For the email path the error is already surfaced via useCloudAuth().error
      if (!identifier.trim().includes("@")) {
        setCodeError(err instanceof Error ? err.message : "Sign-in failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const shownError = codeError ?? error;

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="h5 text-center mb-1">Sign in</h1>
      <p className="text-muted text-center small mb-4">Access your school or district dashboard</p>

      {shownError && (
        <div className="alert alert-danger py-2 small" role="alert">
          {shownError}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label small">Email or school code</label>
        <input
          type="text"
          className="form-control"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />
        <div className="form-text">School administrators can use the school code (e.g. WAC0001) instead of an email.</div>
      </div>
      <div className="mb-3">
        <label className="form-label small">Password</label>
        <input
          type="password"
          className="form-control"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center small text-muted mt-3 mb-0">
        New school? <Link to="/signup">Register it here</Link>
      </p>
    </form>
  );
}
