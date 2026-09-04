import type { ReportSnapshot } from "../ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ScoredReportLayout } from "../ScoredReportLayout";

/** Module 4 - Upper Primary Report. Identical layout and calculations to
 *  Lower Primary/JHS (see ScoredReportLayout.tsx) - only the subject list
 *  differs, and that is entirely data-driven via Phase 1 `Subject.levelIds`. */
export function UpperPrimaryReportTemplate({
  snapshot,
  settings,
  isLastPage,
}: {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  isLastPage?: boolean;
}) {
  return (
    <ScoredReportLayout snapshot={snapshot} settings={settings} title="Upper Primary Terminal Report Card" isLastPage={isLastPage} />
  );
}
