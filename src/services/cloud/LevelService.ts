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
  /** schoolId matters once more than one school exists - see the same
   *  note on ClassService.list(). Always pass profile.school_id. */
  async list(schoolId?: string | null): Promise<LevelRow[]> {
    const filters: Record<string, string> = { is_active: "eq.true" };
    if (schoolId) filters.school_id = `eq.${schoolId}`;
    return rest.select<LevelRow>("levels", { filters, order: "sort_order.asc" });
  }
}

export const CloudLevelService = new CloudLevelServiceImpl();
