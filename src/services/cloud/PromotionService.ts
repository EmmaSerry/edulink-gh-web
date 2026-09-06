/**
 * Cloud service for promotion, repeat, graduation, and mid-term class
 * transfer - see edulink_gh_phase0r_promotion.sql. One RPC
 * (bulk_promote_class) backs all four cases; the methods below just
 * shape the call for each screen that needs it.
 */
import { rest } from "@/lib/supabaseClient";
import type { EnrollmentRow, PromotionHistoryRow, PromotionOutcome, StudentRow } from "@/types/database";

export interface BulkPromoteInput {
  fromClassId: string;
  studentIds: string[];
  outcome: PromotionOutcome;
  /** Not required when outcome is GRADUATED. */
  toClassId?: string;
  toAcademicYearId?: string;
  toTermId?: string;
  enrollmentDate?: string;
}

export interface PromoteResult {
  studentId: string;
  ok: boolean;
  message: string | null;
}

class CloudPromotionServiceImpl {
  /** Every ACTIVE pupil currently placed in a class for a given term -
   *  the roster a promotion/graduation screen starts from. Enrollments
   *  don't carry the pupil's name, so this is a two-step fetch: which
   *  pupils are currently enrolled here, then who they are. */
  async getActiveRoster(termId: string, classId: string): Promise<StudentRow[]> {
    const enrollments = await rest.select<EnrollmentRow>("enrollments", {
      filters: { term_id: `eq.${termId}`, class_id: `eq.${classId}`, is_current: "eq.true" },
    });
    const ids = enrollments.map((e) => e.student_id);
    if (ids.length === 0) return [];
    const students = await rest.select<StudentRow>("students", {
      filters: { id: `in.(${ids.join(",")})`, status: "eq.ACTIVE" },
      order: "last_name.asc",
    });
    return students;
  }

  async bulkPromote(input: BulkPromoteInput): Promise<PromoteResult[]> {
    const rows = await rest.rpc<Array<{ student_id: string; ok: boolean; message: string | null }>>(
      "bulk_promote_class",
      {
        p_from_class_id: input.fromClassId,
        p_student_ids: input.studentIds,
        p_outcome: input.outcome,
        p_to_class_id: input.toClassId ?? null,
        p_to_academic_year_id: input.toAcademicYearId ?? null,
        p_to_term_id: input.toTermId ?? null,
        p_enrollment_date: input.enrollmentDate ?? new Date().toISOString().slice(0, 10),
      }
    );
    return rows.map((r) => ({ studentId: r.student_id, ok: r.ok, message: r.message }));
  }

  /** A single pupil's full promotion/transfer trail, most recent first -
   *  used on the student edit screen alongside the class placement card. */
  async getHistoryForStudent(studentId: string): Promise<PromotionHistoryRow[]> {
    return rest.select<PromotionHistoryRow>("promotion_history", {
      filters: { student_id: `eq.${studentId}` },
      order: "decided_at.desc",
    });
  }
}

export const CloudPromotionService = new CloudPromotionServiceImpl();
