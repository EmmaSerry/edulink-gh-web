import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { AcademicYear } from "@models/AcademicYear";

export class DeletionBlockedError extends Error {}

class AcademicYearServiceImpl extends BaseRepository<AcademicYear> {
  constructor() {
    super(db.academicYears);
  }

  /** Only one academic year may be marked current at a time. */
  async setCurrent(id: number): Promise<void> {
    await db.transaction("rw", db.academicYears, async () => {
      const all = await db.academicYears.toArray();
      await Promise.all(
        all.map((y) =>
          db.academicYears.update(y.id!, { isCurrent: y.id === id }),
        ),
      );
    });
  }

  async remove(id: number): Promise<void> {
    const linkedTerms = await db.terms.where("academicYearId").equals(id).count();
    if (linkedTerms > 0) {
      throw new DeletionBlockedError(
        "This academic year has terms linked to it and cannot be deleted. Delete its terms first.",
      );
    }
    await super.remove(id);
  }
}

export const AcademicYearService = new AcademicYearServiceImpl();
