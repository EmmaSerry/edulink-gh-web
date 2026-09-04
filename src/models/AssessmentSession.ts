/**
 * One row per (class, term): the unit of work a teacher opens to enter
 * scores/skill-ratings for that class this term, and the object whose
 * lifecycle status (Module 11) gates editing.
 *
 * There is deliberately no "assessment mode" branch anywhere else in the
 * data model - `assessmentMode` here is a denormalised copy of the
 * class's Level.assessmentMode purely so the UI can route to the right
 * screen (score grid vs. skill grid) without an extra join, per the
 * "teachers should never have to manually choose" requirement.
 */
export type AssessmentSessionStatus = "DRAFT" | "COMPLETED" | "VERIFIED" | "FINALIZED";

export interface AssessmentSession {
  id?: number;
  classId: number;
  termId: number;
  levelId: number;
  assessmentMode: "scored" | "skill-checklist";
  status: AssessmentSessionStatus;
  lastSavedAt?: string;
  createdBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  createdAt: string;
  updatedAt: string;
}

export const SESSION_STATUS_ORDER: AssessmentSessionStatus[] = [
  "DRAFT",
  "COMPLETED",
  "VERIFIED",
  "FINALIZED",
];

export function isEditable(status: AssessmentSessionStatus): boolean {
  return status !== "FINALIZED";
}
