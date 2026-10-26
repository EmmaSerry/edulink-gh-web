import type { CSSProperties } from "react";
import type { ReportSnapshot } from "./ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportPage } from "./ReportPage";
import { ReportHeader } from "./ReportHeader";
import { ReportFeesSection } from "./ReportFeesSection";
import { SignatureBlock } from "./SignatureBlock";
import { formatDateForDisplay } from "@utils/dateUtils";
import { mixHex, safeHex, shade, tileFor } from "./colorContrast";

/**
 * Shared layout for every "scored" report (Lower Primary, Upper Primary,
 * JHS). Each level's template component is a thin wrapper that renders THIS
 * layout with a level-specific title; the subject list is entirely
 * data-driven, and every subject row reads its own values from its own
 * `snapshot.subjects[i]` (so one subject can never show another's position).
 *
 * The "performance at a glance" tiles are filled with the school's own
 * colours, and their text colour is chosen automatically for contrast.
 */

/** Performance band for a 0-100 total - drives the bar and grade chip colour. */
function bandOf(total: number | null): "a" | "b" | "c" | "d" | "e" | "none" {
  if (total === null || total === undefined) return "none";
  if (total >= 80) return "a";
  if (total >= 65) return "b";
  if (total >= 50) return "c";
  if (total >= 40) return "d";
  return "e";
}

/** Attendance ring. Inline SVG with literal colours (CSS variables do not
 *  survive the PDF rasteriser's SVG handling). */
