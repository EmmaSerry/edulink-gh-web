import * as XLSX from "xlsx";
import { db } from "@database/db";
import type { Student } from "@models/Student";
import { getFullName, calculateAge } from "@models/Student";
import { EnrollmentService } from "./EnrollmentService";
import { GuardianService } from "./GuardianService";
import { downloadBlob } from "@utils/downloadBlob";
import { sanitizeRowsForSpreadsheet } from "@utils/spreadsheetSafety";

export type ExportScope =
  | { type: "all" }
  | { type: "level"; levelId: number }
  | { type: "class"; classId: number }
  | { type: "selected"; studentIds: number[] };

export type ExportFileFormat = "xlsx" | "csv" | "json";

interface ExportRow {
  "Student ID": string;
  "Admission Number": string;
  "Name": string;
  "Gender": string;
  "Age": number;
  "Level": string;
  "Class": string;
  "Status": string;
  "Parent/Guardian": string;
  "Parent Phone": string;
}

/** Module 8 - Bulk Export. Builds one flat row per student (joining in
 *  current enrollment + guardian, since Student itself no longer stores
 *  class/level per the Enrollment-entity design) and writes it out via
 *  SheetJS (xlsx/csv) or a plain JSON Blob download. */
class ExportServiceImpl {
  private async resolveStudents(scope: ExportScope): Promise<Student[]> {
    const all = await db.students.toArray();
    if (scope.type === "all") return all;
    if (scope.type === "selected") return all.filter((s) => scope.studentIds.includes(s.id!));

    const enrollments = await db.enrollments.filter((e) => e.isCurrent).toArray();
    const matchingStudentIds = new Set(
      enrollments
        .filter((e) => (scope.type === "level" ? e.levelId === scope.levelId : e.classId === scope.classId))
        .map((e) => e.studentId),
    );
    return all.filter((s) => matchingStudentIds.has(s.id!));
  }

  private async buildRows(students: Student[]): Promise<ExportRow[]> {
    const [levels, classes] = await Promise.all([db.levels.toArray(), db.classes.toArray()]);

    const rows: ExportRow[] = [];
    for (const student of students) {
      const [enrollment, guardian] = await Promise.all([
        EnrollmentService.getCurrentEnrollment(student.id!),
        GuardianService.getByStudentId(student.id!),
      ]);
      const level = levels.find((l) => l.id === enrollment?.levelId);
      const cls = classes.find((c) => c.id === enrollment?.classId);

      rows.push({
        "Student ID": student.studentId,
        "Admission Number": student.admissionNumber ?? "",
        "Name": getFullName(student),
        "Gender": student.gender,
        "Age": calculateAge(student.dateOfBirth),
        "Level": level?.name ?? "—",
        "Class": cls?.name ?? "—",
        "Status": student.status,
        "Parent/Guardian": guardian?.fullName ?? "",
        "Parent Phone": guardian?.phone ?? "",
      });
    }
    return rows;
  }

  async export(scope: ExportScope, format: ExportFileFormat, fileNamePrefix = "students"): Promise<number> {
    const students = await this.resolveStudents(scope);
    const rows = await this.buildRows(students);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${fileNamePrefix}-${stamp}.json`);
      return rows.length;
    }

    const worksheet = XLSX.utils.json_to_sheet(sanitizeRowsForSpreadsheet(rows));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      downloadBlob(new Blob([csv], { type: "text/csv" }), `${fileNamePrefix}-${stamp}.csv`);
    } else {
      const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      downloadBlob(
        new Blob([arrayBuffer], { type: "application/octet-stream" }),
        `${fileNamePrefix}-${stamp}.xlsx`,
      );
    }
    return rows.length;
  }
}

export const ExportService = new ExportServiceImpl();
