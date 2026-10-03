/**
 * Platform-wide branding - see edulink_gh_phase1h_platform_branding.sql.
 * getPublicBranding() is deliberately safe to call from a signed-out
 * screen (the public homepage, login, or either signup page) - the RPC
 * it wraps has no auth/role check and is explicitly granted to the
 * anon role, same trust level as a logo image already is. Both setters
 * are platform_admin only, enforced server-side in the RPC itself.
 */
import { rest } from "@/lib/supabaseClient";
import type { PublicBranding } from "@/types/database";

class CloudBrandingServiceImpl {
  async getPublicBranding(): Promise<PublicBranding> {
    return rest.rpc<PublicBranding>("get_public_branding", {});
  }

  /** platform_admin only - replaces the "EG" badge everywhere it
   *  appears (public homepage, login/signup, in-app sidebar for every
   *  role) once set. Pass null to remove it and fall back to the
   *  badge again. */
  async setPlatformLogo(logoDataUrl: string | null): Promise<void> {
    await rest.rpc<void>("set_platform_logo", { p_logo_data_url: logoDataUrl });
  }

  /** platform_admin only - shown only on the login/signup screens
   *  (CloudAuthLayout), not the public homepage or in-app sidebar. Pass
   *  null for the photo to remove it; the caption is cleared
   *  automatically if left blank. */
  async setSuperAdminPhoto(photoDataUrl: string | null, caption: string): Promise<void> {
    await rest.rpc<void>("set_super_admin_photo", { p_photo_data_url: photoDataUrl, p_caption: caption });
  }
}

export const CloudBrandingService = new CloudBrandingServiceImpl();
