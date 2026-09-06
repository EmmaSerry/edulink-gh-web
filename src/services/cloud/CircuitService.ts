/**
 * Cloud service for circuit management - see
 * edulink_gh_phase0s_circuits.sql. No RPCs needed: RLS on the circuits
 * table itself already gates writes to a district/platform admin (any
 * signed-in staff member can still read the list, for the dropdown on
 * Settings -> School profile), so plain REST calls are enough.
 */
import { rest } from "@/lib/supabaseClient";
import type { CircuitRow } from "@/types/database";

class CloudCircuitServiceImpl {
  async list(districtId?: string): Promise<CircuitRow[]> {
    return rest.select<CircuitRow>("circuits", {
      filters: districtId ? { district_id: `eq.${districtId}`, is_active: "eq.true" } : { is_active: "eq.true" },
      order: "name.asc",
    });
  }

  /** Includes inactive circuits too - the management screen needs to
   *  show and reactivate them, not just the active dropdown list. */
  async listAll(districtId: string): Promise<CircuitRow[]> {
    return rest.select<CircuitRow>("circuits", {
      filters: { district_id: `eq.${districtId}` },
      order: "name.asc",
    });
  }

  async create(districtId: string, name: string): Promise<CircuitRow> {
    const rows = await rest.insert<CircuitRow>("circuits", { district_id: districtId, name });
    return rows[0];
  }

  async rename(circuitId: string, name: string): Promise<CircuitRow> {
    const rows = await rest.update<CircuitRow>("circuits", { id: `eq.${circuitId}` }, { name });
    return rows[0];
  }

  async setActive(circuitId: string, isActive: boolean): Promise<CircuitRow> {
    const rows = await rest.update<CircuitRow>("circuits", { id: `eq.${circuitId}` }, { is_active: isActive });
    return rows[0];
  }
}

export const CloudCircuitService = new CloudCircuitServiceImpl();
