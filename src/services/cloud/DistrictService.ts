/**
 * District-level rollup - see edulink_gh_phase0n_district_dashboard.sql.
 * A single RPC does all the aggregation server-side (per-school active
 * student counts + assessment status counts for each school's current
 * term); this service just calls it and hands back typed rows. The RPC
 * itself checks the caller is a district_admin/platform_admin, so
 * there's nothing else to guard here beyond the route-level
 * RequireDistrictAdmin check.
 */
import { rest } from "@/lib/supabaseClient";
import type { DistrictSchoolOverviewRow, SchoolRegistrationContext } from "@/types/database";

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
}

export const CloudDistrictService = new CloudDistrictServiceImpl();
