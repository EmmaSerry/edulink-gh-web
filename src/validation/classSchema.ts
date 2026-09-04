import { z } from "zod";
import { requiredString, optionalString, isDuplicate } from "./common";
import type { SchoolClass } from "@models/SchoolClass";

export function createClassSchema(existing: SchoolClass[], excludeId?: number) {
  return z
    .object({
      levelId: z.number({ invalid_type_error: "Level is required" }),
      name: requiredString("Class name"),
      code: requiredString("Class code"),
      capacity: z
        .number()
        .min(1, "Capacity must be at least 1")
        .max(200, "That looks too high for one class")
        .optional(),
      classTeacherName: optionalString,
      isActive: z.boolean(),
    })
    .refine((data) => !isDuplicate(existing, data.code, (c) => c.code, excludeId, (c) => c.id), {
      message: "A class with this code already exists",
      path: ["code"],
    });
}

export type ClassFormValues = z.infer<ReturnType<typeof createClassSchema>>;
