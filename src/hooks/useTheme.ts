import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "actrs.theme";

/** Local (per-device) theme preference. Persisted in localStorage since
 *  it is a UI preference, not application data (that belongs in Dexie). */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "light",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  return {
    mode,
    toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
  };
}
