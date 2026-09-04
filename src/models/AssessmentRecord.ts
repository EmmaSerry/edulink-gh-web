/**
 * Two assessment record shapes exist, mirroring the two assessment modes
 * on Level. A student/term/level combination uses ScoreRecord if the
 * level's assessmentMode is "scored", or SkillAssessmentRecord if it is
 * "skill-checklist" - never both.
 */

/** Lower/Upper Primary & JHS: one row per student, per term, per subject. */
export interface ScoreRecord {
  id?: number;
  studentId: number;
  termId: number;
  subjectId: number;
  /** School-Based Assessment / class score, 0-50. */
  sbaScore: number | null;
  /** Examination score, 0-50. */
  examScore: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Gold / Silver / Bronze / not-assessed / absent, per the NaCCA KG tool. */
export type ProficiencyRating = "G" | "S" | "B" | "X" | "O";

/** KG1 & KG2: one row per student, per term, per skill. */
export interface SkillAssessmentRecord {
  id?: number;
  studentId: number;
  termId: number;
  skillId: number;
  rating: ProficiencyRating | null;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}
