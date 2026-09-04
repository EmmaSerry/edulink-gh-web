# ACTRS Coding Standards

## TypeScript

- `strict: true` is on (see `tsconfig.app.json`) — no implicit `any`, no
  unchecked nulls. Do not add `// @ts-ignore` to work around a type error;
  fix the type.
- One exported type/interface per concern in `src/models/`; pages and
  components import types, they never redeclare shapes inline.
- Prefer `type` for unions/aliases, `interface` for object shapes that may
  be extended (matches the existing `src/models/*.ts` files).

## Naming conventions

| Kind | Convention | Example |
|---|---|---|
| Components / pages | PascalCase file & export | `PageHeader.tsx`, `export function PageHeader` |
| Hooks | camelCase, `use` prefix | `useDatabaseSummary.ts` |
| Services | PascalCase, `*Service`/`*Repository` suffix | `BaseRepository.ts` |
| Database tables | camelCase, plural | `scoreRecords`, `learningAreas` |
| Model fields | camelCase | `sbaScore`, `academicYearId` |
| Route paths | kebab-case | `/levels-classes`, `/backup-restore` |

## Component rules

- Components in `src/components/` and `src/layouts/` are presentation-only:
  no direct Dexie calls, no business rules. They receive data via props or
  hooks.
- Business logic (grading, ranking, validation rules beyond simple field
  checks) lives in `src/services/`, never inline in a component.
- Avoid duplicated code: if two pages need the same UI pattern, extract a
  component (see `PlaceholderPage.tsx` as the working example — every
  not-yet-built module reuses it instead of copy-pasting a "coming soon"
  screen).

## Configuration over hard-coding

Per `docs/ARCHITECTURE.md` §1: subjects, grade bands, learning areas,
skills, and remarks banks are **database records**, not `switch` statements
or hard-coded arrays in component code. When you find yourself writing
`if (level === "JHS") { ... } else if (level === "UPPER_PRIMARY") { ... }`,
stop — that logic almost certainly belongs in a config record read from
`levels`/`subjects`/`learningAreas` instead.

## Comments

Document *why*, not *what*. Every non-obvious file in this scaffold already
follows this pattern (see the header comments in `db.ts`, `seed.ts`,
`BaseRepository.ts`) — continue it rather than narrating each line of code.

## Path aliases

Use the `@`-prefixed aliases defined in `vite.config.ts` /
`tsconfig.app.json` (`@components`, `@pages`, `@services`, `@database`,
`@models`, `@utils`, `@validation`, `@reporting`, `@backups`, `@config`,
`@hooks`, `@contexts`, `@styles`) instead of long relative `../../../`
import paths.

## Testing (introduced from Phase 1)

Phase 0 does not include a test runner (there is no business logic yet to
test). From Phase 1 onward, add Vitest + React Testing Library and require
unit tests for every service in `src/services/` (especially the future
score/rank/grade-band calculation engine, which must be tested against the
known-good values from the existing Excel workbooks).
