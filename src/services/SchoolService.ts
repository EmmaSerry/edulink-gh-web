import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { School } from "@models/School";

/**
 * Most schools running ACTRS configure exactly one School profile
 * (Module 1), so this service exposes a convenience `getProfile()` /
 * `saveProfile()` pair on top of the generic CRUD methods rather than
 * requiring the UI to know the record's id.
 */
class SchoolServiceImpl extends BaseRepository<School> {
  constructor() {
    super(db.schools);
  }

  async getProfile(): Promise<School | undefined> {
    return db.schools.toCollection().first();
  }

  async saveProfile(data: Omit<School, "id" | "createdAt" | "updatedAt">): Promise<number> {
    const now = new Date().toISOString();
    const existing = await this.getProfile();
    if (existing?.id) {
      await this.update(existing.id, { ...data, updatedAt: now } as Partial<School>);
      return existing.id;
    }
    return this.create({ ...data, createdAt: now, updatedAt: now } as Omit<School, "id">);
  }
}

export const SchoolService = new SchoolServiceImpl();
