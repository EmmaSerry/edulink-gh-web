export interface AcademicYear {
  id?: number;
  /** e.g. "2025/2026" */
  label: string;
  startDate: string;
  endDate: string;
  /** Only one academic year may be marked current at a time. */
  isCurrent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
