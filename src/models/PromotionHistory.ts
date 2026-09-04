/**
 * Permanent, append-only promotion record (Module 4). A row is added
 * every time a student moves between levels/classes across academic
 * years - existing rows are never edited or deleted.
 */
export type PromotionStatus = "PROMOTED" | "REPEATED" | "TRANSFERRED" | "GRADUATED";

export interface PromotionHistoryEntry {
  id?: number;
  studentId: number;
  academicYearId: number;
  fromLevelId?: number;
  toLevelId: number;
  fromClassId?: number;
  toClassId: number;
  status: PromotionStatus;
  promotionDate: string;
  remarks?: string;
  createdAt: string;
}
