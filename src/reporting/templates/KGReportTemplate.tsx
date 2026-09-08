import type { ReportSnapshot, ReportSnapshotLearningArea, ReportSnapshotSkillRating } from "../ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportPage } from "../ReportPage";
import { ReportFeesSection } from "../ReportFeesSection";
import { SignatureBlock } from "../SignatureBlock";
import { KgLegend } from "../KgLegend";
import { formatDateForDisplay } from "@utils/dateUtils";

/**
 * KG (Kindergarten) report - Module 15b redesign.
 *
 * Rebuilt from scratch against the official NaCCA "Learner's Report
 * Form" (KG1 and KG2 - see docs handed over with this redesign) rather
 * than reusing the Lower/Upper Primary/JHS scored layout: KG has no
 * scores, grades, or subject positions at all, just a Gold/Silver/
 * Bronze/Not-assessed/Absent rating per skill and one General Comments
 * box, so the report is a fixed sequence of purpose-built pages instead
 * of one dense page:
 *
 *   1. Cover - district logo (replaces the old NaCCA logo entirely),
 *      a slot for the school's own logo, a slot for the learner's
 *      photo with their name printed boldly beneath it, and the
 *      District/School/Learner identification the redesign asked for.
 *      Deliberately carries no NaCCA/copyright notice of any kind.
 *   2. Learner information - the same bio-data/attendance grid every
 *      other template uses, plus the official G/S/B/X/O legend.
 *   3-7. One page per official learning area (Language and Literacy,
 *      Numeracy, Creative Arts, Our World and Our People, Socio-
 *      Emotional Learning) - always all five, in this fixed order, so
 *      the report's shape matches the paper form a parent already
 *      knows, even on a term where a teacher has hidden every skill in
 *      one area (see ReportDataService's report_skill_selection
 *      filtering - `skills` here is already just whatever survived
 *      that filter).
 *   8. General Comments - the form's one combined comments box (see
 *      ReportSnapshotKgRemarks), not the old four-part remarks.
 *   9. School information - vacation/reopening dates, progression,
 *      the private-school fees section, and signatures.
 *
 * Exactly 9 pages, matching the redesign's "9 pages maximum" limit -
 * every page above is always rendered (nothing here can push the count
 * higher). Each `ReportPage` below is one physical page; only the very
 * last one passes through the batch's real `isLastPage` so
 * report-print.css's page-break-after rule only stops between
 * different students' reports, never partway through one student's
 * own 9 pages - see ReportPage.tsx / report-print.css for how that
 * class is used.
 */

const AREA_ACCENTS = ["teal", "plum", "rose", "green", "amber"] as const;

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function IdentLine({ snapshot }: { snapshot: ReportSnapshot }) {
  const { student, term } = snapshot;
  return (
    <div className="actrs-report-summary-line" style={{ marginTop: -2 }}>
      {student.fullName} &middot; {student.className} &middot; {term.termName}, {term.academicYearLabel}
    </div>
  );
}

/** One skill's row in the G/S/B checkmark table - item 11 of the
 *  redesign: the selected proficiency level gets a bold check mark
 *  under its own column, nothing under the other two. X (not assessed)
 *  and O (absent) aren't proficiency levels, so instead of three empty
 *  columns they get one merged status note. */
