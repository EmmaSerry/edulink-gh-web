/**
 * Per-student, per-term record capturing the manually-entered parts of a
 * report card that are not derived from scores/skills - attendance,
 * remarks, promotion/progression and sign-off. This doubles as the
 * "Teacher Remarks" store for Phase 3 Module 10 (rather than a
 * duplicate parallel table) since it already models exactly the same
 * per-student-per-term remarks shape.
 */
export interface ReportRecord {
  id?: number;
  studentId: number;
  termId: number;
  daysPresent?: number;

  // Scored levels (Lower/Upper Primary, JHS) - each drawn from the
  // Remarks Bank (Phase 1), editable before saving.
  interestRemark?: string;
  conductRemark?: string;
  attitudeRemark?: string;
  /** "General Comment" / Teacher Remarks category. */
  classTeacherRemark?: string;
  /** Headteacher Comment category. */
  headteacherRemark?: string;

  // KG only - free-text narrative fields (no remarks-bank picklist).
  generalComment?: string;
  areasForImprovement?: string;
  teacherRecommendation?: string;

  /** "Promoted To" (Primary/JHS) or "Progression" (KG). */
  progression?: string;
  classTeacherName?: string;
  headTeacherName?: string;
  finalisedAt?: string;
  createdAt: string;
  updatedAt: string;
}
