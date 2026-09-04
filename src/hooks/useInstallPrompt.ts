import { useEffect, useState, useCallback } from "react";

/**
 * Phase 7 (Module 3 - PWA deployment package). ACTRS's install
 * capability previously relied entirely on each browser's own, often
 * low-visibility "Install" affordance (a small icon in Chrome's address
 * bar, buried in a browser menu on others) - which a non-technical
 * teacher/administrator is unlikely to notice unprompted. This hook
 * captures the standard `beforeinstallprompt` event (Chromium browsers)
 * so the app can offer its own clear, explicit "Install ACTRS" action
 * instead of relying on the user to discover the browser's own UI.
 *
 * Browsers that don't support `beforeinstallprompt` (e.g. Safari/iOS)
 * never fire the event, so `canInstall` simply stays false there and no
 * button is shown - `install()` itself already has nothing to work with
 * on those browsers, per the API's own design, not a gap in this hook.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (deferredPrompt as any).prompt();
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { canInstall: deferredPrompt !== null, installed, install };
}
