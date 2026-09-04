import { Outlet } from "react-router-dom";

/** Centred, unauthenticated shell used by the Login page - reuses the
 *  same `.actrs-card` surface/shadow treatment as the rest of the app
 *  (see src/styles/theme.css) so the login screen feels like part of
 *  the same product, not a bolted-on page. */
export function CloudAuthLayout() {
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center"
      style={{ minHeight: "100vh", background: "var(--actrs-grey-light)" }}
    >
      <div className="mb-4 d-flex align-items-center gap-2">
        <span className="actrs-brand-mark">EG</span>
        <div className="lh-sm">
          <div className="fw-bold">EduLink GH</div>
          <div className="text-muted" style={{ fontSize: "0.7rem" }}>
            School management, everywhere in Ghana
          </div>
        </div>
      </div>
      <div className="actrs-card p-4" style={{ width: 380 }}>
        <Outlet />
      </div>
    </div>
  );
}
