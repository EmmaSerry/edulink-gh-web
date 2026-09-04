/**
 * Cloud (Supabase-backed) replacement for src/services/GradeBandService.ts.
 *
 * Returns CloudGradeBand - a shape satisfying AssessmentCalculationEngine's
 * GradeBandLike interface - rather than forcing cloud rows (UUID ids,
 * snake_case) into the offline-only @models/GradeBand shape (numeric
 * id). This is exactly why the engine's functions were generalized to
 * accept "anything GradeBandLike" instead of the exact GradeBand type:
 * both the offline app's real GradeBand[] and this cloud shape now work
 * with the same unmodified grading/ranking logic, with no unsafe casts
 * at the boundary.
 */

import { rest } from "@/lib/supabaseClient";
import type { GradeBandRow } from "@/types/database";
import type { GradeBandLike } from "@services/AssessmentCalculationEngine";

export interface CloudGradeBand extends GradeBandLike {
  id: string;
}

function toCloudGradeBand(row: GradeBandRow): CloudGradeBand {
  return {
    id: row.id,
    levelId: row.level_id,
    minScore: row.min_score,
    maxScore: row.max_score,
    label: row.label,
    code: row.code,
    isActive: row.is_active,
  };
}

class CloudGradeBandServiceImpl {
  async getAll(schoolId: string): Promise<CloudGradeBand[]> {
    const rows = await rest.select<GradeBandRow>("grade_bands", {
      filters: { school_id: `eq.${schoolId}` },
      order: "sort_order.asc",
    });
    return rows.map(toCloudGradeBand);
  }
}

export const CloudGradeBandService = new CloudGradeBandServiceImpl();
