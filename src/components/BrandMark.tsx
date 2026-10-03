import { useEffect, useState } from "react";
import { CloudBrandingService } from "@services/cloud/BrandingService";

/**
 * The "EG" badge used across the app - public homepage header,
 * login/signup screens, and the in-app sidebar for every role - now
 * replaced by the platform admin's own uploaded logo wherever one is
 * set (see edulink_gh_phase1h_platform_branding.sql and
 * PlatformBrandingPanel in CloudSubscriptionApproval.tsx). Falls back
 * to the original text badge until a logo is uploaded, so nothing
 * changes visually until Emmanuel actually sets one.
 *
 * Each mount fetches independently rather than sharing one app-wide
 * context - there's no existing "branding" context to hook into, and
 * three small, cheap RPC calls across a page load is a fair trade for
 * not having to wire one up just for this.
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    CloudBrandingService.getPublicBranding()
      .then((b) => !cancelled && setLogoDataUrl(b.platformLogoDataUrl))
      .catch(() => {
        /* no platform logo set yet, or the call failed - either way the
           "EG" badge below is a perfectly good fallback, so this is
           silently ignored rather than surfaced as an error. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (logoDataUrl) {
    return (
      <img
        src={logoDataUrl}
        alt="EduLink GH"
        style={{ width: size, height: size, borderRadius: 8, objectFit: "contain", background: "#fff" }}
      />
    );
  }

  return <span className="actrs-brand-mark">EG</span>;
}
