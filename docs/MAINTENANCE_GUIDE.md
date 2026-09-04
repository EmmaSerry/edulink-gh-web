# ACTRS Maintenance Guide

**Amenfi Central Terminal Report System (ACTRS)** — Version 1.0

Ongoing maintenance for ACTRS is deliberately light — there is no server
to patch, no database server to tune, and no scheduled jobs to babysit.
This guide covers the routine tasks that do matter for a long-lived,
offline-first, single-device installation.

## 1. Routine maintenance checklist

| Frequency | Task |
|---|---|
| Weekly | Take a Full Backup (Section 2) |
| Each term-end | Take a Full Backup **before** archiving the term; archive the term once its reports are final (`docs/USER_MANUAL.md` Chapter 11) |
| Monthly | Check Diagnostics (`/diagnostics`) for any warnings |
| Each school year | Review Settings (Subjects, Grade Bands, Remarks Bank) for any curriculum changes; create the new Academic Year and its Terms |
| Whenever deploying an update | Confirm the installed copy shows the new version on the About page after its next reload (`docs/DEPLOYMENT.md` Section 6) |

## 2. Backup schedule

We recommend, at minimum:

- A **Full Backup**, saved to a location separate from the computer
  ACTRS runs on (USB drive, external drive, or network share), **at
  least weekly**, and always **immediately before** archiving a term or
  restoring an older backup.
- Keeping **at least the last 3-4 backup generations**, not only the
  most recent one — if a data problem isn't noticed right away, having
  only the newest backup may mean it already contains the same problem.
- Verifying, occasionally, that a backup file actually opens the
  Restore preview screen without error (Section 5) — a backup nobody has
  ever tried to read is an unverified assumption, not a safety net.

See `docs/USER_MANUAL.md` Chapter 12 and `docs/ADMINISTRATOR_GUIDE.md`
Section 10 for how to actually create a backup.

## 3. Data integrity checks

ACTRS enforces most integrity rules automatically and continuously (a
record cannot be deleted while real data depends on it; an archived
term cannot be edited — see `docs/DATABASE.md` "Entity relationships"),
so there is no separate manual "integrity check" tool to run. The
closest equivalent:

- **System Logs** (`/system-logs`) — review periodically for anything
  unexpected (an unusual number of restores, or an import that ran when
  none was expected).
- **Diagnostics** (`/diagnostics`) — reports current database health,
  record counts, and any troubleshooting guidance the app itself can
  surface.

## 4. Browser updates

Keep the browser ACTRS runs in (Chrome/Edge recommended) reasonably
up to date via its own normal update mechanism — this is standard
practice for any web application and isn't ACTRS-specific. ACTRS itself
does not depend on any particular browser version beyond a modern,
currently-supported one.

## 5. PWA updates

Because `registerType: "autoUpdate"` is configured, an installed copy of
ACTRS checks for a new deployment automatically and shows an "Update
available — Reload now" prompt once one is found — no manual
"clear cache and reinstall" step is normally needed. If a school's
computer rarely opens ACTRS with an internet connection, the update
check simply happens the next time it does; there is no urgency, since
the currently-installed version keeps working fully offline in the
meantime.

## 6. Database maintenance

IndexedDB (via Dexie) requires no manual vacuuming, indexing, or
tuning — this is handled entirely by the browser. The one
administrator-facing "maintenance" action that matters is **archiving
terms once they're finished** (`docs/USER_MANUAL.md` Chapter 11), which
keeps historical data safely locked without needing any separate
cleanup step.

## 7. Performance monitoring

ACTRS captures best-effort local timing samples (search, batch report
generation, PDF export) into the `performanceMetrics` table, viewable
from Diagnostics — useful context if a school's device is unusually slow
and you want to see roughly where time is going. For most schools, on
typical modern hardware, this should rarely be a concern:
`docs/PHASE6_QA_REVIEW.md` Module 7 and `docs/PHASE7_CERTIFICATION.md`
document the performance work already done (indexed database lookups,
route-level code splitting so the browser only loads what a given screen
actually needs, and a defensive PWA precache size margin).

If a school's device does become noticeably slow over time, the
practical first steps are the same as for any browser-based application:
close unused browser tabs, confirm the device isn't critically low on
storage space, and confirm the browser itself is reasonably up to date.
