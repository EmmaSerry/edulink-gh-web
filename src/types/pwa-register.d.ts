/**
 * Manual ambient declaration for vite-plugin-pwa's React registration
 * hook (`virtual:pwa-register/react`). Declared locally rather than
 * relying on the package's own shipped types, since this sandbox has no
 * npm registry access to install/verify against - see docs/ARCHITECTURE.md
 * "Sandbox Constraints". The shape here matches vite-plugin-pwa's
 * documented public API (a pair of useState-style tuples plus an
 * updater function) and is stable across its releases.
 */
declare module "virtual:pwa-register/react" {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: [boolean, (value: boolean) => void];
    offlineReady: [boolean, (value: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
