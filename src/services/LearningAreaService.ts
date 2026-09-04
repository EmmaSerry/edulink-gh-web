import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { LearningArea } from "@models/LearningArea";
import { DeletionBlockedError } from "./AcademicYearService";

class LearningAreaServiceImpl extends BaseRepository<LearningArea> {
  constructor() {
    super(db.learningAreas);
  }

  async remove(id: number): Promise<void> {
    const skills = await db.skills.where("learningAreaId").equals(id).count();
    if (skills > 0) {
      throw new DeletionBlockedError(
        "This learning area has skills linked to it and cannot be deleted. Remove its skills first.",
      );
    }
    await super.remove(id);
  }
}

export const LearningAreaService = new LearningAreaServiceImpl();
