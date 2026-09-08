/**
 * Subscription payment approval - see edulink_gh_phase1d_subscriptions.sql.
 * listForSchool()/listAll() are plain REST reads (RLS scopes what comes
 * back); everything that changes a payment's status or a school's
 * subscription state goes through an RPC, same reasoning as
 * CloudFeeService.recordPayment() - a server-trusted value (who
 * submitted/reviewed it) or a role check the browser can't be trusted
 * to enforce itself.
 */
import { rest } from "@/lib/supabaseClient";
import type { SubscriptionPaymentRow, SubscriptionPaymentMethod, SchoolSubscriptionOverviewRow } from "@/types/database";

export interface SubmitSubscriptionPaymentInput {
  amount: number;
  method: SubscriptionPaymentMethod;
  reference?: string | null;
  notes?: string | null;
  periodLabel?: string | null;
}

export interface RecordAndApproveSubscriptionPaymentInput extends SubmitSubscriptionPaymentInput {
  schoolId: string;
  newExpiry?: string | null;
}

class CloudSubscriptionServiceImpl {
  async listForSchool(schoolId: string): Promise<SubscriptionPaymentRow[]> {
    return rest.select<SubscriptionPaymentRow>("subscription_payments", {
      filters: { school_id: `eq.${schoolId}` },
      order: "created_at.desc",
    });
  }

  /** Every payment platform_admin/district_admin can see, per RLS -
   *  used for the Super Admin Dashboard's pending queue. */
  async listAll(status?: "pending" | "approved" | "rejected"): Promise<SubscriptionPaymentRow[]> {
    return rest.select<SubscriptionPaymentRow>("subscription_payments", {
      filters: status ? { status: `eq.${status}` } : undefined,
      order: "created_at.desc",
    });
  }

  async submit(input: SubmitSubscriptionPaymentInput): Promise<SubscriptionPaymentRow> {
    return rest.rpc<SubscriptionPaymentRow>("submit_subscription_payment", {
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference ?? null,
      p_notes: input.notes ?? null,
      p_period_label: input.periodLabel ?? null,
    });
  }

  async approve(paymentId: string, reviewNotes?: string | null, newExpiry?: string | null): Promise<SubscriptionPaymentRow> {
    return rest.rpc<SubscriptionPaymentRow>("approve_subscription_payment", {
      p_payment_id: paymentId,
      p_review_notes: reviewNotes ?? null,
      p_new_expiry: newExpiry ?? null,
    });
  }

  async reject(paymentId: string, reviewNotes?: string | null): Promise<SubscriptionPaymentRow> {
    return rest.rpc<SubscriptionPaymentRow>("reject_subscription_payment", {
      p_payment_id: paymentId,
      p_review_notes: reviewNotes ?? null,
    });
  }

  async recordAndApprove(input: RecordAndApproveSubscriptionPaymentInput): Promise<SubscriptionPaymentRow> {
    return rest.rpc<SubscriptionPaymentRow>("record_and_approve_subscription_payment", {
      p_school_id: input.schoolId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference ?? null,
      p_notes: input.notes ?? null,
      p_period_label: input.periodLabel ?? null,
      p_new_expiry: input.newExpiry ?? null,
    });
  }

  async listSchoolsOverview(): Promise<SchoolSubscriptionOverviewRow[]> {
    return rest.rpc<SchoolSubscriptionOverviewRow[]>("list_schools_subscription_overview", {});
  }
}

export const CloudSubscriptionService = new CloudSubscriptionServiceImpl();
