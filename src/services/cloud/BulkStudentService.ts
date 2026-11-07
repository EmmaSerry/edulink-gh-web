/**
 * Bulk student onboarding: registers one row of the uploaded Excel template.
 * Uses the same register_student() database function as the single-student form,
 * so the same rules and permissions apply. (Duplicates are checked on the upload
 * page before anything is saved, so no pop-up appears for every row.)
 */
import { rest } from "@/lib/supabaseClient";
import type { StudentRow } from "@/types/database";

export interface BulkRowPayload {
  schoolId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: "M" | "F";
  dateOfBirth: string;
  academicYearId: string;
  termId: string;
  levelId: string;
  classId: string;
  guardianFullName: string;
  guardianRelationship: string;
  guardianPhone: string;
}

class BulkStudentServiceImpl {
  async registerRow(v: BulkRowPayload): Promise<StudentRow> {
    const student = await rest.rpc<StudentRow>("register_student", {
      p_school_id: v.schoolId,
      p_first_name: v.firstName,
      p_last_name: v.lastName,
      p_gender: v.gender,
      p_date_of_birth: v.dateOfBirth,
      p_academic_year_id: v.academicYearId,
      p_term_id: v.termId,
      p_level_id: v.levelId,
      p_class_id: v.classId,
      p_guardian_name: v.guardianFullName,
      p_guardian_relationship: v.guardianRelationship,
      p_guardian_phone: v.guardianPhone,
    });
    // the registration function has no middle-name field, so it is saved right after
    if (v.middleName) {
      try {
        await rest.update<StudentRow>("students", { id: `eq.${student.id}` }, { middle_name: v.middleName } as Partial<StudentRow>);
      } catch {
        /* the learner is registered; a missing middle name can be added later */
      }
    }
    return student;
  }
}

export const BulkStudentService = new BulkStudentServiceImpl();
