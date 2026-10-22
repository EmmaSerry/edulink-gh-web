import type { ReportSnapshotSchoolInfo, ReportSnapshotTermInfo } from "./ReportSnapshot.types";

/** Shared school-branding header - a colour banner in the school's own brand
 *  colours carrying the school logo, name, circuit/district/region, contact
 *  details and motto (and the district's logo on the right when the district
 *  has uploaded one), followed by the report title ribbon and term line.
 *  Reused identically by every scored-level template. */
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
      {school.reportHeader && <div className="actrs-report-topline">{school.reportHeader}</div>}
      <div className="actrs-report-header">
        {school.logoDataUrl && <img src={school.logoDataUrl} alt="" className="logo" />}
        <div className="header-text">
          <div className="school-name">{school.name || "School Name Not Configured"}</div>
          <div className="school-meta">
            {[school.circuit, school.district, school.region].filter(Boolean).join(", ")}
          </div>
          <div className="school-meta">
            {[school.postalAddress, school.telephone, school.email].filter(Boolean).join(" | ")}
          </div>
          {school.motto && <div className="school-meta motto">"{school.motto}"</div>}
        </div>
        {school.districtLogoDataUrl && <img src={school.districtLogoDataUrl} alt="" className="logo district-logo" />}
      </div>
      <div className="actrs-report-title">
        <span className="ribbon">{title}</span>
        <div className="term-line">
          {term.academicYearLabel} &middot; {term.termName}
        </div>
      </div>
    </>
  );
}
