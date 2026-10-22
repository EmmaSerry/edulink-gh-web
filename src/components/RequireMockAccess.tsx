import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import type { UserRole } from "@/types/database";

// Mock Exams: staff roles only. The database functions enforce what each role can actually see and change.
const MOCK_ROLES: UserRole[] = ["school_admin", "teacher", "district_admin", "platform_admin"];
const DISTRICT_ROLES: UserRole[] = ["district_admin", "platform_admin"];

export function RequireMockAccess({ children, district = false }: { children: ReactNode; district?: boolean }) {
  const { profile } = useCloudAuth();
  const allowed = district ? DISTRICT_ROLES : MOCK_ROLES;
  if (!profile || !allowed.includes(profile.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