function AttendanceRing({
  percent,
  track,
  arc,
  textColor,
}: {
  percent: number;
  track: string;
  arc: string;
  textColor: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" className="ring" aria-hidden="true">
      <circle cx="23" cy="23" r={r} fill="none" stroke={track} strokeWidth="5" />
      <circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke={arc}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 23 23)"
      />
      <text x="23" y="26.6" textAnchor="middle" fontSize="10" fontWeight="700" fill={textColor}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

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
  const { school, student, term, attendance, subjects, overall, scoredRemarks, feeSummary } = snapshot;

  // Tile fills come from the school's two colours; text colour is automatic.
  const primary = safeHex(settings.primaryColorHex, "#1f3864");
  const secondary = safeHex(settings.secondaryColorHex, "#2f6fb0");
  const tiles = [
    tileFor(primary),
    tileFor(secondary),
    tileFor(mixHex(primary, secondary, 0.5)),
    tileFor(shade(primary, -0.1)),
  ];
  const tileStyle = (i: number): CSSProperties => ({
    color: tiles[i].text,
    backgroundColor: tiles[i].from,
    backgroundImage: `linear-gradient(135deg, ${tiles[i].from} 0%, ${tiles[i].to} 100%)`,
    borderColor: tiles[i].to,
  });

  return (
    <ReportPage settings={settings} school={school} isLastPage={isLastPage}>
      <ReportHeader school={school} term={term} title={title} />

      <div className="actrs-report-student-block">
        <div className="actrs-report-info-grid">
          <div><span className="label">Student's Name</span><span className="value">{student.fullName}</span></div>
          <div><span className="label">Student ID</span><span className="value">{student.studentId}</span></div>
          <div><span className="label">Class</span><span className="value">{student.className}</span></div>
          <div><span className="label">Gender</span><span className="value">{student.gender === "M" ? "Male" : "Female"}</span></div>
          <div><span className="label">Date of Birth</span><span className="value">{formatDateForDisplay(student.dateOfBirth)}</span></div>
          <div><span className="label">Age</span><span className="value">{student.ageAtGeneration}</span></div>
          <div>
            <span className="label">Attendance</span>
            <span className="value">
              {attendance.daysPresent !== null
                ? `${attendance.daysPresent} / ${attendance.totalSchoolDays} days`
                : "Not recorded"}
            </span>
          </div>
          <div><span className="label">Class Size</span><span className="value">{overall?.classSize ?? "-"}</span></div>
        </div>
        <div className="actrs-report-photo">
          {student.photoDataUrl ? (
            <img src={student.photoDataUrl} alt="" />
          ) : (
            <span className="placeholder">{student.fullName.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      {overall && (
        <div className="actrs-report-stats">
          <div className="stat tile" style={tileStyle(0)}>
            <div className="stat-value">{overall.average.toFixed(1)}</div>
            <div className="stat-label">Average score</div>
          </div>
          <div className="stat tile" style={tileStyle(1)}>
            <div className="stat-value">{overall.gradeCode ?? "-"}</div>
            <div className="stat-label">{overall.gradeLabel ?? "Overall grade"}</div>
          </div>
          <div className="stat tile" style={tileStyle(2)}>
            <div className="stat-value">{overall.positionText ?? "-"}</div>
            <div className="stat-label">Position (of {overall.classSize})</div>
          </div>
          {attendance.attendancePercentage !== null && (
            <div className="stat tile stat-ring" style={tileStyle(3)}>
              <AttendanceRing
                percent={attendance.attendancePercentage}
                track={mixHex(tiles[3].from, tiles[3].text, 0.3)}
                arc={tiles[3].text}
                textColor={tiles[3].text}
              />
              <div className="stat-label">Attendance</div>
            </div>
          )}
        </div>
      )}

      <table className="actrs-report-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Subject</th>
            <th>SBA (50)</th>
            <th>Exam (50)</th>
            <th className="col-total">Total (100)</th>
            <th>Grade</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {(subjects ?? []).map((subject) => {
            const band = bandOf(subject.total);
            return (
              <tr key={subject.subjectId}>
                <td className="subject-name">{subject.subjectName}</td>
                <td>{subject.sba ?? "-"}</td>
                <td>{subject.exam ?? "-"}</td>
                <td className="total-cell">
                  <span className="total-num">{subject.total ?? "-"}</span>
                  {subject.total !== null && subject.total !== undefined && (
                    <span className="bar">
                      <i className={`band-${band}`} style={{ width: `${Math.max(0, Math.min(100, subject.total))}%` }} />
                    </span>
                  )}
                </td>
                <td>
                  {subject.gradeCode ? <span className={`grade-chip band-${band}`}>{subject.gradeCode}</span> : "-"}
                </td>
                <td>{subject.positionText ?? "-"}</td>
              </tr>
            );
          })}
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

      <div className="actrs-report-remarks accent-teal">
        <span className="remark-label">Conduct</span>
        {scoredRemarks?.conductRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-plum">
        <span className="remark-label">Interest</span>
        {scoredRemarks?.interestRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-rose">
        <span className="remark-label">Attitude</span>
        {scoredRemarks?.attitudeRemark || "-"}
      </div>
      <div className="actrs-report-remarks">
        <span className="remark-label">Class Teacher's Remark</span>
        {scoredRemarks?.classTeacherRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-amber">
        <span className="remark-label">Headteacher's Remark</span>
        {scoredRemarks?.headteacherRemark || "-"}
      </div>
      <div className="actrs-report-remarks accent-green promo">
        <span className="remark-label">Promoted To</span>
        {scoredRemarks?.promotion || "-"}
      </div>

      <div className="actrs-report-dates">
        <div className="date-chip"><span className="label">Vacation Date</span> {formatDateForDisplay(term.vacationDate)}</div>
        <div className="date-chip"><span className="label">Reopening Date</span> {formatDateForDisplay(term.reopeningDate)}</div>
      </div>

      <ReportFeesSection feeSummary={feeSummary} />

      <SignatureBlock
        settings={settings}
        classTeacherName={scoredRemarks?.classTeacherName}
        headTeacherName={scoredRemarks?.headTeacherName}
      />

      {school.reportFooter && <div className="actrs-report-footer">{school.reportFooter}</div>}
    </ReportPage>
  );
}
