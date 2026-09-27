/**
 * Cloud (Supabase-backed) replacement for the offline app's subject
 * lookup. listForLevel() is read-only, used by Assessment Entry to
 * list which subjects apply to one level. create()/update()/setActive()
 * back the new Settings -> Subjects screen - see
 * edulink_gh_subjects_management.sql. "Remove" never hard-deletes a
 * subject (setActive(id, false)) - see that migration's own notes for
 * why, same historical-integrity reasoning as everything else archived
 * rather than deleted in this app.
 */
import { rest } from "@/lib/supabaseClient";
import type { SubjectRow } from "@/types/database";

export interface SaveSubjectInput {
  name: string;
  shortName: string;
  code: string;
  levelIds: string[];
  sortOrder?: number | null;
}

class CloudSubjectServiceImpl {
  /** All active subjects that apply to a given level, in display order. */
  async listForLevel(levelId: string): Promise<SubjectRow[]> {
    const all = await rest.select<SubjectRow>("subjects", {
      filters: { is_active: "eq.true" },
      order: "sort_order.asc",
    });
    return all.filter((s) => s.level_ids.includes(levelId));
  }

  /** Every subject at the caller's own school, active or not, in
   *  display order - used by Settings -> Subjects, which needs to show
   *  (and let someone restore) a removed subject too, not just active
   *  ones. */
  async listAll(): Promise<SubjectRow[]> {
    return rest.select<SubjectRow>("subjects", { order: "sort_order.asc" });
  }

  async create(input: SaveSubjectInput): Promise<SubjectRow> {
    return rest.rpc<SubjectRow>("create_school_subject", {
      p_name: input.name,
      p_short_name: input.shortName,
      p_code: input.code,
      p_level_ids: input.levelIds,
      p_sort_order: input.sortOrder ?? null,
    });
  }

  async update(subjectId: string, input: SaveSubjectInput): Promise<SubjectRow> {
    return rest.rpc<SubjectRow>("update_school_subject", {
      p_subject_id: subjectId,
      p_name: input.name,
      p_short_name: input.shortName,
      p_code: input.code,
      p_level_ids: input.levelIds,
      p_sort_order: input.sortOrder ?? null,
    });
  }

  /** Pass isActive = false to remove a subject (never a hard delete -
   *  see the migration notes), true to restore a previously removed one. */
  async setActive(subjectId: string, isActive: boolean): Promise<SubjectRow> {
    return rest.rpc<SubjectRow>("set_subject_active", {
      p_subject_id: subjectId,
      p_is_active: isActive,
    });
  }
}

export const CloudSubjectService = new CloudSubjectServiceImpl();
