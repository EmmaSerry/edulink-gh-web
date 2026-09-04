/**
 * Standalone, fully editable grade-band configuration - replaces the
 * Phase 0 embedded Level.gradeBands array so bands can be managed on
 * their own screen (Module 9) independent of Level records.
 *
 * `levelId` is optional: null/undefined means the band set applies to
 * every "scored" level by default; a value scopes it to one level only,
 * for a future school that wants different thresholds per level.
 */
export interface GradeBand {
  id?: number;
  levelId?: number | null;
  minScore: number;
  maxScore: number;
  /** e.g. "Advanced", "Proficient" */
  label: string;
  /** Short code, e.g. "A", "P", "A.P", "D", "B" */
  code: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_GRADE_BANDS: Array<
  Pick<GradeBand, "minScore" | "maxScore" | "label" | "code" | "sortOrder">
> = [
  { minScore: 80, maxScore: 100, label: "Advanced", code: "A", sortOrder: 1 },
  { minScore: 68, maxScore: 79, label: "Proficient", code: "P", sortOrder: 2 },
  { minScore: 54, maxScore: 67, label: "Approaching Proficiency", code: "A.P", sortOrder: 3 },
  { minScore: 40, maxScore: 53, label: "Developing", code: "D", sortOrder: 4 },
  { minScore: 0, maxScore: 39, label: "Beginning", code: "B", sortOrder: 5 },
];
