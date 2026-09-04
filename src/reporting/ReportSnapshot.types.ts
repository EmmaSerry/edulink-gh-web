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

export interface ReportSnapshotKgRemarks {
  generalComment?: string;
  areasForImprovement?: string;
  teacherRecommendation?: string;
  classTeacherName?: string;
  headTeacherName?: string;
  progression?: string;
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
}
