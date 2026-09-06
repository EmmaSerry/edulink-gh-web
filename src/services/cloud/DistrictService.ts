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
import type { DistrictSchoolOverviewRow } from "@/types/database";

class CloudDistrictServiceImpl {
  async getSchoolsOverview(): Promise<DistrictSchoolOverviewRow[]> {
    return rest.rpc<DistrictSchoolOverviewRow[]>("get_district_schools_overview", {});
  }
}

export const CloudDistrictService = new CloudDistrictServiceImpl();
