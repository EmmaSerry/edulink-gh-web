import type { ReportSnapshot } from "../ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ScoredReportLayout } from "../ScoredReportLayout";

/** Module 3 - Lower Primary Report. See ScoredReportLayout.tsx for why
 *  this is a thin wrapper rather than a duplicated layout. */
export function LowerPrimaryReportTemplate({
  snapshot,
  settings,
  isLastPage,
}: {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  isLastPage?: boolean;
}) {
  return (
    <ScoredReportLayout snapshot={snapshot} settings={settings} title="Lower Primary Terminal Report Card" isLastPage={isLastPage} />
  );
}
