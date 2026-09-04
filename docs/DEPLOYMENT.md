# ACTRS Deployment Guide

This document covers how to build ACTRS from source and deploy it to a
school computer or a directorate-managed server. It is written for an
ICT coordinator or a technically-comfortable school administrator — no
prior web-development experience is assumed, but basic comfort with a
command line/terminal is.

For day-to-day use once installed, see the **User Manual**
(`docs/USER_MANUAL.md`). For ongoing configuration, see the
**Administrator Guide** (`docs/ADMINISTRATOR_GUIDE.md`).

## 1. What you are deploying

ACTRS is a single-page, offline-first web application with **no server,
no database server, and no backend of any kind**. Everything the app
needs is a folder of static files (HTML, CSS, JavaScript, icons) plus a
web browser. All school data (students, scores, reports, backups) is
stored locally in the browser's IndexedDB on the device it runs on — it
never leaves that device unless a backup file is explicitly exported.

This has one important consequence for deployment: **a service worker
(what makes the app installable and offline-capable) will only register
when the app is served over `http://` or `https://` — not when
`index.html` is opened directly from a folder (`file://`).** A tiny local
web server is required; see Section 3.

## 2. The easy way: one-click launcher

For a single school computer, the simplest way to get ACTRS running is
the launcher included in the project folder — no typed commands needed:

- **Windows:** double-click **`Start-ACTRS.bat`**.
- **macOS/Linux:** double-click **`start-actrs.sh`** (or run
  `./start-actrs.sh` in a terminal once you've made it executable with
  `chmod +x start-actrs.sh`).

The first time it runs, it will (automatically, showing its progress in
the window that opens):

1. Check that Node.js is installed, and tell you clearly where to get it
   if not.
2. Install ACTRS's components (`npm install`) — this step needs an
   internet connection, but only the very first time.
3. Build ACTRS (`npm run build`).
4. Start a small local server and open ACTRS in your browser
   automatically.

Every time after that first run, steps 2-3 are skipped (already done),
so it starts in a couple of seconds. **A second window titled "ACTRS
Server" appears and must stay open while you use ACTRS** — closing it
stops the application; minimizing it is fine. To use ACTRS again later,
just run the launcher again.

This is *why* index.html can't simply be double-clicked directly, and
what the launcher is doing instead: see Section 3.

## 3. Why a server, and how the launcher avoids you needing to think about it

Unlike a simple static HTML page, ACTRS is built with a modern JavaScript
toolchain (React/TypeScript via Vite) and registered as a Progressive
Web App with a service worker. Both the compiled module format and
service workers are, by browser security design, only allowed to run
when a page is loaded over `http://`/`https://` — never from a
`file://` path (opening the file directly). This is a browser
restriction that applies to any modern web app built this way, not a
gap specific to ACTRS.

The one-click launcher (Section 2) exists specifically so nobody needs
to know or care about this — it starts a tiny local server on your own
computer (`http://localhost:5000`) and opens the browser to it
automatically, which satisfies that requirement invisibly.

## 4. Building the production release manually (for an ICT coordinator who prefers the command line, or a shared/network deployment)

