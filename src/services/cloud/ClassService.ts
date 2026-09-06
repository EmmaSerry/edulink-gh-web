/**
 * Cloud (Supabase-backed) replacement for the offline app's class
 * lookup. list()/forRole() are read-only, used everywhere a class
 * picker appears. create()/assignTeacher() back the new Settings ->
 * Classes screen - see edulink_gh_phase0o_staff_and_classes.sql.
 */
import { rest } from "@/lib/supabaseClient";
import type { ClassRow, UserProfileRow } from "@/types/database";

export interface CreateClassInput {
  schoolId: string;
  levelId: string;
  name: string;
  code: string;
  capacity: number | null;
}

class CloudClassServiceImpl {
  async list(levelId?: string): Promise<ClassRow[]> {
    return rest.select<ClassRow>("classes", {
      filters: levelId ? { is_active: "eq.true", level_id: `eq.${levelId}` } : { is_active: "eq.true" },
      order: "name.asc",
    });
  }

  /** Includes inactive classes too - unlike list(), a promotion/history
   *  screen still needs to resolve a class that's since been archived. */
  async getById(classId: string): Promise<ClassRow | null> {
    const rows = await rest.select<ClassRow>("classes", {
      filters: { id: `eq.${classId}` },
      limit: 1,
    });
    return rows[0] ?? null;
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

  async create(input: CreateClassInput): Promise<ClassRow> {
    return rest.rpc<ClassRow>("create_class", {
      p_school_id: input.schoolId,
      p_level_id: input.levelId,
      p_name: input.name,
      p_code: input.code,
      p_capacity: input.capacity,
    });
  }

  /** Pass teacherUserId = null to unassign a class's teacher. */
  async assignTeacher(classId: string, teacherUserId: string | null): Promise<ClassRow> {
    return rest.rpc<ClassRow>("assign_class_teacher", {
      p_class_id: classId,
      p_teacher_user_id: teacherUserId,
    });
  }
}

export const CloudClassService = new CloudClassServiceImpl();
