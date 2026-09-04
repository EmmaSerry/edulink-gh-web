/**
 * Cloud (Supabase-backed) replacement for src/services/AcademicYearService.ts.
 *
 * Deliberately much smaller than the offline version: the offline
 * service is a full CRUD repository (create/update/delete academic
 * years, with delete-safety checks). Nothing in the cloud app needs to
 * manage academic years yet - the seed data already created the
 * school's first academic year - so this file only covers what
 * Student Registration (and future screens) actually need right now:
 * listing them, and finding the one marked current. A full
 * settings/CRUD screen can extend this file later without touching the
 * read side used here.
 */
import { rest } from "@/lib/supabaseClient";
import type { AcademicYearRow } from "@/types/database";

class CloudAcademicYearServiceImpl {
  async list(): Promise<AcademicYearRow[]> {
    return rest.select<AcademicYearRow>("academic_years", { order: "label.desc" });
  }

  async getCurrent(): Promise<AcademicYearRow | null> {
    const rows = await rest.select<AcademicYearRow>("academic_years", {
      filters: { is_current: "eq.true" },
      limit: 1,
    });
    return rows[0] ?? null;
  }
}

export const CloudAcademicYearService = new CloudAcademicYearServiceImpl();
