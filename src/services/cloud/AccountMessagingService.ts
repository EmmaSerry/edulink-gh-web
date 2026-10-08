/**
 * Texting sign-in details / links to account holders. The texts are sent by
 * the send-account-details Edge Function (it needs the SMS key and, for
 * "credentials", the power to set a new password).
 */
import { rest, edgeFunctions } from "@/lib/supabaseClient";

export interface MessageableAccount {
  user_id: string;
  full_name: string;
  role: string;
  phone: string | null;
  email: string | null;
  school_name: string | null;
  district_name: string | null;
  is_active: boolean;
}

export type SendMode = "link" | "credentials";

export interface SendResultRow {
  userId: string;
  name: string;
  status: "sent" | "failed" | "no_phone" | "skipped";
  reason?: string;
  email?: string;
  tempPassword?: string;
}

export interface SendResult {
  mode: SendMode;
  sent: number;
  failed: number;
  noPhone: number;
  skipped: number;
  results: SendResultRow[];
}

class AccountMessagingServiceImpl {
  list(): Promise<MessageableAccount[]> {
    return rest.rpc<MessageableAccount[]>("list_messageable_accounts", {});
  }

  /** Sends in batches of 50 so a big selection never times out. */
  async send(mode: SendMode, userIds: string[], onProgress?: (done: number, total: number) => void): Promise<SendResult> {
    const total: SendResult = { mode, sent: 0, failed: 0, noPhone: 0, skipped: 0, results: [] };
    for (let i = 0; i < userIds.length; i += 50) {
      const chunk = userIds.slice(i, i + 50);
      const r = await edgeFunctions.invoke<SendResult>("send-account-details", { mode, userIds: chunk });
      total.sent += r.sent;
      total.failed += r.failed;
      total.noPhone += r.noPhone;
      total.skipped += r.skipped;
      total.results.push(...r.results);
      onProgress?.(Math.min(i + 50, userIds.length), userIds.length);
    }
    return total;
  }
}

export const AccountMessagingService = new AccountMessagingServiceImpl();
