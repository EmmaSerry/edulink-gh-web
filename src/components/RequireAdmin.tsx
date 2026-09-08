import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import type { UserRole } from "@/types/database";

const SCHOOL_ADMIN_ROLES: UserRole[] = ["school_admin", "district_admin", "platform_admin"];
const DISTRICT_ADMIN_ROLES: UserRole[] = ["district_admin", "platform_admin"];
const FEE_MANAGER_ROLES: UserRole[] = ["bursar", "school_admin", "district_admin", "platform_admin"];
// Deliberately narrower than DISTRICT_ADMIN_ROLES - subscription
// payment approval is Emmanuel's own call, not a district_admin's, per
// edulink_gh_phase1d_subscriptions.sql ("all payment approval should
// be done by me").
const PLATFORM_ADMIN_ROLES: UserRole[] = ["platform_admin"];
// A school reporting its own subscription payment - district_admin/
// platform_admin have no single school to submit one for.
const SUBSCRIPTION_SUBMIT_ROLES: UserRole[] = ["school_admin", "bursar"];

/**
 * Route-level companion to CloudSidebar's role-based nav filtering -
 * hiding a link isn't enough on its own, since a user could still type
 * the URL directly. Redirects to /dashboard rather than showing a bare
 * error, matching how RequireAuth redirects an unauthenticated visit to
 * /login. Defaults to "school admin and above" (Settings, Audit log);
 * pass roles="district" for the district-only screens (a school_admin
 * has no business browsing other schools' data even read-only), or
 * roles="fees" for Fees specifically - the one screen a bursar needs
 * that isn't otherwise "school admin and above" (see
 * edulink_gh_phase1a_fees.sql's is_fee_manager()).
 */
export function RequireAdmin({
  children,
  roles = "school",
}: {
  children: ReactNode;
  roles?: "school" | "district" | "fees" | "platform" | "subscription";
}) {
  const { profile } = useCloudAuth();
  const allowed =
    roles === "district"
      ? DISTRICT_ADMIN_ROLES
      : roles === "fees"
        ? FEE_MANAGER_ROLES
        : roles === "platform"
          ? PLATFORM_ADMIN_ROLES
          : roles === "subscription"
            ? SUBSCRIPTION_SUBMIT_ROLES
            : SCHOOL_ADMIN_ROLES;
  if (!profile || !allowed.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
