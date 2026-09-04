import { z } from "zod";
import { requiredString, isDuplicate } from "./common";
import type { LearningArea } from "@models/LearningArea";

export function createLearningAreaSchema(existing: LearningArea[], excludeId?: number) {
  return z
    .object({
      name: requiredString("Learning area name"),
      sortOrder: z.number().min(1, "Display order must be at least 1"),
      levelIds: z.array(z.number()).min(1, "Select at least one applicable KG level"),
      isActive: z.boolean(),
    })
    .refine((data) => !isDuplicate(existing, data.name, (a) => a.name, excludeId, (a) => a.id), {
      message: "A learning area with this name already exists",
      path: ["name"],
    });
}

export type LearningAreaFormValues = z.infer<ReturnType<typeof createLearningAreaSchema>>;
