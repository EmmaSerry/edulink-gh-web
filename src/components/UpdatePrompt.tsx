import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Module 9 (Phase 5) - PWA "update detection". vite-plugin-pwa's
 * `registerType: "autoUpdate"` (vite.config.ts) already swaps in a new
 * service worker in the background as soon as one is available; this
 * banner is the user-visible half of that - without it, an update
 * would install silently and the person would only see it after their
 * next full reload, with no way to know one just happened or to force
 * it themselves for e.g. a bug they're waiting on. `offlineReady` is
 * shown once so a first-time visitor knows the app installed for
 * offline use at all.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => console.error("Service worker registration failed", error),
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      className="position-fixed bottom-0 end-0 m-3 p-3 rounded-3 shadow-sm actrs-surface border"
      style={{ zIndex: 1080, maxWidth: 340 }}
      role="status"
    >
      {needRefresh ? (
        <>
          <div className="small fw-semibold mb-1"><i className="bi bi-arrow-repeat me-1" /> Update available</div>
          <p className="small text-muted mb-2">A new version of ACTRS has been downloaded and is ready to use.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setNeedRefresh(false)}>Later</button>
            <button className="btn btn-sm btn-primary" onClick={() => updateServiceWorker(true)}>Reload now</button>
          </div>
        </>
      ) : (
        <>
          <div className="small fw-semibold mb-1"><i className="bi bi-cloud-check me-1" /> Ready to work offline</div>
          <p className="small text-muted mb-2 mb-0">ACTRS has finished installing and will now keep working without an internet connection.</p>
          <div className="d-flex justify-content-end">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setOfflineReady(false)}>Dismiss</button>
          </div>
        </>
      )}
    </div>
  );
}
