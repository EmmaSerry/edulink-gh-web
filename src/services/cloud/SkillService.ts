/**
 * Cloud (Supabase-backed) lookup for KG skills within one learning area
 * and level. Read-only, same reasoning as the other lookup services.
 */
import { rest } from "@/lib/supabaseClient";
import type { SkillRow } from "@/types/database";

class CloudSkillServiceImpl {
  async listForLevelAndArea(levelId: string, learningAreaId: string): Promise<SkillRow[]> {
    return rest.select<SkillRow>("skills", {
      filters: {
        is_active: "eq.true",
        level_id: `eq.${levelId}`,
        learning_area_id: `eq.${learningAreaId}`,
      },
      order: "sort_order.asc",
    });
  }
}

export const CloudSkillService = new CloudSkillServiceImpl();
