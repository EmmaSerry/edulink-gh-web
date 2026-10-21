/**
 * Credits (SMS / WhatsApp tokens), online Paystack payments and WhatsApp
 * sending. Amounts and access are decided by the server; this file only
 * talks to it.
 */
import { rest, edgeFunctions } from "@/lib/supabaseClient";

export type PurchaseKind = "sms_tokens" | "whatsapp_tokens" | "report_fees";

export interface MessagingPricing {
  sms_price: number;
  whatsapp_price: number;
  min_purchase: number;
  sms_tokens: number;
  whatsapp_tokens: number;
}

export interface PurchaseRow {
  id: string;
  kind: PurchaseKind;
  quantity: number;
  unit_price: number;
  amount: number;
  status: "pending" | "paid" | "failed";
  paystack_reference: string;
  created_at: string;
  paid_at: string | null;
}

export interface LedgerRow {
  id: string;
  channel: "sms" | "whatsapp";
  delta: number;
  balance_after: number | null;
  reason: string | null;
  created_at: string;
}

export interface AdminSettings {
  report_price_per_learner: number;
  onboarding_fee_required: boolean;
  onboarding_fee_public: number;
  onboarding_fee_private: number;
  sms_price_per_message: number;
  whatsapp_price_per_message: number;
  min_token_purchase: number;
  digest_phone: string | null;
  digest_email: string | null;
}

export interface OnlinePaymentRow {
  id: string;
  school_name: string;
  district_name: string | null;
  kind: PurchaseKind;
  quantity: number;
  amount: number;
  status: string;
  paystack_reference: string;
  paid_at: string | null;
  created_at: string;
}

export interface TokenBalanceRow {
  school_id: string;
  school_name: string;
  district_name: string | null;
  sms_tokens: number;
  whatsapp_tokens: number;
}

export interface DigestRow {
  id: string;
  created_at: string;
  payment_count: number;
  total_amount: number;
  body: string;
  sms_sent: boolean;
  email_sent: boolean;
}

export interface WhatsAppResultRow {
  studentId: string;
  name: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

export interface WhatsAppSendResult {
  sent: number;
  failed: number;
  skipped: number;
  results: WhatsAppResultRow[];
}

const SESSION_KEY = "edulink-gh-session";

class PlatformPaymentsServiceImpl {
  async pricing(): Promise<MessagingPricing> {
    const rows = await rest.rpc<MessagingPricing[]>("get_messaging_pricing", {});
    return rows[0];
  }
  purchases(): Promise<PurchaseRow[]> {
    return rest.rpc<PurchaseRow[]>("list_my_purchases", {});
  }
  ledger(): Promise<LedgerRow[]> {
    return rest.rpc<LedgerRow[]>("list_token_ledger", { p_limit: 40 });
  }

  /** Starts a Paystack checkout and sends the browser there. */
  async checkout(input: { kind: PurchaseKind; quantity?: number; termId?: string; studentIds?: string[] }): Promise<void> {
    const r = await edgeFunctions.invoke<{ authorizationUrl: string }>("platform-checkout", input);
    window.location.assign(r.authorizationUrl);
  }

  verify(reference: string) {
    return edgeFunctions.invoke<{ ok: boolean; kind?: PurchaseKind; quantity?: number; amount?: number; already?: boolean; message?: string }>(
      "platform-verify",
      { reference },
    );
  }

  // ---- Super Admin ----
  async adminSettings(): Promise<AdminSettings> {
    const rows = await rest.rpc<AdminSettings[]>("get_payment_settings", {});
    return rows[0];
  }
  setMessagingPrices(sms: number, whatsapp: number, min: number): Promise<void> {
    return rest.rpc<void>("set_messaging_prices", { p_sms: sms, p_whatsapp: whatsapp, p_min: min });
  }
  setDigestContacts(phone: string, email: string): Promise<void> {
    return rest.rpc<void>("set_digest_contacts", { p_phone: phone, p_email: email });
  }
  grantTokens(schoolId: string, channel: "sms" | "whatsapp", amount: number, reason: string): Promise<void> {
    return rest.rpc<void>("admin_grant_tokens", { p_school_id: schoolId, p_channel: channel, p_amount: amount, p_reason: reason });
  }
  onlinePayments(days = 30): Promise<OnlinePaymentRow[]> {
    return rest.rpc<OnlinePaymentRow[]>("list_online_payments", { p_days: days });
  }
  balances(): Promise<TokenBalanceRow[]> {
    return rest.rpc<TokenBalanceRow[]>("list_schools_token_balances", {});
  }
  digests(): Promise<DigestRow[]> {
    return rest.rpc<DigestRow[]>("list_payment_digests", { p_limit: 12 });
  }
  sendDigestNow() {
    return edgeFunctions.invoke<{ ok: boolean; body: string; smsSent: boolean; emailSent: boolean; hint?: string }>("weekly-payments-digest", {});
  }

  // ---- WhatsApp ----
  /** Uploads a report PDF to private storage; returns its path. */
  async uploadReportPdf(schoolId: string, termId: string, studentId: string, blob: Blob): Promise<string> {
    // Any REST call first makes sure the stored sign-in is fresh.
    await rest.rpc("get_messaging_pricing", {});
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) throw new Error("You are not signed in.");
    const session = JSON.parse(raw) as { access_token: string };
    const path = `${schoolId}/${termId}/${studentId}.pdf`;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/report-pdfs/${path}`, {
      method: "POST",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: blob,
    });
    if (!res.ok) throw new Error("Could not upload the report file.");
    return path;
  }

  sendWhatsApp(input: {
    kind: "report" | "custom";
    termId?: string;
    message?: string;
    items: { studentId: string; pdfPath?: string }[];
  }) {
    return edgeFunctions.invoke<WhatsAppSendResult>("send-whatsapp", input);
  }
}

export const PlatformPaymentsService = new PlatformPaymentsServiceImpl();

export const KIND_LABEL: Record<string, string> = {
  sms_tokens: "SMS tokens",
  whatsapp_tokens: "WhatsApp tokens",
  report_fees: "Report fees",
};
