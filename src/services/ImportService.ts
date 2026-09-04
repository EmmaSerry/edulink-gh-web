import * as XLSX from "xlsx";
import { db } from "@database/db";
import { GuardianService } from "./GuardianService";
import { EnrollmentService } from "./EnrollmentService";
import { StudentIdService } from "./StudentIdService";
import { downloadBlob } from "@utils/downloadBlob";
import type { ImportError, ImportLogEntry } from "@models/ImportLog";
import type { Sex } from "@models/Student";
import type { Level } from "@models/Level";
import type { SchoolClass } from "@models/SchoolClass";
import type { AcademicYear } from "@models/AcademicYear";

/** Normalizes a level/class code or name for lenient matching - strips
 *  all whitespace and lowercases, so "BASIC 5", "Basic5" and the
 *  seeded code "BASIC5" all resolve to the same level/class. Real
 *  school spreadsheets (and this file's own generated import
 *  template, see TEMPLATE_EXAMPLE_ROW below) naturally write these as
 *  spaced display names ("Basic 5"), not raw internal codes
 *  ("BASIC5") - matching by exact code alone silently dropped every
 *  row of a real import file that used natural formatting, with the
 *  failure only surfacing after commit, never in the review/validate
 *  preview step. */
function normalizeMatchKey(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

interface ResolvedRowTargets {
  level?: Level;
  cls?: SchoolClass;
  year?: AcademicYear;
  error?: string;
}

/** Resolves a row's Level/Class/Academic Year against what's actually
 *  configured, matching each against BOTH its code and its display
 *  name (see normalizeMatchKey). Used by both validateRows() (so an
 *  unresolvable level/class/year shows up as a review-step error, not
 *  a silent commit-time drop) and commitImport() (the actual write),
 *  so preview and commit can never disagree about which rows will
 *  succeed. */
/** Builds the same-person matching key used for duplicate detection:
 *  normalized first name + last name + calendar date of birth. Returns
 *  null for an unparseable date rather than throwing, so a row with a
 *  bad date just skips this check (its own "not a valid date" error
 *  already covers that case separately). */
function nameDobKey(firstName: string, lastName: string, dateOfBirth: string): string | null {
  const parsed = new Date(dateOfBirth);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${normalizeMatchKey(firstName)}|${normalizeMatchKey(lastName)}|${parsed.toISOString().slice(0, 10)}`;
}

function resolveRowTargets(
  data: Record<string, string>,
  levels: Level[],
  classes: SchoolClass[],
  years: AcademicYear[],
): ResolvedRowTargets {
  const levelKey = normalizeMatchKey(data.levelCode);
  const level = levels.find((l) => normalizeMatchKey(l.code) === levelKey || normalizeMatchKey(l.name) === levelKey);

  const classKey = normalizeMatchKey(data.classCode);
  const cls = classes.find(
    (c) => c.levelId === level?.id && (normalizeMatchKey(c.code) === classKey || normalizeMatchKey(c.name) === classKey),
  );

  const yearKey = normalizeMatchKey(data.academicYearLabel);
  const year = years.find((y) => normalizeMatchKey(y.label) === yearKey);

  if (!level || !cls || !year) {
    return {
      level,
      cls,
      year,
      error: `Could not match Level "${data.levelCode}" / Class "${data.classCode}" / Academic Year "${data.academicYearLabel}" to anything configured under Settings - Levels & Classes / Academic Years. Check spelling and that the academic year has been created.`,
    };
  }
  return { level, cls, year };
}

/**
 * Bulk student import (Module 7): .xlsx and .csv, both handled by
 * SheetJS's unified `read`/`utils.sheet_to_json` API. The wizard is a
 * three-step flow the Students page drives:
 *   1. parseFile()      -> raw headers + rows
 *   2. autoMapColumns()  + validateRows() -> preview with per-row errors
 *   3. commitImport()   -> writes only the valid rows, logs the run
 */

/** System field -> acceptable spreadsheet header names (case-insensitive). */
const FIELD_ALIASES: Record<string, string[]> = {
  admissionNumber: ["admission number", "admissionnumber", "admission no", "adm no"],
  emisNumber: ["emis number", "emisnumber", "emis"],
  ghanaCardNumber: ["ghana card number", "ghana card", "ghanacard"],
  firstName: ["first name", "firstname"],
  middleName: ["middle name", "middlename"],
  lastName: ["last name", "lastname", "surname"],
  preferredName: ["preferred name", "preferredname", "nickname"],
  gender: ["gender", "sex"],
  dateOfBirth: ["date of birth", "dateofbirth", "dob"],
  nationality: ["nationality"],
  admissionDate: ["admission date", "admissiondate"],
  previousSchool: ["previous school", "previousschool"],
  academicYearLabel: ["academic year", "academic year of admission", "year of admission"],
  levelCode: ["level", "level code"],
  classCode: ["class", "class code"],
  guardianFullName: ["parent name", "guardian name", "parent/guardian name"],
  guardianRelationship: ["relationship"],
  guardianPhone: ["parent phone", "guardian phone", "phone number", "phone", "parent/guardian phone"],
  guardianEmail: ["email", "parent email", "guardian email"],
};

/** Human-readable spreadsheet header for each system field - used both
 *  by the Import Wizard's column-mapping screen and by
 *  generateTemplate() below, so the downloadable template and the
 *  mapping screen always agree on what a field is called. Every label
 *  here is deliberately one of that field's own recognised aliases
 *  above (lowercased), so a school that fills in the generated template
 *  unmodified and re-uploads it gets auto-mapped correctly. */
export const FIELD_LABELS: Record<string, string> = {
  admissionNumber: "Admission Number",
  emisNumber: "EMIS Number",
  firstName: "First Name",
  middleName: "Middle Name",
  lastName: "Last Name",
  preferredName: "Preferred Name",
  gender: "Gender",
  dateOfBirth: "Date of Birth",
  nationality: "Nationality",
  admissionDate: "Admission Date",
  previousSchool: "Previous School",
  academicYearLabel: "Academic Year",
  levelCode: "Level",
  classCode: "Class",
  guardianFullName: "Parent/Guardian Name",
  guardianRelationship: "Relationship",
  guardianPhone: "Parent/Guardian Phone",
  guardianEmail: "Parent/Guardian Email",
};

/** Admission Number and Admission Date are intentionally NOT required -
 *  some schools don't have either on hand when bulk-registering students
 *  (Admission Number may eventually be auto-generated under rules
 *  configured later), matching Student Registration's own fields. */
export const REQUIRED_IMPORT_FIELDS = [
  "firstName",
  "lastName",
  "gender",
  "dateOfBirth",
  "nationality",
  "academicYearLabel",
  "levelCode",
  "classCode",
  "guardianFullName",
  "guardianRelationship",
  "guardianPhone",
] as const;

/** Realistic placeholder values for generateTemplate()'s one example
 *  row - shows the expected format (M/F for gender, YYYY-MM-DD for
 *  dates) without the school needing to guess. */
const TEMPLATE_EXAMPLE_ROW: Record<string, string> = {
  firstName: "Kwame",
  lastName: "Mensah",
  gender: "M",
  dateOfBirth: "2018-03-14",
  nationality: "Ghanaian",
  academicYearLabel: "2025/2026",
  levelCode: "Basic 1",
  classCode: "Basic 1",
  guardianFullName: "Ama Mensah",
  guardianRelationship: "Mother",
  guardianPhone: "0244000000",
};

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

export type ColumnMapping = Record<string, string | null>;

export interface ValidatedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ValidationResult {
  validRows: ValidatedRow[];
  invalidRows: ValidatedRow[];
  duplicateCount: number;
}

class ImportServiceImpl {
  /** Module 7 addition: a ready-to-fill .xlsx template so a school
   *  doesn't have to guess what to name its columns. Only the fields
   *  Student Registration itself treats as mandatory are included -
   *  optional fields (Admission Number, EMIS Number, Admission Date,
   *  etc.) are left off entirely so the sheet a school gets back is as
   *  short as it can be, with one example row showing the expected
   *  format (M/F for gender, YYYY-MM-DD for dates) before the school's
   *  own rows. Headers match REQUIRED_IMPORT_FIELDS' own recognised
   *  aliases, so re-uploading the filled-in template auto-maps
   *  perfectly on the next step of this same wizard. */
  generateTemplate(): void {
    const headers = REQUIRED_IMPORT_FIELDS.map((field) => FIELD_LABELS[field]);
    const exampleRow = REQUIRED_IMPORT_FIELDS.map((field) => TEMPLATE_EXAMPLE_ROW[field] ?? "");
    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    worksheet["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([arrayBuffer], { type: "application/octet-stream" }),
      "ACTRS-Student-Import-Template.xlsx",
    );
  }

  async parseFile(file: File): Promise<ParsedSheet> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const json: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    return { headers, rows: json };
  }

  autoMapColumns(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};
    const normalisedHeaders = headers.map((h) => ({ original: h, norm: h.trim().toLowerCase() }));

    for (const field of Object.keys(FIELD_ALIASES)) {
      const aliases = FIELD_ALIASES[field];
      const match = normalisedHeaders.find((h) => aliases.includes(h.norm));
      mapping[field] = match?.original ?? null;
    }
    return mapping;
  }

  /** Applies the column mapping and validates every row, checking
   *  required fields, gender/date formats, and duplicates both within
   *  the file and against students already in the database. */
  async validateRows(rows: Record<string, string>[], mapping: ColumnMapping): Promise<ValidationResult> {
    const existingStudents = await db.students.toArray();
    const [levels, classes, years] = await Promise.all([
      db.levels.toArray(),
      db.classes.toArray(),
      db.academicYears.toArray(),
    ]);
    const existingAdmissionNumbers = new Set(
      existingStudents.filter((s) => s.admissionNumber).map((s) => s.admissionNumber!.toLowerCase()),
    );
    const existingEmisNumbers = new Set(
      existingStudents.filter((s) => s.emisNumber).map((s) => s.emisNumber!.toLowerCase()),
    );

    // Name + date-of-birth duplicate detection. Admission/EMIS numbers
    // are the only OTHER duplicate signal this importer has, and both
    // are optional fields most schools' onboarding sheets simply don't
    // include - which meant re-uploading a sheet that mixed newly
    // added students with ones already imported silently created a
    // second, duplicate student record for every name that had already
    // been onboarded, with nothing anywhere flagging it. This is a
    // best-effort safety net, not a hard identity check (two genuinely
    // different learners could coincidentally share a name and
    // birthdate) - it surfaces a clear, reviewable error rather than
    // silently blocking, and names the class the existing record is in
    // so a reviewer can tell at a glance whether it's the same student.
    const existingEnrollments = await db.enrollments.toArray();
    const currentClassIdByStudentId = new Map<number, number>();
    for (const e of existingEnrollments) {
      if (e.isCurrent) currentClassIdByStudentId.set(e.studentId, e.classId);
    }
    const classNameById = new Map(classes.map((c) => [c.id!, c.name]));
    const existingByNameDob = new Map<string, string[]>(); // key -> class name(s) of matching existing student(s)
    for (const s of existingStudents) {
      const key = nameDobKey(s.firstName, s.lastName, s.dateOfBirth);
      if (!key) continue;
      const classId = s.id ? currentClassIdByStudentId.get(s.id) : undefined;
      const className = classId ? classNameById.get(classId) : undefined;
      const list = existingByNameDob.get(key) ?? [];
      list.push(className ?? "class unknown");
      existingByNameDob.set(key, list);
    }
    const seenNameDobInFile = new Set<string>();

    const seenAdmissionNumbersInFile = new Set<string>();
    // Phase 6 (Module 10): admission numbers were already checked for
    // duplicates *within the same file*, but EMIS numbers (also meant to
    // be unique, per GES's own numbering) were only checked against
    // students already in the database - two rows sharing an EMIS number
    // within one import file went undetected. Mirrors the same pattern.
    const seenEmisNumbersInFile = new Set<string>();

    const validRows: ValidatedRow[] = [];
    const invalidRows: ValidatedRow[] = [];
    let duplicateCount = 0;

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // account for header row
      const errors: string[] = [];
      const mapped: Record<string, string> = {};

      for (const field of Object.keys(mapping)) {
        const header = mapping[field];
        mapped[field] = header ? String(row[header] ?? "").trim() : "";
      }

      for (const requiredField of REQUIRED_IMPORT_FIELDS) {
        if (!mapped[requiredField]) {
          errors.push(`Missing required value for "${requiredField}"`);
        }
      }

      const genderValue = mapped.gender?.toUpperCase();
      if (genderValue && genderValue !== "M" && genderValue !== "F") {
        errors.push('Gender must be "M" or "F"');
      }

      if (mapped.dateOfBirth && Number.isNaN(new Date(mapped.dateOfBirth).getTime())) {
        errors.push("Date of birth is not a valid date");
      }
      if (mapped.dateOfBirth && new Date(mapped.dateOfBirth) > new Date()) {
        errors.push("Date of birth cannot be in the future");
      }
      if (mapped.admissionDate && Number.isNaN(new Date(mapped.admissionDate).getTime())) {
        errors.push("Admission date is not a valid date");
      }

      if (mapped.firstName && mapped.lastName && mapped.dateOfBirth) {
        const key = nameDobKey(mapped.firstName, mapped.lastName, mapped.dateOfBirth);
        if (key) {
          const existingMatch = existingByNameDob.get(key);
          if (existingMatch) {
            errors.push(
              `Likely duplicate: "${mapped.firstName} ${mapped.lastName}" (same date of birth) already exists in the system, currently in ${existingMatch.join(", ")}. Remove this row if already imported, or fix the name/date of birth if this is a different student.`,
            );
            duplicateCount++;
          } else if (seenNameDobInFile.has(key)) {
            errors.push(
              `Likely duplicate: another row earlier in this file has the same name and date of birth ("${mapped.firstName} ${mapped.lastName}").`,
            );
            duplicateCount++;
          } else {
            seenNameDobInFile.add(key);
          }
        }
      }

      const admissionKey = mapped.admissionNumber.toLowerCase();
      if (admissionKey) {
        if (existingAdmissionNumbers.has(admissionKey)) {
          errors.push(`Admission number "${mapped.admissionNumber}" already exists in the system`);
          duplicateCount++;
        } else if (seenAdmissionNumbersInFile.has(admissionKey)) {
          errors.push(`Admission number "${mapped.admissionNumber}" is duplicated within this file`);
          duplicateCount++;
        } else {
          seenAdmissionNumbersInFile.add(admissionKey);
        }
      }

      const emisKey = mapped.emisNumber?.toLowerCase();
      if (emisKey) {
        if (existingEmisNumbers.has(emisKey)) {
          errors.push(`EMIS number "${mapped.emisNumber}" already exists in the system`);
          duplicateCount++;
        } else if (seenEmisNumbersInFile.has(emisKey)) {
          errors.push(`EMIS number "${mapped.emisNumber}" is duplicated within this file`);
          duplicateCount++;
        } else {
          seenEmisNumbersInFile.add(emisKey);
        }
      }

      // Catch an unresolvable Level/Class/Academic Year right here in
      // the preview step - previously this was only checked at commit
      // time, so a row could show as "valid" in the review screen and
      // then be silently skipped (no student created, no error shown
      // anywhere the teacher would see) the moment Import was clicked.
      if (mapped.levelCode && mapped.classCode && mapped.academicYearLabel) {
        const resolved = resolveRowTargets(mapped, levels, classes, years);
        if (resolved.error) errors.push(resolved.error);
      }

      const entry: ValidatedRow = { rowNumber, data: mapped, errors };
      if (errors.length === 0) validRows.push(entry);
      else invalidRows.push(entry);
    });

    return { validRows, invalidRows, duplicateCount };
  }

  /** Commits only the already-validated rows. Level/class/academic year
   *  are resolved by case-insensitive code/label match at commit time so
   *  the wizard can show a clear per-row error if a spreadsheet refers to
   *  a level/class that doesn't exist yet in Settings. */
  async commitImport(fileName: string, validRows: ValidatedRow[], defaultTermId: number): Promise<ImportLogEntry> {
    const [levels, classes, years] = await Promise.all([
      db.levels.toArray(),
      db.classes.toArray(),
      db.academicYears.toArray(),
    ]);

    const errors: ImportError[] = [];
    let successCount = 0;

    for (const row of validRows) {
      const resolved = resolveRowTargets(row.data, levels, classes, years);
      const { level, cls, year } = resolved;

      if (!level || !cls || !year) {
        errors.push({ row: row.rowNumber, message: resolved.error ?? "Could not resolve level/class/academic year." });
        continue;
      }

      try {
        const studentId = await StudentIdService.generateNext();
        const now = new Date().toISOString();
        const newId = await db.students.add({
          studentId,
          admissionNumber: row.data.admissionNumber || undefined,
          emisNumber: row.data.emisNumber || undefined,
          firstName: row.data.firstName,
          middleName: row.data.middleName || undefined,
          lastName: row.data.lastName,
          preferredName: row.data.preferredName || undefined,
          gender: row.data.gender.toUpperCase() as Sex,
          dateOfBirth: row.data.dateOfBirth,
          nationality: row.data.nationality,
          academicYearOfAdmissionId: year.id!,
          admissionDate: row.data.admissionDate || undefined,
          previousSchool: row.data.previousSchool || undefined,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
        } as any);

        await GuardianService.upsertForStudent(newId as number, {
          fullName: row.data.guardianFullName,
          relationship: row.data.guardianRelationship,
          phone: row.data.guardianPhone,
          email: row.data.guardianEmail || undefined,
        });

        await EnrollmentService.assignClass(newId as number, {
          termId: defaultTermId,
          levelId: level.id!,
          classId: cls.id!,
          enrollmentDate: row.data.admissionDate || now.slice(0, 10),
          remarks: `Imported from ${fileName}`,
        });

        successCount++;
      } catch (err) {
        errors.push({ row: row.rowNumber, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    const log: Omit<ImportLogEntry, "id"> = {
      fileName,
      importedAt: new Date().toISOString(),
      totalRows: validRows.length,
      successCount,
      errorCount: errors.length,
      duplicateCount: 0,
      errors,
    };
    const id = await db.importLogs.add(log as ImportLogEntry);
    return { ...log, id } as ImportLogEntry;
  }
}

export const ImportService = new ImportServiceImpl();
