import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { SchoolClass } from "@models/SchoolClass";
import { DeletionBlockedError } from "./AcademicYearService";

class ClassServiceImpl extends BaseRepository<SchoolClass> {
  constructor() {
    super(db.classes);
  }

  async remove(id: number): Promise<void> {
    // Phase 2 moved "what class is this student in" out of Student and
    // onto Enrollment (see docs/PHASE2_STUDENTS.md) - Student no longer
    // has a currentClassId field at all. A class can only be safely
    // deleted if no enrollment record, current or historical, still
    // points at it.
    // Phase 6 (Module 7 - performance): `classId` is an indexed field on
    // `enrollments` - use `.where()` instead of a full-table `.filter()`
    // scan, since this check runs on every class deletion attempt and the
    // enrollments table only grows over the school's lifetime.
    const linkedEnrollments = await db.enrollments.where("classId").equals(id).count();
    if (linkedEnrollments > 0) {
      throw new DeletionBlockedError(
        "This class has student enrollments (current or historical) linked to it and cannot be deleted.",
      );
    }
    await super.remove(id);
  }
}

export const ClassService = new ClassServiceImpl();
