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
  message: string;
  purpose?: string;
  classId?: string;
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
