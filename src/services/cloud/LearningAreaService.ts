/**
 * Cloud (Supabase-backed) lookup for KG learning areas. Read-only, same
 * reasoning as LevelService/ClassService/SubjectService - a settings
 * screen to manage these is future work.
 */
import { rest } from "@/lib/supabaseClient";
import type { LearningAreaRow } from "@/types/database";

class CloudLearningAreaServiceImpl {
  async listForLevel(levelId: string): Promise<LearningAreaRow[]> {
    const all = await rest.select<LearningAreaRow>("learning_areas", {
      filters: { is_active: "eq.true" },
      order: "sort_order.asc",
    });
    return all.filter((a) => a.level_ids.includes(levelId));
  }
}

export const CloudLearningAreaService = new CloudLearningAreaServiceImpl();
