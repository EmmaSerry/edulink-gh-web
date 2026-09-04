/**
 * Cloud (Supabase-backed) replacement for src/services/EnrollmentService.ts.
 *
 * assignClass() is now one call to the assign_class() Postgres function
 * (see edulink_gh_phase0c_enrollment.sql) instead of a Dexie
 * transaction. The "only one current enrollment per student" rule that
 * used to depend on the app remembering to unset the old flag is now
 * additionally enforced by a database-level unique index, so it holds
 * even if a future bug in this file ever tried to violate it.
 *
 * bulkAssignClass() stays a plain client-side loop, unchanged in spirit
 * from the offline version: sequential, not all-or-nothing, so one
 * student's failure (e.g. an archived term) doesn't undo the others -
 * and the caller gets back exactly which students failed and why.
 */

import { rest } from "@/lib/supabaseClient";
import type { EnrollmentRow } from "@/types/database";

export interface AssignClassInput {
  termId: string;
  levelId: string;
  classId: string;
  enrollmentDate: string;
  remarks?: string;
}

class CloudEnrollmentServiceImpl {
  async assignClass(studentId: string, values: AssignClassInput): Promise<EnrollmentRow> {
    return rest.rpc<EnrollmentRow>("assign_class", {
      p_student_id: studentId,
      p_term_id: values.termId,
      p_level_id: values.levelId,
      p_class_id: values.classId,
      p_enrollment_date: values.enrollmentDate,
      p_remarks: values.remarks ?? null,
    });
  }

  async bulkAssignClass(
    studentIds: string[],
    values: AssignClassInput
  ): Promise<{ succeeded: string[]; failed: Array<{ studentId: string; message: string }> }> {
    const succeeded: string[] = [];
    const failed: Array<{ studentId: string; message: string }> = [];
    for (const studentId of studentIds) {
      try {
        await this.assignClass(studentId, values);
        succeeded.push(studentId);
      } catch (err) {
        failed.push({ studentId, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    return { succeeded, failed };
  }

  async getCurrentEnrollment(studentId: string): Promise<EnrollmentRow | null> {
    const rows = await rest.select<EnrollmentRow>("enrollments", {
      filters: { student_id: `eq.${studentId}`, is_current: "eq.true" },
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async getHistoryForStudent(studentId: string): Promise<EnrollmentRow[]> {
    return rest.select<EnrollmentRow>("enrollments", {
      filters: { student_id: `eq.${studentId}` },
      order: "enrollment_date.desc",
    });
  }

  /** Class roster for a specific term (matches ACTRS's Module 12 Class Lists). */
  async getRoster(termId: string, classId: string): Promise<EnrollmentRow[]> {
    return rest.select<EnrollmentRow>("enrollments", {
      filters: { term_id: `eq.${termId}`, class_id: `eq.${classId}` },
    });
  }
}

export const CloudEnrollmentService = new CloudEnrollmentServiceImpl();
