import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Student, StudentStatus } from "@models/Student";
import { getFullName } from "@models/Student";
import { StudentIdService } from "./StudentIdService";
import { EnrollmentService } from "./EnrollmentService";
import type { StudentFormValues } from "@validation/studentSchema";

export interface StudentFilterCriteria {
  academicYearId?: number;
  termId?: number;
  levelId?: number;
  classId?: number;
  gender?: "M" | "F";
  status?: StudentStatus;
  admissionYearId?: number;
  minAge?: number;
  maxAge?: number;
}

class StudentServiceImpl extends BaseRepository<Student> {
  constructor() {
    super(db.students);
  }

  /**
   * Registers a new student: generates the permanent Student ID, creates
   * the Student identity row, the primary Guardian row, and the initial
   * Enrollment row (Module 1 + the Enrollment-entity enhancement) - all
   * inside one transaction so a failure partway never leaves an orphaned
   * student with no guardian/placement.
   */
  async register(values: StudentFormValues): Promise<number> {
    const now = new Date().toISOString();

    // This transaction's table list must cover every table touched by
    // ANYTHING called from inside it, not just the direct db.*.add()
    // calls below - Dexie throws if code running inside an active
    // transaction ever touches a table that wasn't declared up front,
    // even via a service method several layers down. This was missing
    // `db.settings` (read/written by StudentIdService.generateNext(),
    // for the permanent Student ID counter) and `db.archives` (read by
    // ArchiveService.assertTermEditable(), called from
    // EnrollmentService.assignClass() to block enrolling into a closed
    // term) - a genuine defect that could only ever surface against a
    // real IndexedDB database, which is exactly why it went undetected
    // until now.
    // Dexie's individual-table-arguments overload of transaction() only
    // accepts up to 5 tables (a real, compiler-enforced limit - the
    // array form below has no such cap) - 6 tables here overflowed it.
    return db.transaction(
      "rw",
      [db.students, db.guardians, db.enrollments, db.terms, db.settings, db.archives],
      async () => {
      const studentId = await StudentIdService.generateNext();
      // Admission date is optional on the Student record (the school may
      // not have it on hand), but Enrollment.enrollmentDate is not - it
      // is the "since when is this student in this class" anchor used
      // for promotion history and roster ordering. Default it to today
      // when no admission date was given, without ever fabricating one
      // on the permanent Student record itself.
      const enrollmentDate = values.admissionDate || now.slice(0, 10);

      const newStudentId = await db.students.add({
        studentId,
        admissionNumber: values.admissionNumber || undefined,
        emisNumber: values.emisNumber || undefined,
        ghanaCardNumber: values.ghanaCardNumber || undefined,
        firstName: values.firstName,
        middleName: values.middleName || undefined,
        lastName: values.lastName,
        preferredName: values.preferredName || undefined,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth,
        nationality: values.nationality,
        specialEducationalNeeds: values.specialEducationalNeeds || undefined,
        academicYearOfAdmissionId: values.academicYearOfAdmissionId,
        admissionDate: values.admissionDate || undefined,
        previousSchool: values.previousSchool || undefined,
        boardingStatus: values.boardingStatus,
        status: values.status,
        createdAt: now,
        updatedAt: now,
      } as Student);

      await db.guardians.add({
        studentId: newStudentId,
        fullName: values.guardianFullName,
        relationship: values.guardianRelationship,
        phone: values.guardianPhone,
        alternativePhone: values.guardianAlternativePhone || undefined,
        email: values.guardianEmail || undefined,
        occupation: values.guardianOccupation || undefined,
        residentialAddress: values.guardianResidentialAddress || undefined,
        digitalAddress: values.guardianDigitalAddress || undefined,
        emergencyContactName: values.guardianEmergencyContactName || undefined,
        emergencyContactPhone: values.guardianEmergencyContactPhone || undefined,
        createdAt: now,
        updatedAt: now,
      });

      await EnrollmentService.assignClass(newStudentId, {
        termId: values.termId,
        levelId: values.levelId,
        classId: values.classId,
        enrollmentDate,
        remarks: "Initial enrollment at registration",
      });

      return newStudentId;
    });
  }

