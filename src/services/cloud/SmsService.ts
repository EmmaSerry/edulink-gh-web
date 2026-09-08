/**
 * SMS-to-parents - see edulink_gh_phase0x_sms.sql (recipient lookup +
 * the read-only log) and the send-parent-sms Edge Function (the actual
 * send, which needs the Arkesel API key and so cannot be a plain RPC -
 * see that function's own comments for why).
 */
import { rest, edgeFunctions } from "@/lib/supabaseClient";
import type { SmsRecipient, SmsSendResult, SmsLogRow } from "@/types/database";

export interface SendSmsInput {
  guardianIds: string[];
  /** May contain {guardian_name}, {student_name}, {school_name} - each
   *  recipient gets their own filled-in copy, see send-parent-sms. */
  message: string;
  purpose?: string;
  classId?: string;
  termId?: string;
  /** Appends each pupil's current-term subject scores/grades to THEIR
   *  message - see get_student_term_report_summary(). */
  includeReportSummary?: boolean;
  /** Appends this/next term's fees payable and/or the reopening date
   *  to THEIR message - see build_fee_sms_snippet() in
   *  edulink_gh_phase1b_fee_edits_and_sms.sql. Private schools only -
   *  the fees screen these numbers come from doesn't exist for public
   *  schools. */
  includeFeesThisTerm?: boolean;
  includeFeesNextTerm?: boolean;
  includeReopeningDate?: boolean;
}

class CloudSmsServiceImpl {
  /** Pass a classId to list a class's guardians, or studentIds for a
   *  specific pupil selection - at least one should be given. */
  async getRecipients(opts: { classId?: string; studentIds?: string[] }): Promise<SmsRecipient[]> {
    return rest.rpc<SmsRecipient[]>("get_sms_recipients", {
      p_class_id: opts.classId ?? null,
      p_student_ids: opts.studentIds ?? null,
    });
  }

  async send(input: SendSmsInput): Promise<SmsSendResult> {
    return edgeFunctions.invoke<SmsSendResult>("send-parent-sms", {
      guardianIds: input.guardianIds,
      message: input.message,
      purpose: input.purpose ?? "general",
      classId: input.classId ?? null,
      termId: input.termId ?? null,
      includeReportSummary: input.includeReportSummary ?? false,
      includeFeesThisTerm: input.includeFeesThisTerm ?? false,
      includeFeesNextTerm: input.includeFeesNextTerm ?? false,
      includeReopeningDate: input.includeReopeningDate ?? false,
    });
  }

  /** Recent history, most recent first - respects the same tenant/
   *  district visibility as everything else (see the table's RLS). */
  async recentHistory(limit = 50): Promise<SmsLogRow[]> {
    return rest.select<SmsLogRow>("sms_log", {
      order: "sent_at.desc",
      limit,
    });
  }
}

export const CloudSmsService = new CloudSmsServiceImpl();
