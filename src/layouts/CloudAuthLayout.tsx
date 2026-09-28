import { Outlet } from "react-router-dom";

/** Centred, unauthenticated shell used by the Login page - reuses the
 *  same `.actrs-card` surface/shadow treatment as the rest of the app
 *  (see src/styles/theme.css) so the login screen feels like part of
 *  the same product, not a bolted-on page.
 *
 *  `actrs-auth-hero` (see theme.css) adds a soft, drifting glow behind
 *  the card - a CSS-only stand-in for a flashier animated background,
 *  chosen deliberately over a WebGL/canvas effect here: this screen is
 *  the first thing anyone sees before signing in, often on modest
 *  school hardware, so it needs to be nearly free to run rather than
 *  holding open a GPU context and a render loop. */
export function CloudAuthLayout() {
  return (
    <div
      className="actrs-auth-hero d-flex flex-column align-items-center justify-content-center"
      style={{ minHeight: "100vh", background: "var(--actrs-grey-light)" }}
    >
      <div className="mb-4 d-flex align-items-center gap-2" style={{ position: "relative", zIndex: 1 }}>
        <span className="actrs-brand-mark">EG</span>
        <div className="lh-sm">
          <div className="fw-bold">EduLink GH</div>
          <div className="text-muted" style={{ fontSize: "0.7rem" }}>
            School management, everywhere in Ghana
          </div>
        </div>
      </div>
      <div className="actrs-card p-4" style={{ width: 380, position: "relative", zIndex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
