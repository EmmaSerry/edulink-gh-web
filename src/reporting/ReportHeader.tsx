import type { ReportSnapshotSchoolInfo, ReportSnapshotTermInfo } from "./ReportSnapshot.types";

/** Shared school-branding header - logo, name, circuit/district/region,
 *  contact details, motto, and the report title/term line - reused
 *  identically by every template so a parent recognises the same
 *  official letterhead regardless of which level's report they're
 *  holding.
 *
 *  Shows the district's logo too (district.logoDataUrl -> already
 *  threaded into every snapshot as school.districtLogoDataUrl by
 *  ReportDataService - see that file) - previously only the KG
 *  template's separate cover page showed it; every scored level
 *  (Lower/Upper Primary, JHS) used to show the school logo alone.
 *  Omitted entirely when the district hasn't uploaded one, same as the
 *  school logo already does. */
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
        {school.districtLogoDataUrl && <img src={school.districtLogoDataUrl} alt="" className="logo district-logo" />}
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
