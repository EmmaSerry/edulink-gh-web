import { z } from "zod";
import { requiredString } from "./common";
import type { Term } from "@models/Term";

export function createTermSchema(existing: Term[], excludeId?: number) {
  return z
    .object({
      academicYearId: z.number({ invalid_type_error: "Academic year is required" }),
      termName: requiredString("Term name"),
      termNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      openingDate: requiredString("Opening date"),
      closingDate: requiredString("Closing date"),
      vacationDate: requiredString("Vacation date"),
      reopeningDate: requiredString("Reopening date"),
      totalSchoolDays: z
        .number({ invalid_type_error: "Total school days must be a number" })
        .min(1, "Total school days must be at least 1")
        .max(200, "That looks too high for one term"),
      isActive: z.boolean(),
    })
    .refine((data) => new Date(data.closingDate) > new Date(data.openingDate), {
      message: "Closing date must be after opening date",
      path: ["closingDate"],
    })
    .refine(
      (data) =>
        !existing.some(
          (t) =>
            t.id !== excludeId &&
            t.academicYearId === data.academicYearId &&
            t.termNumber === data.termNumber,
        ),
      { message: "This term already exists for the selected academic year", path: ["termNumber"] },
    );
}

export type TermFormValues = z.infer<ReturnType<typeof createTermSchema>>;
