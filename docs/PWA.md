# ACTRS Progressive Web App Configuration

## Goal

The app must be installable and fully usable offline after the first
successful load — no feature (student registration, assessment entry,
report generation, PDF creation, printing, searching, archives, backup,
restore) may require a live network connection.

## Implementation

- **Plugin:** `vite-plugin-pwa` (`vite.config.ts`), which generates the web
  app manifest and a Workbox-based service worker at build time.
- **`registerType: "autoUpdate"`:** the service worker checks for a new
  build in the background and swaps it in automatically, so schools always
  run the latest version without a manual "clear cache" step.
- **Manifest:** name, short name, theme colour (`#1F3864`, matching the
  design system's navy), `display: "standalone"` (so it opens like a
  desktop app, not inside browser chrome), and three icon sizes
  (192, 512, and a maskable 512 for Android adaptive icons) generated into
  `public/icons/`.
- **Precaching:** `workbox.globPatterns` precaches every built JS/CSS/HTML/
  image/font asset, so the entire app shell is available offline
  immediately after first install — not just previously-visited pages.
  Since Phase 6, `maximumFileSizeToCacheInBytes` is explicitly set to 5MB
  (Workbox's own default is 2MB) so the report/export tooling chunk
  (jsPDF + html2canvas + SheetJS, code-split since Phase 6's route-level
  `React.lazy` conversion) can never be silently skipped from precache.
- **Navigation fallback:** `navigateFallback: "/index.html"` (Workbox's
  purpose-built mechanism for client-routed SPAs) serves the precached
  app shell for *any* navigation request, then lets React Router take
  over client-side. This was fixed in Phase 6 after finding the original
  implementation (a `NetworkFirst` rule keyed per exact visited URL) only
  ever worked for a URL already visited once while online — a fresh
  navigation to any not-yet-visited route while offline (a student deep
  link, or simply reopening the installed app) previously failed outright.
  `navigateFallback` makes every route genuinely available offline,
  visited or not.

## What "offline-first" does *not* mean here

It does not mean data syncs to a server in the background — there is no
server. All application data lives in IndexedDB on the device
(`src/database/db.ts`). "Offline-first" in ACTRS means the *application
code itself* (not just the data) is fully cached and runable with zero
network, which is what the manifest/service-worker configuration above
provides.

## Installation

Since Phase 7, ACTRS offers its own explicit "Install ACTRS" action on
the About page (`src/hooks/useInstallPrompt.ts` + `src/pages/About.tsx`),
built on the standard `beforeinstallprompt`/`appinstalled` browser events,
rather than relying entirely on a browser's own often-low-visibility
install affordance. On browsers that don't fire `beforeinstallprompt`
(e.g. Safari), the page instead points the user to their browser's own
"Add to Home Screen"/"Install" menu option.

## Cache management

`DiagnosticsService.clearCachesAndReload()` (Diagnostics page) lets an
administrator clear all Cache Storage entries and force a fresh reload —
the supported recovery step if the app ever appears stuck on an old
cached version, see `docs/DISASTER_RECOVERY.md`.

## Verifying the PWA locally

```bash
npm run build
npm run preview
```

Then, in Chrome/Edge DevTools → Application → Manifest/Service Workers,
confirm the manifest loads and the service worker is "activated and
running"; toggle Network → Offline and reload to confirm the app still
loads.
