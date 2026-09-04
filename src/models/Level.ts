import type { AssessmentMode, LevelCode } from "@config/appConfig";

/**
 * A Level is a *configuration record*, not a hard-coded branch of the
 * application. KG1, KG2, Basic 1-6, JHS1-3 are all rows in this table.
 * See docs/ARCHITECTURE.md "Configuration-Driven Design".
 */
export interface Level {
  id?: number;
  code: LevelCode;
  name: string;
  /** "scored" = SBA+Exam/Total/Rank/GradeBand (Primary & JHS).
   *  "skill-checklist" = Gold/Silver/Bronze/X/O per skill (KG1 & KG2). */
  assessmentMode: AssessmentMode;
  /** Display order across the app (KG1, KG2, Basic 1 ... JHS3). */
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
