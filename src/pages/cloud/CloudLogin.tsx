import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";

/**
 * Real email/password sign-in against Supabase Auth (see
 * src/lib/supabaseClient.ts). Accounts themselves are created by a
 * platform/district/school admin (Authentication -> Users in Supabase,
 * for now - a self-service "create your school" flow is a later piece);
 * this screen only signs an already-created user in.
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
      await signIn(email, password);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
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
    </form>
  );
}
