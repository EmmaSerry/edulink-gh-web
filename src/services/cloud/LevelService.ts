/**
 * Cloud (Supabase-backed) replacement for the offline app's level lookup
 * (levels were managed together with classes under "Levels & Classes").
 * Read-only for the same reason as AcademicYearService/TermService -
 * the seed data already created a school's levels; a settings screen to
 * manage them is future work.
 */
import { rest } from "@/lib/supabaseClient";
import type { LevelRow } from "@/types/database";

class CloudLevelServiceImpl {
  async list(): Promise<LevelRow[]> {
    return rest.select<LevelRow>("levels", {
      filters: { is_active: "eq.true" },
      order: "sort_order.asc",
    });
  }
}

export const CloudLevelService = new CloudLevelServiceImpl();
