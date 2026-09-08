import type { ReportTemplateCode } from "@models/ReportTemplate";
import type { ProficiencyRating } from "@models/AssessmentRecord";
import type { Sex } from "@models/Student";

/**
 * The fully-resolved, self-contained data bundle one report card is
 * rendered from. Building this snapshot (see
 * `src/services/ReportDataService.ts`) is the ONLY place that reads
 * Student/Enrollment/ScoreRecord/SkillAssessmentRecord/ReportRecord/
 * School/GradeBand/Subject/LearningArea/Skill records and runs the
 * Phase 3 calculation engine over them. Once built, it is frozen into
 * `GeneratedReport.snapshotData` / `ReportVersionEntry.snapshotData` -
 * every template component, the PDF service and the print view render
 * ONLY from this object, never by re-querying Dexie or recalculating.
 * This is what makes "reopen and reprint without recalculating unless
 * the assessment has been officially reopened" (Module 13) trivially
 * correct: reprinting is just re-rendering the same frozen object.
 */
export interface ReportSnapshotSchoolInfo {
  name: string;
  schoolCode: string;
  circuit: string;
  district: string;
  region: string;
  postalAddress?: string;
  digitalAddress?: string;
  telephone?: string;
  email?: string;
  logoDataUrl?: string;
  /** The district's own logo (Settings, district admin) - used on the
   *  KG cover page in place of the old NaCCA logo. Undefined for a
   *  district that hasn't uploaded one yet; the cover page simply
   *  omits it rather than showing a placeholder. */
  districtLogoDataUrl?: string;
  motto?: string;
  reportHeader?: string;
  reportFooter?: string;
  officialSignatoryTitles?: string;
  reportWatermarkDataUrl?: string;
  headTeacherName?: string;
}

export interface ReportSnapshotStudentInfo {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  gender: Sex;
  dateOfBirth: string;
  ageAtGeneration: number;
  className: string;
  levelName: string;
  photoDataUrl?: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface ReportSnapshotTermInfo {
  academicYearLabel: string;
  termName: string;
  termNumber: 1 | 2 | 3;
  vacationDate: string;
  reopeningDate: string;
  totalSchoolDays: number;
}

export interface ReportSnapshotAttendance {
  daysPresent: number | null;
  totalSchoolDays: number;
  daysAbsent: number | null;
  attendancePercentage: number | null;
}

/** One subject row for Lower Primary / Upper Primary / JHS templates. */
export interface ReportSnapshotSubjectRow {
  subjectId: number | string;
  subjectName: string;
  subjectCode: string;
  sba: number | null;
  exam: number | null;
  total: number | null;
  gradeCode?: string;
  gradeLabel?: string;
  positionText?: string;
}

export interface ReportSnapshotOverall {
  total: number;
  average: number;
  gradeCode?: string;
  gradeLabel?: string;
  positionText?: string;
  classSize: number;
}

export interface ReportSnapshotScoredRemarks {
  conductRemark?: string;
  interestRemark?: string;
  attitudeRemark?: string;
  classTeacherRemark?: string;
  headteacherRemark?: string;
  classTeacherName?: string;
  headTeacherName?: string;
  promotion?: string;
}

/** One skill rating row for the KG template, grouped by learning area. */
export interface ReportSnapshotSkillRating {
  skillId: number | string;
  serialNumber: number;
  description: string;
  rating: ProficiencyRating | null;
  comment?: string;
}

export interface ReportSnapshotLearningArea {
  learningAreaId: number | string;
  name: string;
  skills: ReportSnapshotSkillRating[];
}

/** KG's official form has exactly one free-text box - "GENERAL
 *  COMMENTS" - not the separate Class Teacher's/Headteacher's remarks
 *  a scored level's report uses (see ReportSnapshotScoredRemarks
 *  above). `generalComment` is that one box; the entry screen offers a
 *  quick-fill dropdown (src/constants/kgCommentBank.ts) plus free text
 *  feeding this same field, matching what the KG redesign asked for -
 *  "one field... combine the remarks set... provide space to add their
 *  own comments". `progression` stays separate since the KG2 form has
 *  its own explicit "PROGRESSION:" line next to the reopening date. */
export interface ReportSnapshotKgRemarks {
  generalComment?: string;
  classTeacherName?: string;
  headTeacherName?: string;
  progression?: string;
  /** Kept for the offline app's own KG remarks screen/report template
   *  (src/services/ReportDataService.ts, src/pages/assessments/
   *  TeacherRemarksPanel.tsx, src/models/Report.ts) and its sample
   *  data generator (SampleReportService.ts), which still use the
   *  older four-part remarks. Not populated by the cloud app - see
   *  services/cloud/ReportDataService.ts - and not read by the
   *  redesigned KGReportTemplate.tsx, which shows generalComment only. */
  areasForImprovement?: string;
  teacherRecommendation?: string;
}

/** One fee component row on a private school's report card - see
 *  edulink_gh_phase1a_fees.sql. Absent entirely for a public school
 *  (schools.is_private = false), so every template's fees section
 *  simply renders nothing there - see ReportFeesSection.tsx. */
export interface ReportSnapshotFeeItem {
  name: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
}

export interface ReportSnapshotFeeSummary {
  items: ReportSnapshotFeeItem[];
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
}

export interface ReportSnapshot {
  templateCode: ReportTemplateCode;
  school: ReportSnapshotSchoolInfo;
  student: ReportSnapshotStudentInfo;
  term: ReportSnapshotTermInfo;
  attendance: ReportSnapshotAttendance;

  // Scored levels only (Lower/Upper Primary, JHS):
  subjects?: ReportSnapshotSubjectRow[];
  overall?: ReportSnapshotOverall;
  scoredRemarks?: ReportSnapshotScoredRemarks;

  // KG only:
  learningAreas?: ReportSnapshotLearningArea[];
  kgRemarks?: ReportSnapshotKgRemarks;

  // Private schools only - see ReportSnapshotFeeSummary above.
  feeSummary?: ReportSnapshotFeeSummary;
}
