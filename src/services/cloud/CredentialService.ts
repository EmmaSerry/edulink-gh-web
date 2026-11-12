/**
 * Login credentials page support - see STEP_1_login_credentials.sql.
 *
 * A readable copy of each login password is kept in a locked table that
 * only the database functions below can read, and each function checks
 * the caller's role: a school admin sees their own teachers/bursars, a
 * district admin sees the school admins and teachers of their district,
 * the platform admin sees everyone.
 */
import { auth, rest } from "@/lib/supabaseClient";

export interface CredentialRow {
  user_id: string;
  full_name: string;
  role: string;
  school_id: string | null;
  school_name: string | null;
  school_code: string | null;
  district_name: string | null;
  login_email: string | null;
  password: string | null;
  is_active: boolean;
  updated_at: string | null;
}

class CloudCredentialServiceImpl {
  async list(): Promise<CredentialRow[]> {
    return rest.rpc<CredentialRow[]>("list_login_credentials", {});
  }

  /** Called right after a successful sign-in so the page always knows
   *  each person's current password. Never throws: a failure here must
   *  not stop anyone signing in. */
  async recordMine(password: string): Promise<void> {
    try {
      await rest.rpc("record_my_password", { p_password: password });
    } catch {
      /* ignore */
    }
  }

  /** Used when an admin creates an account and knows its first password. */
  async recordFor(userId: string, password: string): Promise<void> {
    try {
      await rest.rpc("record_password_for", { p_user_id: userId, p_password: password });
    } catch {
      /* ignore */
    }
  }

  /** Issues a new temporary password through the admin-reset-password
   *  Edge Function, which also saves it for this page. */
  async reset(userId: string): Promise<string> {
    const session = await auth.getValidSession();
    if (!session) throw new Error("You are not signed in.");
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""),
      },
      body: JSON.stringify({ targetUserId: userId }),
    });
    const body = (await res.json().catch(() => ({}))) as { tempPassword?: string; error?: string };
    if (!res.ok || !body.tempPassword) throw new Error(body.error ?? "Could not reset the password.");
    return body.tempPassword;
  }
}

export const CloudCredentialService = new CloudCredentialServiceImpl();
