/**
 * Cloud (Supabase-backed) replacement for the offline app's class
 * lookup. Read-only, same reasoning as the other lookup services in
 * this batch (AcademicYearService, TermService, LevelService).
 */
import { rest } from "@/lib/supabaseClient";
import type { ClassRow } from "@/types/database";

class CloudClassServiceImpl {
  async list(levelId?: string): Promise<ClassRow[]> {
    return rest.select<ClassRow>("classes", {
      filters: levelId ? { is_active: "eq.true", level_id: `eq.${levelId}` } : { is_active: "eq.true" },
      order: "name.asc",
    });
  }
}

export const CloudClassService = new CloudClassServiceImpl();
