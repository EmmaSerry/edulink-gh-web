import type { ReportSnapshot } from "./ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportPage } from "./ReportPage";
import { ReportHeader } from "./ReportHeader";
import { SignatureBlock } from "./SignatureBlock";
import { formatDateForDisplay } from "@utils/dateUtils";

/**
 * Shared layout for every "scored" report (Lower Primary, Upper Primary,
 * JHS - Modules 3/4/5). The brief itself says Upper Primary must be
 * "identical in layout and calculations to the current Upper Primary
 * report card" and Lower/Upper/JHS all share the same
 * subject-table/attendance/remarks/promotion/signature structure - only
 * the subject list differs, and that is already 100% data-driven via
 * Phase 1 `Subject.levelIds`. Rather than triplicate ~200 lines of JSX
 * three times (one per Module), each level's template component
 * (`LowerPrimaryReportTemplate.tsx` etc.) is a thin wrapper that renders
 * THIS shared layout with a level-specific title - this is what "modular,
 * template-driven, future templates easily added" means in practice
 * here: a new scored-level template is a new one-line wrapper, not a
 * copy-pasted page.
 *
 * JHS Social Studies/Science bug fix: every subject row below reads its
 * own `subject.total`/`subject.positionText` from
 * `snapshot.subjects[i]` - the array element built by
 * `ReportDataService` FOR THAT SPECIFIC SUBJECT (keyed by its own
 * subjectId, see that file's comment). There is no shared variable, no
 * copy-pasted merge field, and no column-index coincidence that could
 * make one subject display another's position - see
 * docs/PHASE4_REPORTS.md "JHS Social Studies bug fix" for the executable
 * proof.
 */
export function ScoredReportLayout({
  snapshot,
  settings,
  title,
  isLastPage,
}: {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  title: string;
  isLastPage?: boolean;
}) {
  const { school, student, term, attendance, subjects, overall, scoredRemarks } = snapshot;

  return (
    <ReportPage settings={settings} school={school} isLastPage={isLastPage}>
      <ReportHeader school={school} term={term} title={title} />

      <div className="actrs-report-student-block">
        <div className="actrs-report-info-grid">
          <div><span className="label">Student's Name:</span> {student.fullName}</div>
          <div><span className="label">Student ID:</span> {student.studentId}</div>
          <div><span className="label">Class:</span> {student.className}</div>
          <div><span className="label">Gender:</span> {student.gender === "M" ? "Male" : "Female"}</div>
          <div><span className="label">Date of Birth:</span> {formatDateForDisplay(student.dateOfBirth)}</div>
          <div><span className="label">Age:</span> {student.ageAtGeneration}</div>
          <div>
            <span className="label">Attendance:</span>{" "}
            {attendance.daysPresent !== null
              ? `${attendance.daysPresent} / ${attendance.totalSchoolDays} days (${attendance.attendancePercentage}%)`
              : "Not recorded"}
          </div>
          <div><span className="label">Class Size:</span> {overall?.classSize ?? "-"}</div>
        </div>
        <div className="actrs-report-photo">
          {student.photoDataUrl ? (
            <img src={student.photoDataUrl} alt="" />
          ) : (
            <span className="placeholder">{student.fullName.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      <table className="actrs-report-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Subject</th>
            <th>SBA (50)</th>
            <th>Exam (50)</th>
            <th>Total (100)</th>
            <th>Grade</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {(subjects ?? []).map((subject) => (
            <tr key={subject.subjectId}>
              <td className="subject-name">{subject.subjectName}</td>
              <td>{subject.sba ?? "-"}</td>
              <td>{subject.exam ?? "-"}</td>
              <td>{subject.total ?? "-"}</td>
              <td>{subject.gradeCode ?? "-"}</td>
              <td>{subject.positionText ?? "-"}</td>
            </tr>
          ))}
          {overall && (
            <tr className="overall-row">
              <td className="subject-name">Overall</td>
              <td colSpan={2}></td>
              <td>{overall.total}</td>
              <td>{overall.gradeCode ?? "-"}</td>
              <td>{overall.positionText ?? "-"}</td>
            </tr>
          )}
        </tbody>
      </table>
      {overall && (
        <div className="actrs-report-summary-line">
          Average: {overall.average.toFixed(1)} | Overall Grade: {overall.gradeLabel ?? "-"} | Class Position:{" "}
          {overall.positionText ?? "-"} of {overall.classSize}
        </div>
      )}

      <div className="actrs-report-remarks accent-teal">
        <span className="remark-label">Conduct: </span>
        {scoredRemarks?.conductRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-plum">
        <span className="remark-label">Interest: </span>
        {scoredRemarks?.interestRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-rose">
        <span className="remark-label">Attitude: </span>
        {scoredRemarks?.attitudeRemark || "-"}
      </div>
      <div className="actrs-report-remarks">
        <span className="remark-label">Class Teacher's Remark: </span>
        {scoredRemarks?.classTeacherRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-amber">
        <span className="remark-label">Headteacher's Remark: </span>
        {scoredRemarks?.headteacherRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-green">
        <span className="remark-label">Promoted To: </span>
        {scoredRemarks?.promotion || "-"}
      </div>

      <div className="actrs-report-info-grid" style={{ marginTop: 10 }}>
        <div><span className="label">Vacation Date:</span> {formatDateForDisplay(term.vacationDate)}</div>
        <div><span className="label">Reopening Date:</span> {formatDateForDisplay(term.reopeningDate)}</div>
      </div>

      <SignatureBlock
        settings={settings}
        classTeacherName={scoredRemarks?.classTeacherName}
        headTeacherName={scoredRemarks?.headTeacherName}
      />

      {school.reportFooter && <div className="actrs-report-footer">{school.reportFooter}</div>}
    </ReportPage>
  );
}
