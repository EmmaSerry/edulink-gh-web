import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import type { UserRole } from "@/types/database";

const SCHOOL_ADMIN_ROLES: UserRole[] = ["school_admin", "district_admin", "platform_admin"];
const DISTRICT_ADMIN_ROLES: UserRole[] = ["district_admin", "platform_admin"];

/**
 * Route-level companion to CloudSidebar's role-based nav filtering -
 * hiding a link isn't enough on its own, since a user could still type
 * the URL directly. Redirects to /dashboard rather than showing a bare
 * error, matching how RequireAuth redirects an unauthenticated visit to
 * /login. Defaults to "school admin and above" (Settings, Audit log);
 * pass roles="district" for the district-only screens (a school_admin
 * has no business browsing other schools' data even read-only).
 */
export function RequireAdmin({ children, roles = "school" }: { children: ReactNode; roles?: "school" | "district" }) {
  const { profile } = useCloudAuth();
  const allowed = roles === "district" ? DISTRICT_ADMIN_ROLES : SCHOOL_ADMIN_ROLES;
  if (!profile || !allowed.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
