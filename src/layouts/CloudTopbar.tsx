import { useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";

/** Simplified counterpart of the offline app's Topbar - a school/role
 *  indicator plus sign-out, in place of the offline-only global search
 *  and connectivity badge (those two are meaningless once accounts and
 *  data live in the cloud rather than on one device). */
export function CloudTopbar() {
  const navigate = useNavigate();
  const { profile, signOut } = useCloudAuth();

  return (
    <header className="actrs-topbar d-flex align-items-center justify-content-between px-4 py-3 gap-3">
      <div>
        <span className="fw-semibold">{profile?.full_name ?? "Loading…"}</span>
        {profile?.role && <span className="badge actrs-phase-badge ms-2 text-capitalize">{profile.role.replace("_", " ")}</span>}
      </div>
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
    </header>
  );
}
