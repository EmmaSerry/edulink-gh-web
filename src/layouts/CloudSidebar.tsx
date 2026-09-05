import { NavLink } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: "bi-speedometer2" },
  { path: "/students", label: "Students", icon: "bi-people" },
  { path: "/students/register", label: "Register student", icon: "bi-person-plus" },
  { path: "/assessments", label: "Assessment entry", icon: "bi-clipboard-check" },
];

export function CloudSidebar() {
  const { profile } = useCloudAuth();

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
          {NAV_ITEMS.map((item) => (
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
