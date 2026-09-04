/**
 * Phase 0 forward-declared this file as a placeholder so earlier phases
 * could reference stable type names without Phase 4 needing to change
 * their code later. Nothing ever ended up depending on the placeholder
 * `ReportTemplateContext` type, so Phase 4 replaces it outright with the
 * real contracts rather than keeping a redundant alias:
 *
 *  - `ReportTemplateCode` / `ReportTemplate` -> `@models/ReportTemplate`
 *  - The full per-report data bundle -> `ReportSnapshot` in
 *    `./ReportSnapshot.types.ts`
 */
export type { ReportTemplateCode, ReportTemplate } from "@models/ReportTemplate";
export type { ReportSnapshot } from "./ReportSnapshot.types";
