import { db } from "@database/db";
import { getFullName, calculateAge } from "@models/Student";
import { EnrollmentService } from "./EnrollmentService";
import { GuardianService } from "./GuardianService";
import { SchoolService } from "./SchoolService";
import { GradeBandService } from "./GradeBandService";
import { ReportRecordService } from "./ReportRecordService";
import { ReportTemplateService } from "./ReportTemplateService";
import {
  computeSubjectTotal,
  findGradeBand,
  resolveGradeBandsForLevel,
  computeCompetitionRanking,
  computeOverallForStudent,
} from "./AssessmentCalculationEngine";
import type {
  ReportSnapshot,
  ReportSnapshotSubjectRow,
  ReportSnapshotLearningArea,
} from "@reporting/ReportSnapshot.types";
import type { ReportTemplateCode } from "@models/ReportTemplate";

export interface ReportValidationIssue {
  code: string;
  message: string;
}

export interface ReportValidationResult {
  valid: boolean;
  issues: ReportValidationIssue[];
  /** Populated when valid, so a caller that just validated doesn't need
   *  a second round of lookups to learn the class/level/mode. */
  context?: { classId: number; levelId: number; templateCode: ReportTemplateCode };
}

/**
 * Module 11 - Report Validation. Every prerequisite is checked before a
 * report is allowed to be generated; the first failing check does not
 * short-circuit the rest, so the teacher sees every problem at once
 * instead of fixing them one at a time.
 */
export async function validateReportPrerequisites(studentId: number, termId: number): Promise<ReportValidationResult> {
  const issues: ReportValidationIssue[] = [];

  const student = await db.students.get(studentId);
  if (!student) {
    issues.push({ code: "STUDENT_NOT_FOUND", message: "Student record was not found." });
    return { valid: false, issues };
  }

  const enrollment = await db.enrollments.where("[studentId+termId]").equals([studentId, termId]).first();
  if (!enrollment) {
    issues.push({
      code: "NOT_ENROLLED",
      message: `${getFullName(student)} is not enrolled in any class for the selected term.`,
    });
    return { valid: false, issues };
  }

  const session = await db.assessmentSessions
    .where("[classId+termId]")
    .equals([enrollment.classId, termId])
    .first();
  if (!session || session.status !== "FINALIZED") {
    issues.push({
      code: "ASSESSMENT_NOT_FINALIZED",
      message: "This class's assessment for the selected term has not been finalized yet.",
    });
  }

  const level = await db.levels.get(enrollment.levelId);
  const templateCode = await ReportTemplateService.resolveTemplateCodeForLevel(enrollment.levelId);
  if (!templateCode) {
    issues.push({
      code: "NO_TEMPLATE_MAPPED",
      message: "No report template is mapped to this student's level yet - configure one under Settings - Report Templates.",
    });
  }

  const reportRecord = await ReportRecordService.getForStudent(studentId, termId);
  const isKg = level?.assessmentMode === "skill-checklist";

  if (isKg) {
    if (!reportRecord?.generalComment?.trim()) {
      issues.push({ code: "MISSING_REMARKS", message: "The General Progress Comment has not been entered yet." });
    }
  } else if (!reportRecord?.classTeacherRemark?.trim()) {
    issues.push({ code: "MISSING_REMARKS", message: "The Class Teacher's Remark has not been entered yet." });
  }

  if (reportRecord?.daysPresent === undefined || reportRecord?.daysPresent === null) {
    issues.push({ code: "MISSING_ATTENDANCE", message: "Attendance (days present) has not been recorded yet." });
  }

  if (!reportRecord?.progression?.trim()) {
    issues.push({
      code: "MISSING_PROMOTION",
      message: isKg ? "The Progression decision has not been entered yet." : "The Promotion decision has not been entered yet.",
    });
  }

  const term = await db.terms.get(termId);
  if (!term?.vacationDate || !term?.reopeningDate || !term?.totalSchoolDays) {
    issues.push({
      code: "INCOMPLETE_TERM",
      message: "This term's vacation date, reopening date or total school days are not fully configured.",
    });
  }

  const school = await SchoolService.getProfile();
  if (!school?.name || !school?.schoolCode) {
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
        ? { classId: enrollment.classId, levelId: enrollment.levelId, templateCode }
        : undefined,
  };
}

/**
 * Builds the frozen `ReportSnapshot` for every currently-enrolled student
 * in one class+term in a single pass, computing class-wide subject
 * rankings and overall rankings ONCE and reusing them for every
 * student's snapshot - the same total/grade/position values a batch
 * generation (Module 9) and a single-student report (Module 3-6) must
 * agree on, because they are computed by literally the same call.
 *
 * IMPORTANT (JHS Social Studies/Science bug fix): every subject's Total
 * and Position are looked up from a map keyed by that subject's own
 * `subjectId` (`rankingsBySubject.get(subject.id)` /
 * `scoresByStudentAndSubject.get(...)`) - there is no field name or
 * column position anywhere in this function that could cause one
 * subject's row to accidentally display another subject's value, unlike
 * the old Word mail-merge template's copy-pasted merge field.
 */
