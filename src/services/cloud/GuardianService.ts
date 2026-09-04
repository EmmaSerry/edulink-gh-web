/**
 * Cloud (Supabase-backed) replacement for src/services/GuardianService.ts.
 * Also no new SQL needed - guardians already exists with the right
 * grants and RLS from the Phase 0 migrations.
 */

import { rest } from "@/lib/supabaseClient";
import type { GuardianRow } from "@/types/database";

class CloudGuardianServiceImpl {
  async getByStudentId(studentId: string): Promise<GuardianRow | null> {
    const rows = await rest.select<GuardianRow>("guardians", {
      filters: { student_id: `eq.${studentId}` },
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async upsertForStudent(
    studentId: string,
    schoolId: string,
    data: Omit<Partial<GuardianRow>, "id" | "student_id" | "school_id">
  ): Promise<GuardianRow> {
    const existing = await this.getByStudentId(studentId);
    if (existing) {
      const rows = await rest.update<GuardianRow>("guardians", { id: `eq.${existing.id}` }, data);
      return rows[0];
    }
    const rows = await rest.insert<GuardianRow>("guardians", {
      ...data,
      student_id: studentId,
      school_id: schoolId,
    });
    return rows[0];
  }
}

export const CloudGuardianService = new CloudGuardianServiceImpl();
