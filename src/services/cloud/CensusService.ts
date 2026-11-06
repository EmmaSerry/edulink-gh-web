/**
 * District school census - see STEP_district_census.sql. The database limits
 * every call to the Super Admin and the district admin of the census district.
 */
import { rest } from "@/lib/supabaseClient";
import type { CensusLogRow, CensusRow } from "@components/census/censusModel";

type Editable = Omit<CensusRow, "id" | "district_id" | "updated_at">;

class CensusServiceImpl {
  async list(): Promise<CensusRow[]> {
    return rest.select<CensusRow>("district_census_schools", { select: "*", order: "name.asc", limit: 2000 });
  }

  async update(id: string, values: Editable): Promise<CensusRow> {
    const rows = await rest.update<CensusRow>("district_census_schools", { id: `eq.${id}` }, values);
    return rows[0];
  }

  async create(districtId: string, values: Editable): Promise<CensusRow> {
    const rows = await rest.insert<CensusRow>("district_census_schools", { district_id: districtId, ...values });
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    await rest.rpc<void>("delete_census_school", { p_id: id });
  }

  async history(schoolId: string): Promise<CensusLogRow[]> {
    return rest.select<CensusLogRow>("district_census_log", {
      select: "id,changed_by_name,changed_at,action,changes",
      filters: { school_id: `eq.${schoolId}` },
      order: "changed_at.desc",
      limit: 30,
    });
  }
}

export const CensusService = new CensusServiceImpl();