export async function buildClassSnapshots(classId: number, termId: number): Promise<Map<number, ReportSnapshot>> {
  const cls = await db.classes.get(classId);
  if (!cls) throw new Error("Class not found");
  const level = await db.levels.get(cls.levelId);
  if (!level) throw new Error("Level not found for this class");
  const templateCode = await ReportTemplateService.resolveTemplateCodeForLevel(cls.levelId);
  if (!templateCode) throw new Error("No report template is mapped to this level");

  const term = await db.terms.get(termId);
  if (!term) throw new Error("Term not found");
  const academicYear = await db.academicYears.get(term.academicYearId);
  const school = await SchoolService.getProfile();

  const enrollments = await EnrollmentService.getRoster(termId, classId);
  const studentIds = enrollments.map((e) => e.studentId);
  const students = await db.students.bulkGet(studentIds);
  const reportRecords = await ReportRecordService.getForTerm(termId);
  const reportRecordByStudent = new Map(reportRecords.filter((r) => studentIds.includes(r.studentId)).map((r) => [r.studentId, r]));

  const schoolInfo = {
    name: school?.name ?? "",
    schoolCode: school?.schoolCode ?? "",
    circuit: school?.circuit ?? "",
    district: school?.district ?? "",
    region: school?.region ?? "",
    postalAddress: school?.postalAddress,
    digitalAddress: school?.digitalAddress,
    telephone: school?.telephone,
    email: school?.email,
    logoDataUrl: school?.logoDataUrl,
    motto: school?.motto,
    reportHeader: school?.reportHeader,
    reportFooter: school?.reportFooter,
    officialSignatoryTitles: school?.officialSignatoryTitles,
    reportWatermarkDataUrl: school?.reportWatermarkDataUrl,
    headTeacherName: school?.headTeacherName,
  };

  const termInfo = {
    academicYearLabel: academicYear?.label ?? "",
    termName: term.termName,
    termNumber: term.termNumber,
    vacationDate: term.vacationDate,
    reopeningDate: term.reopeningDate,
    totalSchoolDays: term.totalSchoolDays,
  };

  const snapshots = new Map<number, ReportSnapshot>();

  if (level.assessmentMode === "skill-checklist") {
    // ---- KG: skills only, no calculations of any kind -----------------
    const learningAreas = await db.learningAreas.filter((a) => a.isActive && a.levelIds.includes(cls.levelId)).toArray();
    const skills = await db.skills.where("levelId").equals(cls.levelId).filter((s) => s.isActive).toArray();
    const allRatings = await db.skillAssessmentRecords.where("termId").equals(termId).toArray();

    for (let i = 0; i < studentIds.length; i++) {
      const student = students[i];
      if (!student) continue;
      const guardian = await GuardianService.getByStudentId(student.id!);
      const reportRecord = reportRecordByStudent.get(student.id!);

      const learningAreaRows: ReportSnapshotLearningArea[] = learningAreas
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((area) => ({
          learningAreaId: area.id!,
          name: area.name,
          skills: skills
            .filter((sk) => sk.learningAreaId === area.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.serialNumber - b.serialNumber)
            .map((sk) => {
              const rating = allRatings.find((r) => r.studentId === student.id && r.skillId === sk.id);
              return {
                skillId: sk.id!,
                serialNumber: sk.serialNumber,
                description: sk.description,
                rating: rating?.rating ?? null,
                comment: rating?.comment,
              };
            }),
        }));

      snapshots.set(student.id!, {
        templateCode,
        school: schoolInfo,
        student: {
          studentId: student.studentId,
          admissionNumber: student.admissionNumber ?? "",
          fullName: getFullName(student),
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          ageAtGeneration: calculateAge(student.dateOfBirth),
          className: cls.name,
          levelName: level.name,
          photoDataUrl: student.photoDataUrl,
          guardianName: guardian?.fullName,
          guardianPhone: guardian?.phone,
        },
        term: termInfo,
        attendance: {
          daysPresent: reportRecord?.daysPresent ?? null,
          totalSchoolDays: term.totalSchoolDays,
          daysAbsent:
            reportRecord?.daysPresent !== undefined && reportRecord?.daysPresent !== null
              ? Math.max(0, term.totalSchoolDays - reportRecord.daysPresent)
              : null,
          attendancePercentage:
            reportRecord?.daysPresent !== undefined && reportRecord?.daysPresent !== null && term.totalSchoolDays > 0
              ? Math.round((reportRecord.daysPresent / term.totalSchoolDays) * 1000) / 10
              : null,
        },
        learningAreas: learningAreaRows,
        kgRemarks: {
          generalComment: reportRecord?.generalComment,
          areasForImprovement: reportRecord?.areasForImprovement,
          teacherRecommendation: reportRecord?.teacherRecommendation,
          classTeacherName: reportRecord?.classTeacherName ?? cls.classTeacherName,
          headTeacherName: reportRecord?.headTeacherName ?? school?.headTeacherName,
          progression: reportRecord?.progression,
        },
      });
    }

    return snapshots;
  }

  // ---- Scored levels: Lower/Upper Primary, JHS ------------------------
  const subjects = (await db.subjects.filter((s) => s.isActive && s.levelIds.includes(cls.levelId)).toArray()).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const gradeBandsRaw = await GradeBandService.getAll();
  const gradeBands = resolveGradeBandsForLevel(gradeBandsRaw, cls.levelId);
  const allScores = await db.scoreRecords.where("termId").equals(termId).toArray();

  // scoresByStudentAndSubject: the ONLY lookup table used to build a
  // subject's Total/Grade/Position - keyed by [studentId, subjectId], so
  // a subject can never read another subject's number by accident.
  const scoresByStudentAndSubject = new Map<string, { sba: number | null; exam: number | null }>();
  for (const rec of allScores) {
    if (!studentIds.includes(rec.studentId)) continue;
    scoresByStudentAndSubject.set(`${rec.studentId}:${rec.subjectId}`, { sba: rec.sbaScore, exam: rec.examScore });
  }

  // One competition ranking PER subject, computed independently.
  const rankingBySubject = new Map<number, Map<number, { positionText: string }>>();
  for (const subject of subjects) {
    const items = studentIds.map((sid) => {
      const cell = scoresByStudentAndSubject.get(`${sid}:${subject.id}`);
      const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
      return { studentId: sid, total };
    });
    const ranked = computeCompetitionRanking(items, (x) => x.total);
    rankingBySubject.set(subject.id!, new Map(ranked.map((r) => [r.item.studentId, { positionText: r.positionText }])));
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

  for (let i = 0; i < studentIds.length; i++) {
    const student = students[i];
    if (!student) continue;
    const studentId = student.id!;
    const reportRecord = reportRecordByStudent.get(studentId);

    const subjectRows: ReportSnapshotSubjectRow[] = subjects.map((subject) => {
      const cell = scoresByStudentAndSubject.get(`${studentId}:${subject.id}`);
      const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
      const band = findGradeBand(total, gradeBands);
      const positionText = rankingBySubject.get(subject.id!)?.get(studentId)?.positionText;
      return {
        subjectId: subject.id!,
        subjectName: subject.name,
        subjectCode: subject.code,
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
        studentId: student.studentId,
        admissionNumber: student.admissionNumber ?? "",
        fullName: getFullName(student),
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        ageAtGeneration: calculateAge(student.dateOfBirth),
        className: cls.name,
        levelName: level.name,
        photoDataUrl: student.photoDataUrl,
      },
      term: termInfo,
      attendance: {
        daysPresent: reportRecord?.daysPresent ?? null,
        totalSchoolDays: term.totalSchoolDays,
        daysAbsent:
          reportRecord?.daysPresent !== undefined && reportRecord?.daysPresent !== null
            ? Math.max(0, term.totalSchoolDays - reportRecord.daysPresent)
            : null,
        attendancePercentage:
          reportRecord?.daysPresent !== undefined && reportRecord?.daysPresent !== null && term.totalSchoolDays > 0
            ? Math.round((reportRecord.daysPresent / term.totalSchoolDays) * 1000) / 10
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
        conductRemark: reportRecord?.conductRemark,
        interestRemark: reportRecord?.interestRemark,
        attitudeRemark: reportRecord?.attitudeRemark,
        classTeacherRemark: reportRecord?.classTeacherRemark,
        headteacherRemark: reportRecord?.headteacherRemark,
        classTeacherName: reportRecord?.classTeacherName ?? cls.classTeacherName,
        headTeacherName: reportRecord?.headTeacherName ?? school?.headTeacherName,
        promotion: reportRecord?.progression,
      },
    });
  }

  return snapshots;
}

export async function buildSnapshotForStudent(studentId: number, termId: number): Promise<ReportSnapshot> {
  const enrollment = await db.enrollments.where("[studentId+termId]").equals([studentId, termId]).first();
  if (!enrollment) throw new Error("Student is not enrolled for this term");
  const snapshots = await buildClassSnapshots(enrollment.classId, termId);
  const snapshot = snapshots.get(studentId);
  if (!snapshot) throw new Error("Could not build a report snapshot for this student");
  return snapshot;
}
