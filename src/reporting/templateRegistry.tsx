import type { ComponentType } from "react";
import type { ReportTemplateCode } from "@models/ReportTemplate";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { ReportSnapshot } from "./ReportSnapshot.types";
import { LowerPrimaryReportTemplate } from "./templates/LowerPrimaryReportTemplate";
import { UpperPrimaryReportTemplate } from "./templates/UpperPrimaryReportTemplate";
import { JHSReportTemplate } from "./templates/JHSReportTemplate";
import { KGReportTemplate } from "./templates/KGReportTemplate";

export interface ReportTemplateComponentProps {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  isLastPage?: boolean;
}

/**
 * The template engine's component registry (Module 2). This is the ONLY
 * place in the application that maps a `ReportTemplateCode` to the React
 * component that renders it - the Preview, PDF, print and batch services
 * all render through `ReportRenderer` below rather than switching on the
 * code themselves. Adding a future template (e.g. a special-education
 * variant) means: add one row to the `reportTemplates` table (Module 2,
 * `ReportTemplateService`), write one new component, and add one line
 * here - nothing else in the rendering/PDF/print/batch pipeline changes.
 */
const TEMPLATE_COMPONENTS: Record<ReportTemplateCode, ComponentType<ReportTemplateComponentProps>> = {
  KG: KGReportTemplate,
  LOWER_PRIMARY: LowerPrimaryReportTemplate,
  UPPER_PRIMARY: UpperPrimaryReportTemplate,
  JHS: JHSReportTemplate,
};

export function getTemplateComponent(code: ReportTemplateCode): ComponentType<ReportTemplateComponentProps> | undefined {
  return TEMPLATE_COMPONENTS[code];
}

/** Renders whichever template `snapshot.templateCode` (auto-detected
 *  from the student's Level, never chosen manually - Module 2's core
 *  requirement) says to use. */
export function ReportRenderer({ snapshot, settings, isLastPage }: ReportTemplateComponentProps) {
  const Component = getTemplateComponent(snapshot.templateCode);
  if (!Component) {
    return (
      <div className="alert alert-danger">
        No template component is registered for code "{snapshot.templateCode}".
      </div>
    );
  }
  return <Component snapshot={snapshot} settings={settings} isLastPage={isLastPage} />;
}
