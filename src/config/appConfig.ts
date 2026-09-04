/**
 * Central application configuration.
 *
 * This is the single source of truth for branding, developer credit and
 * global constants. Per the project brief, developer information must
 * appear on the Login page, Dashboard, About page, User Manual, exported
 * documentation and every generated report where appropriate - it is
 * defined once here and consumed everywhere via <DeveloperCredit /> and
 * useAppInfo() so it never has to be duplicated or hand-typed again.
 */

export const APP_INFO = {
  name: "Amenfi Central Terminal Report System",
  shortName: "ACTRS",
  tagline: "Offline-first terminal report cards for KG, Primary and JHS",
  version: "1.0.0",
  phase: "Version 1.0 - Official Production Release",
} as const;

export const DEVELOPER_INFO = {
  name: "Emmanuel Serry",
  title: "ICT Coordinator",
  organisation: "Wassa Amenfi Central Education Directorate",
} as const;

export const ORGANISATION_INFO = {
  directorate: "Wassa Amenfi Central Education Directorate",
  circuit: "Amenfi Central Circuit",
  country: "Ghana",
} as const;

/**
 * Levels are fully administrator-defined records (Module 4 - Level
 * Management) - there is deliberately no fixed enum of level codes
 * anymore. `LevelCode` is a plain string so a school can create exactly
 * the levels it needs (KG1, KG2, Basic 1-6, JHS1-3, or any future
 * variation) entirely through the Levels & Classes screen, with no code
 * change. See docs/ARCHITECTURE.md "Configuration-Driven Design" and
 * docs/PHASE1_CONFIGURATION.md.
 *
 * `SUGGESTED_DEFAULT_LEVELS` documents the recommended default level
 * codes for reference; `src/database/seed.ts` defines its own literal
 * seed list (it needs a name/assessmentMode per level, not just a code)
 * rather than deriving from this constant - it is not a type constraint
 * either way, just reference documentation.
 */
export type LevelCode = string;

export const SUGGESTED_DEFAULT_LEVELS = [
  "KG1",
  "KG2",
  "BASIC1",
  "BASIC2",
  "BASIC3",
  "BASIC4",
  "BASIC5",
  "BASIC6",
  "JHS1",
  "JHS2",
  "JHS3",
] as const;

/**
 * UI-only grouping over the fully admin-defined Level list above, used
 * by Student Registration and Class (Re)assignment's two-step picker:
 * pick a familiar broad stage first (KG / Primary / JHS), which then
 * narrows the Class list down to just that stage's grades - rather than
 * making every user scan a single flat list of every level the school
 * has ever defined. This is purely a display convenience computed from
 * each level's code; nothing about the underlying Level/SchoolClass
 * data model changes, and a level whose code doesn't match one of the
 * three familiar prefixes still appears (grouped under "Other") so a
 * school that customises level codes never loses access to it here.
 */
export type LevelCategoryKey = "KG" | "PRIMARY" | "JHS" | "OTHER";

export const LEVEL_CATEGORIES: Array<{ key: LevelCategoryKey; label: string }> = [
  { key: "KG", label: "KG (Kindergarten)" },
  { key: "PRIMARY", label: "Primary" },
  { key: "JHS", label: "JHS" },
  { key: "OTHER", label: "Other" },
];

export function categorizeLevelCode(code: string): LevelCategoryKey {
  const upper = code.toUpperCase();
  if (upper.startsWith("KG")) return "KG";
  if (upper.startsWith("BASIC")) return "PRIMARY";
  if (upper.startsWith("JHS")) return "JHS";
  return "OTHER";
}

/** Two assessment philosophies exist in the current curriculum. */
export type AssessmentMode = "scored" | "skill-checklist";