On a computer with [Node.js](https://nodejs.org) 18 or later installed:

```bash
cd actrs
npm install
npm run build
```

This produces a `dist/` folder containing the entire, ready-to-deploy
application — minified JavaScript and CSS, an optimized service worker
and manifest, and every icon/asset the app needs. `dist/` is everything
that needs to be copied to wherever the app will run; nothing else from
the source folder is required at runtime.

`npm run build` runs `tsc -b && vite build` — a TypeScript type-check
followed by the Vite/Rollup production bundle (minification, tree
shaking, and route-level code splitting are all applied automatically;
see `docs/TECHNICAL_DOCUMENTATION.md` "Production build" for details).

## 5. Serving `dist/`

The launcher (Section 2) already does this for a single computer
automatically (`npm start`, i.e. `serve -s dist -l 5000`). Pick one of
these instead if you need a different setup:

**Option A — a single school computer, no network required.**
This is exactly what `Start-ACTRS.bat`/`start-actrs.sh` (Section 2)
already automates — use the launcher unless you specifically want to run
it by hand:

```bash
npm install -g serve
serve -s dist -l 5000
```

Then open `http://localhost:5000` in the browser and use the About
page's "Install ACTRS" button to install it as a desktop app. From then
on, the school can either leave this running in the background or set it
to start automatically with the computer (see your operating system's
"startup programs" settings) — after the first successful load, ACTRS
keeps working fully offline even if this local server is later stopped,
because the service worker has already cached everything it needs. If
the server is stopped and the browser tab is closed, reopening the
installed app will still work offline; only a fresh `npm install -g serve`
+ `serve` cycle is needed again if the computer is reformatted or ACTRS
is moved to a new device.

**Option B — a shared computer on the school's local network.**
Run the same `serve -s dist -l 5000` command on one computer, then any
other device on the same network can open
`http://<that computer's local IP address>:5000` in its own browser and
install its own independent copy (remember: each installed copy has its
own separate, local data — see `docs/ARCHITECTURE.md` "Single-device
design").

**Option C — hosted by the Directorate on the internet.**
Copy the contents of `dist/` to any standard static web hosting service
(the Directorate's own web server, or a low-cost static host). No
special server-side configuration is required beyond serving the files
as-is over HTTPS — there is no backend to configure, no database
server to install, and no environment variables to set.

## 6. Folder structure reference

```
actrs/
├── Start-ACTRS.bat        ← one-click launcher (Windows) — Section 2
├── start-actrs.sh         ← one-click launcher (macOS/Linux) — Section 2
├── dist/                  ← built output (Section 4) — this is what gets deployed
├── docs/                  ← all project documentation (this file, User Manual, etc.)
├── public/
│   └── icons/             ← app icons used by the PWA manifest
├── scripts/               ← executable verification/regression proof scripts
├── src/
│   ├── components/        ← shared UI building blocks (Card, Modal, DataTable, ...)
│   ├── config/            ← branding, navigation, app-wide constants
│   ├── contexts/          ← Toast/Confirm React contexts
│   ├── database/          ← Dexie/IndexedDB schema (db.ts) + default seed data (seed.ts)
│   ├── hooks/              ← shared React hooks
│   ├── layouts/           ← page shell (Topbar, Sidebar, AppLayout)
│   ├── models/            ← TypeScript types for every entity
│   ├── pages/              ← one file per screen, routed in App.tsx
│   ├── reporting/          ← report card templates (Lower/Upper Primary, JHS, KG)
│   ├── services/           ← all business logic and database access
│   ├── styles/             ← theme + print stylesheet
│   ├── utils/               ← small stateless helper functions
│   ├── validation/          ← Zod schemas for every form
│   ├── App.tsx              ← route table
│   └── main.tsx             ← application entry point
├── package.json
└── vite.config.ts           ← build + PWA configuration
```

## 7. Default configuration data

On first run on a brand-new device (empty IndexedDB), `src/database/
seed.ts` automatically populates a sensible starting configuration —
KG1 through JHS3 levels, standard subjects, the NaCCA KG Learning Areas/
Skills list, a default WAEC-style grade band set, and a starter remarks
bank. This happens once, automatically, the first time the app is
opened on a device; there is no manual "run the seed script" step. A
school then customizes School Profile, Academic Years/Terms, Classes,
and any of the seeded defaults from Settings — see the User Manual's
"First-Time Setup" and "School Configuration" chapters.

## 8. Updating an already-deployed installation

Because `registerType: "autoUpdate"` is configured, once a new `dist/`
build is deployed to the same URL a school is already using, every
installed copy will detect and download the update in the background
the next time it's opened with a connection, then show an "Update
available — Reload now" prompt (see `docs/PWA.md`). No reinstallation,
no data loss, and no manual cache-clearing is required for a routine
update. See `docs/MAINTENANCE_GUIDE.md` for the recommended update
cadence.

## 9. Verifying a deployment

After deploying, confirm:

- The app loads at the expected URL and the Dashboard renders.
- The About page's "Install ACTRS" button appears (or, on browsers that
  don't support it, the fallback instructions do) and installing
  succeeds.
- Diagnostics (`/diagnostics`) reports the service worker as
  "Active - offline-ready".
- Turning off the device's network connection and reloading the
  installed app still works.

This mirrors the "Live-browser verification" step flagged as outstanding
in `docs/PHASE6_QA_REVIEW.md` and `docs/PHASE7_CERTIFICATION.md` — it
should be the first thing done in a real browser after every build.
