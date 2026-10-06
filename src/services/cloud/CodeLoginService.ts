/**
 * Sign in with a SCHOOL CODE (e.g. WAC0001) + password instead of an
 * email - see supabase-edge-function/login-with-school-code.ts. The
 * server finds the school administrator's account itself; the browser
 * only ever sees the code and the password it typed.
 *
 * On success this stores the session in exactly the shape and place
 * supabaseClient.ts expects, then the caller does a full page load so
 * CloudAuthContext restores the session and loads the profile the same
 * way it does after any page refresh.
 */
const SESSION_STORAGE_KEY = "edulink-gh-session";

interface CodeLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
  error?: string;
}

export const CodeLoginService = {
  async signIn(code: string, password: string): Promise<void> {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${url}/functions/v1/login-with-school-code`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code, password }),
    });
    let data: CodeLoginResponse | null = null;
    try {
      data = (await res.json()) as CodeLoginResponse;
    } catch {
      /* fall through to the generic message below */
    }
    if (!res.ok || !data?.access_token) {
      throw new Error(data?.error ?? "Could not sign in with that school code.");
    }
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: { id: data.user.id, email: data.user.email },
        expires_at: Date.now() + data.expires_in * 1000,
      })
    );
  },
};
