import type { ReportSnapshot } from "../ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportPage } from "../ReportPage";
import { ReportHeader } from "../ReportHeader";
import { SignatureBlock } from "../SignatureBlock";
import { KgLegend } from "../KgLegend";
import { formatDateForDisplay } from "@utils/dateUtils";

/**
 * Module 6 - KG Report, following the official NaCCA Kindergarten
 * Learner Report Form structure. Per the brief's "Critical Instruction"
 * this template must NEVER show a total, average, grade, ranking,
 * position or percentage anywhere - the only numeric attendance figures
 * are days-present/total-days, which are attendance, not assessment.
 * `ReportSnapshot.overall`/`subjects` are simply never read here (the
 * KG branch of `ReportDataService.buildClassSnapshots` never populates
 * them in the first place - see that file).
 */
export function KGReportTemplate({
  snapshot,
  settings,
  isLastPage,
}: {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  isLastPage?: boolean;
}) {
  const { school, student, term, attendance, learningAreas, kgRemarks } = snapshot;

  return (
    <ReportPage settings={settings} school={school} isLastPage={isLastPage}>
      <ReportHeader school={school} term={term} title="Kindergarten Learner's Report Form" />

      <div className="actrs-report-student-block">
        <div className="actrs-report-info-grid">
          <div><span className="label">Learner's Name:</span> {student.fullName}</div>
          <div><span className="label">Student ID:</span> {student.studentId}</div>
          <div><span className="label">Class:</span> {student.className}</div>
          <div><span className="label">Gender:</span> {student.gender === "M" ? "Male" : "Female"}</div>
          <div><span className="label">Date of Birth:</span> {formatDateForDisplay(student.dateOfBirth)}</div>
          <div><span className="label">Age:</span> {student.ageAtGeneration}</div>
          <div><span className="label">Parent/Guardian:</span> {student.guardianName || "-"}</div>
          <div><span className="label">Contact:</span> {student.guardianPhone || "-"}</div>
          <div>
            <span className="label">Attendance:</span>{" "}
            {attendance.daysPresent !== null
              ? `${attendance.daysPresent} / ${attendance.totalSchoolDays} days`
              : "Not recorded"}
          </div>
        </div>
        <div className="actrs-report-photo">
          {student.photoDataUrl ? (
            <img src={student.photoDataUrl} alt="" />
          ) : (
            <span className="placeholder">{student.fullName.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      <KgLegend />

      {(learningAreas ?? []).map((area) => (
        <table className="actrs-report-table" key={area.learningAreaId}>
          <thead>
            <tr>
              <th colSpan={3} style={{ textAlign: "left", background: "var(--report-secondary)" }}>
                {area.name}
              </th>
            </tr>
            <tr>
              <th style={{ textAlign: "left", width: "8%" }}>S/N</th>
              <th style={{ textAlign: "left" }}>Skill</th>
              <th style={{ width: "18%" }}>Rating</th>
            </tr>
          </thead>
          <tbody>
            {area.skills.map((skill) => (
              <tr key={skill.skillId}>
                <td>{skill.serialNumber}</td>
                <td style={{ textAlign: "left" }}>
                  {skill.description}
                  {skill.comment && <div className="text-muted small">Comment: {skill.comment}</div>}
                </td>
                <td style={{ fontWeight: 700 }}>{skill.rating ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      <div className="actrs-report-remarks accent-teal">
        <span className="remark-label">General Progress Comment: </span>
        {kgRemarks?.generalComment || "-"}
      </div>
      <div className="actrs-report-remarks accent-rose">
        <span className="remark-label">Areas for Improvement: </span>
        {kgRemarks?.areasForImprovement || "-"}
      </div>
      <div className="actrs-report-remarks accent-plum">
        <span className="remark-label">Teacher Recommendation: </span>
        {kgRemarks?.teacherRecommendation || "-"}
      </div>
      <div className="actrs-report-remarks accent-green">
        <span className="remark-label">Progression: </span>
        {kgRemarks?.progression || "-"}
      </div>

      <div className="actrs-report-info-grid" style={{ marginTop: 10 }}>
        <div><span className="label">Vacation Date:</span> {formatDateForDisplay(term.vacationDate)}</div>
        <div><span className="label">Reopening Date:</span> {formatDateForDisplay(term.reopeningDate)}</div>
      </div>

      <SignatureBlock
        settings={settings}
        classTeacherName={kgRemarks?.classTeacherName}
        headTeacherName={kgRemarks?.headTeacherName}
      />

      {school.reportFooter && <div className="actrs-report-footer">{school.reportFooter}</div>}
    </ReportPage>
  );
}
