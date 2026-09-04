/**
 * Tracks where a student belongs in a specific academic year + term -
 * the Phase 2 enhancement recommended by the project owner. Student
 * identity (Student) and student placement (Enrollment) are separate on
 * purpose: a promotion, transfer or repeat is a NEW Enrollment row, never
 * an edit to the Student record, which keeps full historical accuracy.
 *
 * Example: Emmanuel Mensah (one Student row) has an Enrollment row for
 * 2026/2027 Term 1 in Basic 5A, another for Term 2 in Basic 5A, and
 * another for 2027/2028 Term 1 in Basic 6A after promotion.
 */
export type EnrollmentStatus = "ACTIVE" | "TRANSFERRED" | "ENDED";

export interface Enrollment {
  id?: number;
  studentId: number;
  academicYearId: number;
  termId: number;
  levelId: number;
  classId: number;
  enrollmentDate: string;
  status: EnrollmentStatus;
  /** Exactly one enrollment per student may be "current" at any time -
   *  the fast-path flag used by class rosters/lookups instead of always
   *  computing "the latest term" from scratch. */
  isCurrent: boolean;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}
