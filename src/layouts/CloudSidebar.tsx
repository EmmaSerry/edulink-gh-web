import { NavLink } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import type { UserRole } from "@/types/database";

const SCHOOL_ADMIN_ROLES: UserRole[] = ["school_admin", "district_admin", "platform_admin"];
const DISTRICT_ADMIN_ROLES: UserRole[] = ["district_admin", "platform_admin"];

interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** Hidden from the 'teacher' role - see edulink_gh_phase0l_role_access.sql. */
  adminOnly?: boolean;
  /** Hidden from everyone except district_admin/platform_admin - see
   *  edulink_gh_phase0n_district_dashboard.sql. A school_admin doesn't
   *  see this even though they otherwise see every admin-only item. */
  districtOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: "bi-speedometer2" },
  { path: "/district", label: "District overview", icon: "bi-diagram-3", districtOnly: true },
  { path: "/accounts", label: "Accounts", icon: "bi-people-fill", districtOnly: true },
  { path: "/students", label: "Students", icon: "bi-people" },
  { path: "/staff", label: "Staff", icon: "bi-person-badge", adminOnly: true },
  { path: "/assessments", label: "Assessment entry", icon: "bi-clipboard-check" },
  { path: "/report-remarks", label: "Remarks & attendance", icon: "bi-journal-text" },
  { path: "/reports", label: "Reports", icon: "bi-file-earmark-text" },
  { path: "/audit-log", label: "Audit log", icon: "bi-clock-history", adminOnly: true },
  { path: "/settings", label: "Settings", icon: "bi-gear", adminOnly: true },
];

export function CloudSidebar() {
  const { profile } = useCloudAuth();
  const isSchoolAdmin = !!profile && SCHOOL_ADMIN_ROLES.includes(profile.role);
  const isDistrictAdmin = !!profile && DISTRICT_ADMIN_ROLES.includes(profile.role);
  const items = NAV_ITEMS.filter((item) => {
    if (item.districtOnly) return isDistrictAdmin;
    if (item.adminOnly) return isSchoolAdmin;
    return true;
  });

  return (
    <aside className="actrs-sidebar d-flex flex-column p-3" style={{ width: 260 }}>
      <div className="mb-4 px-1 d-flex align-items-center gap-2">
        <span className="actrs-brand-mark">EG</span>
        <div className="lh-sm">
          <div className="fw-bold">EduLink GH</div>
          <div className="text-muted" style={{ fontSize: "0.7rem" }}>
            {profile?.role === "district_admin" ? "District dashboard" : "School dashboard"}
          </div>
        </div>
      </div>
      <nav className="flex-grow-1">
        <ul className="nav nav-pills flex-column">
          {items.map((item) => (
            <li className="nav-item" key={item.path}>
              <NavLink
                to={item.path}
                end
                className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? "active" : ""}`}
              >
                <i className={`bi ${item.icon}`} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="text-white-50 small px-1">EduLink GH &middot; Phase 1</div>
    </aside>
  );
}
