/**
 * District-level rollup - see edulink_gh_phase0n_district_dashboard.sql.
 * A single RPC does all the aggregation server-side (per-school active
 * student counts + assessment status counts for each school's current
 * term); this service just calls it and hands back typed rows. The RPC
 * itself checks the caller is a district_admin/platform_admin, so
 * there's nothing else to guard here beyond the route-level
 * RequireDistrictAdmin check.
 */
import { rest, edgeFunctions } from "@/lib/supabaseClient";
import type { DistrictSchoolOverviewRow, SchoolRegistrationContext, PendingSchoolRow, IdleTimeoutSettings } from "@/types/database";

class CloudDistrictServiceImpl {
  async getSchoolsOverview(): Promise<DistrictSchoolOverviewRow[]> {
    return rest.rpc<DistrictSchoolOverviewRow[]>("get_district_schools_overview", {});
  }

  /** Another school's levels/classes/terms/academic years, for the
   *  district-admin registration screen's dropdowns - see
   *  edulink_gh_phase0t_district_registration.sql. */
  async getSchoolRegistrationContext(schoolId: string): Promise<SchoolRegistrationContext> {
    return rest.rpc<SchoolRegistrationContext>("get_school_registration_context", { p_school_id: schoolId });
  }

  /** Self-registered schools waiting on a district/platform admin to
   *  approve them - see edulink_gh_phase0y_sms_and_approval.sql. */
  async getPendingSchools(): Promise<PendingSchoolRow[]> {
    return rest.rpc<PendingSchoolRow[]>("list_pending_schools", {});
  }

  /** Approves the school (RPC, plain database update) then texts its
   *  head teacher that they're live - see the notify-school-approved
   *  Edge Function, which needs the Arkesel key and so can't be a
   *  plain RPC. If the SMS leg fails, the school is still approved -
   *  this only surfaces a warning, it doesn't roll anything back. */
  async approveSchool(schoolId: string): Promise<{ notified: boolean; warning?: string }> {
    await rest.rpc<void>("approve_school", { p_school_id: schoolId });
    try {
      const result = await edgeFunctions.invoke<{ notified?: boolean; warning?: string }>("notify-school-approved", {
        schoolId,
      });
      return { notified: !!result.notified, warning: result.warning };
    } catch (err) {
      return { notified: false, warning: err instanceof Error ? err.message : "Could not send the approval SMS." };
    }
  }

  /** The caller's effective idle-session timeout plus what they're
   *  allowed to change - see get_idle_timeout_settings() in
   *  edulink_gh_phase0z_idle_timeout_and_signup_fix.sql. Used both by
   *  CloudAuthContext (to know when to sign the person out) and by
   *  this dashboard's own "Session timeout" panel. */
  async getIdleTimeoutSettings(): Promise<IdleTimeoutSettings> {
    return rest.rpc<IdleTimeoutSettings>("get_idle_timeout_settings", {});
  }

  async setPlatformIdleTimeout(minutes: number): Promise<void> {
    await rest.rpc<void>("set_platform_idle_timeout", { p_minutes: minutes });
  }

  /** Pass `minutes: null` to clear a district's own override and fall
   *  back to the platform-wide default. */
  async setDistrictIdleTimeout(districtId: string, minutes: number | null): Promise<void> {
    await rest.rpc<void>("set_district_idle_timeout", { p_district_id: districtId, p_minutes: minutes });
  }
}

export const CloudDistrictService = new CloudDistrictServiceImpl();
