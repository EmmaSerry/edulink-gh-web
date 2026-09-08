/**
 * Fee management (private schools only) - see edulink_gh_phase1a_fees.
 * sql. Fee structures are plain REST reads/writes (RLS alone protects
 * them, same reasoning as TermService.update()); generating a term's
 * fees and recording a payment go through RPCs because they need
 * either bulk/idempotent logic or a server-trusted value the browser
 * can't be allowed to set itself. The three overview/summary reads are
 * RPCs because they're aggregations PostgREST can't express directly.
 */
import { rest } from "@/lib/supabaseClient";
import type {
  FeeStructureRow,
  StudentFeeSummaryRow,
  ClassFeeOverviewRow,
  SchoolFeeOverviewRow,
  FeePaymentRow,
  FeePaymentMethod,
} from "@/types/database";

export interface CreateFeeStructureInput {
  schoolId: string;
  academicYearId: string;
  termId: string;
  levelId: string | null;
  name: string;
  amount: number;
}

export interface RecordPaymentInput {
  studentFeeId: string;
  amount: number;
  method: FeePaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

class CloudFeeServiceImpl {
  async listStructures(schoolId: string, termId: string): Promise<FeeStructureRow[]> {
    return rest.select<FeeStructureRow>("fee_structures", {
      filters: { school_id: `eq.${schoolId}`, term_id: `eq.${termId}` },
      order: "name.asc",
    });
  }

  async createStructure(input: CreateFeeStructureInput): Promise<FeeStructureRow> {
    const rows = await rest.insert<FeeStructureRow>("fee_structures", {
      school_id: input.schoolId,
      academic_year_id: input.academicYearId,
      term_id: input.termId,
      level_id: input.levelId,
      name: input.name,
      amount: input.amount,
    });
    return rows[0];
  }

  async updateStructure(id: string, patch: Partial<Pick<FeeStructureRow, "name" | "amount" | "is_active">>): Promise<FeeStructureRow> {
    const rows = await rest.update<FeeStructureRow>("fee_structures", { id: `eq.${id}` }, patch);
    return rows[0];
  }

  /** Blocked with a friendly message if this fee has already been
   *  generated for students - see delete_fee_structure() in
   *  edulink_gh_phase1b_fee_edits_and_sms.sql. */
  async deleteStructure(id: string): Promise<void> {
    await rest.rpc<void>("delete_fee_structure", { p_id: id });
  }

  /** Creates a student_fees row for every enrolled student against
   *  every active fee structure that applies to them - safe to run
   *  more than once, already-generated rows are skipped. */
  async generateTermFees(schoolId: string, termId: string): Promise<{ created: number }> {
    return rest.rpc<{ created: number }>("generate_term_fees", { p_school_id: schoolId, p_term_id: termId });
  }

  async getStudentFeeSummary(studentId: string, termId?: string): Promise<StudentFeeSummaryRow[]> {
    return rest.rpc<StudentFeeSummaryRow[]>("get_student_fee_summary", {
      p_student_id: studentId,
      p_term_id: termId ?? null,
    });
  }

  async getClassFeeOverview(classId: string, termId: string): Promise<ClassFeeOverviewRow[]> {
    return rest.rpc<ClassFeeOverviewRow[]>("get_class_fee_overview", { p_class_id: classId, p_term_id: termId });
  }

  async getSchoolFeeOverview(schoolId?: string | null, termId?: string | null): Promise<SchoolFeeOverviewRow[]> {
    return rest.rpc<SchoolFeeOverviewRow[]>("get_school_fee_overview", {
      p_school_id: schoolId ?? null,
      p_term_id: termId ?? null,
    });
  }

  async recordPayment(input: RecordPaymentInput): Promise<FeePaymentRow> {
    return rest.rpc<FeePaymentRow>("record_payment", {
      p_student_fee_id: input.studentFeeId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference ?? null,
      p_notes: input.notes ?? null,
    });
  }
}

export const CloudFeeService = new CloudFeeServiceImpl();
