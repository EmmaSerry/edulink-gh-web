import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import { getFullName, calculateAge } from "@models/Student";
import type { Student } from "@models/Student";

export interface StudentDirectoryRow {
  student: Student;
  fullName: string;
  age: number;
  levelId?: number;
  levelName: string;
  classId?: number;
  className: string;
  termId?: number;
  academicYearId?: number;
  guardianName: string;
  guardianPhone: string;
}

/**
 * Joins Student + current Enrollment + Guardian into flat rows for the
 * Students directory, search, filters and class lists. Centralised here
 * so every screen (Students list, Class Register, Dashboard analytics)
 * builds the same shape the same way.
 */
export function useStudentDirectory() {
  return useLiveQuery(async (): Promise<StudentDirectoryRow[]> => {
    const [students, enrollments, guardians, levels, classes] = await Promise.all([
      db.students.toArray(),
      db.enrollments.filter((e) => e.isCurrent).toArray(),
      db.guardians.toArray(),
      db.levels.toArray(),
      db.classes.toArray(),
    ]);

    const enrollmentByStudent = new Map(enrollments.map((e) => [e.studentId, e]));
    const guardianByStudent = new Map(guardians.map((g) => [g.studentId, g]));
    const levelById = new Map(levels.map((l) => [l.id, l]));
    const classById = new Map(classes.map((c) => [c.id, c]));

    return students.map((student) => {
      const enrollment = enrollmentByStudent.get(student.id!);
      const guardian = guardianByStudent.get(student.id!);
      const level = enrollment ? levelById.get(enrollment.levelId) : undefined;
      const cls = enrollment ? classById.get(enrollment.classId) : undefined;

      return {
        student,
        fullName: getFullName(student),
        age: calculateAge(student.dateOfBirth),
        levelId: enrollment?.levelId,
        levelName: level?.name ?? "Not enrolled",
        classId: enrollment?.classId,
        className: cls?.name ?? "—",
        termId: enrollment?.termId,
        academicYearId: enrollment?.academicYearId,
        guardianName: guardian?.fullName ?? "",
        guardianPhone: guardian?.phone ?? "",
      };
    });
  }, []);
}
