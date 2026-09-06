/**
 * Cloud (Supabase-backed) replacement for src/services/StudentService.ts.
 *
 * Same shape deliberately: register(), updateStudent(), updateStatus(),
 * deleteStudent(), deleteMany() all exist here with equivalent
 * signatures, so screens built against the Dexie version port over with
 * minimal changes. What changed underneath:
 *   - "One Dexie transaction touching N tables" becomes "one Postgres
 *     function (RPC) doing the same N writes atomically on the server"
 *     - see register_student() / delete_student() in
 *       edulink_gh_phase0b_functions.sql. The client-side code below
 *       does not (and cannot) orchestrate a multi-table transaction
 *       itself over plain REST calls.
 *   - There is no manual "which school is this" filtering anywhere in
 *     this file. Row Level Security on the database does that
 *     automatically for every request, based on the signed-in user's
 *     own school_id - the same query a teacher and a platform admin
 *     both run returns different rows for each of them, with no branch
 *     in this code for it.
 *   - Numeric auto-increment ids become UUID strings throughout.
 */

import { rest } from "@/lib/supabaseClient";
import type { StudentRow, StudentStatus } from "@/types/database";

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

class CloudStudentServiceImpl {
  /** Registers a new student: identity + guardian + initial enrollment,
   *  atomically, via the register_student() Postgres function. */
  async register(values: StudentRegistration): Promise<StudentRow> {
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
   *  edulink_gh_phase0t_district_registration.sql. Same payload shape,
   *  routed to the definer RPC that carries its own district check
   *  instead of relying on ordinary tenant-isolation RLS. */
  async registerForDistrict(values: StudentRegistration): Promise<StudentRow> {
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

  /** Lists students. RLS already limits results to the caller's own
   *  school (or, for a district admin, schools in their district) - no
   *  school_id filter needs to be added here by hand. */
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
    await rest.update<StudentRow>(
      "students",
      { id: `eq.${id}` },
      { status, status_reason: reason }
    );
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
