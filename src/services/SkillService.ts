import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Skill } from "@models/Skill";
import { DeletionBlockedError } from "./AcademicYearService";

class SkillServiceImpl extends BaseRepository<Skill> {
  constructor() {
    super(db.skills);
  }

  async remove(id: number): Promise<void> {
    const records = await db.skillAssessmentRecords.where("skillId").equals(id).count();
    if (records > 0) {
      throw new DeletionBlockedError(
        "This skill already has assessment records linked to it and cannot be deleted.",
      );
    }
    await super.remove(id);
  }
}

export const SkillService = new SkillServiceImpl();
