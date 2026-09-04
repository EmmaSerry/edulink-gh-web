import { z } from "zod";
import { requiredString, isDuplicate } from "./common";
import type { Level } from "@models/Level";

export function createLevelSchema(existing: Level[], excludeId?: number) {
  return z
    .object({
      code: requiredString("Level code"),
      name: requiredString("Level name"),
      assessmentMode: z.enum(["scored", "skill-checklist"]),
      sortOrder: z.number().min(1, "Display order must be at least 1"),
      isActive: z.boolean(),
    })
    .refine((data) => !isDuplicate(existing, data.code, (l) => l.code, excludeId, (l) => l.id), {
      message: "A level with this code already exists",
      path: ["code"],
    });
}

export type LevelFormValues = z.infer<ReturnType<typeof createLevelSchema>>;
