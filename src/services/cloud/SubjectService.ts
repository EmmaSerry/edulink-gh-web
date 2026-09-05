/**
 * Cloud (Supabase-backed) replacement for the offline app's subject
 * lookup. Read-only, same reasoning as LevelService/ClassService - a
 * settings screen to manage subjects is future work; Assessment Entry
 * only needs to list which subjects apply to one level.
 */
import { rest } from "@/lib/supabaseClient";
import type { SubjectRow } from "@/types/database";

class CloudSubjectServiceImpl {
  /** All active subjects that apply to a given level, in display order. */
  async listForLevel(levelId: string): Promise<SubjectRow[]> {
    const all = await rest.select<SubjectRow>("subjects", {
      filters: { is_active: "eq.true" },
      order: "sort_order.asc",
    });
    return all.filter((s) => s.level_ids.includes(levelId));
  }
}

export const CloudSubjectService = new CloudSubjectServiceImpl();
