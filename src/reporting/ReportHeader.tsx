import type { ReportSnapshotSchoolInfo, ReportSnapshotTermInfo } from "./ReportSnapshot.types";

/** Shared school-branding header - logo, name, circuit/district/region,
 *  contact details, motto, and the report title/term line - reused
 *  identically by every template so a parent recognises the same
 *  official letterhead regardless of which level's report they're
 *  holding. */
export function ReportHeader({
  school,
  term,
  title,
}: {
  school: ReportSnapshotSchoolInfo;
  term: ReportSnapshotTermInfo;
  title: string;
}) {
  return (
    <>
      {school.reportHeader && <div className="text-center small mb-1">{school.reportHeader}</div>}
      <div className="actrs-report-header">
        {school.logoDataUrl && <img src={school.logoDataUrl} alt="" className="logo" />}
        <div>
          <div className="school-name">{school.name || "School Name Not Configured"}</div>
          <div className="school-meta">
            {[school.circuit, school.district, school.region].filter(Boolean).join(", ")}
          </div>
          <div className="school-meta">
            {[school.postalAddress, school.telephone, school.email].filter(Boolean).join(" | ")}
          </div>
          {school.motto && <div className="school-meta fst-italic">"{school.motto}"</div>}
        </div>
      </div>
      <div className="actrs-report-header-rule" />
      <div className="actrs-report-title">
        {title}
        <div style={{ fontSize: "0.75em", fontWeight: 400, textTransform: "none", marginTop: 2 }}>
          {term.academicYearLabel} - {term.termName}
        </div>
      </div>
    </>
  );
}
