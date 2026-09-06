import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";

/**
 * Real email/password sign-in against Supabase Auth (see
 * src/lib/supabaseClient.ts). Most accounts are created by a school
 * admin (Settings -> Staff) or a district/platform admin - a brand-new
 * SCHOOL, though, registers itself via /signup (see
 * edulink_gh_phase0w_school_self_signup.sql) rather than needing me to
 * set it up by hand; this screen only signs an already-created user in.
 */
export function CloudLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, error } = useCloudAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const signedInProfile = await signIn(email, password);
      const fallback = signedInProfile?.role === "district_admin" ? "/district" : "/dashboard";
      const redirectTo = (location.state as { from?: string } | null)?.from ?? fallback;
      navigate(redirectTo, { replace: true });
    } catch {
      // error is already surfaced via useCloudAuth().error
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="h5 text-center mb-1">Sign in</h1>
      <p className="text-muted text-center small mb-4">Access your school or district dashboard</p>

      {error && (
        <div className="alert alert-danger py-2 small" role="alert">
          {error}
        </div>
      )}

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
