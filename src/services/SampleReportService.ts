import { SchoolService } from "./SchoolService";
import { AcademicYearService } from "./AcademicYearService";
import { TermService } from "./TermService";
import { ReportTemplateService } from "./ReportTemplateService";
import { LevelService } from "./LevelService";
import { SubjectService } from "./SubjectService";
import { LearningAreaService } from "./LearningAreaService";
import { SkillService } from "./SkillService";
import { GradeBandService } from "./GradeBandService";
import {
  computeSubjectTotal,
  findGradeBand,
  resolveGradeBandsForLevel,
  computeOverallForStudent,
} from "./AssessmentCalculationEngine";
import { toOrdinal } from "@utils/ordinal";
import type {
  ReportSnapshot,
  ReportSnapshotSubjectRow,
  ReportSnapshotLearningArea,
} from "@reporting/ReportSnapshot.types";
import type { ReportTemplateCode } from "@models/ReportTemplate";
import type { Sex } from "@models/Student";

/**
 * Module 7 (Version 1.0 update) - "Preview a sample report card". Before
 * a school has entered any real students or scores, there was no way to
 * see what a report card actually looks like - Report Preview always
 * required a real class/term with real assessment data. This builds a
 * complete, self-contained ReportSnapshot for a made-up learner at a
 * given level, so it renders through the exact same ReportRenderer/
 * template components real reports use.
 *
 * What's REAL (so the sample is actually useful, not just a mockup):
 *  - School branding (name, logo, motto, letterhead text) from School
 *    Setup, if configured.
 *  - Report layout/paper size/colours from Report Customization.
 *  - The school's own configured Subjects / Learning Areas & Skills /
 *    Grade Bands, so subject names and grading thresholds match what
 *    the school will actually see once real scores are entered.
 * What's FAKE: the learner's name/scores/ratings/remarks - clearly
 * labelled "(Sample)" so it's never mistaken for a real record.
 */

const SAMPLE_LEARNER: Record<ReportTemplateCode, { fullName: string; gender: Sex; dateOfBirth: string }> = {
  KG: { fullName: "Abena Owusu (Sample)", gender: "F", dateOfBirth: "2020-05-12" },
  LOWER_PRIMARY: { fullName: "Kwabena Asante (Sample)", gender: "M", dateOfBirth: "2017-09-03" },
  UPPER_PRIMARY: { fullName: "Efua Boateng (Sample)", gender: "F", dateOfBirth: "2014-11-20" },
  JHS: { fullName: "Yaw Darko (Sample)", gender: "M", dateOfBirth: "2011-02-08" },
};

