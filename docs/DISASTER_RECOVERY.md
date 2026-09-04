# ACTRS Disaster Recovery Guide

**Amenfi Central Terminal Report System (ACTRS)** — Version 1.0

Since all ACTRS data lives locally on one device (`docs/ARCHITECTURE.md`),
disaster recovery is fundamentally about one thing: **do you have a
recent backup file saved somewhere other than that device?** Everything
in this guide assumes the answer is yes, per the backup schedule in
`docs/MAINTENANCE_GUIDE.md` Section 2 — the single most important thing
an administrator can do to make every scenario below fully recoverable
is to keep taking regular backups before anything ever goes wrong.

## 1. Lost data recovery (accidental deletion, incorrect bulk change)

1. Do not enter any more data before restoring, if possible — this
   avoids the restore later overwriting anything new.
2. Go to **Backup & Restore → Restore**, choose your most recent backup
   file that predates the problem, and review the preview screen
   carefully (it shows exactly what will be replaced).
3. Confirm the restore. If it fails partway through for any reason, your
   existing data is left completely untouched (see `docs/DATABASE.md`
   "Data integrity on restore") — it is always safe to try again.
4. Cross-check a sample of restored records (a few students, a recent
   term's scores) against what you expect before resuming normal use.

## 2. Backup restoration (routine, e.g. after replacing a computer)

1. Deploy ACTRS on the new/replacement device (`docs/DEPLOYMENT.md`).
2. Open it once to confirm the Dashboard loads and default configuration
   has seeded.
3. Go to **Backup & Restore → Restore**, select your most recent Full
   Backup file, review the preview, and confirm.
4. Verify: Dashboard summary counts look right, a known student's
   profile shows their full history, and a previously-generated report
   can still be viewed/reprinted.

## 3. Corrupted database recovery

If ACTRS shows unexpected errors, blank screens, or data that doesn't
match what you remember entering, and reloading the page doesn't help:

1. Go to **Diagnostics** and review what it reports about database
   health and record counts.
2. Try the cache-clearing option on the Diagnostics page and reload —
   this clears cached *application code*, not your data, and resolves
   most "stuck on an old/broken version" symptoms.
3. If the problem persists and appears to genuinely be corrupted data
   rather than a stuck cache, the reliable recovery path is a full
   browser data reset for ACTRS's site (Section 4) followed by restoring
   your most recent backup (Section 2) — this guarantees a clean slate
   rather than trying to selectively repair unknown corruption.

## 4. Browser reset procedures

If ACTRS's own cache-clearing (Section 3) doesn't resolve a problem, a
full reset of the browser's stored data for ACTRS's site will:

1. In your browser's settings, find "Site settings" / "Privacy and
   security" → clear browsing data, **scoped to the specific site ACTRS
   runs on** (not your whole browser history) — the exact menu wording
   varies by browser (Chrome: Settings → Privacy and security → Site
   Settings → find the site → Clear data; Edge: similar path under
   Settings → Cookies and site permissions).
2. This deletes **all local ACTRS data on this device**, including
   IndexedDB — treat this as equivalent to starting from a brand-new
   installation.
3. Reopen ACTRS (it will re-seed default configuration), then follow
   Section 2 to restore your most recent backup.

**This is precisely why regular backups matter** (`docs/
MAINTENANCE_GUIDE.md` Section 2) — without one, a browser reset (or a
lost/failed device) means permanently losing everything entered since
the last backup.

## 5. System reinstallation

Reinstalling ACTRS itself (as opposed to resetting its data) does not
affect your data at all, since the two are stored completely separately
by the browser — uninstalling the installed PWA shortcut/icon and
reinstalling it (`docs/USER_MANUAL.md` Chapter 3) is always safe and
never requires a backup/restore cycle on its own. Only a full site-data
reset (Section 4) or a lost/replaced device (Section 2) actually removes
your data.

## 6. Recovery validation

After any recovery scenario above, before resuming normal use, confirm:

- The Dashboard's summary counts (students, classes) look right for
  your school.
- A student you know well shows their complete history on their profile
  page (enrollment, promotion, assessment, report card history).
- A report card you know was previously generated can still be found
  and reprinted from **Report Cards** → that student/class/term.
- **Diagnostics** shows no unexpected warnings.

If anything looks wrong after these checks, do not continue entering new
data — try restoring from an earlier backup generation instead (Section
2), and keep whichever backup file was involved in case you need to
investigate further.
