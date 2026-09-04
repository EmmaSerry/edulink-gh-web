import type { ReportSnapshot } from "../ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ScoredReportLayout } from "../ScoredReportLayout";

/**
 * Module 5 - JHS Report.
 *
 * The known defect in the previous Microsoft Word mail-merge template
 * was a copy-pasted merge field: the Social Studies row's Position cell
 * referenced the Science Position merge field instead of its own. That
 * class of bug cannot occur here because `ScoredReportLayout` renders
 * `subject.positionText` straight from each `snapshot.subjects[i]`
 * element, and every element is built by `ReportDataService` from a
 * ranking computed independently PER subjectId (see that file's
 * `rankingBySubject` map). There is no template code path, in this file
 * or in `ScoredReportLayout`, that reads one subject's row using another
 * subject's identifier. See docs/PHASE4_REPORTS.md and
 * `verify_jhs_bug_fix.mjs` for the executable proof used to confirm this.
 */
export function JHSReportTemplate({
  snapshot,
  settings,
  isLastPage,
}: {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  isLastPage?: boolean;
}) {
  return <ScoredReportLayout snapshot={snapshot} settings={settings} title="JHS Terminal Report Card" isLastPage={isLastPage} />;
}
