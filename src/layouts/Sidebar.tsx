import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@config/navigation";
import { Brand } from "@components/Brand";

export function Sidebar() {
  return (
    <aside className="actrs-sidebar d-flex flex-column p-3" style={{ width: 260 }}>
      <div className="mb-4 px-1">
        <Brand />
      </div>
      <nav className="flex-grow-1">
        <ul className="nav nav-pills flex-column">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? "active" : ""}`}
                title={item.description}
              >
                <i className={`bi ${item.icon}`} />
                <span>{item.label}</span>
                {item.availableFromPhase > 0 && (
                  <span className="badge bg-light text-dark ms-auto" style={{ fontSize: "0.6rem" }}>
                    P{item.availableFromPhase}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="text-white-50 small px-1">Phase 0 &middot; Foundation</div>
    </aside>
  );
}
