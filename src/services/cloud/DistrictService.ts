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
import type { DistrictSchoolOverviewRow, SchoolRegistrationContext, PendingSchoolRow, IdleTimeoutSettings, DistrictRow } from "@/types/database";

/** A self-registered district waiting on platform_admin approval - see
 *  list_pending_districts() in edulink_gh_district_signup.sql. Defined
 *  here rather than in types/database.ts, same as PendingSchoolRow's
 *  neighbours, to keep this one small addition out of that large file. */
export interface PendingDistrictRow {
  id: string;
  name: string;
  region: string | null;
  requested_by_name: string | null;
  requested_by_phone: string | null;
  created_at: string;
}

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

  /** Self-registered districts waiting on platform_admin approval - see
   *  edulink_gh_district_signup.sql. No SMS leg for this one (unlike
   *  school approval) - just the plain database update. */
  async getPendingDistricts(): Promise<PendingDistrictRow[]> {
    return rest.rpc<PendingDistrictRow[]>("list_pending_districts", {});
  }

  async approveDistrict(districtId: string): Promise<void> {
    await rest.rpc<void>("approve_district", { p_district_id: districtId });
  }

  /** Rejects a pending school application by permanently removing it
   *  (and the applicant's login), then texts the applicant. Done by the
   *  reject-school-application Edge Function, since the SMS needs the
   *  Arkesel key. District admin: own district only; platform admin:
   *  any. Refuses an already-approved school - see
   *  edulink_gh_phase1k_reject_applications.sql. */
  async rejectSchoolApplication(
    schoolId: string,
    reason?: string
  ): Promise<{ removed: boolean; notified: boolean; warning?: string }> {
    const result = await edgeFunctions.invoke<{ removed?: boolean; notified?: boolean; warning?: string }>(
      "reject-school-application",
      { schoolId, reason: reason ?? "" }
    );
    return { removed: !!result.removed, notified: !!result.notified, warning: result.warning };
  }

  /** Rejects a pending district application by permanently removing it
   *  (and the applicant's login). Platform admin only, checked in the
   *  database function itself. No SMS - districts aren't texted on
   *  approval either. */
  async rejectDistrictApplication(districtId: string): Promise<void> {
    await rest.rpc<void>("reject_district_application", { p_district_id: districtId });
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

  /** The district's own logo (KG cover page + branding) - a plain read,
   *  same as any other districts column; RLS already allows this or the
   *  district dashboard's other lookups wouldn't work. */
  async getDistrictLogo(districtId: string): Promise<string | null> {
    const [row] = await rest.select<Pick<DistrictRow, "logo_data_url">>("districts", {
      filters: { id: `eq.${districtId}` },
      select: "logo_data_url",
      limit: 1,
    });
    return row?.logo_data_url ?? null;
  }

  /** Pass `dataUrl: null` to remove the district's logo. Server-side
   *  role check (district_admin, own district only, or platform_admin
   *  any district) - see set_district_logo() in
   *  edulink_gh_phase1c_kg_report_redesign.sql. */
  async setDistrictLogo(districtId: string, dataUrl: string | null): Promise<void> {
    await rest.rpc<void>("set_district_logo", { p_district_id: districtId, p_logo_data_url: dataUrl });
  }
}

export const CloudDistrictService = new CloudDistrictServiceImpl();
