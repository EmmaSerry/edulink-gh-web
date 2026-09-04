import { db } from "@database/db";
import { EnrollmentService } from "./EnrollmentService";
import { computeSubjectTotal } from "./AssessmentCalculationEngine";
import type { AssessmentSession, AssessmentSessionStatus } from "@models/AssessmentSession";

export interface ClassAssessmentSummary {
  classId: number;
  termId: number;
  levelId: number;
  assessmentMode: "scored" | "skill-checklist";
  /** Undefined = a teacher has never opened this class+term for
   *  assessment yet (no session row exists). Dashboard reads must never
   *  create a session as a side effect of being viewed. */
  session: AssessmentSession | undefined;
  status: AssessmentSessionStatus | "NOT_STARTED";
  totalStudents: number;
  fullyAssessedStudents: number;
  missingStudentNames: string[];
  lastSavedAt?: string;
}

/** Read-only progress computation shared by the Assessment Dashboard
 *  (Module 1, class-by-class table) and the assessment workspace
 *  (Module 3/8 completion badges). Never creates or mutates a session -
 *  that only happens when a teacher explicitly opens a class to work on
 *  it (see AssessmentSessionService.getOrCreate). */
export async function getClassAssessmentSummary(
  classId: number,
  termId: number,
): Promise<ClassAssessmentSummary> {
  const cls = await db.classes.get(classId);
  const levelId = cls?.levelId ?? 0;
  const level = levelId ? await db.levels.get(levelId) : undefined;
  const assessmentMode = level?.assessmentMode ?? "scored";

  const session = await db.assessmentSessions
    .where("[classId+termId]")
    .equals([classId, termId])
    .first();

  const enrollments = await EnrollmentService.getRoster(termId, classId);
  const studentIds = enrollments.map((e) => e.studentId);

  let fullyAssessed = 0;
  const missingStudentNames: string[] = [];

  if (studentIds.length > 0) {
    const students = await db.students.bulkGet(studentIds);

    if (assessmentMode === "skill-checklist") {
      const learningAreas = await db.learningAreas.filter((a) => a.isActive && a.levelIds.includes(levelId)).toArray();
      const skills = await db.skills.where("levelId").equals(levelId).filter((sk) => sk.isActive).toArray();
      const relevantSkillIds = new Set(
        skills.filter((sk) => learningAreas.some((a) => a.id === sk.learningAreaId)).map((sk) => sk.id!),
      );
      const allRatings = await db.skillAssessmentRecords.where("termId").equals(termId).toArray();

      studentIds.forEach((studentId, i) => {
        const ratedSkillIds = new Set(
          allRatings
            .filter((r) => r.studentId === studentId && relevantSkillIds.has(r.skillId) && r.rating)
            .map((r) => r.skillId),
        );
        const complete = relevantSkillIds.size > 0 && [...relevantSkillIds].every((id) => ratedSkillIds.has(id));
        if (complete) fullyAssessed++;
        else missingStudentNames.push(students[i] ? `${students[i]!.firstName} ${students[i]!.lastName}` : `#${studentId}`);
      });
    } else {
      const subjects = await db.subjects.filter((s) => s.isActive && s.levelIds.includes(levelId)).toArray();
      const allScores = await db.scoreRecords.where("termId").equals(termId).toArray();

      studentIds.forEach((studentId, i) => {
        const scores = allScores.filter((s) => s.studentId === studentId);
        const complete =
          subjects.length > 0 &&
          subjects.every((subj) => {
            const rec = scores.find((s) => s.subjectId === subj.id);
            return rec && computeSubjectTotal(rec.sbaScore, rec.examScore) !== null;
          });
        if (complete) fullyAssessed++;
        else missingStudentNames.push(students[i] ? `${students[i]!.firstName} ${students[i]!.lastName}` : `#${studentId}`);
      });
    }
  }

  return {
    classId,
    termId,
    levelId,
    assessmentMode,
    session,
    status: session?.status ?? "NOT_STARTED",
    totalStudents: studentIds.length,
    fullyAssessedStudents: fullyAssessed,
    missingStudentNames,
    lastSavedAt: session?.lastSavedAt,
  };
}

/** Bulk variant for the Dashboard's class table - runs the per-class
 *  summary for every active class in one pass. */
export async function getAllClassSummaries(termId: number): Promise<ClassAssessmentSummary[]> {
  const activeClasses = await db.classes.filter((c) => c.isActive).toArray();
  return Promise.all(activeClasses.map((c) => getClassAssessmentSummary(c.id!, termId)));
}
