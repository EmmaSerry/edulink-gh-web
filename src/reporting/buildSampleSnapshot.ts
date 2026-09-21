import {
  CONDUCT_COMMENT_BANK,
  INTEREST_COMMENT_BANK,
  ATTITUDE_COMMENT_BANK,
  CLASS_TEACHER_REMARK_BANK,
  HEADTEACHER_REMARK_BANK,
} from "@/constants/scoredRemarkCommentBanks";
import { KG_GENERAL_COMMENT_BANK } from "@/constants/kgCommentBank";
import type {
  ReportSnapshot,
  ReportSnapshotSubjectRow,
  ReportSnapshotLearningArea,
} from "@reporting/ReportSnapshot.types";
import type { ReportTemplateCode } from "@/types/database";

/**
 * Cloud counterpart of the offline app's SampleReportService.ts -
 * builds a complete, self-contained ReportSnapshot with no real
 * student, scores or remarks required, so anyone who can reach the
 * Sample report screen can check how a template/print settings choice
 * actually looks BEFORE any real data entry exists for it. Renders
 * through the exact same ReportPrintSurface every real report uses -
 * this is not a separate mockup, it's a real snapshot with made-up
 * content.
 *
 * Unlike the offline version (which pulls the real signed-in school's
 * own branding into the sample), this one uses a fixed, deliberately
 * generic reference identity for the school/teacher/headteacher/
 * learner names - see the constants just below - because this screen
 * is also reachable by district_admin/platform_admin, who have no
 * single school of their own to pull branding from, and because a
 * consistent, comparable sample matters more here than a personalised
 * one: the point is to check the TEMPLATE and PRINT SETTINGS, not to
 * preview any one particular school's letterhead. Everything else
 * (subjects, learning areas, scores, ratings) is plainly generic
 * placeholder content, reusing the same quick-fill comment banks a
 * real teacher would pick from.
 */

const SAMPLE_SCHOOL_NAME = "Wassa Amenfi Central DEO";
const SAMPLE_CLASS_TEACHER_NAME = "Mr. Kofi Ennin Sangmoah";
const SAMPLE_HEAD_TEACHER_NAME = "Mrs. Ann Konadu";
const SAMPLE_LEARNER_NAME = "Emmanuel Serry";

const SAMPLE_CLASS_NAME: Record<ReportTemplateCode, string> = {
  KG: "KG 2",
  LOWER_PRIMARY: "Basic 3",
  UPPER_PRIMARY: "Basic 6",
  JHS: "JHS 2",
};

const SAMPLE_LEVEL_NAME: Record<ReportTemplateCode, string> = {
  KG: "Kindergarten",
  LOWER_PRIMARY: "Lower Primary",
  UPPER_PRIMARY: "Upper Primary",
  JHS: "Junior High School",
};

const SAMPLE_SUBJECTS_SCORED: Record<Exclude<ReportTemplateCode, "KG">, string[]> = {
  LOWER_PRIMARY: ["English Language", "Mathematics", "Our World Our People", "Ghanaian Language", "Creative Arts", "Religious & Moral Education"],
  UPPER_PRIMARY: ["English Language", "Mathematics", "Integrated Science", "Social Studies", "Ghanaian Language", "Computing", "Religious & Moral Education"],
  JHS: ["English Language", "Mathematics", "Integrated Science", "Social Studies", "Ghanaian Language", "Computing", "Career Technology", "Religious & Moral Education"],
};

const SAMPLE_LEARNING_AREAS_KG: { name: string; skills: string[] }[] = [
  { name: "Language & Literacy", skills: ["Listens attentively to stories", "Recognises and names letters", "Speaks confidently in class"] },
  { name: "Numeracy", skills: ["Counts objects up to 20", "Recognises basic shapes", "Sorts objects by size and colour"] },
  { name: "Creative Arts", skills: ["Participates in music and movement", "Uses colours and materials creatively"] },
  { name: "Physical Development", skills: ["Shows good coordination in play", "Follows simple safety instructions"] },
];

const SAMPLE_SBA_CYCLE = [42, 38, 45, 35, 40, 44, 37, 41];
const SAMPLE_EXAM_CYCLE = [40, 35, 42, 30, 38, 41, 33, 39];
const KG_RATING_CYCLE: Array<"G" | "S" | "B"> = ["G", "G", "S", "G", "B", "S", "G"];

/** A simple, generic A-E scale used only for this sample - deliberately
 *  NOT the school's own configured grade bands (those are per-school,
 *  Settings -> Academic setup, and this screen is reachable by roles
 *  with no single school at all), so this is clearly illustrative
 *  rather than a preview of any real school's actual grading. */
