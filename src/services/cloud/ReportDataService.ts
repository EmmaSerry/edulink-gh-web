/**
 * Cloud (Supabase-backed) replacement for src/services/ReportDataService.ts.
 *
 * This is the port of the two most important functions in the whole
 * report-card system: validateReportPrerequisites() and
 * buildClassSnapshots(). Deliberately kept structurally identical to
 * the original - same lookups, same per-subject ranking-by-subjectId
 * map (the exact mechanism the original's comments call out as the fix
 * for a real JHS Social Studies/Science mix-up bug), same "total/grade/
 * position are always derived, never stored" rule. Only the data-access
 * layer changed: REST reads instead of Dexie reads, snake_case rows
 * mapped to the same ReportSnapshot shape the templates/PdfService
 * already expect, string (UUID) ids instead of numeric ones.
 *
 * Nothing here writes anything - like the original, this only ASSEMBLES
 * a snapshot in memory. Freezing one into report_snapshots (the actual
 * "generate/finalize the report" action) is a separate, smaller step
 * built on top of this.
 */

import { rest } from "@/lib/supabaseClient";
import { CloudEnrollmentService } from "./EnrollmentService";
import { CloudGuardianService } from "./GuardianService";
import { CloudSchoolService } from "./SchoolService";
import { CloudGradeBandService } from "./GradeBandService";
import { CloudReportRecordService } from "./ReportRecordService";
import { CloudReportTemplateService } from "./ReportTemplateService";
import {
  computeSubjectTotal,
  findGradeBand,
  resolveGradeBandsForLevel,
  computeCompetitionRanking,
  computeOverallForStudent,
} from "@services/AssessmentCalculationEngine";
import { calculateAge } from "@models/Student";
import type {
  ReportSnapshot,
  ReportSnapshotSubjectRow,
  ReportSnapshotLearningArea,
} from "@reporting/ReportSnapshot.types";
import type {
  StudentRow,
  ClassRow,
  LevelRow,
  TermRow,
  AcademicYearRow,
  SubjectRow,
  ScoreRecordRow,
  ReportRecordRow,
  DistrictRow,
} from "@/types/database";

interface LearningAreaRow {
  id: string;
  name: string;
  level_ids: string[];
  sort_order: number;
  is_active: boolean;
}

