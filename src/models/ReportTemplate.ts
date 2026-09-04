import type { AssessmentMode } from "@config/appConfig";

/**
 * The four distinct report layouts required by the brief. KG1 and KG2
 * intentionally share one template code ("KG") since both follow the
 * same official NaCCA Learner Report Form structure - only the Skill
 * config rows underneath differ (per Level, as already modelled in
 * Phase 0/1), never the layout.
 */
export type ReportTemplateCode = "KG" | "LOWER_PRIMARY" | "UPPER_PRIMARY" | "JHS";

/**
 * A registry row describing one report layout: which Levels it applies
 * to (many-to-many, editable - never a hard-coded per-level switch) and
 * which assessment mode it renders. `componentVersion` is bumped
 * whenever the rendering component's logic changes in a way that would
 * change a previously-generated report's content or layout; it is
 * copied onto every `GeneratedReport`/`ReportVersionEntry` so Module 13's
 * "Version" field always reflects what the student actually received,
 * even if the template is improved later.
 *
 * The actual rendering is still a React/TypeScript component (see
 * `src/reporting/templateRegistry.tsx`) - there is no safe way to let an
 * administrator edit arbitrary report layout as free-form data without
 * building a full template-scripting engine, which the brief does not
 * ask for. What IS fully data-driven, per Module 12 and every earlier
 * phase's "configuration over hard-coding" principle, is: which
 * template a Level uses (this table), what content appears inside it
 * (Subjects/LearningAreas/Skills/GradeBands/RemarksBank from Phase 1),
 * and how it looks (`TemplateSettings` - colours, paper size, margins,
 * fonts, watermark).
 */
export interface ReportTemplate {
  id?: number;
  code: ReportTemplateCode;
  name: string;
  description?: string;
  appliesToLevelIds: number[];
  assessmentMode: AssessmentMode;
  componentVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
