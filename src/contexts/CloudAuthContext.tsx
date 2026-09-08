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
import { CloudDistrictService } from "@services/cloud/DistrictService";
import type { UserProfileRow } from "@/types/database";

interface CloudAuthContextValue {
  session: AuthSession | null;
  profile: UserProfileRow | null;
  /** True while the initial session/profile check on page load is still running. */
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<UserProfileRow | null>;
  signOut: (reason?: string) => void;
}

const CloudAuthContext = createContext<CloudAuthContextValue | undefined>(undefined);

/**
 * Idle-session timeout - see get_idle_timeout_settings() in
 * edulink_gh_phase0z_idle_timeout_and_signup_fix.sql. A district admin
 * sets their own district's timeout, a platform admin sets the
 * platform-wide default (CloudDistrictDashboard's "Session timeout"
 * panel); this is the enforcement side.
 *
 * Last-activity is kept in localStorage (not component state) for two
 * reasons: it needs to survive a full browser close/reopen (a closed
 * laptop overnight should still force re-login, not just an open tab
 * left idle), and it's naturally shared across every tab of the same
 * origin, so activity in one tab resets the idle clock for all of
 * them.
 *
 * On first load after this feature ships (no stored timestamp yet),
 * activity is seeded to "now" rather than treated as already-stale -
 * same fail-open philosophy as RequireApprovedSchool - so nobody who
 * was already using the app gets unexpectedly signed out the moment
 * this deploys. Every restart after that has a real timestamp to
 * check against.
 */
const IDLE_ACTIVITY_KEY = "edulinkgh_last_activity";
const IDLE_CHECK_INTERVAL_MS = 30_000;
const IDLE_ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const IDLE_ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

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
    let cancelled = false;
    // getValidSession() (not currentSession()) so reopening the app
    // after the access token has expired transparently refreshes it
    // instead of leaving every page's first request to fail with "JWT
    // expired".
    auth
      .getValidSession()
      .then((existing) => {
        if (cancelled) return null;
        if (!existing) {
          setLoading(false);
          return null;
        }
        setSession(existing);
        return loadProfile(existing.user.id);
      })
      .then((p) => {
        if (!cancelled && p !== null) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const newSession = await auth.signInWithPassword(email, password);
      setSession(newSession);
      const p = await loadProfile(newSession.user.id);
      setProfile(p);
      return p;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      throw err;
    }
  }, []);

  const signOut = useCallback((reason?: string) => {
    auth.signOut();
    setSession(null);
    setProfile(null);
    localStorage.removeItem(IDLE_ACTIVITY_KEY);
    if (reason) setError(reason);
  }, []);

  // Watches for inactivity while a session is active and signs the
  // person out once the effective idle timeout is exceeded - see the
  // block comment above IDLE_ACTIVITY_KEY for why this lives in
  // localStorage rather than component state.
  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let minutes = 30;
    let intervalId: number | undefined;
    let lastWrite = 0;

    function markActivity() {
      const now = Date.now();
      if (now - lastWrite < IDLE_ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWrite = now;
      localStorage.setItem(IDLE_ACTIVITY_KEY, String(now));
    }

    function checkIdle() {
      const raw = localStorage.getItem(IDLE_ACTIVITY_KEY);
      const last = raw ? Number(raw) : Date.now();
      if (Date.now() - last > minutes * 60_000) {
        signOut("You were signed out after being inactive for a while. Please sign in again.");
      }
    }

    CloudDistrictService.getIdleTimeoutSettings()
      .then((settings) => {
        if (cancelled) return;
        minutes = settings.effectiveMinutes;
        if (!localStorage.getItem(IDLE_ACTIVITY_KEY)) markActivity();
        checkIdle();
        intervalId = window.setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);
      })
      .catch(() => {
        // Couldn't reach the idle-timeout settings (offline, etc.) -
        // fail open rather than risk locking someone out of an
        // already-open session over a network hiccup.
      });

    IDLE_ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      IDLE_ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
    };
  }, [session, signOut]);

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
