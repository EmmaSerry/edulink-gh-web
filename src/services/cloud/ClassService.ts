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
  /**
   * schoolId matters more than it looks - this table has no per-school
   * filter baked in anywhere else, so without it the query relies
   * entirely on row-level security to narrow the result to "your
   * school". That's fine for a school_admin/teacher/bursar (their own
   * school is all RLS ever lets them see), but a district_admin or
   * platform_admin's RLS is deliberately broader (they're allowed to
   * see every school), so on a single-school screen like Settings ->
   * Classes or SMS to parents, omitting schoolId used to silently
   * return every school's classes mixed together once more than one
   * school existed - two schools sharing the same default class names
   * (Basic 1, JHS 1, etc.) then looked like each class appearing
   * "twice". Always pass the caller's own profile.school_id here.
   */
  async list(levelId?: string, schoolId?: string | null): Promise<ClassRow[]> {
    const filters: Record<string, string> = { is_active: "eq.true" };
    if (levelId) filters.level_id = `eq.${levelId}`;
    if (schoolId) filters.school_id = `eq.${schoolId}`;
    return rest.select<ClassRow>("classes", { filters, order: "name.asc" });
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
