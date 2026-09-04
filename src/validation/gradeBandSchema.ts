import { z } from "zod";
import { requiredString } from "./common";
import type { GradeBand } from "@models/GradeBand";

export function createGradeBandSchema(existing: GradeBand[], excludeId?: number) {
  return z
    .object({
      levelId: z.number().nullable().optional(),
      minScore: z.number().min(0, "Minimum score cannot be negative").max(100, "Minimum score cannot exceed 100"),
      maxScore: z.number().min(0, "Maximum score cannot be negative").max(100, "Maximum score cannot exceed 100"),
      label: requiredString("Description"),
      code: requiredString("Short code"),
      sortOrder: z.number().min(1, "Display order must be at least 1"),
      isActive: z.boolean(),
    })
    .refine((data) => data.maxScore >= data.minScore, {
      message: "Maximum score must be greater than or equal to minimum score",
      path: ["maxScore"],
    })
    .refine(
      (data) =>
        !existing.some((b) => {
          if (b.id === excludeId) return false;
          if ((b.levelId ?? null) !== (data.levelId ?? null)) return false;
          // overlap check
          return data.minScore <= b.maxScore && data.maxScore >= b.minScore;
        }),
      { message: "This score range overlaps with an existing grade band", path: ["minScore"] },
    );
}

export type GradeBandFormValues = z.infer<ReturnType<typeof createGradeBandSchema>>;
