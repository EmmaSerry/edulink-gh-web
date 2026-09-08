import type { ReportSnapshot, ReportSnapshotLearningArea, ReportSnapshotSkillRating } from "../ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportPage } from "../ReportPage";
import { ReportFeesSection } from "../ReportFeesSection";
import { SignatureBlock } from "../SignatureBlock";
import { KgLegend } from "../KgLegend";
import { formatDateForDisplay } from "@utils/dateUtils";

/**
 * KG (Kindergarten) report - Module 15b redesign, revised to a fixed
 * 3-page layout matching the sample the school sent (KG REPORT
 * FORMAT.pdf) - the first version of this redesign used 9 pages (one
 * per section) and printing that many pages per learner was judged too
 * costly. Same content as before, just grouped onto three pages
 * instead of spread across nine - nothing about WHAT is shown changed,
 * only how it's paginated:
 *
 *   1. Cover + Learner Information - district logo (replaces the old
 *      NaCCA logo entirely), a slot for the school's own logo, a slot
 *      for the learner's photo with their name printed boldly beneath
 *      it, the District/School/Learner identification, AND (new in
 *      this revision, combined onto the same page) the bio-data/
 *      attendance grid plus the official G/S/B/X/O legend. Deliberately
 *      carries no NaCCA/copyright notice of any kind.
 *   2. The first three learning areas (Language and Literacy, Numeracy,
 *      Creative Arts).
 *   3. The remaining learning areas (Our World and Our People, Socio-
 *      Emotional Learning), General Comments, and School Information
 *      (vacation/reopening dates, progression, private-school fees,
 *      signatures).
 *
 * The 3-way area split (first three vs. the rest) assumes the seeded
 * five-area order (edulink_gh_phase1c_kg_report_redesign.sql) - if a
 * school ever has a different number of learning areas this still
 * degrades reasonably (page 2 gets up to three, page 3 gets whatever's
 * left plus the fixed sections below it) rather than breaking.
 *
 * Each `ReportPage` below is one physical page in the export/print
 * pipeline (see PdfService.ts, which rasterizes one `.actrs-report-
 * page` node per PDF page and scales it to fill that page - a page
 * with a bit more content than usual just renders slightly smaller,
 * nothing is ever cropped). Only the very last one passes through the
 * batch's real `isLastPage` so report-print.css's page-break-after
 * rule only stops between different students' reports, never partway
 * through one student's own 3 pages.
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
 *  original redesign: the selected proficiency level gets a bold check
 *  mark under its own column, nothing under the other two. X (not
 *  assessed) and O (absent) aren't proficiency levels, so instead of
 *  three empty columns they get one merged status note. */
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

function LearningAreaBlock({
  area,
  accent,
}: {
  area: ReportSnapshotLearningArea;
  accent: (typeof AREA_ACCENTS)[number];
}) {
  return (
    <div className="mb-3">
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
    </div>
  );
}

export function KGReportTemplate({ snapshot, settings, isLastPage }: {
  snapshot: ReportSnapshot; settings: TemplateSettings; isLastPage?: boolean;
}) {
  const { school, student, term, attendance, learningAreas, kgRemarks, feeSummary } = snapshot;
  const areas = learningAreas ?? [];
  const firstAreas = areas.slice(0, 3);
  const restAreas = areas.slice(3);

  return (
    <>
      {/* ---------------- Page 1: Cover + Learner Information ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={false}>
        {/* Letterhead row - district seal + wordmark on the left, the
            school's own logo slot on the right, matching the physical
            office letterhead this was modelled on. */}
        <div className="kg-cover-letterhead">
          <div className="kg-cover-district">
            {school.districtLogoDataUrl && (
              <img src={school.districtLogoDataUrl} alt="" className="district-logo" />
            )}
            <div className="wordmark">
              {school.district || "District"}
              {school.region && <span className="region">{school.region} Region</span>}
            </div>
          </div>
          <div className="kg-cover-school-logo-box">
            {school.logoDataUrl ? (
              <img src={school.logoDataUrl} alt="" />
            ) : (
              <span className="placeholder">School Logo</span>
            )}
          </div>
        </div>

        <div className="kg-cover-titles">
          <div className="form-title">Kindergarten Learner's Report</div>
          <div className="form-subtitle">
            {student.levelName} &middot; {term.termName}, {term.academicYearLabel}
          </div>
        </div>

        <div className="kg-cover-photo-centered">
          <div className="kg-cover-learner-photo">
            {student.photoDataUrl ? (
              <img src={student.photoDataUrl} alt="" />
            ) : (
              <span className="placeholder">{initialsOf(student.fullName)}</span>
            )}
          </div>
        </div>

        <div className="kg-cover-learner-name">{student.fullName}</div>

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

        <div className="mt-2">
          <KgLegend />
        </div>
      </ReportPage>

      {/* ---------------- Page 2: first three learning areas ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={false}>
        <IdentLine snapshot={snapshot} />
        {firstAreas.map((area, i) => (
          <LearningAreaBlock key={area.learningAreaId} area={area} accent={AREA_ACCENTS[i % AREA_ACCENTS.length]} />
        ))}
      </ReportPage>

      {/* ---------------- Page 3: remaining learning areas + comments + school info ---------------- */}
      <ReportPage settings={settings} school={school} isLastPage={isLastPage}>
        <IdentLine snapshot={snapshot} />
        {restAreas.map((area, i) => (
          <LearningAreaBlock
            key={area.learningAreaId}
            area={area}
            accent={AREA_ACCENTS[(i + firstAreas.length) % AREA_ACCENTS.length]}
          />
        ))}

        <div className="actrs-report-remarks accent-plum mb-2">
          <span className="remark-label">General Comments</span>
        </div>
        <div className="kg-comments-box mb-3">{kgRemarks?.generalComment || "-"}</div>

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
