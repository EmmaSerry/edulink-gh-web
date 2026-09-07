/**
 * Cloud (Supabase-backed) replacement for src/services/TermService.ts.
 *
 * Read side (list/getActive) is what Student Registration and other
 * screens need. create()/setActive()/update() back the Settings ->
 * Terms screen - create() and setActive() call RPCs
 * (edulink_gh_phase0k_settings.sql) so "only one term can be active"
 * stays true even when two people edit at once; update() is a plain
 * PATCH since editing dates doesn't touch that invariant.
 */
import { rest } from "@/lib/supabaseClient";
import type { TermRow } from "@/types/database";

export interface CreateTermInput {
  schoolId: string;
  academicYearId: string;
  termName: string;
  termNumber: 1 | 2 | 3;
  openingDate: string | null;
  closingDate: string | null;
  vacationDate: string | null;
  reopeningDate: string | null;
  totalSchoolDays: number | null;
  makeActive: boolean;
}

export interface UpdateTermInput {
  termName: string;
  openingDate: string | null;
  closingDate: string | null;
  vacationDate: string | null;
  reopeningDate: string | null;
  totalSchoolDays: number | null;
}

class CloudTermServiceImpl {
  /** schoolId only strictly needed when academicYearId is omitted -
   *  see the same note on ClassService.list(). Always pass
   *  profile.school_id when you have one. */
  async list(academicYearId?: string, schoolId?: string | null): Promise<TermRow[]> {
    const filters: Record<string, string> = {};
    if (academicYearId) filters.academic_year_id = `eq.${academicYearId}`;
    if (schoolId) filters.school_id = `eq.${schoolId}`;
    return rest.select<TermRow>("terms", { filters, order: "term_number.asc" });
  }

  async getActive(schoolId?: string | null): Promise<TermRow | null> {
    const filters: Record<string, string> = { is_active: "eq.true" };
    if (schoolId) filters.school_id = `eq.${schoolId}`;
    const rows = await rest.select<TermRow>("terms", { filters, limit: 1 });
    return rows[0] ?? null;
  }

  async create(input: CreateTermInput): Promise<TermRow> {
    return rest.rpc<TermRow>("create_term", {
      p_school_id: input.schoolId,
      p_academic_year_id: input.academicYearId,
      p_term_name: input.termName,
      p_term_number: input.termNumber,
      p_opening_date: input.openingDate,
      p_closing_date: input.closingDate,
      p_vacation_date: input.vacationDate,
      p_reopening_date: input.reopeningDate,
      p_total_school_days: input.totalSchoolDays,
      p_make_active: input.makeActive,
    });
  }

  async setActive(termId: string): Promise<void> {
    await rest.rpc<void>("set_active_term", { p_term_id: termId });
  }

  async update(termId: string, input: UpdateTermInput): Promise<TermRow> {
    const rows = await rest.update<TermRow>(
      "terms",
      { id: `eq.${termId}` },
      {
        term_name: input.termName,
        opening_date: input.openingDate,
        closing_date: input.closingDate,
        vacation_date: input.vacationDate,
        reopening_date: input.reopeningDate,
        total_school_days: input.totalSchoolDays,
      }
    );
    return rows[0];
  }
}

export const CloudTermService = new CloudTermServiceImpl();
