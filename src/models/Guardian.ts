/**
 * Parent/Guardian information, stored as its own table (Database
 * Requirements: "Parent/Guardian") rather than inline on Student, so a
 * future phase can support multiple guardians per student or link
 * siblings to the same guardian without restructuring anything.
 * Phase 2 UI manages exactly one primary guardian per student.
 */
export interface Guardian {
  id?: number;
  studentId: number;
  fullName: string;
  relationship: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  occupation?: string;
  residentialAddress?: string;
  digitalAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
  updatedAt: string;
}
