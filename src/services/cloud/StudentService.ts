/**
 * Cloud (Supabase-backed) replacement for src/services/StudentService.ts.
 *
 * Same shape deliberately: register(), updateStudent(), updateStatus(),
 * deleteStudent(), deleteMany() all exist here with equivalent
 * signatures. Multi-table writes are done by Postgres functions (RPCs);
 * Row Level Security limits every request to the signed-in user's school.
 *
 * register() and registerForDistrict() first ask the database for likely
 * duplicates (same name + date of birth, a probable typo, or the same name)
 * in the same class, school or district (see STEP-B_duplicate_checks.sql)
 * and ask the user to confirm before saving.
 */

import { rest } from "@/lib/supabaseClient";
import type { StudentRow, StudentStatus } from "@/types/database";
import { DuplicateService, DuplicateCancelled, confirmDuplicates, describeLearnerMatch } from "./DuplicateService";

export interface StudentRegistration {
  schoolId: string;
  firstName: string;
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

export interface StudentFilterCriteria {
  classId?: string;
  status?: StudentStatus;
  gender?: "M" | "F";
}

async function checkDuplicates(values: StudentRegistration): Promise<void> {
  const matches = await DuplicateService.learners({
    schoolId: values.schoolId,
    firstName: values.firstName,
    lastName: values.lastName,
    dateOfBirth: values.dateOfBirth,
    classId: values.classId,
  });
  if (matches.length === 0) return;
  const lines = matches.map((m) => {
    const d = describeLearnerMatch(m);
    return `${d.title} - ${d.detail}`;
  });
  if (!confirmDuplicates("This learner may already be registered:", lines)) throw new DuplicateCancelled();
}

class CloudStudentServiceImpl {
  /** Registers a new student: identity + guardian + initial enrollment,
   *  atomically, via the register_student() Postgres function. */
  async register(values: StudentRegistration): Promise<StudentRow> {
    await checkDuplicates(values);
    return rest.rpc<StudentRow>("register_student", {
      p_school_id: values.schoolId,
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_gender: values.gender,
      p_date_of_birth: values.dateOfBirth,
      p_academic_year_id: values.academicYearId,
      p_term_id: values.termId,
      p_level_id: values.levelId,
      p_class_id: values.classId,
      p_guardian_name: values.guardianFullName,
      p_guardian_relationship: values.guardianRelationship,
      p_guardian_phone: values.guardianPhone,
    });
  }

  /** Same as register(), but for a district/platform admin registering
   *  into a DIFFERENT school than their own - see
   *  edulink_gh_phase0t_district_registration.sql. */
  async registerForDistrict(values: StudentRegistration): Promise<StudentRow> {
    await checkDuplicates(values);
    return rest.rpc<StudentRow>("register_student_for_district", {
      p_school_id: values.schoolId,
      p_first_name: values.firstName,
      p_last_name: values.lastName,
      p_gender: values.gender,
      p_date_of_birth: values.dateOfBirth,
      p_academic_year_id: values.academicYearId,
      p_term_id: values.termId,
      p_level_id: values.levelId,
      p_class_id: values.classId,
      p_guardian_name: values.guardianFullName,
      p_guardian_relationship: values.guardianRelationship,
      p_guardian_phone: values.guardianPhone,
    });
  }

  /** Just these learners (a class roster) - much lighter than list() for big schools. */
  async listByIds(studentIds: string[]): Promise<StudentRow[]> {
    if (studentIds.length === 0) return [];
    return rest.select<StudentRow>("students", {
      select: "*",
      filters: { id: `in.(${studentIds.join(",")})` },
      order: "last_name.asc",
    });
  }

  /** Lists students. RLS already limits results to the caller's own
   *  school (or, for a district admin, schools in their district). */
  async list(filters: StudentFilterCriteria = {}): Promise<StudentRow[]> {
    const restFilters: Record<string, string> = {};
    if (filters.status) restFilters.status = `eq.${filters.status}`;
    if (filters.gender) restFilters.gender = `eq.${filters.gender}`;
    // classId filters via the current enrollment, so it's applied as a
    // join filter once the enrollments join is wired up in Phase 1's UI
    // work - left as a documented gap rather than a silent no-op.
    return rest.select<StudentRow>("students", {
      select: "*",
      filters: restFilters,
      order: "last_name.asc",
    });
  }

  async getById(id: string): Promise<StudentRow | null> {
    const rows = await rest.select<StudentRow>("students", {
      filters: { id: `eq.${id}` },
      limit: 1,
    });
    return rows[0] ?? null;
  }

  /** Updates the permanent record only - never touches placement/guardian,
   *  same rule as the offline version. */
  async updateStudent(id: string, values: Partial<StudentRow>): Promise<void> {
    await rest.update<StudentRow>("students", { id: `eq.${id}` }, values);
  }

  /** The soft-delete: changes status instead of removing the row. */
  async updateStatus(id: string, status: StudentStatus, reason?: string): Promise<void> {
    await rest.update<StudentRow>("students", { id: `eq.${id}` }, { status, status_reason: reason });
  }

  /** Genuine, permanent hard delete - see delete_student() in
   *  edulink_gh_phase0b_functions.sql for exactly what it touches. */
  async deleteStudent(id: string): Promise<void> {
    await rest.rpc<void>("delete_student", { p_student_id: id });
  }

  async deleteMany(ids: string[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await this.deleteStudent(id);
        deleted++;
      } catch (err) {
        console.error(`Could not delete student ${id}`, err);
        failed++;
      }
    }
    return { deleted, failed };
  }
}

export const CloudStudentService = new CloudStudentServiceImpl();
