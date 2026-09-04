/**
 * Session/profile context for the cloud (EduLink GH) app.
 *
 * A Supabase Auth session alone only proves WHO signed in - it says
 * nothing about which school/district they belong to or what role they
 * have, and that's exactly what every page needs to decide what to show
 * and what RLS will let it read. So on sign-in (and on every page
 * reload, since the session is restored from localStorage by
 * supabaseClient.ts) this context fetches the caller's own
 * `user_profiles` row - allowed by RLS because a user is always allowed
 * to read their own profile - and holds it alongside the session for
 * the rest of the app to use.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, rest, type AuthSession } from "@/lib/supabaseClient";
import type { UserProfileRow } from "@/types/database";

interface CloudAuthContextValue {
  session: AuthSession | null;
  profile: UserProfileRow | null;
  /** True while the initial session/profile check on page load is still running. */
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const CloudAuthContext = createContext<CloudAuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<UserProfileRow | null> {
  const rows = await rest.select<UserProfileRow>("user_profiles", {
    filters: { id: `eq.${userId}` },
    limit: 1,
  });
  return rows[0] ?? null;
}

export function CloudAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = auth.currentSession();
    if (!existing) {
      setLoading(false);
      return;
    }
    setSession(existing);
    loadProfile(existing.user.id)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const newSession = await auth.signInWithPassword(email, password);
      setSession(newSession);
      const p = await loadProfile(newSession.user.id);
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      throw err;
    }
  }, []);

  const signOut = useCallback(() => {
    auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <CloudAuthContext.Provider value={{ session, profile, loading, error, signIn, signOut }}>
      {children}
    </CloudAuthContext.Provider>
  );
}

export function useCloudAuth(): CloudAuthContextValue {
  const ctx = useContext(CloudAuthContext);
  if (!ctx) throw new Error("useCloudAuth must be used within a CloudAuthProvider");
  return ctx;
}
