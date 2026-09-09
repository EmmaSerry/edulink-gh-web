/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Paystack's PUBLIC key only - safe to expose in the browser. The
   *  secret key lives in Supabase's own Edge Function secrets, never
   *  here. See paystack-verify-transaction.ts. */
  readonly VITE_PAYSTACK_PUBLIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Loaded via a plain <script> tag in index.html (Paystack Inline JS
 *  Popup V2) rather than an npm import, so TypeScript has no type
 *  information for it on its own - this ambient declaration covers
 *  just the shape CloudSubscriptionStatus.tsx actually calls. */
declare class PaystackPop {
  newTransaction(options: {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, unknown>;
    onSuccess?: (transaction: { reference: string }) => void;
    onCancel?: () => void;
  }): void;
}
