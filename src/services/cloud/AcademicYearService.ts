/**
 * Cloud (Supabase-backed) replacement for src/services/AcademicYearService.ts.
 *
 * Read side (list/getCurrent) is what Student Registration and other
 * screens need. create()/setCurrent()/update() back the Settings ->
 * Academic Years screen - create() and setCurrent() call RPCs
 * (edulink_gh_phase0k_settings.sql) so "only one year can be current"
 * stays true even when two people edit at once; update() is a plain
 * PATCH since editing a label doesn't touch that invariant.
 */
import { rest } from "@/lib/supabaseClient";
import type { AcademicYearRow } from "@/types/database";

class CloudAcademicYearServiceImpl {
  /** schoolId matters once more than one school exists - see the same
   *  note on ClassService.list(). Always pass profile.school_id. */
  async list(schoolId?: string | null): Promise<AcademicYearRow[]> {
    return rest.select<AcademicYearRow>("academic_years", {
      filters: schoolId ? { school_id: `eq.${schoolId}` } : undefined,
      order: "label.desc",
    });
  }

  async getCurrent(schoolId?: string | null): Promise<AcademicYearRow | null> {
    const filters: Record<string, string> = { is_current: "eq.true" };
    if (schoolId) filters.school_id = `eq.${schoolId}`;
    const rows = await rest.select<AcademicYearRow>("academic_years", { filters, limit: 1 });
    return rows[0] ?? null;
  }

  async create(schoolId: string, label: string, makeCurrent: boolean): Promise<AcademicYearRow> {
    return rest.rpc<AcademicYearRow>("create_academic_year", {
      p_school_id: schoolId,
      p_label: label,
      p_make_current: makeCurrent,
    });
  }

  async setCurrent(academicYearId: string): Promise<void> {
    await rest.rpc<void>("set_current_academic_year", { p_academic_year_id: academicYearId });
  }

  async update(academicYearId: string, label: string): Promise<AcademicYearRow> {
    const rows = await rest.update<AcademicYearRow>("academic_years", { id: `eq.${academicYearId}` }, { label });
    return rows[0];
  }
}

export const CloudAcademicYearService = new CloudAcademicYearServiceImpl();
