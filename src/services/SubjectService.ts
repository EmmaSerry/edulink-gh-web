import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Subject } from "@models/Subject";
import { DeletionBlockedError } from "./AcademicYearService";

class SubjectServiceImpl extends BaseRepository<Subject> {
  constructor() {
    super(db.subjects);
  }

  async remove(id: number): Promise<void> {
    const records = await db.scoreRecords.where("subjectId").equals(id).count();
    if (records > 0) {
      throw new DeletionBlockedError(
        "This subject has score records linked to it and cannot be deleted.",
      );
    }
    await super.remove(id);
  }
}

export const SubjectService = new SubjectServiceImpl();
