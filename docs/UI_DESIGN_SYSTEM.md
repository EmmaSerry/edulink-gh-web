# ACTRS UI Design System

## Theme: Professional Blue / White / Navy / Light Grey

Design tokens are CSS custom properties defined once in
`src/styles/theme.css` and layered on top of Bootstrap 5 (imported
separately in `main.tsx`) rather than a forked Bootstrap Sass build, so
upgrading Bootstrap later is a version bump, not a merge conflict.

| Token | Value | Use |
|---|---|---|
| `--actrs-navy` | `#1F3864` | Primary brand colour, sidebar background, headings |
| `--actrs-blue` | `#2F6FB0` | Accents, links, icons |
| `--actrs-blue-light` | `#EAF1FB` | Subtle highlight backgrounds (badges, stat tiles) |
| `--actrs-grey-light` | `#F4F6F9` | App background |
| `--actrs-grey-border` | `#E1E5EA` | Card/table borders |
| `--actrs-text` / `--actrs-text-muted` | `#1C2733` / `#5B6B7C` | Body text / secondary text |

Dark mode is supported via `[data-bs-theme="dark"]` (toggled by
`useTheme()`), overriding background/text tokens only — component code never
needs to branch on light/dark.

## Layout rules

- **Rounded cards, soft shadows:** the `.actrs-card` utility class
  (`border-radius: 0.75rem`, subtle box-shadow) is the standard container —
  see `src/components/Card.tsx`. Don't hand-roll bordered `<div>`s in pages.
- **Spacing:** Bootstrap's spacing scale (`p-3`, `gap-2`, etc.) is used
  throughout instead of one-off pixel values.
- **Typography:** system font stack (`Segoe UI` first, falling back to the
  OS default) for maximum legibility on the low-spec Windows laptops these
  schools typically use.
- **Icons:** Bootstrap Icons (`bi bi-*` classes) — no separate icon-component
  library dependency.

## Reusable components (`src/components/`)

| Component | Purpose |
|---|---|
| `Brand` | App mark + name, used in the sidebar and auth layout |
| `DeveloperCredit` | Renders the required developer credit block (`full` on Login/About/Help, `inline` for footers) — single source, never hand-typed |
| `PageHeader` | Title + description + phase badge + action buttons, standard header for every page |
| `Card` | The `.actrs-card` container |
| `EmptyState` | Standard "not built yet" / "no records" placeholder |

Every new page should compose these rather than writing new one-off markup,
so the whole app stays visually consistent as modules are added phase by
phase.

## Accessibility

- Colour choices meet WCAG AA contrast against both light and dark
  backgrounds.
- All interactive elements are real `<button>`/`<a>`/form elements (never
  clickable `<div>`s), so keyboard navigation and screen readers work
  without extra ARIA plumbing.
- Layouts use Bootstrap's responsive grid (`row`/`col-*`) so the app remains
  usable on tablets, not only desktop/laptop screens.
