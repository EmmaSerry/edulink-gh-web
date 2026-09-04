export interface SchoolClass {
  id?: number;
  levelId: number;
  /** e.g. "KG1 A", "Basic 4 A", "JHS2 Gold" */
  name: string;
  /** e.g. "KG1-A" */
  code: string;
  capacity?: number;
  classTeacherName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
