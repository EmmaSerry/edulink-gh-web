# ACTRS Navigation Structure

The sidebar/topbar shell (`src/layouts/AppLayout.tsx`,
`src/layouts/Sidebar.tsx`, `src/layouts/Topbar.tsx`) is permanent — it never
changes when a new module is added. All menu content comes from a single
data file: `src/config/navigation.ts`.

## Current navigation (as of Version 1.0 / Phase 7)

| Item | Route | Built in |
|---|---|---|
| Dashboard | `/` | Phase 0 |
| School Setup | `/school-setup` | Phase 1 |
| Academic Years | `/academic-years` | Phase 1 |
| Terms | `/terms` | Phase 1 |
| Levels & Classes | `/levels-classes` | Phase 1 |
| Students | `/students` | Phase 2 |
| Assessments | `/assessments` | Phase 3 |
| Report Cards | `/report-cards` | Phase 4 |
| Archives | `/archives` | Phase 5 |
| Backup & Restore | `/backup-restore` | Phase 5 |
| Import & Export | `/import-export` | Phase 5 |
| System Logs | `/system-logs` | Phase 5 |
| Diagnostics | `/diagnostics` | Phase 5 |
| Settings | `/settings` | Phase 1 |
| Help | `/help` | Phase 0 |
| About | `/about` | Phase 0 |

As of Version 1.0, every nav item has a real, dedicated route registered
directly in `App.tsx` - the generic `PlaceholderPage` fallback described
below is no longer reached by anything, but is deliberately kept as the
mechanism a genuinely new future module (see `docs/FUTURE_ROADMAP.md`)
would automatically render through until it, too, gets a real page.

Since Phase 7, every route in `App.tsx` is also wrapped in `React.lazy`
behind one shared `<Suspense>` boundary, so each page's code (and whatever
it imports) is only downloaded the first time that route is visited,
rather than all up front - see `docs/TECHNICAL_DOCUMENTATION.md`
"Production build" for the full rationale.

## Adding a new nav item / module

1. Add one object to the `NAV_ITEMS` array in `src/config/navigation.ts`
   (label, path, Bootstrap Icons class, phase, description).
2. If the module isn't built yet, do nothing else — `App.tsx` automatically
   routes any item not in its `CUSTOM_ROUTES` set through
   `PlaceholderPage`.
3. When you do build the module, add its route explicitly in `App.tsx` and
   add its path to `CUSTOM_ROUTES`.

This means the sidebar, routing table and "what's not built yet" messaging
never fall out of sync with each other.
