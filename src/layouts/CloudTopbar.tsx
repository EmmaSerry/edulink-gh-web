import { useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { useThemeMode } from "@contexts/ThemeContext";

/** Simplified counterpart of the offline app's Topbar - a school/role
 *  indicator plus sign-out, in place of the offline-only global search
 *  and connectivity badge (those two are meaningless once accounts and
 *  data live in the cloud rather than on one device). Also the one place
 *  the light/dark toggle lives - it's a per-device display preference,
 *  not something any other screen needs to know about. */
export function CloudTopbar() {
  const navigate = useNavigate();
  const { profile, signOut } = useCloudAuth();
  const { mode, toggle } = useThemeMode();

  return (
    <header className="actrs-topbar d-flex align-items-center justify-content-between px-4 py-3 gap-3">
      <div>
        <span className="fw-semibold">{profile?.full_name ?? "Loading…"}</span>
        {profile?.role && <span className="badge actrs-phase-badge ms-2 text-capitalize">{profile.role.replace("_", " ")}</span>}
      </div>
      <div className="d-flex align-items-center gap-2">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={toggle}
          title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          <i className={`bi ${mode === "light" ? "bi-moon-stars" : "bi-sun"}`} />
        </button>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => {
            signOut();
            navigate("/login", { replace: true });
          }}
        >
          <i className="bi bi-box-arrow-right me-1" />
          Sign out
        </button>
      </div>
    </header>
  );
}
