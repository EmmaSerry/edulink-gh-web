import { z } from "zod";
import { requiredString } from "./common";
import type { Skill } from "@models/Skill";

export function createSkillSchema(existing: Skill[], excludeId?: number) {
  return z
    .object({
      learningAreaId: z.number({ invalid_type_error: "Learning area is required" }),
      levelId: z.number({ invalid_type_error: "KG level is required" }),
      serialNumber: z.number().min(1, "Skill number must be at least 1"),
      description: requiredString("Skill description"),
      sortOrder: z.number().min(1, "Display order must be at least 1"),
      isActive: z.boolean(),
    })
    .refine(
      (data) =>
        !existing.some(
          (s) =>
            s.id !== excludeId &&
            s.learningAreaId === data.learningAreaId &&
            s.levelId === data.levelId &&
            s.serialNumber === data.serialNumber,
        ),
      { message: "This skill number already exists for this learning area and level", path: ["serialNumber"] },
    );
}

export type SkillFormValues = z.infer<ReturnType<typeof createSkillSchema>>;
