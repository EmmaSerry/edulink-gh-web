import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { CloudBrandingService } from "@services/cloud/BrandingService";
import { BrandMark } from "@components/BrandMark";
import type { PublicBranding } from "@/types/database";

/** The platform admin's own photo + short caption (e.g. "Emmanuel
 *  Serry, Platform Administrator") - shown only on this auth shell
 *  (Login, Register your school, Register your district), not the
 *  public homepage or the in-app sidebar, per the request this was
 *  built for. Renders nothing until a photo is actually uploaded - see
 *  PlatformBrandingPanel in CloudSubscriptionApproval.tsx and
 *  edulink_gh_phase1h_platform_branding.sql. */
function SuperAdminPhotoBlock() {
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  useEffect(() => {
    let cancelled = false;
    CloudBrandingService.getPublicBranding()
      .then((b) => !cancelled && setBranding(b))
      .catch(() => {
        /* nothing uploaded yet, or the call failed - either way this
           block simply doesn't render, see the guard below. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!branding?.superAdminPhotoDataUrl) return null;

  return (
    <div
      className="d-flex align-items-center gap-2 mt-3"
      style={{ position: "relative", zIndex: 1 }}
    >
      <img
        src={branding.superAdminPhotoDataUrl}
        alt=""
        style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
      {branding.superAdminCaption && <span className="text-muted small">{branding.superAdminCaption}</span>}
    </div>
  );
}

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
 *  holding open a GPU context and a render loop.
 *
 *  BrandMark replaces the old hardcoded "EG" badge with the platform
 *  admin's own uploaded logo once one is set - see
 *  edulink_gh_phase1h_platform_branding.sql. */
export function CloudAuthLayout() {
  return (
    <div
      className="actrs-auth-hero d-flex flex-column align-items-center justify-content-center"
      style={{ minHeight: "100vh", background: "var(--actrs-grey-light)" }}
    >
      <div className="mb-4 d-flex align-items-center gap-2" style={{ position: "relative", zIndex: 1 }}>
        <BrandMark />
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
      <SuperAdminPhotoBlock />
    </div>
  );
}
