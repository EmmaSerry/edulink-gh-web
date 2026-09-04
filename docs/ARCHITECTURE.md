# ACTRS Software Architecture

## 1. Guiding principle: configuration over code

The single most important architectural decision in ACTRS is this:

> **Subjects, grade bands, learning areas, skills, report templates and
> assessment rules are database records, not source code.**

The existing Excel/Word system already showed the cost of the alternative —
every time a grade boundary or a subject list needed to change, someone had
to edit formulas inside a spreadsheet. ACTRS instead models the curriculum as
data:

- A **Level** (KG1, KG2, Lower Primary, Upper Primary, JHS, and any future
  level) is a row in the `levels` table, carrying its own `assessmentMode`
  ("scored" or "skill-checklist") and, for scored levels, its own grade-band
  thresholds.
- A **Subject** (scored levels) or a **Learning Area → Skill** hierarchy (KG
  levels) is likewise data, scoped to a `levelId`.
- **Remarks banks** (Interest/Conduct/Attitude/Comment phrase lists) are
  editable records, not hard-coded dropdown lists.

Consequently, a future NaCCA curriculum revision, a new grade-band policy, or
an entirely new level is a **data change made through the Settings module**,
not an application redeploy. See `src/models/Level.ts`, `src/database/db.ts`
and `src/database/seed.ts` for the concrete implementation of this principle.

## 2. Layered architecture

```
┌─────────────────────────────────────────────┐
│ Pages (src/pages)                            │  routed screens, one per module
├─────────────────────────────────────────────┤
│ Components (src/components) / Layouts        │  presentation only, no business logic
├─────────────────────────────────────────────┤
│ Hooks (src/hooks) / Contexts (src/contexts)   │  cross-cutting state & data access glue
├─────────────────────────────────────────────┤
│ Services (src/services)                       │  business logic + data access (repository
│                                                │  pattern over Dexie; Phase 1+ adds concrete
│                                                │  services such as ScoreCalculationService)
├─────────────────────────────────────────────┤
│ Database (src/database) — Dexie/IndexedDB     │  schema + migrations, no business logic
└─────────────────────────────────────────────┘
```

Rule of thumb: **components render, services decide, the database stores.**
A component should never contain grading/ranking logic; a service should
never contain JSX.

## 3. Why this stack, and why no backend

| Requirement (from the project brief) | Architectural answer |
|---|---|
| Fully offline after install | All data lives in IndexedDB on-device; no network call is ever required for core workflows |
| No PHP / Python / Node server / SQL / Firebase | The shipped artifact is static HTML/CSS/JS + a service worker; Vite/npm are *build-time* tooling only, never present at runtime |
| Installable, works like a desktop app | Configured as a PWA (manifest + service worker, see `docs/PWA.md`) |
| Fast with thousands of records | IndexedDB (via Dexie) is built for exactly this; indexes are defined per-table in `db.ts` for the lookups each module will need |
| Long-lived, multi-phase project | Strict module boundaries (this document) + `docs/ROADMAP.md` phase gating prevent later phases from requiring a rewrite of earlier ones |

## 4. Two assessment models, one architecture

Lower Primary, Upper Primary and JHS use a **scored** model (SBA + Exam →
Total → Rank → Grade band). KG1 and KG2 use a **skill-checklist** model
(Gold/Silver/Bronze/X/O per skill, no ranking). Rather than branching the
whole application in two, only the parts that must differ actually differ:

- `Level.assessmentMode` tells every generic module (Assessments, Report
  Cards, Settings) which entry UI and which report template family to use.
- `ScoreRecord` vs. `SkillAssessmentRecord` are separate tables — a scored
  level never has skill rows and a KG level never has score rows.
- The **calculation engine** (Phase 2) will be two small, independent
  modules — one computing Total/Rank/Grade-band, one simply validating that
  every skill has a rating — rather than one large conditional module.

This is the same principle as Section 1, applied to assessment mode instead
of curriculum content: the *shape* of the two models is config-shaped
(`assessmentMode`), not hard-coded per level.

## 5. Extending the system later

Adding a genuinely new module (e.g. Attendance Management, Timetable) means:

1. Add model(s) in `src/models/`.
2. Add table(s) to a **new** `db.version(n+1)` block in `src/database/db.ts`
   with an `.upgrade()` migration (never edit a shipped version).
3. Add a service extending `BaseRepository` in `src/services/`.
4. Add a nav entry in `src/config/navigation.ts`.
5. Add a page in `src/pages/` and a route in `src/App.tsx`.

No existing file needs structural changes to accommodate this — this is what
"future modules should be easily accommodated" means concretely in this
codebase.
