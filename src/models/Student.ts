/**
 * The Student record is the learner's PERMANENT identity record - it
 * never stores current class/level/term. That placement information
 * belongs to Enrollment (src/models/Enrollment.ts), per the Phase 2
 * enhancement: "the Student record should remain permanent (identity and
 * biographical information), while Enrollment records track where the
 * student belongs in each academic year and term." See
 * docs/PHASE2_STUDENTS.md for the full rationale.
 */
export type Sex = "M" | "F";

export type StudentStatus =
  | "ACTIVE"
  | "TRANSFERRED_OUT"
  | "GRADUATED"
  | "WITHDRAWN"
  | "DECEASED";

/** Every status other than ACTIVE represents a student who has left
 *  the school in some way, while retaining the record for historical
 *  integrity - this is the module's "soft delete" (see Module 1 Status
 *  Information and the General Requirements' "use soft deletion" rule).
 *  There is no separate isDeleted flag; status IS the soft-delete
 *  mechanism.
 *
 *  Phase 6 (Module 12 - code quality review) corrected this comment: it
 *  previously claimed these statuses are used to filter students out of
 *  "default active lists", but the Students page (`src/pages/Students.
 *  tsx`) always shows every status and instead offers an explicit status
 *  filter dropdown - a deliberate UX choice (school staff transferring or
 *  withdrawing a student want that record easy to find, not hidden by
 *  default), not an oversight. This constant has no current consumer; it
 *  is kept as the single authoritative list of non-active statuses for
 *  any future feature that does need it (e.g. an "active only" bulk
 *  export scope), rather than letting a second, possibly-diverging copy
 *  of this list appear somewhere else later. */
export const INACTIVE_STATUSES: StudentStatus[] = [
  "TRANSFERRED_OUT",
  "GRADUATED",
  "WITHDRAWN",
  "DECEASED",
];

export type BoardingStatus = "Day" | "Boarding";

export interface Student {
  id?: number;
  /** Permanent, system-generated, immutable. e.g. "ACTRS-2026-000001". */
  studentId: string;
  /** Editable - can be corrected without touching the permanent studentId.
   *  Optional: some schools don't assign one at registration time, or
   *  want ACTRS to auto-generate it under rules configured later. */
  admissionNumber?: string;
  emisNumber?: string;
  ghanaCardNumber?: string;

  // Personal information
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  gender: Sex;
  dateOfBirth: string;
  nationality: string;
  specialEducationalNeeds?: string;
  photoDataUrl?: string;

  // Academic information (admission event only - current placement lives
  // in Enrollment, not here)
  academicYearOfAdmissionId: number;
  /** Optional - not every school has this on hand at registration time. */
  admissionDate?: string;
  previousSchool?: string;
  boardingStatus?: BoardingStatus;

  status: StudentStatus;
  statusReason?: string;
  statusChangedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export function getFullName(student: Pick<Student, "firstName" | "middleName" | "lastName">): string {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

export function calculateAge(dateOfBirth: string, asOf: Date = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