function SkillRow({ skill }: { skill: ReportSnapshotSkillRating }) {
  const rating = skill.rating;
  if (rating === "X" || rating === "O") {
    return (
      <tr>
        <td>{skill.serialNumber || ""}</td>
        <td className="col-skill">{skill.description}</td>
        <td colSpan={3} className="col-status">
          {rating === "X" ? "Not assessed" : "Absent"}
        </td>
        <td className="col-comment">{skill.comment || ""}</td>
      </tr>
    );
  }
  return (
    <tr>
      <td>{skill.serialNumber || ""}</td>
      <td className="col-skill">{skill.description}</td>
      <td className={`col-rating gold${rating === "G" ? " active" : ""}`}>
        {rating === "G" && <span className="check">&#10003;</span>}
      </td>
      <td className={`col-rating silver${rating === "S" ? " active" : ""}`}>
        {rating === "S" && <span className="check">&#10003;</span>}
      </td>
      <td className={`col-rating bronze${rating === "B" ? " active" : ""}`}>
        {rating === "B" && <span className="check">&#10003;</span>}
      </td>
      <td className="col-comment">{skill.comment || ""}</td>
    </tr>
  );
}

function LearningAreaPage({
  snapshot,
  settings,
  area,
  accent,
}: {
  snapshot: ReportSnapshot;
  settings: TemplateSettings;
  area: ReportSnapshotLearningArea;
  accent: (typeof AREA_ACCENTS)[number];
}) {
  return (
    <ReportPage settings={settings} school={snapshot.school} isLastPage={false}>
      <IdentLine snapshot={snapshot} />
      <div className={`actrs-report-remarks accent-${accent} mb-2`}>
        <span className="remark-label">{area.name}</span>
      </div>
      {area.skills.length === 0 ? (
        <p className="text-muted small">No skills are set to appear for this learning area this term.</p>
      ) : (
        <table className="actrs-report-table kg-skill-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>S/N</th>
              <th className="col-skill">Skill</th>
              <th className="col-rating">Gold</th>
              <th className="col-rating">Silver</th>
              <th className="col-rating">Bronze</th>
              <th className="col-comment">Comments</th>
            </tr>
          </thead>
          <tbody>
            {area.skills.map((skill) => (
              <SkillRow key={skill.skillId} skill={skill} />
            ))}
          </tbody>
        </table>
      )}
    </ReportPage>
  );
}

export function KGReportTemplate({ snapshot, settings, isLastPage }: {
  snapshot: ReportSnapshot; settings: TemplateSettings; isLastPage?: boolean;
}) {
  const { school, student, term, attendance, learningAreas, kgRemarks, feeSummary } = snapshot;
  const areas = learningAreas ?? [];

  return (
    <>
      {/* ---------------- Page 1: Cover ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={false}>
        <div className="kg-cover-header">
          {school.districtLogoDataUrl && (
            <img src={school.districtLogoDataUrl} alt="" className="district-logo" />
          )}
          <div className="district-name">
            {school.district || "District"}
            {school.region && <span className="region">{school.region} Region</span>}
          </div>
          <div className="form-title">Kindergarten Learner's Report</div>
          <div className="form-subtitle">
            {student.levelName} &middot; {term.termName}, {term.academicYearLabel}
          </div>
        </div>

        <div className="kg-cover-photo-row">
          <div className="photo-slot">
            <div className="kg-cover-school-logo">
              {school.logoDataUrl ? (
                <img src={school.logoDataUrl} alt="" />
              ) : (
                <span className="text-muted small">Logo</span>
              )}
            </div>
            <span className="caption">School logo</span>
          </div>
          <div className="photo-slot">
            <div className="kg-cover-learner-photo">
              {student.photoDataUrl ? (
                <img src={student.photoDataUrl} alt="" />
              ) : (
                <span className="placeholder">{initialsOf(student.fullName)}</span>
              )}
            </div>
            <span className="caption">Learner's photo</span>
          </div>
        </div>

        <div className="kg-cover-learner-name">{student.fullName}</div>

        <div className="kg-cover-info-grid">
          <span className="label">District:</span>
          <span>{school.district || "-"}</span>
          <span className="label">School:</span>
          <span>{school.name || "-"}</span>
          <span className="label">Class:</span>
          <span>{student.className}</span>
          <span className="label">Term:</span>
          <span>
            {term.termName}, {term.academicYearLabel}
          </span>
        </div>
      </ReportPage>

      {/* ---------------- Page 2: Learner information ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={false}>
        <IdentLine snapshot={snapshot} />
        <div className="actrs-report-remarks accent-teal mb-2">
          <span className="remark-label">Learner Information</span>
        </div>
        <div className="actrs-report-info-grid">
          <div>
            <span className="label">Learner's Name:</span> {student.fullName}
          </div>
          <div>
            <span className="label">Admission No.:</span> {student.admissionNumber || "-"}
          </div>
          <div>
            <span className="label">Class:</span> {student.className}
          </div>
          <div>
            <span className="label">Sex:</span> {student.gender}
          </div>
          <div>
            <span className="label">Age:</span> {student.ageAtGeneration}
          </div>
          <div>
            <span className="label">Total School Days:</span> {attendance.totalSchoolDays || "-"}
          </div>
          <div>
            <span className="label">Days Present:</span> {attendance.daysPresent ?? "-"}
          </div>
          <div>
            <span className="label">Days Absent:</span> {attendance.daysAbsent ?? "-"}
          </div>
          <div>
            <span className="label">Parent/Guardian:</span> {student.guardianName || "-"}
          </div>
          <div>
            <span className="label">Contact:</span> {student.guardianPhone || "-"}
          </div>
        </div>
        <div className="mt-3">
          <KgLegend />
        </div>
      </ReportPage>

      {/* ---------------- Pages 3-7: the five learning areas ---------------- */}
      {areas.map((area, i) => (
        <LearningAreaPage
          key={area.learningAreaId}
          snapshot={snapshot}
          settings={settings}
          area={area}
          accent={AREA_ACCENTS[i % AREA_ACCENTS.length]}
        />
      ))}

      {/* ---------------- Page 8: General Comments ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={false}>
        <IdentLine snapshot={snapshot} />
        <div className="actrs-report-remarks accent-plum mb-2">
          <span className="remark-label">General Comments</span>
        </div>
        <div className="kg-comments-box">{kgRemarks?.generalComment || "-"}</div>
      </ReportPage>

      {/* ---------------- Page 9: School information, fees, signatures ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={isLastPage}>
        <IdentLine snapshot={snapshot} />
        <div className="actrs-report-remarks accent-amber mb-3">
          <span className="remark-label">School Information</span>
        </div>
        <div className="actrs-report-info-grid" style={{ marginBottom: 16 }}>
          <div>
            <span className="label">Vacation Date:</span> {formatDateForDisplay(term.vacationDate)}
          </div>
          <div>
            <span className="label">Reopening Date:</span> {formatDateForDisplay(term.reopeningDate)}
          </div>
          {kgRemarks?.progression && (
            <div>
              <span className="label">Progression:</span> {kgRemarks.progression}
            </div>
          )}
        </div>
        <ReportFeesSection feeSummary={feeSummary} />
        <SignatureBlock
          settings={settings}
          classTeacherName={kgRemarks?.classTeacherName}
          headTeacherName={kgRemarks?.headTeacherName}
        />
        {school.reportFooter && <div className="actrs-report-footer">{school.reportFooter}</div>}
      </ReportPage>
    </>
  );
}
