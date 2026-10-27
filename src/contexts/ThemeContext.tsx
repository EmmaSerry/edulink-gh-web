/**
 * Light/dark mode - a per-device UI preference stored in localStorage and
 * applied with Bootstrap 5.3's `data-bs-theme` attribute on <html>.
 *
 * A floating toggle button is rendered here, inside the provider, so it is
 * available on EVERY screen (home page, sign-in, registration, dashboard).
 * Signed-in screens already have the toggle in the top bar, so the floating
 * one hides itself there (see light-contrast.css).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import "@styles/light-contrast.css";

export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "edulink-gh.theme";

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ mode, toggle }}>
      {children}
      <button
        type="button"
        className="theme-fab no-print"
        onClick={toggle}
        aria-label={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
      >
        <i className={`bi ${mode === "light" ? "bi-moon-stars-fill" : "bi-sun-fill"}`} />
      </button>
    </ThemeContext.Provider>
  );
}

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within a ThemeProvider");
  return ctx;
}
