/** Editable replacement for the hard-coded Excel Data Validation lists
 *  used on Lower/Upper Primary & JHS reports. */
export type RemarksCategory =
  | "CONDUCT"
  | "INTEREST"
  | "ATTITUDE"
  | "TEACHER_REMARKS"
  | "HEADTEACHER_REMARKS";

export const REMARKS_CATEGORY_LABELS: Record<RemarksCategory, string> = {
  CONDUCT: "Conduct",
  INTEREST: "Interest",
  ATTITUDE: "Attitude",
  TEACHER_REMARKS: "Teacher Remarks",
  HEADTEACHER_REMARKS: "Headteacher Remarks",
};

export interface RemarksBankEntry {
  id?: number;
  category: RemarksCategory;
  text: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
