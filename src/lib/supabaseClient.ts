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

function authHeaders(): Record<string, string> {
  const anonKey = getSupabaseAnonKey();
  const session = loadSession();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${session?.access_token ?? anonKey}`,
  };
}

export const auth = {
  /** Signs in an already-created Supabase Auth user (see Authentication -> Users). */
  async signInWithPassword(email: string, password: string): Promise<AuthSession> {
    const SUPABASE_URL = getSupabaseUrl();
    const SUPABASE_ANON_KEY = getSupabaseAnonKey();
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await describeError(res));
    const data = await res.json();
    const session: AuthSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { id: data.user.id, email: data.user.email },
      expires_at: Date.now() + data.expires_in * 1000,
    };
    saveSession(session);
    return session;
  },

  signOut(): void {
    saveSession(null);
  },

  currentSession(): AuthSession | null {
    return loadSession();
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
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T[];
  },

  async insert<T>(table: string, row: Partial<T> | Array<Partial<T>>): Promise<T[]> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T[];
  },

  async update<T>(table: string, filters: Record<string, string>, patch: Partial<T>): Promise<T[]> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/${table}${buildQuery({ filters })}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T[];
  },

  /** Calls a Postgres function exposed via PostgREST (`create function ... `). */
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(await describeError(res));
    return (await res.json()) as T;
  },
};
