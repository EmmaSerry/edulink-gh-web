import type { GradeBand } from "@models/GradeBand";
import { toOrdinal } from "@utils/ordinal";

/**
 * The structural subset of GradeBand this engine actually needs.
 * GradeBand (numeric `id`, from the offline Dexie schema) already
 * satisfies this shape, so every existing caller keeps working
 * unchanged - this only widens what the functions below will ALSO
 * accept, e.g. a cloud GradeBandRow mapped with a UUID `id` instead of
 * a number. The engine never reads `id` for any calculation.
 */
export interface GradeBandLike {
  minScore: number;
  maxScore: number;
  label: string;
  code: string;
  levelId?: number | string | null;
  isActive: boolean;
}

/**
 * Pure, framework-free calculation & ranking engine (Modules 4-7).
 *
 * Nothing in this file touches Dexie/React - it is intentionally a set of
 * plain functions over plain data, so it can be unit-tested in isolation
 * and so its behaviour is easy to verify against the original Excel
 * workbooks it must reproduce exactly (see docs/PHASE3_ASSESSMENTS.md).
 *
 * IMPORTANT: Total/Grade-band/Position/Overall* are never persisted -
 * they are always derived on the fly from the raw SBA/Exam inputs (the
 * only values actually stored in ScoreRecord). This guarantees the
 * calculations can never drift out of sync with a stored "cached" value.
 */

const MAX_SUBJECT_SCORE = 100;

/** Score Validation (Module 3): SBA and Exam are each entered on their
 *  own 0-50 scale (never 0-100) - matches the source Excel workbooks. */
export const MIN_COMPONENT_SCORE = 0;
export const MAX_COMPONENT_SCORE = 50;

/** A blank/unscored cell (null) is always valid - it just means "not
 *  entered yet", distinct from an out-of-range value the teacher typed. */
export function isValidComponentScore(value: number | null): boolean {
  if (value === null) return true;
  return Number.isFinite(value) && value >= MIN_COMPONENT_SCORE && value <= MAX_COMPONENT_SCORE;
}

/** Subject Total = SBA + Exam (Module 4). Returns null if either input
 *  is missing (a subject not yet scored), never a partial/guessed total. */
export function computeSubjectTotal(sba: number | null, exam: number | null): number | null {
  if (sba === null || exam === null) return null;
  return Math.min(MAX_SUBJECT_SCORE, sba + exam);
}

/** Grade Band lookup (Module 5) - thresholds always come from the
 *  Phase 1 GradeBand table, never hard-coded here. `bands` should be the
 *  active, global (levelId == null) or level-specific set, pre-sorted by
 *  the caller is not required - this sorts defensively by minScore desc. */
export function findGradeBand<T extends GradeBandLike>(score: number | null, bands: T[]): T | undefined {
  if (score === null) return undefined;
  const sorted = [...bands].filter((b) => b.isActive).sort((a, b) => b.minScore - a.minScore);
  return sorted.find((b) => score >= b.minScore && score <= b.maxScore);
}

/** Grade bands may be scoped to one specific level or left level-agnostic
 *  (levelId null/undefined = applies to every scored level) - see
 *  GradeBand.levelId. A level-specific set, if one exists, always wins
 *  over the global default set for that level. */
export function resolveGradeBandsForLevel<T extends GradeBandLike>(bands: T[], levelId: number | string): T[] {
  const active = bands.filter((b) => b.isActive);
  const specific = active.filter((b) => b.levelId === levelId);
  if (specific.length > 0) return specific;
  return active.filter((b) => b.levelId === null || b.levelId === undefined);
}

export interface RankedItem<T> {
  item: T;
  value: number;
  rank: number;
  positionText: string;
}

/**
 * Competition ranking (Module 6/7): 95, 95, 91, 90 -> ranks 1, 1, 3, 4.
 * Items with a null/undefined value (not yet scored) are excluded from
 * ranking entirely rather than being ranked last, since an incomplete
 * assessment shouldn't produce a misleading position.
 */
export function computeCompetitionRanking<T>(
  items: T[],
  getValue: (item: T) => number | null | undefined,
): RankedItem<T>[] {
  const scored = items
    .map((item) => ({ item, value: getValue(item) }))
    .filter((x): x is { item: T; value: number } => x.value !== null && x.value !== undefined);

  const sorted = [...scored].sort((a, b) => b.value - a.value);

  const ranked: RankedItem<T>[] = [];
  let rank = 0;
  let lastValue: number | null = null;
  let seen = 0;
  for (const { item, value } of sorted) {
    seen++;
    if (value !== lastValue) {
      rank = seen;
      lastValue = value;
    }
    ranked.push({ item, value, rank, positionText: toOrdinal(rank) });
  }
  return ranked;
}

export interface OverallResult<T extends GradeBandLike = GradeBand> {
  total: number;
  average: number;
  grade: T | undefined;
}

/** Overall Total/Average/Grade for one student (Module 7). `subjectTotals`
 *  should only include subjects that HAVE been scored - a student with
 *  some subjects still blank gets an average over what's actually
 *  entered, not zeros, so a partially-complete draft doesn't understate
 *  their standing while assessment is still in progress. */
export function computeOverallForStudent<T extends GradeBandLike>(subjectTotals: number[], bands: T[]): OverallResult<T> {
  if (subjectTotals.length === 0) {
    return { total: 0, average: 0, grade: undefined };
  }
  const total = subjectTotals.reduce((sum, t) => sum + t, 0);
  const average = total / subjectTotals.length;
  return { total, average, grade: findGradeBand(average, bands) };
}