interface SkillRow {
  id: string;
  learning_area_id: string;
  level_id: string;
  serial_number: number | null;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface SkillAssessmentRecordRow {
  student_id: string;
  skill_id: string;
  rating: "G" | "S" | "B" | "X" | "O" | null;
  comment: string | null;
}

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

function inList(ids: string[]): string {
  return `in.(${ids.join(",")})`;
}

export interface ReportValidationIssue {
  code: string;
  message: string;
}

export interface ReportValidationResult {
  valid: boolean;
  issues: ReportValidationIssue[];
  context?: { classId: string; levelId: string; templateCode: string };
}

/** Every prerequisite is checked before a report is allowed to be
 *  generated; the first failing check does not short-circuit the rest,
 *  so the teacher sees every problem at once. */
export async function validateReportPrerequisites(
  studentId: string,
  termId: string
): Promise<ReportValidationResult> {
  const issues: ReportValidationIssue[] = [];

  const [student] = await rest.select<StudentRow>("students", {
    filters: { id: `eq.${studentId}` },
    limit: 1,
  });
  if (!student) {
    issues.push({ code: "STUDENT_NOT_FOUND", message: "Student record was not found." });
    return { valid: false, issues };
  }

  const [enrollment] = await rest.select<{ class_id: string; level_id: string }>("enrollments", {
    select: "class_id,level_id",
    filters: { student_id: `eq.${studentId}`, term_id: `eq.${termId}` },
    limit: 1,
  });
  if (!enrollment) {
    issues.push({
      code: "NOT_ENROLLED",
      message: `${fullNameOf(student)} is not enrolled in any class for the selected term.`,
    });
    return { valid: false, issues };
  }

  const [session] = await rest.select<{ status: string }>("assessment_sessions", {
    select: "status",
    filters: { class_id: `eq.${enrollment.class_id}`, term_id: `eq.${termId}` },
    limit: 1,
  });
  if (!session || session.status !== "FINALIZED") {
    issues.push({
      code: "ASSESSMENT_NOT_FINALIZED",
      message: "This class's assessment for the selected term has not been finalized yet.",
    });
  }

  const [level] = await rest.select<LevelRow>("levels", {
    filters: { id: `eq.${enrollment.level_id}` },
    limit: 1,
  });
  const templateCode = await CloudReportTemplateService.resolveTemplateCodeForLevel(enrollment.level_id);
  if (!templateCode) {
    issues.push({
      code: "NO_TEMPLATE_MAPPED",
      message:
        "No report template is mapped to this student's level yet - configure one under Settings - Report Templates.",
    });
  }

  const reportRecord = await CloudReportRecordService.getForStudent(studentId, termId);
  const isKg = level?.assessment_mode === "skill-checklist";

  if (isKg) {
    if (!reportRecord?.general_comment?.trim()) {
      issues.push({ code: "MISSING_REMARKS", message: "The General Progress Comment has not been entered yet." });
    }
  } else if (!reportRecord?.class_teacher_remark?.trim()) {
    issues.push({ code: "MISSING_REMARKS", message: "The Class Teacher's Remark has not been entered yet." });
  }

  if (reportRecord?.days_present === undefined || reportRecord?.days_present === null) {
    issues.push({ code: "MISSING_ATTENDANCE", message: "Attendance (days present) has not been recorded yet." });
  }

  if (!reportRecord?.progression?.trim()) {
    issues.push({
      code: "MISSING_PROMOTION",
      message: isKg
        ? "The Progression decision has not been entered yet."
        : "The Promotion decision has not been entered yet.",
    });
  }

  const [term] = await rest.select<TermRow>("terms", { filters: { id: `eq.${termId}` }, limit: 1 });
  if (!term?.vacation_date || !term?.reopening_date || !term?.total_school_days) {
    issues.push({
      code: "INCOMPLETE_TERM",
      message: "This term's vacation date, reopening date or total school days are not fully configured.",
    });
  }

  const school = await CloudSchoolService.getProfile();
  if (!school?.name || !school?.school_code) {
    issues.push({
      code: "INCOMPLETE_SCHOOL_INFO",
      message: "School information is not fully configured yet - see School Setup.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    context:
      issues.length === 0 && templateCode
        ? { classId: enrollment.class_id, levelId: enrollment.level_id, templateCode }
        : undefined,
  };
}

/**
 * Builds the frozen ReportSnapshot for every currently-enrolled student
 * in one class+term in a single pass - class-wide subject rankings and
 * the overall ranking are computed ONCE and reused for every student,
 * so a batch export and a single reprint can never disagree.
 */
export async function buildClassSnapshots(classId: string, termId: string): Promise<Map<string, ReportSnapshot>> {
  const [cls] = await rest.select<ClassRow>("classes", { filters: { id: `eq.${classId}` }, limit: 1 });
  if (!cls) throw new Error("Class not found");
  const [level] = await rest.select<LevelRow>("levels", { filters: { id: `eq.${cls.level_id}` }, limit: 1 });
  if (!level) throw new Error("Level not found for this class");
  const templateCode = await CloudReportTemplateService.resolveTemplateCodeForLevel(cls.level_id);
  if (!templateCode) throw new Error("No report template is mapped to this level");

  const [term] = await rest.select<TermRow>("terms", { filters: { id: `eq.${termId}` }, limit: 1 });
  if (!term) throw new Error("Term not found");
  const [academicYear] = term.academic_year_id
    ? await rest.select<AcademicYearRow>("academic_years", { filters: { id: `eq.${term.academic_year_id}` }, limit: 1 })
    : [undefined];
  const school = await CloudSchoolService.getProfile();
  const [district] = school?.district_id
    ? await rest.select<DistrictRow>("districts", { filters: { id: `eq.${school.district_id}` }, limit: 1 })
    : [undefined];

  const enrollments = await CloudEnrollmentService.getRoster(termId, classId);
  const studentIds = enrollments.map((e) => e.student_id);
  const students =
    studentIds.length > 0
      ? await rest.select<StudentRow>("students", { filters: { id: inList(studentIds) } })
      : [];
  const reportRecords = await CloudReportRecordService.getForTerm(termId);
  const reportRecordByStudent = new Map<string, ReportRecordRow>(
    reportRecords.filter((r) => studentIds.includes(r.student_id)).map((r) => [r.student_id, r])
  );

  const schoolInfo = {
    name: school?.name ?? "",
    schoolCode: school?.school_code ?? "",
    circuit: school?.circuit ?? "",
    district: district?.name ?? "",
    region: school?.region ?? "",
    postalAddress: school?.postal_address ?? undefined,
    digitalAddress: school?.digital_address ?? undefined,
    telephone: school?.telephone ?? undefined,
    email: school?.email ?? undefined,
    logoDataUrl: school?.logo_data_url ?? undefined,
    motto: school?.motto ?? undefined,
    reportHeader: school?.report_header ?? undefined,
    reportFooter: school?.report_footer ?? undefined,
    officialSignatoryTitles: undefined,
    reportWatermarkDataUrl: undefined,
    headTeacherName: school?.head_teacher_name ?? undefined,
  };

  const termInfo = {
    academicYearLabel: academicYear?.label ?? "",
    termName: term.term_name,
    termNumber: term.term_number,
    vacationDate: term.vacation_date ?? "",
    reopeningDate: term.reopening_date ?? "",
    totalSchoolDays: term.total_school_days ?? 0,
  };

  const snapshots = new Map<string, ReportSnapshot>();

  if (level.assessment_mode === "skill-checklist") {
    // ---- KG: skills only, no calculations of any kind -----------------
    const learningAreas = (
      await rest.select<LearningAreaRow>("learning_areas", { filters: { is_active: "eq.true" } })
    ).filter((a) => a.level_ids.includes(cls.level_id));
    const skills = await rest.select<SkillRow>("skills", {
      filters: { level_id: `eq.${cls.level_id}`, is_active: "eq.true" },
    });
    const allRatings =
      studentIds.length > 0
        ? await rest.select<SkillAssessmentRecordRow>("skill_assessment_records", {
            filters: { term_id: `eq.${termId}` },
          })
        : [];

    for (const student of students) {
      const reportRecord = reportRecordByStudent.get(student.id);
      const guardian = await CloudGuardianService.getByStudentId(student.id);

      const learningAreaRows: ReportSnapshotLearningArea[] = [...learningAreas]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((area) => ({
          learningAreaId: area.id,
          name: area.name,
          skills: skills
            .filter((sk) => sk.learning_area_id === area.id)
            .sort((a, b) => a.sort_order - b.sort_order || (a.serial_number ?? 0) - (b.serial_number ?? 0))
            .map((sk) => {
              const rating = allRatings.find((r) => r.student_id === student.id && r.skill_id === sk.id);
              return {
                skillId: sk.id,
                serialNumber: sk.serial_number ?? 0,
                description: sk.description,
                rating: rating?.rating ?? null,
                comment: rating?.comment ?? undefined,
              };
            }),
        }));

      snapshots.set(student.id, {
        templateCode,
        school: schoolInfo,
        student: {
          studentId: student.student_id,
          admissionNumber: student.admission_number ?? "",
          fullName: fullNameOf(student),
          gender: student.gender,
          dateOfBirth: student.date_of_birth,
          ageAtGeneration: calculateAge(student.date_of_birth),
          className: cls.name,
          levelName: level.name,
          photoDataUrl: student.photo_url ?? undefined,
          guardianName: guardian?.full_name ?? undefined,
          guardianPhone: guardian?.phone ?? undefined,
        },
        term: termInfo,
        attendance: {
          daysPresent: reportRecord?.days_present ?? null,
          totalSchoolDays: term.total_school_days ?? 0,
          daysAbsent:
            reportRecord?.days_present !== undefined && reportRecord?.days_present !== null && term.total_school_days
              ? Math.max(0, term.total_school_days - reportRecord.days_present)
              : null,
          attendancePercentage:
            reportRecord?.days_present !== undefined &&
            reportRecord?.days_present !== null &&
            term.total_school_days &&
            term.total_school_days > 0
              ? Math.round((reportRecord.days_present / term.total_school_days) * 1000) / 10
              : null,
        },
        learningAreas: learningAreaRows,
        kgRemarks: {
          generalComment: reportRecord?.general_comment ?? undefined,
          areasForImprovement: reportRecord?.areas_for_improvement ?? undefined,
          teacherRecommendation: reportRecord?.teacher_recommendation ?? undefined,
          classTeacherName: reportRecord?.class_teacher_name ?? cls.class_teacher_name ?? undefined,
          headTeacherName: reportRecord?.head_teacher_name ?? school?.head_teacher_name ?? undefined,
          progression: reportRecord?.progression ?? undefined,
        },
      });
    }

    return snapshots;
  }

  // ---- Scored levels: Lower/Upper Primary, JHS -------------------------
  const subjects = (
    await rest.select<SubjectRow>("subjects", { filters: { is_active: "eq.true" } })
  )
    .filter((s) => s.level_ids.includes(cls.level_id))
    .sort((a, b) => a.sort_order - b.sort_order);

  const gradeBandsRaw = school ? await CloudGradeBandService.getAll(school.id) : [];
  const gradeBands = resolveGradeBandsForLevel(gradeBandsRaw, cls.level_id);

  const allScores =
    studentIds.length > 0
      ? await rest.select<ScoreRecordRow>("score_records", { filters: { term_id: `eq.${termId}` } })
      : [];

  // scoresByStudentAndSubject: the ONLY lookup used to build a subject's
  // Total/Grade/Position - keyed by [studentId, subjectId], so a
  // subject can never read another subject's number by accident.
  const scoresByStudentAndSubject = new Map<string, { sba: number | null; exam: number | null }>();
  for (const rec of allScores) {
    if (!studentIds.includes(rec.student_id)) continue;
    scoresByStudentAndSubject.set(`${rec.student_id}:${rec.subject_id}`, {
      sba: rec.sba_score,
      exam: rec.exam_score,
    });
  }

  // One competition ranking PER subject, computed independently.
  const rankingBySubject = new Map<string, Map<string, { positionText: string }>>();
  for (const subject of subjects) {
    const items = studentIds.map((sid) => {
      const cell = scoresByStudentAndSubject.get(`${sid}:${subject.id}`);
      const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
      return { studentId: sid, total };
    });
    const ranked = computeCompetitionRanking(items, (x) => x.total);
    rankingBySubject.set(subject.id, new Map(ranked.map((r) => [r.item.studentId, { positionText: r.positionText }])));
  }

  // Overall ranking, computed independently from any single subject.
  const overallItems = studentIds.map((sid) => {
    const totals: number[] = [];
    for (const subject of subjects) {
      const cell = scoresByStudentAndSubject.get(`${sid}:${subject.id}`);
      const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
      if (total !== null) totals.push(total);
    }
    const overall = computeOverallForStudent(totals, gradeBands);
    return { studentId: sid, average: totals.length > 0 ? overall.average : null };
  });
  const overallRanked = computeCompetitionRanking(overallItems, (x) => x.average);
  const overallRankByStudent = new Map(overallRanked.map((r) => [r.item.studentId, r.positionText]));

  for (const student of students) {
    const studentId = student.id;
    const reportRecord = reportRecordByStudent.get(studentId);

    const subjectRows: ReportSnapshotSubjectRow[] = subjects.map((subject) => {
      const cell = scoresByStudentAndSubject.get(`${studentId}:${subject.id}`);
      const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
      const band = findGradeBand(total, gradeBands);
      const positionText = rankingBySubject.get(subject.id)?.get(studentId)?.positionText;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code ?? subject.short_name ?? subject.name,
        sba: cell?.sba ?? null,
        exam: cell?.exam ?? null,
        total,
        gradeCode: band?.code,
        gradeLabel: band?.label,
        positionText,
      };
    });

    const scoredTotals = subjectRows.map((r) => r.total).filter((t): t is number => t !== null);
    const overall = computeOverallForStudent(scoredTotals, gradeBands);

    snapshots.set(studentId, {
      templateCode,
      school: schoolInfo,
      student: {
        studentId: student.student_id,
        admissionNumber: student.admission_number ?? "",
        fullName: fullNameOf(student),
        gender: student.gender,
        dateOfBirth: student.date_of_birth,
        ageAtGeneration: calculateAge(student.date_of_birth),
        className: cls.name,
        levelName: level.name,
        photoDataUrl: student.photo_url ?? undefined,
      },
      term: termInfo,
      attendance: {
        daysPresent: reportRecord?.days_present ?? null,
        totalSchoolDays: term.total_school_days ?? 0,
        daysAbsent:
          reportRecord?.days_present !== undefined && reportRecord?.days_present !== null && term.total_school_days
            ? Math.max(0, term.total_school_days - reportRecord.days_present)
            : null,
        attendancePercentage:
          reportRecord?.days_present !== undefined &&
          reportRecord?.days_present !== null &&
          term.total_school_days &&
          term.total_school_days > 0
            ? Math.round((reportRecord.days_present / term.total_school_days) * 1000) / 10
            : null,
      },
      subjects: subjectRows,
      overall: {
        total: scoredTotals.reduce((s, t) => s + t, 0),
        average: overall.average,
        gradeCode: overall.grade?.code,
        gradeLabel: overall.grade?.label,
        positionText: overallRankByStudent.get(studentId),
        classSize: studentIds.length,
      },
      scoredRemarks: {
        conductRemark: reportRecord?.conduct_remark ?? undefined,
        interestRemark: reportRecord?.interest_remark ?? undefined,
        attitudeRemark: reportRecord?.attitude_remark ?? undefined,
        classTeacherRemark: reportRecord?.class_teacher_remark ?? undefined,
        headteacherRemark: reportRecord?.headteacher_remark ?? undefined,
        classTeacherName: reportRecord?.class_teacher_name ?? undefined,
        headTeacherName: reportRecord?.head_teacher_name ?? school?.head_teacher_name ?? undefined,
        promotion: reportRecord?.progression ?? undefined,
      },
    });
  }

  return snapshots;
}

export async function buildSnapshotForStudent(studentId: string, termId: string): Promise<ReportSnapshot> {
  const [enrollment] = await rest.select<{ class_id: string }>("enrollments", {
    select: "class_id",
    filters: { student_id: `eq.${studentId}`, term_id: `eq.${termId}` },
    limit: 1,
  });
  if (!enrollment) throw new Error("Student is not enrolled for this term");
  const snapshots = await buildClassSnapshots(enrollment.class_id, termId);
  const snapshot = snapshots.get(studentId);
  if (!snapshot) throw new Error("Could not build a report snapshot for this student");
  return snapshot;
}