const KG_RATING_CYCLE: Array<"G" | "S" | "B"> = ["G", "G", "S", "G", "B", "S", "G", "G"];
const SAMPLE_SBA_CYCLE = [42, 38, 45, 35, 40, 44, 37, 41, 39, 43];
const SAMPLE_EXAM_CYCLE = [40, 35, 42, 30, 38, 41, 33, 39, 36, 40];

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export async function buildSampleSnapshot(templateCode: ReportTemplateCode): Promise<ReportSnapshot> {
  // Report layout/paper size/colours (TemplateSettings) are loaded
  // separately by the caller (ReportPreview) and passed straight to
  // ReportRenderer, same as a real report - this only needs to build
  // the *content* half of the preview (the ReportSnapshot).
  const [profile, years, terms, template, levels, gradeBandsAll] = await Promise.all([
    SchoolService.getProfile(),
    AcademicYearService.getAll(),
    TermService.getAll(),
    ReportTemplateService.getByCode(templateCode),
    LevelService.getAll(),
    GradeBandService.getAll(),
  ]);

  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const activeTerm =
    terms.find((t) => t.isActive && (!currentYear || t.academicYearId === currentYear.id)) ?? terms[0];

  const wantsSkillChecklist = templateCode === "KG";
  const sampleLevelId = template?.appliesToLevelIds[0];
  const level =
    levels.find((l) => l.id === sampleLevelId) ??
    levels.find((l) => l.assessmentMode === (wantsSkillChecklist ? "skill-checklist" : "scored"));

  const school = {
    name: profile?.name ?? "Your School Name",
    schoolCode: profile?.schoolCode ?? "SAMPLE",
    circuit: profile?.circuit ?? "Sample Circuit",
    district: profile?.district ?? "Sample District",
    region: profile?.region ?? "Sample Region",
    postalAddress: profile?.postalAddress,
    digitalAddress: profile?.digitalAddress,
    telephone: profile?.telephone,
    email: profile?.email,
    logoDataUrl: profile?.logoDataUrl,
    motto: profile?.motto,
    reportHeader: profile?.reportHeader,
    reportFooter: profile?.reportFooter,
    officialSignatoryTitles: profile?.officialSignatoryTitles,
    reportWatermarkDataUrl: profile?.reportWatermarkDataUrl,
    headTeacherName: profile?.headTeacherName,
  };

  const learner = SAMPLE_LEARNER[templateCode];

  const term = {
    academicYearLabel: currentYear?.label ?? "2025/2026",
    termName: activeTerm?.termName ?? "Term 1",
    termNumber: (activeTerm?.termNumber ?? 1) as 1 | 2 | 3,
    vacationDate: activeTerm?.vacationDate ?? "",
    reopeningDate: activeTerm?.reopeningDate ?? "",
    totalSchoolDays: activeTerm?.totalSchoolDays ?? 60,
  };

  const totalSchoolDays = term.totalSchoolDays || 60;
  const attendance = {
    daysPresent: Math.round(totalSchoolDays * 0.94),
    totalSchoolDays,
    daysAbsent: totalSchoolDays - Math.round(totalSchoolDays * 0.94),
    attendancePercentage: 94,
  };

  const student = {
    studentId: "ACTRS-SAMPLE-000000",
    admissionNumber: "SAMPLE-0001",
    fullName: learner.fullName,
    gender: learner.gender,
    dateOfBirth: learner.dateOfBirth,
    ageAtGeneration: ageFromDob(learner.dateOfBirth),
    className: level ? `${level.name} (Sample Class)` : "Sample Class",
    levelName: level?.name ?? "Sample Level",
    guardianName: "Sample Parent/Guardian",
    guardianPhone: "0240000000",
  };

  if (templateCode === "KG") {
    const [learningAreas, skills] = await Promise.all([LearningAreaService.getAll(), SkillService.getAll()]);
    const activeAreas = learningAreas.filter((a) => a.isActive);
    const relevantAreas = level ? activeAreas.filter((a) => a.levelIds.includes(level.id!)) : activeAreas;
    const areaPool = relevantAreas.length > 0 ? relevantAreas : activeAreas;

    const learningAreaRows: ReportSnapshotLearningArea[] = areaPool
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((area) => {
        const areaSkills = skills
          .filter((sk) => sk.isActive && sk.learningAreaId === area.id && (!level || sk.levelId === level.id))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          learningAreaId: area.id!,
          name: area.name,
          skills: areaSkills.map((sk, i) => ({
            skillId: sk.id!,
            serialNumber: sk.serialNumber,
            description: sk.description,
            rating: KG_RATING_CYCLE[i % KG_RATING_CYCLE.length],
          })),
        };
      });

    return {
      templateCode,
      school,
      student,
      term,
      attendance,
      learningAreas: learningAreaRows,
      kgRemarks: {
        generalComment: "Sample learner shows steady progress across all learning areas this term.",
        areasForImprovement: "Continue practising fine motor skills and number recognition at home.",
        teacherRecommendation: "Ready to progress with continued support and encouragement.",
        classTeacherName: "Sample Class Teacher",
        headTeacherName: school.headTeacherName ?? "Sample Headteacher",
        progression: "Promoted",
      },
    };
  }

  // Scored levels: Lower Primary, Upper Primary, JHS.
  const subjectsAll = await SubjectService.getAll();
  const activeSubjects = subjectsAll.filter((s) => s.isActive);
  const relevantSubjects = level ? activeSubjects.filter((s) => s.levelIds.includes(level.id!)) : activeSubjects;
  const subjectPool = (relevantSubjects.length > 0 ? relevantSubjects : activeSubjects).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const bands = level
    ? resolveGradeBandsForLevel(gradeBandsAll, level.id!)
    : gradeBandsAll.filter((b) => b.isActive && !b.levelId);

  const subjectRows: ReportSnapshotSubjectRow[] = subjectPool.map((subj, i) => {
    const sba = SAMPLE_SBA_CYCLE[i % SAMPLE_SBA_CYCLE.length];
    const exam = SAMPLE_EXAM_CYCLE[i % SAMPLE_EXAM_CYCLE.length];
    const total = computeSubjectTotal(sba, exam);
    const band = findGradeBand(total, bands);
    return {
      subjectId: subj.id!,
      subjectName: subj.name,
      subjectCode: subj.code,
      sba,
      exam,
      total,
      gradeCode: band?.code,
      gradeLabel: band?.label,
      positionText: toOrdinal((i % 5) + 1),
    };
  });

  const totals = subjectRows.map((r) => r.total).filter((t): t is number => t !== null);
  const overallCalc = computeOverallForStudent(totals, bands);

  return {
    templateCode,
    school,
    student,
    term,
    attendance,
    subjects: subjectRows,
    overall: {
      total: overallCalc.total,
      average: Math.round(overallCalc.average * 100) / 100,
      gradeCode: overallCalc.grade?.code,
      gradeLabel: overallCalc.grade?.label,
      positionText: "3rd",
      classSize: 25,
    },
    scoredRemarks: {
      conductRemark: "Displays excellent conduct and cooperation in class.",
      interestRemark: "Shows keen interest in creative and practical activities.",
      attitudeRemark: "Maintains a positive attitude towards learning.",
      classTeacherRemark: "A hardworking learner - keep up the good effort.",
      headteacherRemark: "Impressive progress this term. Well done.",
      classTeacherName: "Sample Class Teacher",
      headTeacherName: school.headTeacherName ?? "Sample Headteacher",
      promotion: "Promoted to the next class",
    },
  };
}