  /** Updates the permanent record only - never touches placement/guardian. */
  async updateStudent(id: number, values: Partial<Student>): Promise<void> {
    await this.update(id, { ...values, updatedAt: new Date().toISOString() });
  }

  /** The Module 1 "soft delete": changes status instead of removing the
   *  row. Every status except ACTIVE hides the student from default
   *  active lists while the full record is retained. */
  async updateStatus(id: number, status: StudentStatus, reason?: string): Promise<void> {
    await this.update(id, {
      status,
      statusReason: reason,
      statusChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Module 15 - genuine, permanent hard delete. Deliberately separate
   * from updateStatus() above: a real student who has left the school
   * (graduated, transferred, withdrawn) should ALWAYS use updateStatus()
   * instead, so their historical academic record is retained - that is
   * the entire point of the status model. This method exists for the
   * other case: a duplicate entered by mistake, or a test/example
   * record used to try the system out before real onboarding, that
   * should never have existed as a record at all.
   *
   * Removes the student and every row anywhere in the database that
   * references them by studentId - guardian, enrollment history,
   * promotion history, photos, scores, skill ratings, teacher remarks
   * (ReportRecord), generated reports and their version history, and
   * print/export logs - in one transaction, so a failure partway never
   * leaves orphaned rows referencing a student that no longer exists.
   * Deliberately does NOT touch assessmentSessions (keyed by class+term,
   * shared by every student in that class) or auditLogs (keyed by
   * assessmentSessionId, a record of what happened to the SESSION, not
   * to any one student).
   *
   * There is no confirmation step in this method itself - the caller
   * (see StudentProfile.tsx / Students.tsx) is responsible for that,
   * since this is deliberately irreversible and by design leaves no
   * trace of the deleted student anywhere, including in exports/backups
   * taken after this point.
   */
  async deleteStudent(id: number): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.students,
        db.guardians,
        db.enrollments,
        db.promotionHistory,
        db.studentPhotos,
        db.scoreRecords,
        db.skillAssessmentRecords,
        db.reportRecords,
        db.generatedReports,
        db.reportVersions,
        db.printLogs,
        db.exportLogs,
      ],
      async () => {
        await db.guardians.where("studentId").equals(id).delete();
        await db.enrollments.where("studentId").equals(id).delete();
        await db.promotionHistory.where("studentId").equals(id).delete();
        await db.studentPhotos.where("studentId").equals(id).delete();
        await db.scoreRecords.where("studentId").equals(id).delete();
        await db.skillAssessmentRecords.where("studentId").equals(id).delete();
        await db.reportRecords.where("studentId").equals(id).delete();
        await db.generatedReports.where("studentId").equals(id).delete();
        await db.reportVersions.where("studentId").equals(id).delete();
        await db.printLogs.where("studentId").equals(id).delete();
        await db.exportLogs.where("studentId").equals(id).delete();
        await db.students.delete(id);
      },
    );
  }

  /** Bulk version of deleteStudent() for the Students list's multi-select
   *  toolbar - sequential rather than one giant transaction so a single
   *  bad id can't roll back deletions that already succeeded, and so the
   *  UI can report a partial-success count if that ever happens. */
  async deleteMany(ids: number[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await this.deleteStudent(id);
        deleted++;
      } catch (err) {
        console.error(`Could not delete student #${id}`, err);
        failed++;
      }
    }
    return { deleted, failed };
  }

  /** Module 5 - instant, partial-match search across every field listed
   *  in the brief. Parent name/phone and class/level require a join
   *  against Guardian/Enrollment, so this method accepts pre-joined rows
   *  from the caller (see useStudentDirectory hook) for performance
   *  rather than re-querying per keystroke. */
  matchesSearch(
    student: Student,
    query: string,
    guardianName?: string,
    guardianPhone?: string,
    className?: string,
    levelName?: string,
  ): boolean {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const haystack = [
      student.studentId,
      student.admissionNumber ?? "",
      student.emisNumber ?? "",
      getFullName(student),
      guardianName ?? "",
      guardianPhone ?? "",
      className ?? "",
      levelName ?? "",
      student.gender,
      student.status,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  }
}

export const StudentService = new StudentServiceImpl();
