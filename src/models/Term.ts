export interface Term {
  id?: number;
  academicYearId: number;
  /** e.g. "Term 1" */
  termName: string;
  /** 1, 2 or 3 */
  termNumber: 1 | 2 | 3;
  openingDate: string;
  closingDate: string;
  vacationDate: string;
  reopeningDate: string;
  totalSchoolDays: number;
  /** Only one term system-wide may be active at a time. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
