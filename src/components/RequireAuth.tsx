import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";

/** Redirects to /login when there is no active session, preserving the
 *  page the user was trying to reach so CloudLogin can send them back
 *  there after a successful sign-in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useCloudAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
