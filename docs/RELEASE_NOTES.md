# ACTRS Version 1.0 — Release Notes

**Amenfi Central Terminal Report System (ACTRS)**
**Version:** 1.0.0
**Release date:** 15 July 2026
**Developed by:** Emmanuel Serry, ICT Coordinator, Wassa Amenfi Central
Education Directorate

## A note on version numbering

During internal development, the codebase briefly carried the version
numbers `1.0.0` (end of Phase 5) and `1.0.1` (end of Phase 6's QA and
defect-correction pass). **Version 1.0.0, as released here, supersedes
both** — it represents the complete, certified result of Phases 0
through 7, and is the first version number a school will actually
receive. There is no functional difference schools need to be aware of
from those internal designations beyond everything described below.

## What Version 1.0 is

A complete, offline-first education management system covering the
entire terminal-report-card workflow for **KG1, KG2, Lower Primary,
Upper Primary and JHS**, replacing the previous Excel workbook + Word
Mail Merge process used across schools under the Wassa Amenfi Central
Education Directorate.

## New features (cumulative, Phases 0-7)

- **System Configuration & Administration** — school profile, academic
  years/terms, levels/classes, subjects, KG learning areas/skills,
  configurable grade bands, and a reusable remarks bank — all editable
  data, never hard-coded curriculum.
- **Student Management** — full registration, permanent student IDs,
  guardian records, class enrollment, promotion history, photo history,
  and bulk spreadsheet import with per-row validation.
- **Assessment Management** — SBA + Exam score entry for scored levels;
  Gold/Silver/Bronze/Not-Assessed/Absent skill-checklist entry for KG,
  matching the official NaCCA KG Assessment Tool exactly; a Draft →
  Completed → Verified → Finalized workflow with a full audit trail.
- **Report Card Generation & Printing** — four report templates (Lower
  Primary, Upper Primary, JHS, KG), automatic total/grade/class-position
  calculation (scored levels only — KG reports never show a total,
  average, grade, or position, matching NaCCA's qualitative model),
  versioned report history, individual and batch PDF export/printing.
- **Records Management, Archives, Backup & Analytics** — permanent term
  archiving (locks history without duplicating it), full/partial backup
  and restore, a centralized Import & Export Centre, a Dashboard &
  Analytics module, system-wide search, a unified activity/audit log,
  and built-in Diagnostics.
- **Install as an app** — since this release, ACTRS offers its own
  explicit "Install ACTRS" button (About page), rather than relying
  solely on a browser's own install affordance.
- **One-click launcher** — `Start-ACTRS.bat` (Windows) and
  `start-actrs.sh` (macOS/Linux) let a school start ACTRS by double-
  clicking a single file, with first-time setup (installing and
  building) handled automatically and explained in plain language if
  anything is missing (e.g. Node.js not yet installed).

## Major improvements this release (Phases 6-7)

- A dedicated, independent line-by-line QA pass (`docs/PHASE6_QA_REVIEW.md`)
  found and fixed several genuine defects, including: an archived term
  could previously be deleted outright; a Full Backup silently never
  captured five of its own tables; offline navigation failed for any
  route not visited before going offline; a connectivity indicator always
  said "Offline" regardless of the real connection; audit/system logs
  could be silently edited or deleted; and a spreadsheet-export
  formula-injection risk in every xlsx/csv export.
- Route-level code splitting cuts what the browser must load before
  first paint, since jsPDF/html2canvas/SheetJS (report/export/backup
  tooling) now only load when one of those screens is actually opened.
- Dead code removal and duplicate-implementation consolidation across
  the codebase, improving long-term maintainability.
- Complete documentation set produced for this release (see "Deliverables"
  below).

## Technical highlights

- **100% offline-first**: no backend, no server, no database server. All
  data lives in the browser's IndexedDB on-device; the application code
  itself is fully cached for offline use via a Progressive Web App
  service worker.
- **Configuration-over-code architecture**: curriculum, grading, and
  report content are all database records, never hard-coded — a future
  curriculum change is a Settings edit, not a redeploy.
- **Calculations are always derived, never stored**: subject totals,
  grades, and class positions are computed fresh every time from the raw
  scores, so they can never silently drift out of sync.
- **Historical integrity by design**: archived terms are locked, not
  duplicated; generated reports are frozen, versioned snapshots that can
  always be reproduced exactly as originally printed.
- Four independent, executable regression proof scripts (`scripts/`)
  verify the calculation engine, the KG qualitative-only guarantee, and
  both required end-to-end lifecycle scenarios — all pass with zero
  failures as of this release.

## Known limitations

- **Single-device data** — Version 1.0 has no built-in multi-device
  synchronization or cloud backup. A school's data lives on the device
  it was entered on; regular manual backups (`docs/MAINTENANCE_GUIDE.md`)
  are the supported way to protect against device loss.
- **No user authentication / role-based access** — Version 1.0 is
  designed for a single trusted device per school, not multiple named
  user accounts with different permission levels.
- **Live-browser verification outstanding** — this project was developed
  in a sandboxed environment without a real browser or npm registry
  access. Real PDF rendering fidelity, print dialog output, IndexedDB
  quota behaviour, service-worker update flow under a real network, and
  real production bundle-size measurement should all be confirmed once,
  in a real browser/build environment, before school-facing rollout —
  see `docs/PHASE7_CERTIFICATION.md` "Outstanding items" for the complete
  list and `docs/DEPLOYMENT.md` for the exact verification steps.
- Bootstrap Icons' bundled font is used as-is (not subset to only the
  icons ACTRS actually uses) — a minor, optional future optimization,
  not a functional limitation.

## Future enhancement opportunities

See `docs/FUTURE_ROADMAP.md` for the complete list (multi-school
deployment, user authentication/RBAC, cloud synchronization, EMIS
integration, SMS/email notifications, attendance management, a parent
portal, a teacher portal, and a mobile companion app) — all explicitly
out of scope for Version 1.0 and clearly separated from it.

## Developer information

**Emmanuel Serry**
ICT Coordinator, Wassa Amenfi Central Education Directorate
