import { z } from "zod";
import { requiredString, isDuplicate } from "./common";
import type { AcademicYear } from "@models/AcademicYear";

const YEAR_LABEL_PATTERN = /^\d{4}\/\d{4}$/;

export function createAcademicYearSchema(existing: AcademicYear[], excludeId?: number) {
  return z
    .object({
      label: requiredString("Academic year")
        .regex(YEAR_LABEL_PATTERN, "Use the format YYYY/YYYY, e.g. 2025/2026"),
      startDate: requiredString("Start date"),
      endDate: requiredString("End date"),
      isCurrent: z.boolean(),
    })
    .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
      message: "End date must be after start date",
      path: ["endDate"],
    })
    .refine(
      (data) => !isDuplicate(existing, data.label, (a) => a.label, excludeId, (a) => a.id),
      { message: "This academic year already exists", path: ["label"] },
    );
}

export type AcademicYearFormValues = z.infer<ReturnType<typeof createAcademicYearSchema>>;
