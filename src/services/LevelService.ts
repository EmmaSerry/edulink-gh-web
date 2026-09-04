import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Level } from "@models/Level";
import { DeletionBlockedError } from "./AcademicYearService";

class LevelServiceImpl extends BaseRepository<Level> {
  constructor() {
    super(db.levels);
  }

  async remove(id: number): Promise<void> {
    // Students are never linked to a Level directly (Phase 2 removed
    // Student.currentClassId in favour of Enrollment), so classes,
    // subjects, learning areas and skills are the only referential
    // integrity checks a Level needs; a class-level delete already
    // blocks on enrollments (see ClassService.remove).
    const [classes, subjects, learningAreas, skills] = await Promise.all([
      db.classes.where("levelId").equals(id).count(),
      db.subjects.where("levelIds").equals(id).count(),
      db.learningAreas.where("levelIds").equals(id).count(),
      db.skills.where("levelId").equals(id).count(),
    ]);
    if (classes + subjects + learningAreas + skills > 0) {
      throw new DeletionBlockedError(
        "This level is linked to classes, subjects, learning areas or skills and cannot be deleted. Remove those first.",
      );
    }
    await super.remove(id);
  }
}

export const LevelService = new LevelServiceImpl();
