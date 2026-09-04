import { z } from "zod";
import { requiredString } from "./common";
import type { RemarksBankEntry } from "@models/RemarksBank";

export function createRemarksBankSchema(existing: RemarksBankEntry[], excludeId?: number) {
  return z
    .object({
      category: z.enum(["CONDUCT", "INTEREST", "ATTITUDE", "TEACHER_REMARKS", "HEADTEACHER_REMARKS"]),
      text: requiredString("Remark text"),
      sortOrder: z.number().min(1, "Display order must be at least 1"),
      isActive: z.boolean(),
    })
    .refine(
      (data) =>
        !existing.some(
          (r) =>
            r.id !== excludeId &&
            r.category === data.category &&
            r.text.trim().toLowerCase() === data.text.trim().toLowerCase(),
        ),
      { message: "This remark already exists in this category", path: ["text"] },
    );
}

export type RemarksBankFormValues = z.infer<ReturnType<typeof createRemarksBankSchema>>;
