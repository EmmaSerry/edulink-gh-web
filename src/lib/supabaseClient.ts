/**
 * Minimal Supabase client built on the browser's own `fetch` - no
 * `@supabase/supabase-js` dependency required.
 *
 * Supabase's official SDK is itself mostly a thin wrapper over two plain
 * HTTP APIs: PostgREST (the auto-generated REST API in front of the
 * Postgres schema) and GoTrue (the auth service). This file talks to
 * both directly. It can be swapped for the official SDK later without
 * changing any calling code, since cloud services only ever import
 * `auth` and `rest` from this one file.
 *
 * Requires two Vite env vars (see .env.example):
 *   VITE_SUPABASE_URL       - e.g. https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  - the "anon / public" key from
 *                              Project Settings -> API Keys
 * Never put the service_role/secret key in frontend code - only the
 * anon key belongs here. Row Level Security (see the Phase 0 schema) is
 * what keeps that key safe to expose in the browser.
 */

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const RAW_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getSupabaseUrl(): string {
  if (!RAW_SUPABASE_URL) {
    throw new Error(
      "Missing VITE_SUPABASE_URL. Copy .env.example to .env.local and fill in " +
        "your Supabase project's values."
    );
  }
  return RAW_SUPABASE_URL;
}

function getSupabaseAnonKey(): string {
  if (!RAW_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill " +
        "in your Supabase project's values."
    );
  }
  return RAW_SUPABASE_ANON_KEY;
}

const SESSION_STORAGE_KEY = "edulink-gh-session";

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  /** Epoch milliseconds. */
  expires_at: number;
}

function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession | null): void {
  if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function describeError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.message ?? body.error_description ?? body.msg ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

function sessionFromTokenResponse(data: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
}): AuthSession {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: { id: data.user.id, email: data.user.email },
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/** Supabase access tokens are short-lived (about an hour) by design - a
 *  page left open, or reopened later, will otherwise start failing
 *  every request with "JWT expired". This refreshes the stored session
 *  using its refresh_token whenever the access token is at or near
 *  expiry (a 30s buffer avoids racing the exact expiry instant),
 *  called before every authenticated request rather than on a timer,
 *  so it works correctly even if the tab was asleep/backgrounded. If
 *  the refresh token itself has also expired (e.g. the device was
 *  offline for a very long time), the stored session is cleared so the
 *  app falls back to the sign-in screen instead of looping on errors.
 */
async function ensureFreshSession(): Promise<AuthSession | null> {
  const session = loadSession();
  if (!session) return null;
  if (Date.now() < session.expires_at - 30_000) return session;

  try {
    const res = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: getSupabaseAnonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) {
      saveSession(null);
      return null;
    }
    const refreshed = sessionFromTokenResponse(await res.json());
    saveSession(refreshed);
    return refreshed;
  } catch {
    // Network hiccup refreshing - keep the old (possibly still valid
    // for a few more seconds) session rather than signing the user out
    // over what may just be a dropped connection.
    return session;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const anonKey = getSupabaseAnonKey();
  const session = await ensureFreshSession();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${session?.access_token ?? anonKey}`,
  };
}

export const auth = {
  /** Signs in an already-created Supabase Auth user (see Authentication -> Users). */
  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    const res = await fetch(`${getSupabaseUrl()}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: getSupabaseAnonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await describeError(res));
    const session = sessionFromTokenResponse(await res.json());
    saveSession(session);
    return session;
  },

  signOut(): void {
    saveSession(null);
  },

  /**
   * Creates a brand-new Supabase Auth user (email + password) WITHOUT
   * touching the calling browser's own stored session - used by
   * Settings -> Staff so a school admin can create a teacher/bursar
   * account without being signed out of their own. GoTrue's plain
   * signup endpoint only needs the anon key (no admin/service_role key
   * involved, which must never be in the browser), and its response is
   * simply never passed to saveSession() here.
   *
   * If the Supabase project has "Confirm email" switched on
   * (Authentication -> Providers -> Email), the new account can't sign
   * in until that confirmation link is clicked - worth turning off for
   * staff created this way, since there's no one else to click it.
   */
  async signUpWithoutSession(email: string, password: string): Promise<{ id: string }> {
    const res = await fetch(`${getSupabaseUrl()}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: getSupabaseAnonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await describeError(res));
    const data = await res.json();
    const id = data?.user?.id ?? data?.id;
    if (!id) throw new Error("Account was created but no user id was returned - please check Supabase Auth.");
    return { id };
  },

  /**
   * Public self-service signup (a brand-new school registering itself)
   * - unlike signUpWithoutSession() above, this one DOES want the new
   * session: there's no existing admin to keep signed in here, the
   * person filling out this form IS the account being created, and the
   * follow-up call (register_school_self_service()) needs to run AS
   * them so auth.uid() inside that function resolves correctly.
   * GoTrue's plain signup endpoint returns a full session directly in
   * its response as long as "Confirm email" is off project-wide (the
   * same setting every staff-creation flow already depends on) - if
   * it's back on, there's no session to use here and the caller needs
   * to tell the person to check their email instead.
   */
  async signUpAndSignIn(email: string, password: string): Promise<AuthSession> {
    const res = await fetch(`${getSupabaseUrl()}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: getSupabaseAnonKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await describeError(res));
    const data = await res.json();
    if (!data?.access_token) {
      throw new Error(
        "Your account was created, but couldn't be signed in automatically - this project may require email " +
          "confirmation. Check your inbox for a confirmation link, then sign in normally."
      );
    }
    const session = sessionFromTokenResponse(data);
    saveSession(session);
    return session;
  },

  currentSession(): AuthSession | null {
    return loadSession();
  },

  /** Like currentSession(), but refreshes an expired/near-expired
   *  session first - use this on app load instead of currentSession()
   *  so reopening the app after the access token has expired doesn't
   *  immediately fail every request. */
  async getValidSession(): Promise<AuthSession | null> {
    return ensureFreshSession();
  },
};

