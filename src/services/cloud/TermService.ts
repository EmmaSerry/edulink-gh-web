/**
 * Cloud (Supabase-backed) replacement for src/services/TermService.ts.
 *
 * Same scope reduction as CloudAcademicYearService - read-only for now
 * (list a school's terms, find the one marked active). The offline
 * version's delete-safety checks (does this term already have scores,
 * enrollments, archives, etc. linked to it) only matter once there is a
 * cloud CRUD screen for terms to protect; that's future settings work,
 * not something Student Registration needs today.
 */
import { rest } from "@/lib/supabaseClient";
import type { TermRow } from "@/types/database";

class CloudTermServiceImpl {
  async list(academicYearId?: string): Promise<TermRow[]> {
    return rest.select<TermRow>("terms", {
      filters: academicYearId ? { academic_year_id: `eq.${academicYearId}` } : undefined,
      order: "term_number.asc",
    });
  }

  async getActive(): Promise<TermRow | null> {
    const rows = await rest.select<TermRow>("terms", {
      filters: { is_active: "eq.true" },
      limit: 1,
    });
    return rows[0] ?? null;
  }
}

export const CloudTermService = new CloudTermServiceImpl();
