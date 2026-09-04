/**
 * Cloud (Supabase-backed) replacement for src/services/SchoolService.ts.
 *
 * No new SQL needed for this one - the schools table and its grants
 * already exist from earlier migrations. getProfile() relies on Row
 * Level Security to do the same job the offline version did by
 * convention: the offline app assumed "there's only ever one school
 * row"; the cloud version instead has many schools in one shared
 * table, but RLS means a plain "give me the school row(s) I can see"
 * query naturally returns just the caller's own school - so the "one
 * school" simplicity for a School Admin's own settings screen carries
 * over without this file needing to know anything about tenancy.
 */

import { rest } from "@/lib/supabaseClient";
import type { SchoolRow } from "@/types/database";

class CloudSchoolServiceImpl {
  async getProfile(): Promise<SchoolRow | null> {
    const rows = await rest.select<SchoolRow>("schools", { limit: 1 });
    return rows[0] ?? null;
  }

  async saveProfile(schoolId: string, data: Partial<SchoolRow>): Promise<SchoolRow> {
    const rows = await rest.update<SchoolRow>("schools", { id: `eq.${schoolId}` }, data);
    return rows[0];
  }
}

export const CloudSchoolService = new CloudSchoolServiceImpl();
