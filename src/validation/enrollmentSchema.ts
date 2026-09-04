import { z } from "zod";
import { requiredString } from "./common";

/** Used for class (re)assignment - see EnrollmentService.assignClass. */
export const classAssignmentSchema = z.object({
  termId: z.number({ invalid_type_error: "Term is required" }),
  levelId: z.number({ invalid_type_error: "Level is required" }),
  classId: z.number({ invalid_type_error: "Class is required" }),
  enrollmentDate: requiredString("Enrollment date"),
  remarks: z.string().trim().optional().or(z.literal("")),
});

export type ClassAssignmentFormValues = z.infer<typeof classAssignmentSchema>;
