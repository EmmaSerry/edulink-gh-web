import { z } from "zod";
import { requiredString } from "./common";

export const promotionSchema = z.object({
  academicYearId: z.number({ invalid_type_error: "Academic year is required" }),
  toLevelId: z.number({ invalid_type_error: "New level is required" }),
  toClassId: z.number({ invalid_type_error: "New class is required" }),
  termId: z.number({ invalid_type_error: "Starting term is required" }),
  status: z.enum(["PROMOTED", "REPEATED", "TRANSFERRED", "GRADUATED"]),
  promotionDate: requiredString("Promotion date"),
  remarks: z.string().trim().optional().or(z.literal("")),
});

export type PromotionFormValues = z.infer<typeof promotionSchema>;
