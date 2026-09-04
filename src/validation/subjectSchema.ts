import { z } from "zod";
import { requiredString, isDuplicate } from "./common";
import type { Subject } from "@models/Subject";

export function createSubjectSchema(existing: Subject[], excludeId?: number) {
  return z
    .object({
      name: requiredString("Subject name"),
      code: requiredString("Subject code"),
      shortName: requiredString("Short name"),
      sortOrder: z.number().min(1, "Display order must be at least 1"),
      levelIds: z.array(z.number()).min(1, "Select at least one applicable level"),
      isActive: z.boolean(),
    })
    .refine((data) => !isDuplicate(existing, data.code, (s) => s.code, excludeId, (s) => s.id), {
      message: "A subject with this code already exists",
      path: ["code"],
    });
}

export type SubjectFormValues = z.infer<ReturnType<typeof createSubjectSchema>>;