/** Calls a Supabase Edge Function (see supabase/functions/ in this
 *  project) - used for the one action that genuinely needs the
 *  service_role key, which can only ever run server-side, never in
 *  this browser code. Sends the caller's own session token, same as
 *  every other authenticated request here; the function itself is
 *  responsible for checking that caller is actually allowed to do
 *  whatever it's asking for. */
export const edgeFunctions = {
  async invoke<T>(name: string, body: unknown): Promise<T> {
    const res = await fetch(`${getSupabaseUrl()}/functions/v1/${name}`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.error ?? `Request to ${name} failed.`);
    return data as T;
  },
};

export interface RestQueryOptions {
  /** PostgREST column selection, e.g. "id,name" or "*,school:schools(name)". */
  select?: string;
  /** Raw PostgREST filter params, e.g. { school_id: "eq.<uuid>" }. */
  filters?: Record<string, string>;
  order?: string;
  limit?: number;
}

function buildQuery(options: RestQueryOptions = {}): string {
  const params = new URLSearchParams();
  if (options.select) params.set("select", options.select);
  if (options.order) params.set("order", options.order);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Thin wrapper over Supabase's auto-generated REST (PostgREST) API. */
export const rest = {
  async select<T>(table: string, options?: RestQueryOptions): Promise<T[]> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/${table}${buildQuery(options)}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T[];
  },

  async insert<T>(table: string, row: Partial<T> | Array<Partial<T>>): Promise<T[]> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T[];
  },

  async update<T>(table: string, filters: Record<string, string>, patch: Partial<T>): Promise<T[]> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/${table}${buildQuery({ filters })}`, {
      method: "PATCH",
      headers: { ...(await authHeaders()), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T[];
  },

  /** Calls a Postgres function exposed via PostgREST (`create function ... `).
   *  A function declared `returns void` (e.g. record_report_print,
   *  record_report_export, delete_student) sends back an empty body,
   *  not JSON - reading it as text first and only parsing when there's
   *  actually something there avoids "Unexpected end of JSON input" on
   *  every one of those calls. */
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(await describeError(res));
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  },
};
