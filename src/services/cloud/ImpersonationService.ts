/**
 * Super Admin "sign in as". The Super Admin's own session is parked in this
 * browser tab's sessionStorage; the app then runs as the chosen person until
 * "Return to Super Admin" restores it.
 */
import { rest, edgeFunctions } from "@/lib/supabaseClient";

const SESSION_KEY = "edulink-gh-session"; // same key the app's sign-in uses
const STASH_KEY = "edulink-gh-admin-stash";

export interface SchoolAccountRow {
  user_id: string;
  full_name: string;
  role: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ImpersonationLogRow {
  id: string;
  admin_name: string | null;
  target_name: string | null;
  target_role: string | null;
  school_name: string | null;
  started_at: string;
}

interface Stash {
  session: string; // the Super Admin's stored session, verbatim
  adminId: string;
  viewingName: string;
  viewingRole: string;
  viewingSchool: string | null;
}

export function getImpersonation(): Stash | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const stash = JSON.parse(raw) as Stash;
    // If the person signed out / in as someone else, the stash is stale.
    const current = localStorage.getItem(SESSION_KEY);
    if (!current) {
      sessionStorage.removeItem(STASH_KEY);
      return null;
    }
    const cur = JSON.parse(current) as { user?: { id?: string } };
    if (cur.user?.id === stash.adminId) {
      sessionStorage.removeItem(STASH_KEY);
      return null;
    }
    return stash;
  } catch {
    return null;
  }
}

class ImpersonationServiceImpl {
  listSchoolAccounts(schoolId: string): Promise<SchoolAccountRow[]> {
    return rest.rpc<SchoolAccountRow[]>("list_school_accounts", { p_school_id: schoolId });
  }

  log(): Promise<ImpersonationLogRow[]> {
    return rest.rpc<ImpersonationLogRow[]>("list_impersonation_log", { p_limit: 30 });
  }

  /** Opens the app as `userId`. Reloads the page on success. */
  async start(userId: string): Promise<void> {
    const adminRaw = localStorage.getItem(SESSION_KEY);
    if (!adminRaw) throw new Error("You are not signed in.");
    const adminSession = JSON.parse(adminRaw) as { user: { id: string } };

    const r = await edgeFunctions.invoke<{ tokenHash: string; name: string; role: string; schoolName: string | null }>(
      "impersonate-user",
      { userId },
    );

    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const res = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", token_hash: r.tokenHash }),
    });
    if (!res.ok) throw new Error("Could not open this account. Try again.");
    const data = await res.json();

    const stash: Stash = {
      session: adminRaw,
      adminId: adminSession.user.id,
      viewingName: r.name,
      viewingRole: r.role,
      viewingSchool: r.schoolName,
    };
    sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: { id: data.user.id, email: data.user.email },
        expires_at: Date.now() + data.expires_in * 1000,
      }),
    );
    window.location.assign("/dashboard");
  }

  stop(): void {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return;
    const stash = JSON.parse(raw) as Stash;
    localStorage.setItem(SESSION_KEY, stash.session);
    sessionStorage.removeItem(STASH_KEY);
    window.location.assign("/billing");
  }
}

export const ImpersonationService = new ImpersonationServiceImpl();