function sampleGrade(total: number): { code: string; label: string } {
  if (total >= 80) return { code: "A", label: "Excellent" };
  if (total >= 70) return { code: "B", label: "Very Good" };
  if (total >= 60) return { code: "C", label: "Good" };
  if (total >= 50) return { code: "D", label: "Credit" };
  return { code: "E", label: "Needs Improvement" };
}

export function buildSampleSnapshot(templateCode: ReportTemplateCode): ReportSnapshot {
  const school = {
    name: SAMPLE_SCHOOL_NAME,
    schoolCode: "SAMPLE-001",
    circuit: "Wassa Amenfi Central Circuit",
    district: "Wassa Amenfi Central",
    region: "Western Region",
    postalAddress: "P. O. Box 25, Wassa Amenfi",
    digitalAddress: "WS-025-2580",
    telephone: "024 000 0000",
    email: "info@wassaamenficentraldeo.example",
    motto: "Knowledge, Character, Service",
    headTeacherName: SAMPLE_HEAD_TEACHER_NAME,
  };

  const term = {
    academicYearLabel: "2025/2026",
    termName: "Term 1",
    termNumber: 1 as const,
    vacationDate: "",
    reopeningDate: "",
    totalSchoolDays: 60,
  };

  const attendance = {
    daysPresent: 56,
    totalSchoolDays: 60,
    daysAbsent: 4,
    attendancePercentage: 93,
  };

  const student = {
    studentId: "EDULINK-SAMPLE-000000",
    admissionNumber: "SAMPLE-0001",
    fullName: SAMPLE_LEARNER_NAME,
    gender: "M" as const,
    dateOfBirth: "2013-06-15",
    ageAtGeneration: 12,
    className: `${SAMPLE_CLASS_NAME[templateCode]} (Sample Class)`,
    levelName: SAMPLE_LEVEL_NAME[templateCode],
    guardianName: "Sample Parent/Guardian",
    guardianPhone: "024 000 0000",
  };

  if (templateCode === "KG") {
    const learningAreas: ReportSnapshotLearningArea[] = SAMPLE_LEARNING_AREAS_KG.map((area, areaIndex) => ({
      learningAreaId: areaIndex + 1,
      name: area.name,
      skills: area.skills.map((description, i) => ({
        skillId: `${areaIndex}-${i}`,
        serialNumber: i + 1,
        description,
        rating: KG_RATING_CYCLE[(areaIndex + i) % KG_RATING_CYCLE.length],
      })),
    }));

    return {
      templateCode,
      school,
      student,
      term,
      attendance,
      learningAreas,
      kgRemarks: {
        generalComment: KG_GENERAL_COMMENT_BANK[0] ?? "Sample learner shows steady progress across all learning areas this term.",
        classTeacherName: SAMPLE_CLASS_TEACHER_NAME,
        headTeacherName: SAMPLE_HEAD_TEACHER_NAME,
        progression: "Promoted to KG 2",
      },
    };
  }

  const subjectNames = SAMPLE_SUBJECTS_SCORED[templateCode];
  const subjects: ReportSnapshotSubjectRow[] = subjectNames.map((name, i) => {
    const sba = SAMPLE_SBA_CYCLE[i % SAMPLE_SBA_CYCLE.length];
    const exam = SAMPLE_EXAM_CYCLE[i % SAMPLE_EXAM_CYCLE.length];
    const total = sba + exam;
    const grade = sampleGrade(total);
    return {
      subjectId: i + 1,
      subjectName: name,
      subjectCode: name.slice(0, 3).toUpperCase(),
      sba,
      exam,
      total,
      gradeCode: grade.code,
      gradeLabel: grade.label,
      positionText: "3rd",
    };
  });

  const totals = subjects.map((s) => s.total ?? 0);
  const overallTotal = totals.reduce((sum, t) => sum + t, 0);
  const overallAverage = totals.length > 0 ? overallTotal / totals.length : 0;
  const overallGrade = sampleGrade(overallAverage);

  return {
    templateCode,
    school,
    student,
    term,
    attendance,
    subjects,
    overall: {
      total: overallTotal,
      average: Math.round(overallAverage * 100) / 100,
      gradeCode: overallGrade.code,
      gradeLabel: overallGrade.label,
      positionText: "3rd",
      classSize: 25,
    },
    scoredRemarks: {
      conductRemark: CONDUCT_COMMENT_BANK[0],
      interestRemark: INTEREST_COMMENT_BANK[0],
      attitudeRemark: ATTITUDE_COMMENT_BANK[0],
      classTeacherRemark: CLASS_TEACHER_REMARK_BANK[0],
      headteacherRemark: HEADTEACHER_REMARK_BANK[0],
      classTeacherName: SAMPLE_CLASS_TEACHER_NAME,
      headTeacherName: SAMPLE_HEAD_TEACHER_NAME,
      promotion: `Promoted to ${templateCode === "JHS" ? "the next class" : "next class"}`,
    },
  };
}
