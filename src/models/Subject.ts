/**
 * Subjects apply to "scored" levels (Lower/Upper Primary, JHS) and can
 * differ per level. `levelIds` is a many-to-many link (a subject like
 * "Science" is shared across several levels but the level list is fully
 * editable per subject) - never a hard-coded per-level subject array.
 */
export interface Subject {
  id?: number;
  name: string;
  /** Short code used internally, e.g. "EN", "MA", "SC". */
  code: string;
  shortName: string;
  sortOrder: number;
  levelIds: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
