import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { Guardian } from "@models/Guardian";

class GuardianServiceImpl extends BaseRepository<Guardian> {
  constructor() {
    super(db.guardians);
  }

  async getByStudentId(studentId: number): Promise<Guardian | undefined> {
    return db.guardians.where("studentId").equals(studentId).first();
  }

  async upsertForStudent(studentId: number, data: Omit<Guardian, "id" | "studentId" | "createdAt" | "updatedAt">): Promise<number> {
    const now = new Date().toISOString();
    const existing = await this.getByStudentId(studentId);
    if (existing?.id) {
      await this.update(existing.id, { ...data, updatedAt: now } as Partial<Guardian>);
      return existing.id;
    }
    return this.create({ ...data, studentId, createdAt: now, updatedAt: now } as Omit<Guardian, "id">) as Promise<number>;
  }
}

export const GuardianService = new GuardianServiceImpl();
