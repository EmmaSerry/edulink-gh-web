import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import type { UserRole } from "@/types/database";

const ADMIN_ROLES: UserRole[] = ["school_admin", "district_admin", "platform_admin"];

/**
 * Route-level companion to CloudSidebar's adminOnly nav filtering -
 * hiding the link isn't enough on its own, since a teacher could still
 * type /settings or /audit-log directly. Redirects to /dashboard rather
 * than showing a bare error, matching how RequireAuth redirects an
 * unauthenticated visit to /login.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile } = useCloudAuth();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
