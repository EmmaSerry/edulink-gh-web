import { useNavigate } from "react-router-dom";
import { DeveloperCredit } from "@components/DeveloperCredit";
import { useAppInfo } from "@hooks/useAppInfo";

/**
 * Phase 0 placeholder login screen. ACTRS is a single-device, offline-first
 * application with no server, so "login" in later phases is expected to be a
 * lightweight local device/staff-name + PIN gate (protecting the local data,
 * not authenticating against any backend) rather than traditional auth.
 * That mechanism is Phase 1+ work; this screen only establishes the layout
 * and branding.
 */
export function Login() {
  const navigate = useNavigate();
  const { app } = useAppInfo();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate("/");
      }}
    >
      <h1 className="h5 text-center mb-1">{app.shortName}</h1>
      <p className="text-muted text-center small mb-4">Sign in to continue</p>

      <div className="mb-3">
        <label className="form-label small">Staff name</label>
        <input className="form-control" placeholder="e.g. Emmanuel Serry" disabled />
      </div>
      <div className="mb-3">
        <label className="form-label small">PIN</label>
        <input className="form-control" type="password" placeholder="••••" disabled />
      </div>
      <button className="btn btn-primary w-100" type="submit">
        Continue to Dashboard
      </button>
      <p className="text-muted small text-center mt-3 mb-0">
        Local device sign-in will be enabled in a later phase.
      </p>

      <hr className="my-4" />
      <DeveloperCredit variant="full" />
    </form>
  );
}
