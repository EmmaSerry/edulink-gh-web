/**
 * Report-card payments. Reports can always be generated (and are counted);
 * releasing one - print, PDF/zip download, SMS - needs it to be unlocked.
 * A learner is unlocked by: an approved payment, the one free report per
 * class each term, or the price being 0 (reports free). The server decides
 * all of this; this file only talks to it.
 */
import { rest } from "@/lib/supabaseClient";

export type BillingStatus = "paid" | "free" | "locked" | "pending";

export interface BillingRow {
  student_id: string;
  student_name: string;
  student_code: string;
  class_id: string;
  class_name: string;
  generated: boolean;
  status: BillingStatus;
}

export interface ReportPaymentRow {
  id: string;
  term_id: string;
  learner_count: number;
  unit_price: number;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
}

export interface AdminPaymentRow {
  id: string;
  school_id: string;
  school_name: string;
  district_name: string | null;
  term_name: string | null;
  learner_count: number;
  unit_price: number;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
}

export interface SchoolBillingRow {
  school_id: string;
  school_name: string;
  district_name: string | null;
  price_override: number | null;
  effective_price: number;
  generated_count: number;
  unlocked_count: number;
  approved_amount: number;
  pending_amount: number;
}

export interface PaymentSettings {
  report_price_per_learner: number;
  onboarding_fee_required: boolean;
  onboarding_fee_public: number;
  onboarding_fee_private: number;
}

export interface LockState {
  /** Price per learner report for this school (0 = free). */
  price: number;
  /** True when payment is required (price > 0). */
  enforced: boolean;
  unlocked: Set<string>;
  freeClasses: Set<string>;
  isLocked(studentId: string): boolean;
}

export const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  online: "Online",
  other: "Other",
};

class ReportBillingServiceImpl {
  async getLockState(termId: string): Promise<LockState> {
    const [pricing, unlocks] = await Promise.all([
      rest.rpc<{ unit_price: number }[]>("get_report_pricing", {}),
      rest.select<{ student_id: string; class_id: string | null; source: string }>("report_unlocks", {
        select: "student_id,class_id,source",
        filters: { term_id: `eq.${termId}` },
      }),
    ]);
    const price = Number(pricing?.[0]?.unit_price ?? 0);
    const unlocked = new Set(unlocks.map((u) => u.student_id));
    const freeClasses = new Set(unlocks.filter((u) => u.source === "free" && u.class_id).map((u) => u.class_id as string));
    return {
      price,
      enforced: price > 0,
      unlocked,
      freeClasses,
      isLocked: (id: string) => price > 0 && !unlocked.has(id),
    };
  }

  claimFree(studentId: string, termId: string): Promise<void> {
    return rest.rpc<void>("claim_free_report", { p_student_id: studentId, p_term_id: termId });
  }

  listRows(termId: string, schoolId?: string): Promise<BillingRow[]> {
    return rest.rpc<BillingRow[]>("list_report_billing_rows", { p_term_id: termId, p_school_id: schoolId ?? null });
  }

  submit(termId: string, studentIds: string[], method: string, reference: string, notes: string): Promise<ReportPaymentRow> {
    return rest.rpc<ReportPaymentRow>("submit_report_payment", {
      p_term_id: termId,
      p_student_ids: studentIds,
      p_method: method,
      p_reference: reference || null,
      p_notes: notes || null,
    });
  }

  myPayments(): Promise<ReportPaymentRow[]> {
    return rest.rpc<ReportPaymentRow[]>("list_my_report_payments", {});
  }

  // ---- Super Admin ----
  async getSettings(): Promise<PaymentSettings> {
    const rows = await rest.rpc<PaymentSettings[]>("get_payment_settings", {});
    return rows[0];
  }
  setReportPrice(price: number): Promise<void> {
    return rest.rpc<void>("set_report_price", { p_price: price });
  }
  setSchoolPrice(schoolId: string, price: number | null): Promise<void> {
    return rest.rpc<void>("set_school_report_price", { p_school_id: schoolId, p_price: price });
  }
  setOnboarding(required: boolean, pub: number, priv: number): Promise<void> {
    return rest.rpc<void>("set_onboarding_settings", { p_required: required, p_public: pub, p_private: priv });
  }
  listPayments(status?: string): Promise<AdminPaymentRow[]> {
    return rest.rpc<AdminPaymentRow[]>("list_report_payments", { p_status: status ?? null });
  }
  decide(paymentId: string, approve: boolean, notes?: string): Promise<void> {
    return rest.rpc<void>("decide_report_payment", { p_payment_id: paymentId, p_approve: approve, p_notes: notes ?? null });
  }
  listSchools(): Promise<SchoolBillingRow[]> {
    return rest.rpc<SchoolBillingRow[]>("list_schools_report_billing", {});
  }
}

export const ReportBillingService = new ReportBillingServiceImpl();
