/**
 * Cloud (Supabase-backed) replacement for the offline app's class
 * lookup. Read-only, same reasoning as the other lookup services in
 * this batch (AcademicYearService, TermService, LevelService).
 */
import { rest } from "@/lib/supabaseClient";
import type { ClassRow, UserProfileRow } from "@/types/database";

class CloudClassServiceImpl {
  async list(levelId?: string): Promise<ClassRow[]> {
    return rest.select<ClassRow>("classes", {
      filters: levelId ? { is_active: "eq.true", level_id: `eq.${levelId}` } : { is_active: "eq.true" },
      order: "name.asc",
    });
  }

  /**
   * A teacher only ever needs to pick from the class(es) they're
   * actually assigned to (class_teacher_id) - everyone else (school
   * admin, district admin, bursar) still sees every class. This is a
   * UI-level narrowing to match what the server now also enforces
   * (see edulink_gh_phase0l_role_access.sql): a teacher can't act on a
   * class they don't own even if they somehow picked it, but there's
   * no reason to show it as a choice in the first place.
   */
  forRole(classes: ClassRow[], profile: UserProfileRow | null): ClassRow[] {
    if (!profile || profile.role !== "teacher") return classes;
    return classes.filter((c) => c.class_teacher_id === profile.id);
  }
}

export const CloudClassService = new CloudClassServiceImpl();
